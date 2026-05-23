import os
import sys
import json
import re
import subprocess
import tempfile
import time
from pathlib import Path
from datetime import datetime

from google import genai
from google.genai import types

API_KEY = os.environ.get("GEMINI_API_KEY", "")

ICLOUD_BASE = Path(r"C:\Users\ericb\iCloudPhotos\Shared")

TRIP_FOLDERS = {
    "2023 - Raja Ampat": "Raja Ampat, Indonesia",
    "2023 - Thailand Liveaboard": "Thailand liveaboard, Similan Islands",
    "Cayman 2026": "Grand Cayman, Caribbean",
    "Eric Hawaii": "Hawaii",
    "Indonesia_Vietnam 2022": "Indonesia & Vietnam",
    "Islas Del Rosario Diving": "Islas del Rosario, Colombia",
}

VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".m4v"}
MODEL_NAME = "gemini-2.5-flash"

PROMPT = """Underwater diving video frame from {trip_context}. Give a short descriptive title (under 50 chars, Title Case). Focus on the main subject: species name, reef feature, or activity. If NOT underwater, prefix "Surface - ". Return ONLY the title."""

GEN_CONFIG = types.GenerateContentConfig(
    thinking_config=types.ThinkingConfig(thinking_budget=0),
    max_output_tokens=30,
)


def get_video_duration(video_path: Path) -> float:
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(video_path)],
        capture_output=True, text=True
    )
    try:
        return float(result.stdout.strip())
    except ValueError:
        return 10.0


def extract_single_frame(video_path: Path, tmp_dir: Path) -> Path | None:
    duration = get_video_duration(video_path)
    out_path = tmp_dir / "frame.jpg"
    subprocess.run(
        ["ffmpeg", "-y", "-ss", str(duration * 0.5), "-i", str(video_path),
         "-frames:v", "1", "-q:v", "3", "-vf", "scale=512:-1", str(out_path)],
        capture_output=True, timeout=30
    )
    if out_path.exists() and out_path.stat().st_size > 0:
        return out_path
    return None


def classify_video(client, frame_path: Path, trip_context: str) -> str:
    contents = [
        PROMPT.format(trip_context=trip_context),
        types.Part.from_bytes(data=frame_path.read_bytes(), mime_type="image/jpeg"),
    ]
    response = client.models.generate_content(
        model=MODEL_NAME, contents=contents, config=GEN_CONFIG,
    )
    return response.text.strip().strip('"').strip("'")


def sanitize_filename(title: str) -> str:
    sanitized = re.sub(r'[<>:"/\\|?*]', '', title)
    sanitized = re.sub(r'\s+', ' ', sanitized).strip()
    return sanitized[:80]


def rename_video(video_path: Path, new_title: str) -> Path:
    safe_title = sanitize_filename(new_title)
    new_name = f"{safe_title}{video_path.suffix}"
    new_path = video_path.parent / new_name

    if new_path.exists():
        counter = 2
        while new_path.exists():
            new_name = f"{safe_title} ({counter}){video_path.suffix}"
            new_path = video_path.parent / new_name
            counter += 1

    video_path.rename(new_path)
    return new_path


def is_hash_filename(name: str) -> bool:
    return bool(re.match(r'^[0-9a-f]{30,}', name))


def discover_videos() -> list[tuple[Path, str]]:
    videos = []
    for folder_name, context in TRIP_FOLDERS.items():
        folder_path = ICLOUD_BASE / folder_name
        if not folder_path.exists():
            print(f"  SKIP folder: {folder_name} (not found)")
            continue
        count = 0
        for f in sorted(folder_path.iterdir()):
            if f.is_file() and f.suffix.lower() in VIDEO_EXTENSIONS:
                if is_hash_filename(f.stem):
                    videos.append((f, context))
                    count += 1
        print(f"  {folder_name}: {count} to classify")
    return videos


def main():
    if not API_KEY:
        print("ERROR: Set GEMINI_API_KEY environment variable")
        sys.exit(1)

    client = genai.Client(api_key=API_KEY)

    print("=== Dive Video Classifier (cost-optimized) ===")
    print(f"Model: {MODEL_NAME} | Thinking: OFF | Frames: 1 | Scale: 512px\n")

    videos = discover_videos()
    print(f"\nTotal to classify: {len(videos)}\n")

    if not videos:
        print("Nothing to classify.")
        return

    results = []
    errors = []
    total_input_tokens = 0
    total_output_tokens = 0

    log_path = Path(__file__).parent / f"classify_log_{datetime.now():%Y%m%d_%H%M%S}.json"

    for i, (video_path, trip_context) in enumerate(videos, 1):
        folder_name = video_path.parent.name
        print(f"[{i}/{len(videos)}] {folder_name}/{video_path.name[:20]}... ", end="", flush=True)

        with tempfile.TemporaryDirectory() as tmp_dir:
            frame = extract_single_frame(video_path, Path(tmp_dir))
            if not frame:
                print("ERROR (no frame)")
                errors.append({"file": str(video_path), "error": "frame extraction failed"})
                continue

            for attempt in range(5):
                try:
                    title = classify_video(client, frame, trip_context)
                    new_path = rename_video(video_path, title)
                    print(f"-> {new_path.name}")
                    results.append({
                        "original": video_path.name,
                        "title": title,
                        "renamed_to": new_path.name,
                        "folder": folder_name,
                    })
                    break
                except Exception as e:
                    err_str = str(e)
                    if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                        wait = 10 * (attempt + 1)
                        print(f"[wait {wait}s] ", end="", flush=True)
                        time.sleep(wait)
                    else:
                        print(f"ERROR: {err_str[:80]}")
                        errors.append({"file": str(video_path), "error": err_str[:200]})
                        break
            else:
                print("ERROR: retries exhausted")
                errors.append({"file": str(video_path), "error": "retries exhausted"})

    print(f"\n=== Done ===")
    print(f"Classified: {len(results)} | Errors: {len(errors)}")

    log_data = {
        "timestamp": datetime.now().isoformat(),
        "model": MODEL_NAME,
        "classified": results,
        "errors": errors,
    }
    log_path.write_text(json.dumps(log_data, indent=2))
    print(f"Log: {log_path}")


if __name__ == "__main__":
    main()

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

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
API_KEY = os.environ.get("GEMINI_API_KEY", "")

ICLOUD_BASE = Path(r"C:\Users\ericb\iCloudPhotos")

ALREADY_DONE = {
    "2023 - Raja Ampat",
    "2023 - Thailand Liveaboard",
    "Best of Roatan Apr 2024",
    "Cayman 2026",
    "Eric Hawaii",
    "Flores",
    "Indonesia_Vietnam 2022",
    "Islas Del Rosario Diving",
}

VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".m4v"}
MODEL_NAME = "gemini-2.5-flash"

PROMPT = """Is this frame from an underwater scuba/snorkeling video?
If YES: give a short title (under 50 chars, Title Case) describing the main subject.
If NO: respond with exactly SKIP
Return ONLY the title or SKIP, nothing else."""

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


def classify_video(client, frame_path: Path) -> str | None:
    contents = [
        PROMPT,
        types.Part.from_bytes(data=frame_path.read_bytes(), mime_type="image/jpeg"),
    ]
    response = client.models.generate_content(
        model=MODEL_NAME, contents=contents, config=GEN_CONFIG,
    )
    text = response.text.strip().strip('"').strip("'")
    if text.upper() == "SKIP" or text.upper() == "NO":
        return None
    return text


def sanitize_filename(title: str) -> str:
    sanitized = re.sub(r'[<>:"/\\|?*Ā-￿]', '', title)
    sanitized = re.sub(r'\s+', ' ', sanitized).strip()
    return sanitized[:80]


def rename_video(video_path: Path, new_title: str) -> Path:
    safe_title = sanitize_filename(new_title)
    if not safe_title:
        safe_title = "Untitled Dive Video"
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


def discover_videos() -> list[Path]:
    videos = []

    shared = ICLOUD_BASE / "Shared"
    for folder in sorted(shared.iterdir()):
        if not folder.is_dir() or folder.name in ALREADY_DONE:
            continue
        count = 0
        for f in sorted(folder.iterdir()):
            if f.is_file() and f.suffix.lower() in VIDEO_EXTENSIONS and is_hash_filename(f.stem):
                videos.append(f)
                count += 1
        if count > 0:
            print(f"  Shared/{folder.name}: {count} videos")

    photos = ICLOUD_BASE / "Photos"
    if photos.exists():
        count = 0
        for f in sorted(photos.rglob("*")):
            if f.is_file() and f.suffix.lower() in VIDEO_EXTENSIONS and is_hash_filename(f.stem):
                videos.append(f)
                count += 1
        if count > 0:
            print(f"  Photos: {count} videos")

    return videos


def main():
    if not API_KEY:
        print("ERROR: Set GEMINI_API_KEY environment variable")
        sys.exit(1)

    client = genai.Client(api_key=API_KEY)

    print("=== iCloud Dive Video Scanner ===")
    print(f"Model: {MODEL_NAME} | Mode: detect + classify\n")

    print("Scanning folders...")
    videos = discover_videos()
    print(f"\nTotal to scan: {len(videos)}\n")

    if not videos:
        print("Nothing to scan.")
        return

    dive_videos = []
    skipped = 0
    errors = []

    log_path = Path(__file__).parent / f"scan_log_{datetime.now():%Y%m%d_%H%M%S}.json"

    for i, video_path in enumerate(videos, 1):
        rel = video_path.relative_to(ICLOUD_BASE)
        parent = str(rel.parent)
        print(f"[{i}/{len(videos)}] {parent}/{video_path.name[:16]}... ", end="", flush=True)

        with tempfile.TemporaryDirectory() as tmp_dir:
            frame = extract_single_frame(video_path, Path(tmp_dir))
            if not frame:
                print("ERR (no frame)")
                errors.append({"file": str(video_path), "error": "frame extraction failed"})
                continue

            for attempt in range(5):
                try:
                    title = classify_video(client, frame)
                    if title is None:
                        print("skip")
                        skipped += 1
                    else:
                        new_path = rename_video(video_path, title)
                        print(f"DIVE -> {new_path.name}")
                        dive_videos.append({
                            "original": video_path.name,
                            "title": title,
                            "renamed_to": new_path.name,
                            "folder": parent,
                        })
                    break
                except Exception as e:
                    err_str = str(e)
                    if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                        wait = 10 * (attempt + 1)
                        print(f"[wait {wait}s] ", end="", flush=True)
                        time.sleep(wait)
                    else:
                        print(f"ERR: {err_str[:60]}")
                        errors.append({"file": str(video_path), "error": err_str[:200]})
                        break
            else:
                print("ERR: retries exhausted")
                errors.append({"file": str(video_path), "error": "retries exhausted"})

    print(f"\n=== Done ===")
    print(f"Dive videos found & renamed: {len(dive_videos)}")
    print(f"Non-dive skipped: {skipped}")
    print(f"Errors: {len(errors)}")

    log_data = {
        "timestamp": datetime.now().isoformat(),
        "model": MODEL_NAME,
        "total_scanned": len(videos),
        "dive_videos": dive_videos,
        "non_dive_skipped": skipped,
        "errors": errors,
    }
    log_path.write_text(json.dumps(log_data, indent=2))
    print(f"Log: {log_path}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Verify every YouTube video referenced by data/dives.json still exists.

Why this exists
---------------
On 2026-08-30 an audit found 23 of 116 embedded videos (20%) had been deleted
from YouTube, including one of the four front-page `bestVideos`. The site had
been serving broken tiles for an unknown length of time and nothing detected it:
the hosts were green, the deploy was green, and the failure was invisible to
every check that existed.

dive-map's clips live in the `RAW-STOCK` bucket of the Backman Diving /
Scuba Sessions channel, which that project treats as disposable. So dive-map's
content can be removed by a decision taken in a different repo. This script is
the interlock.

How liveness is decided
-----------------------
`https://img.youtube.com/vi/<id>/mqdefault.jpg` returns 200 for a video that
exists (public OR unlisted) and 404 for one that is deleted or never existed.
That endpoint is also what js/app.js uses to draw gallery thumbnails, so a 404
here is exactly the broken tile a visitor sees.

Do NOT use the oEmbed endpoint. It returns 401 for *unlisted* videos, which is
most of this library, and reports the entire set as dead.

Exit codes: 0 = all alive, 1 = at least one dead, 2 = could not complete.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Iterable, NamedTuple

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "dives.json"
THUMB_URL = "https://img.youtube.com/vi/{vid}/mqdefault.jpg"
TIMEOUT_S = 20
MAX_RETRIES = 3
WORKERS = 8

log = logging.getLogger("check_video_liveness")


class VideoRef(NamedTuple):
    """One video reference and where in the data it came from."""

    video_id: str
    title: str
    where: str


class Result(NamedTuple):
    ref: VideoRef
    alive: bool
    status: int


def collect_refs(data: dict) -> list[VideoRef]:
    """Every video referenced by the dataset, deduped by id, order preserved."""
    refs: dict[str, VideoRef] = {}
    for trip in data.get("trips", []):
        for video in trip.get("videos") or []:
            refs.setdefault(
                video["id"],
                VideoRef(video["id"], video.get("title", ""), trip.get("name", "?")),
            )
    for video in data.get("bestVideos", []):
        refs.setdefault(
            video["id"], VideoRef(video["id"], video.get("title", ""), "bestVideos")
        )
    return list(refs.values())


def probe(video_id: str) -> int:
    """HTTP status for a video's thumbnail. Retries transient failures.

    Returns the status code, or 0 if every attempt failed to get a response at
    all. Never returns a "probably fine" default: a network problem must not be
    reported as a live video.
    """
    last_error: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            request = urllib.request.Request(
                THUMB_URL.format(vid=video_id), headers={"User-Agent": "dive-map-liveness/1.0"}
            )
            with urllib.request.urlopen(request, timeout=TIMEOUT_S) as response:
                return int(response.status)
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                return 404  # definitive: the video is gone
            last_error = exc
        except Exception as exc:  # noqa: BLE001 - retried, then reported loudly
            last_error = exc
        if attempt < MAX_RETRIES - 1:
            time.sleep(2**attempt)
    log.warning("probe failed for %s after %d attempts: %s", video_id, MAX_RETRIES, last_error)
    return 0


def check(refs: Iterable[VideoRef]) -> list[Result]:
    refs = list(refs)
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        statuses = list(pool.map(lambda r: probe(r.video_id), refs))
    return [Result(ref, status == 200, status) for ref, status in zip(refs, statuses)]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=DATA_FILE, help="path to dives.json")
    parser.add_argument("--json", action="store_true", help="emit JSON instead of text")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    try:
        data = json.loads(args.data.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        log.error("cannot read %s: %s", args.data, exc)
        return 2

    refs = collect_refs(data)
    if not refs:
        log.error("no video references found in %s - is the schema what we expect?", args.data)
        return 2

    results = check(refs)
    dead = [r for r in results if not r.alive]
    unreachable = [r for r in dead if r.status == 0]

    if args.json:
        print(
            json.dumps(
                {
                    "checked": len(results),
                    "alive": len(results) - len(dead),
                    "dead": [
                        {
                            "id": r.ref.video_id,
                            "title": r.ref.title,
                            "where": r.ref.where,
                            "status": r.status,
                        }
                        for r in dead
                    ],
                },
                indent=2,
            )
        )
    else:
        print(f"checked {len(results)} videos: {len(results) - len(dead)} alive, {len(dead)} dead")
        for r in dead:
            state = "UNREACHABLE" if r.status == 0 else "DEAD"
            print(f"  {state:11s} {r.ref.video_id}  [{r.ref.where}]  {r.ref.title}")

    if unreachable:
        log.error("%d video(s) could not be reached - result is inconclusive", len(unreachable))
        return 2
    return 1 if dead else 0


if __name__ == "__main__":
    sys.exit(main())

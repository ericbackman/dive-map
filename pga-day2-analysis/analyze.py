#!/usr/bin/env python3
"""
PGA Tour: how often does the 36-hole (day-2) leader win the tournament?

Data source: ESPN's public golf JSON API.
  - Season event list: https://sports.core.api.espn.com/v2/sports/golf/leagues/pga/seasons/{year}/events
  - Event leaderboard:  https://site.api.espn.com/apis/site/v2/sports/golf/leagues/pga/summary?event={id}

All raw responses are cached to ./cache so re-runs are offline and reproducible.

Usage:
  python3 analyze.py --probe 401219787   # dump structure of one event to learn the JSON shape
  python3 analyze.py --years 2010-2025    # run the full analysis
"""
import argparse
import json
import os
import sys
import time
import urllib.request
import urllib.error

CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cache")
UA = "Mozilla/5.0 (compatible; pga-analysis/1.0)"
CORE = "https://sports.core.api.espn.com/v2/sports/golf/leagues/pga"
SITE = "https://site.api.espn.com/apis/site/v2/sports/golf/leagues/pga"


def fetch(url, cache_key, force=False, retries=4):
    """GET url with on-disk caching and exponential backoff."""
    path = os.path.join(CACHE, cache_key + ".json")
    if os.path.exists(path) and not force:
        with open(path) as f:
            return json.load(f)
    delay = 2
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                data = json.loads(r.read().decode("utf-8"))
            with open(path, "w") as f:
                json.dump(data, f)
            return data
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as e:
            last = e
            time.sleep(delay)
            delay *= 2
    raise RuntimeError(f"failed to fetch {url}: {last}")


def season_event_ids(year):
    """Return list of ESPN event ids for a PGA season."""
    ids = []
    page = 1
    while True:
        url = f"{CORE}/seasons/{year}/events?limit=100&page={page}"
        data = fetch(url, f"season_{year}_p{page}")
        items = data.get("items", [])
        for it in items:
            ref = it.get("$ref", "")
            # .../events/{id}?...
            eid = ref.split("/events/")[-1].split("?")[0].strip("/")
            if eid:
                ids.append(eid)
        if page >= data.get("pageCount", 1):
            break
        page += 1
    return ids


def get_event_summary(eid):
    return fetch(f"{SITE}/summary?event={eid}", f"event_{eid}")


# ---- parsing (finalized after probing real JSON) ----

def analyze_event(summary):
    """
    Returns a dict describing the event, or None if it should be excluded
    (match play, team event, no 36-hole data, fewer than 4 rounds, etc.).

    NOTE: field paths below are written against ESPN's observed golf summary
    structure and will be confirmed/adjusted with --probe before the real run.
    """
    raise NotImplementedError("parser finalized after --probe confirms JSON shape")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--probe", metavar="EVENT_ID", help="dump structure of one event")
    ap.add_argument("--years", default="2010-2025")
    args = ap.parse_args()

    if args.probe:
        data = get_event_summary(args.probe)
        print("TOP-LEVEL KEYS:", list(data.keys()))
        print(json.dumps(data, indent=2)[:6000])
        return

    lo, hi = (int(x) for x in args.years.split("-"))
    for year in range(lo, hi + 1):
        ids = season_event_ids(year)
        print(f"{year}: {len(ids)} events")


if __name__ == "__main__":
    main()

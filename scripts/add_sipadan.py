"""Add Sipadan dive log entries, remove placeholder, renumber all IDs."""

import json
from pathlib import Path

DATA_FILE = Path(__file__).parent.parent / "data" / "dives.json"

# Load current data
with open(DATA_FILE, "r", encoding="utf-8") as f:
    data = json.load(f)

# 1. Add sipadan-2023 trip (between raja-ampat-liveaboard-2023 and red-sea-2023)
sipadan_trip = {
    "id": "sipadan-2023",
    "name": "Sipadan (Scuba Junkie)",
    "region": "Sipadan / Mabul / Kapalai, Sabah, Malaysia",
    "year": 2023,
    "dates": "April 24-27, 2023",
    "diveCount": 11,
}

# Insert after raja-ampat-liveaboard-2023
trip_idx = next(i for i, t in enumerate(data["trips"]) if t["id"] == "raja-ampat-liveaboard-2023")
data["trips"].insert(trip_idx + 1, sipadan_trip)

# 2. Remove the unlogged Sipadan placeholder
data["dives"] = [d for d in data["dives"] if not (d["trip"] is None and d["site"] == "Sipadan")]

# 3. Add 11 Sipadan dives
sipadan_dives = [
    {
        "trip": "sipadan-2023",
        "site": "Sui Sui",
        "location": "Mabul Island, Sabah, Malaysia",
        "lat": 4.2450,
        "lng": 118.6285,
        "depth_m": None,
        "duration_min": 60,
        "date": "2023-04-24",
        "type": "reef",
        "highlights": ["cuttlefish", "eels fighting", "mantis shrimp", "lobster"],
        "notes": "Large cuttlefish, two eels fighting, mantis shrimp. Struggled with ears from start.",
        "rating": 3,
        "media": [],
    },
    {
        "trip": "sipadan-2023",
        "site": "Kapalai House Reef",
        "location": "Kapalai Island, Sabah, Malaysia",
        "lat": 4.1340,
        "lng": 118.6700,
        "depth_m": None,
        "duration_min": 61,
        "date": "2023-04-24",
        "type": "reef",
        "highlights": ["barracuda", "turtle", "pipefish", "pufferfish", "underwater village"],
        "notes": "Really cool dive — barracudas swimming around man-made coral houses like an underwater village. Massive eels, turtle, pipefish, big pufferfish.",
        "rating": 5,
        "media": [],
    },
    {
        "trip": "sipadan-2023",
        "site": "South Point",
        "location": "Sipadan Island, Sabah, Malaysia",
        "lat": 4.1100,
        "lng": 118.6280,
        "depth_m": 27.5,
        "duration_min": 51,
        "date": "2023-04-25",
        "type": "wall",
        "highlights": ["jackfish school", "scorpionfish", "sharks"],
        "notes": "Large school of jackfish at start, steep wall drop, very cool white scorpionfish, sharks underneath hunting.",
        "rating": 4,
        "media": [],
    },
    {
        "trip": "sipadan-2023",
        "site": "Drop Off",
        "location": "Sipadan Island, Sabah, Malaysia",
        "lat": 4.1150,
        "lng": 118.6250,
        "depth_m": 21.8,
        "duration_min": 62,
        "date": "2023-04-25",
        "type": "cave",
        "highlights": ["cave", "barracuda", "turtle", "soft coral"],
        "notes": "Explored large underwater cave entrance, swam along steep wall with soft corals. Barracudas, big turtle at end. Current pulled towards Barracuda Point.",
        "rating": 5,
        "media": [],
    },
    {
        "trip": "sipadan-2023",
        "site": "Black Ray Channel",
        "location": "Sipadan Island, Sabah, Malaysia",
        "lat": 4.1170,
        "lng": 118.6305,
        "depth_m": 14.8,
        "duration_min": 57,
        "date": "2023-04-25",
        "type": "drift",
        "highlights": ["stingray", "turtle", "bumphead parrotfish"],
        "notes": "Gentle drift dive. Stingray, turtle, bumphead parrotfish, lots of fish around top reef.",
        "rating": 4,
        "media": [],
    },
    {
        "trip": "sipadan-2023",
        "site": "Staghorn",
        "location": "Sipadan Island, Sabah, Malaysia",
        "lat": 4.1125,
        "lng": 118.6260,
        "depth_m": 27.7,
        "duration_min": 62,
        "date": "2023-04-26",
        "type": "wall",
        "highlights": ["jackfish", "white tip sharks", "turtles", "blue water"],
        "notes": "Swam straight off the wall into the blue — exhilarating and terrifying — hunting for barracuda and hammerheads. White tip reef sharks and turtles on return.",
        "rating": 5,
        "media": [],
    },
    {
        "trip": "sipadan-2023",
        "site": "Midreef",
        "location": "Sipadan Island, Sabah, Malaysia",
        "lat": 4.1145,
        "lng": 118.6258,
        "depth_m": 22.5,
        "duration_min": 61,
        "date": "2023-04-26",
        "type": "wall",
        "highlights": ["white tip sharks", "unicornfish", "turtles", "moray eel"],
        "notes": "Super steep wall dive, lots of white tips underneath, unicornfish, turtles, moray eel.",
        "rating": 4,
        "media": [],
    },
    {
        "trip": "sipadan-2023",
        "site": "Sipadan Barrier Reef",
        "location": "Sipadan Island, Sabah, Malaysia",
        "lat": 4.1120,
        "lng": 118.6310,
        "depth_m": 20.5,
        "duration_min": 67,
        "date": "2023-04-26",
        "type": "reef",
        "highlights": [],
        "notes": "Not much to see. Longer dive because Claire had a malfunctioning O-ring — started with different group.",
        "rating": 2,
        "media": [],
    },
    {
        "trip": "sipadan-2023",
        "site": "Barracuda Point",
        "location": "Sipadan Island, Sabah, Malaysia",
        "lat": 4.1185,
        "lng": 118.6290,
        "depth_m": 26.6,
        "duration_min": 68,
        "date": "2023-04-27",
        "type": "reef",
        "highlights": ["sharks x15", "barracuda", "bumphead parrotfish", "eels"],
        "notes": "Divemaster Simon worked the group hard in strong current. 10-15 sharks (white and black tips), all sorts of barracuda. Simon literally hugged the group after — so happy the air consumption held for 60+ mins.",
        "rating": 5,
        "media": [],
    },
    {
        "trip": "sipadan-2023",
        "site": "Hanging Gardens",
        "location": "Sipadan Island, Sabah, Malaysia",
        "lat": 4.1155,
        "lng": 118.6320,
        "depth_m": 24.6,
        "duration_min": 70,
        "date": "2023-04-27",
        "type": "wall",
        "highlights": ["sharks", "barracuda", "bumphead parrotfish", "jellyfish"],
        "notes": "First 20 mins swimming into the blue looking for hammerheads. Lots of tiny jellyfish and strange banana-shaped flat jellies. Healthy top reef with endless fish.",
        "rating": 4,
        "media": [],
    },
    {
        "trip": "sipadan-2023",
        "site": "Ozikawa's Garden",
        "location": "Sipadan Island, Sabah, Malaysia",
        "lat": 4.1110,
        "lng": 118.6295,
        "depth_m": 19.2,
        "duration_min": 66,
        "date": "2023-04-27",
        "type": "reef",
        "highlights": ["eels", "turtles", "barracuda"],
        "notes": "Macro dive. Some eels, turtles, barracuda. Headache at end of dive.",
        "rating": 3,
        "media": [],
    },
]

data["dives"].extend(sipadan_dives)

# 4. Sort: unlogged (date=None) first, then by date chronologically
def sort_key(d):
    if d["date"] is None:
        return ("0000-00-00", d.get("site", ""))
    return (d["date"], d.get("site", ""))

data["dives"].sort(key=sort_key)

# 5. Renumber IDs: total 156, entries count backwards
total = data["diver"]["totalDives"]
n = len(data["dives"])
start_id = total - n + 1

for i, dive in enumerate(data["dives"]):
    dive["id"] = start_id + i

print(f"Total entries: {n}")
print(f"ID range: {start_id} — {total}")
print(f"Trips: {len(data['trips'])}")

# Verify Sipadan dives are in the right spot
sipadan_ids = [d["id"] for d in data["dives"] if d.get("trip") == "sipadan-2023"]
print(f"Sipadan dive IDs: {sipadan_ids}")

# Check neighbors
for d in data["dives"]:
    if d["id"] == sipadan_ids[0] - 1:
        print(f"Before Sipadan: #{d['id']} {d['site']} ({d['trip']})")
    if d["id"] == sipadan_ids[-1] + 1:
        print(f"After Sipadan: #{d['id']} {d['site']} ({d['trip']})")

# 6. Write back
with open(DATA_FILE, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("\nDone! dives.json updated.")

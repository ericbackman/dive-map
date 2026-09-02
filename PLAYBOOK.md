# dive-map operations playbook

A static site with no server, no database, no secrets and no state. Almost
nothing here can break. The one thing that does is the video content, because it
is owned by a different project.

**If you read one section, read [§3 Video rot](#3-video-rot-the-one-real-failure-mode).**

---

## 1. What runs

| What | Where | Trigger | Failure alert |
|---|---|---|---|
| `cf-deploy.yml` | GitHub Actions | push to `main` | Actions failure email to repo owner |
| `pages-build-deployment` | GitHub Pages | push to `main` | same |
| `video-liveness.yml` | GitHub Actions | Mondays 09:17 UTC, on data change, manual | same |

No Windows Task Scheduler job. No Cloudflare Worker. No cron in `AUTOMATION.md`
Layer 3. The weekly liveness check is this project's only recurring job.

## 2. Live surfaces

| URL | Serves | Expected |
|---|---|---|
| `https://dive.ericbackman.com` | Cloudflare Pages `dive-map-c4c` | public, 200 |
| `https://dives.ericbackman.com` | same project (alias) | public, 200 |
| `https://ericbackman.github.io/dive-map/` | GitHub Pages | public, 200 |

Two traps:

- **`dive-map.pages.dev` is not ours.** The name was taken globally, so
  Cloudflare suffixed the project to `dive-map-c4c`. The bare name belongs to a
  stranger and 308s to an unrelated Thai dive site. Never health-check it.
- **Cloudflare Pages falls back to `index.html` for unknown paths.** A 200 from
  `dive.ericbackman.com/anything.md` means nothing. To test whether a file
  exists, check GitHub Pages, which serves real bytes, or compare the body.

## 3. Video rot, the one real failure mode

### What happened

dive-map embeds ~100 YouTube clips. They are the `RAW-STOCK` bucket of the
Scuba Sessions channel, which the `dive-channel` repo treats as disposable
working footage. **A cleanup in that repo silently deletes content from this
one.**

On 2026-08-30 an audit found **23 of 116 embeds (20%) deleted**, including one of
the four front-page `bestVideos`. Every host was green, every deploy was green,
and the site had been serving broken tiles for an unknown period.

### Detecting it

```bash
python scripts/check_video_liveness.py
```

Exit 0 = all alive, 1 = at least one dead, 2 = inconclusive (could not reach
YouTube; do **not** read this as healthy). Runs weekly in CI.

The check probes `img.youtube.com/vi/<id>/mqdefault.jpg`, which returns 404 for a
deleted video and 200 for one that exists, public or unlisted. This is the same
endpoint `js/app.js` uses for gallery thumbnails, so a failure is literally the
broken tile a visitor sees.

⚠ **Do not use the oEmbed endpoint.** It returns 401 for *unlisted* videos, which
is most of this library, and will report the entire set as dead. An audit made
exactly this mistake before switching instruments.

### Fixing it

When the check reports a dead video, in order of preference:

1. **Find the same footage, republished.** When `dive-channel` promotes a raw
   clip to a public Short it retitles it `<raw title> <emoji> #shorts`. An exact
   title match after stripping the emoji and hashtag is reliable evidence of the
   same footage. Cross-check against
   `dive-channel/tracking/_channel_inventory.json`.
2. **Ask Eric.** He is the only source of truth for what a clip actually showed.
   Do not substitute similar-looking footage from another dive.
3. **Remove the entry.** A trip with fewer videos is correct. A trip showing
   somebody else's reef is not.

**The rule is factual over complete.** In the 2026-08-30 pass only 5 of 23 could
be proven to be the same footage; the other 18 were removed rather than guessed.

### Why not just re-upload?

The 4K originals are on homebase (`/opt/dive`) and in iCloud shared albums, but
the mapping from source file to deleted video id was never recorded, and
`config/labels.json` resolves titles for only some of them. Re-uploading means
Eric identifying the footage by eye. That is a real cost, which is why the weekly
check exists: catching one death is cheap, reconstructing twenty is not.

## 4. Deploying

Push to `main`. Both hosts deploy themselves. There is nothing to build.

The Actions workflow stages only `index.html css data js` into `_site`. Working
files stay out of the Cloudflare deploy, and `_config.yml` keeps them off GitHub
Pages. Before 2026-08-30 `docs/` was published on both.

To verify a deploy landed:

```bash
curl -s https://dive-map-c4c.pages.dev/data/dives.json | python -c "import json,sys; d=json.load(sys.stdin); print(len(d['dives']),'dives',sum(len(t.get('videos') or []) for t in d['trips']),'videos')"
```

## 5. Data integrity

No database, so "restore" is `git clone`. The data is `data/dives.json`, tracked
in git and pushed to GitHub. There is no separate backup because there is no
state that git does not already hold.

Three invariants worth checking after any data edit:

- Every `dives[].trip` matches a `trips[].id`. A dive with an unknown trip id
  renders nowhere and fails silently.
- `trips[].diveCount` matches the actual number of dives for that trip.
- Dives carry a `date`. ⚠ All 10 `cayman-2026` dives have real site names and
  coordinates, so they pin correctly, but `date`, `depth_m`, `duration_min`,
  `highlights` and `notes` are all null. They render as empty rows in the Dive
  Log and contribute nothing to the depth and date statistics. The trip's
  `dates` field is null too. Eric has the log; it has not been entered.

```bash
python -c "
import json,collections
d=json.load(open('data/dives.json'))
c=collections.Counter(x['trip'] for x in d['dives'])
ids={t['id'] for t in d['trips']}
print('orphan dives:', {k for k in c if k not in ids} or 'none')
for t in d['trips']:
    if c.get(t['id'],0)!=t.get('diveCount'): print('count mismatch:',t['id'],c.get(t['id'],0),'vs',t.get('diveCount'))
"
```

## 6. Titles are generated, and have been wrong

Video titles came from `scripts/classify_dive_videos.py`, an AI vision pass. The
YouTube descriptions were then generated **from the trip assignment in
`dives.json`**, so the metadata is circular and cannot confirm which trip a clip
belongs to.

Misattributions have been corrected twice (`2b9639e`, `02ed0fb`). Still open:
`1BZ9SQSr93E` "Clownfish In Anemone 2" and `B9zGvYAY9wo` "Bubble Coral" sit on
`cayman-2026` but name Indo-Pacific-only species; Eric places them in Raja Ampat
or Komodo. Treat every species name as a claim to check.

## 7. Cost and quota

Zero. Cloudflare Pages free tier, GitHub Pages free tier, YouTube embeds, CARTO
tiles keyless. The weekly Actions run is a handful of seconds. Nothing here has a
quota worth watching.

## 8. Maintenance log

- **2026-08-30** - `/finalize` audit. Found 23 of 116 videos dead and no
  detection of any kind. Remapped 5 to their republished Scuba Sessions
  equivalents, removed 18 that could not be proven to be the same footage.
  Added `scripts/check_video_liveness.py` plus a weekly workflow, stopped
  publishing `docs/` on both hosts, rewrote `CLAUDE.md` and `README.md` against
  reality, wrote this playbook. **Not marked stable**: the 10 `cayman-2026`
  dives are still missing dates, depths and notes, and two clips remain
  misattributed.

### 2026-09-01: finalized, STABLE

`/finalize` passed: 7 checks, 0 failures. Both hosts respond as declared, the repo
is clean and in sync, and the project holds no state outside git, so GitHub is the
backup and "restore" is a clone plus a push to main.

This is the second attempt. The 2026-08-30 run REFUSED it: 23 of 116 video embeds
(20%) were dead and nothing detected them. PR #7 repaired them and added the weekly
`video-liveness` workflow; PR #8 corrected a stale dive count in the meta
description. Both are merged, and the workflow has run green.

Accepted caveats, recorded rather than waved through:

- **GitHub disables scheduled workflows after 60 days of repo inactivity.** A
  finished project is inactive by definition, so `video-liveness` is most likely to
  switch itself off exactly when dive-map is healthiest. This is the single most
  likely route out of stable and nothing currently detects it.
- `video-liveness` alerts only through GitHub's email on a failed scheduled run.
  There is no Discord or ntfy path, so it sits outside `run-job.ps1` and the estate
  digest, and the finalize record's `jobs` list is empty for that reason rather
  than because nothing runs.
- Four stale remote branches, oldest 2026-06-01. They mislead a reader but cannot
  affect operation.

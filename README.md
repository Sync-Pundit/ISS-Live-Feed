# ISS Live Console

A Cloudflare-backed orbital mission console for watching the International Space Station, tracking its orbit, and reading public telemetry/context feeds.

## What it does

- Self-healing YouTube live stream discovery through `/api/stream`.
- Cached ISS position proxy through `/api/iss/state`.
- Cached ISS TLE endpoint through `/api/iss/tle` for SGP4 forecast paths.
- Space-weather and Earth-event context through `/api/space-weather`.
- Static browser fallback for local development when Cloudflare Functions are not running.

## Hosting target

This app is designed for **Cloudflare Pages**.

The browser shell is static, but the dynamic stream discovery requires server-side secrets, so the `/functions` directory should be deployed with Cloudflare Pages Functions.

## Required Cloudflare secret

Set this in Cloudflare Pages:

```text
YOUTUBE_API_KEY=<Google/YouTube Data API key>
```

The key is used only server-side by `/api/stream`.

## Recommended Cloudflare environment variables

```text
YOUTUBE_CHANNEL_IDS=<comma-separated YouTube channel IDs to search for live streams>
YOUTUBE_FALLBACK_VIDEO_ID=<optional known-good fallback video id>
YOUTUBE_FALLBACK_CHANNEL_ID=<optional channel id for YouTube live channel embed fallback>
YOUTUBE_FALLBACK_TITLE=ISS live stream fallback
STREAM_CACHE_SECONDS=180
```

`YOUTUBE_CHANNEL_IDS` is intentionally not hardcoded because NASA and ISS mirror channels can change. Add official NASA/ISS channel IDs in Cloudflare once selected. If you do not have a stable fallback video ID, prefer `YOUTUBE_FALLBACK_CHANNEL_ID`; otherwise the UI will show a clean no-source state until discovery is configured.

## Public data sources

- YouTube Data API for current live stream discovery.
- Where The ISS At for live station position.
- CelesTrak for ISS TLE data.
- NOAA SWPC for Kp index and GOES X-ray flux.
- NASA EONET for active Earth events.

## Local development

Any static server can render the UI:

```bash
python3 -m http.server 5000
```

Then open:

```text
http://127.0.0.1:5000/
```

Without Cloudflare Functions, stream discovery and TLE/context endpoints fall back to degraded states. ISS state still tries a direct browser fetch to `wheretheiss.at`.

## Cloudflare deployment notes

- Build command: none
- Output directory: repository root
- Functions directory: `functions`
- Add the environment variables/secrets above in Cloudflare Pages settings.

## Key files

```text
index.html
assets/css/app.css
assets/js/app.js
assets/js/api.js
assets/js/stream.js
assets/js/map.js
assets/js/orbit.js
assets/js/telemetry.js
functions/api/stream.js
functions/api/iss/state.js
functions/api/iss/tle.js
functions/api/space-weather.js
```

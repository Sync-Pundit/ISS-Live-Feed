# ISS / live orbit

An orbital observatory for following the International Space Station. The map, position, orbit forecast, and public context feeds work without a private API key. Video discovery is optional; the interface links to [NASA Live](https://www.nasa.gov/live/) when an embeddable ISS signal is unavailable.

## Experience

- NASA Earth imagery with the current ISS fix, ground track, visibility footprint, and Earth event markers. **Day / Night** switches between archival Blue Marble and city-lights imagery; **ISS footprint** and **Earth events** independently show or hide overlays.
- Position, altitude, speed, and source freshness in a compact instrument strip.
- A station video panel that shows a clear off-air state instead of an invalid embed.
- Browser-local geometric pass predictions after a visitor chooses to share their location. These are **not** optical visibility forecasts.
- Light and dark modes. The selected mode is stored in the visitor's browser.

See [the source and design audit](docs/source-audit.md) for provider choices, limits, and the remaining work.

## Runtime

This repository contains a Cloudflare Worker entry point in `src/worker.js` and static assets in `public/`. The repository-root `index.html` and `assets/` mirror the static files for older static hosting. Edit the root files, then run:

```sh
python3 tools/sync_public.py
python3 tools/sync_public.py --check
```

For local testing:

```sh
npx wrangler@4 dev --local
```

Cloudflare can build and deploy the Worker directly from the connected GitHub repository with `npx wrangler@4 deploy`. No GitHub Actions token is required.

## Configuration

The core tracker requires no secret. Add a server-side `YOUTUBE_API_KEY` secret to enable station video discovery. The Worker resolves NASA's channel from its public handle, checks active broadcasts through the YouTube Data API, and embeds only a live, embeddable station camera. No current video ID or fallback title is configured. Remove the old `YOUTUBE_CHANNEL_IDS`, `YOUTUBE_FALLBACK_TITLE`, and `STREAM_CACHE_SECONDS` variables from Cloudflare after this version deploys.

A Cloudflare Cron Trigger checks twice an hour and stores one shared result in Workers KV. Public requests only read that result. This keeps `search.list` to about 48 calls per day, below YouTube's default 100-call daily search allowance, and avoids one search per data center. The page stops calling a stream live after 45 minutes without a successful check. YouTube's push feed announces uploads and title or description edits, but does not guarantee a go-live event, so it cannot replace the scheduled check. If the API key is missing or discovery fails, the page links to [NASA Live](https://www.nasa.gov/live/).

## Public sources

- [Where the ISS at](https://wheretheiss.at/w/developer) for the current ISS position and TLE fallback.
- [CelesTrak](https://celestrak.org/NORAD/documentation/gp-data-formats.php) for the primary TLE.
- [NASA GIBS](https://nasa-gibs.github.io/gibs-api-docs/access-basics/) for Earth imagery. Blue Marble is historical base imagery, not a live camera.
- [NASA](https://www.nasa.gov/international-space-station/space-station-visiting-vehicles/) for the visiting-vehicle summary.
- [NOAA SWPC](https://www.swpc.noaa.gov/content/data-access) for Kp and GOES X-ray readings.
- [NASA EONET](https://eonet.gsfc.nasa.gov/docs/v3) for a sample of open Earth events.

Source availability and freshness are shown or described where the data is used. A failed feed must never be interpreted as zero events or zero docked vehicles.

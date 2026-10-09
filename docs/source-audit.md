# ISS source and experience audit

Checked 9 October 2026. This audit describes the repository and public response contracts; it does not assert the state of private Cloudflare secrets.

## What was failing

The public map used CARTO raster tiles without a key. CARTO [now requires a basemap key](https://www.carto.com/basemaps/apikey/), which explains the visible “API KEY REQUIRED” watermark. The configured fallback video ID rendered “Video unavailable.” The stream endpoint returned a fallback with a “no active stream” note, but the old code swallowed provider errors, so that response could not distinguish a missing broadcast from a bad key or a provider failure. The public position, vehicle, NOAA, and EONET endpoints did return data during this review. CelesTrak briefly returned HTTP 500 during local testing and then recovered.

The old “next transition” used the Sun's position at a fixed ground coordinate instead of the station's moving orbit. The “Ocean / unresolved” ground label came from a reverse-geocoding request that did not match the provider's documented coordinate endpoint. EONET events were described as near the ISS even though the request sampled worldwide events. The local pass action only captured coordinates and did not calculate a pass.

## Provider decisions

| Need | Decision | Reason and limit |
| --- | --- | --- |
| Earth map | Replace CARTO with [NASA GIBS](https://nasa-gibs.github.io/gibs-api-docs/access-basics/) Blue Marble and night lights | Public imagery endpoints remove a tile key. The base imagery is historical, so it is credited and never called live Earth imagery. |
| Current position | Keep [Where the ISS at](https://wheretheiss.at/w/developer) for now | It returns coordinates, speed, altitude, and solar status without authentication. Its published limit is roughly one request per second. The Worker cache is not a global rate coordinator. |
| Orbit elements | Keep [CelesTrak GP](https://celestrak.org/NORAD/documentation/gp-data-formats.php) with Where the ISS at TLE fallback | CelesTrak recommends fetching GP updates no more than every two hours. The fallback keeps forecasts available through short upstream failures. |
| Station video | Optional YouTube discovery plus [NASA Live](https://www.nasa.gov/live/) as the always available route | YouTube [limits default projects to 100 search.list calls per day](https://developers.google.com/youtube/v3/getting-started). A generic NASA live stream is not automatically an ISS camera. No unverified video is embedded by default. |
| Docked vehicles | Keep the [NASA visiting-vehicles page](https://www.nasa.gov/international-space-station/space-station-visiting-vehicles/) | Authoritative public source, but the WordPress excerpt is editorial text, not a stable structured manifest. Display its source and update date; revisit if NASA publishes a suitable structured feed. |
| Space weather | Keep [NOAA SWPC JSON](https://www.swpc.noaa.gov/content/data-access) | Direct public Kp and GOES X-ray data. Do not equate missing readings with calm conditions. |
| Earth events | Keep [NASA EONET v3](https://eonet.gsfc.nasa.gov/docs/v3) | The query returns up to 20 recent open events worldwide. The UI now says that, and it distinguishes an empty response from an unavailable feed. |
| Observer passes | Calculate from TLE with SGP4 in the browser | No location leaves the browser for pass calculation. These are geometric passes above 10° elevation, not visible pass promises. [N2YO](https://www.n2yo.org/api/) offers optical visibility forecasts but requires a key and limits visual-pass requests; add it only if that extra accuracy justifies a new dependency. |

## Design direction

The station's moving position leads the experience. NASA Earth imagery fills the first canvas; coordinates and the orbit line are annotations on that view. Day / Night switches the archival Earth and city-lights basemaps. Footprint and Earth events are independent overlays. A single row of instruments answers “where is it, how fast, and how fresh?” The video has an off-air state, and context feeds show source details. The visual identity uses cold blue, solar yellow, condensed flight-display type, and a compact ISS wordmark. Light and dark modes share the same hierarchy.

## Remaining risks

- Worker Cache API entries are local to a Cloudflare data center. Higher traffic may need a coordinated cache or TLE-based position propagation to stay within the current-position provider's limit.
- YouTube search quota is also per project, not per data center. One cached search per data center can still accumulate. Monitor it before relying on automatic video discovery at scale.
- The public NASA vehicle excerpt can change shape. A missing or unparseable excerpt should show unavailable, with a link to NASA's source page.
- The GIBS map is a base layer. Its historical imagery should not be mistaken for a real-time view from the station.

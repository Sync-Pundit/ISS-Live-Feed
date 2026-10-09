#!/usr/bin/env python3
"""Keep the root static preview and the Worker asset directory identical."""
from pathlib import Path
import shutil
import sys

root = Path(__file__).resolve().parents[1]
paths = [Path("index.html"), *(Path("assets") / path for path in [
    "css/app.css", "js/api.js", "js/app.js", "js/context.js", "js/map.js",
    "js/orbit.js", "js/stream.js", "js/telemetry.js", "favicon.png",
])]
check = "--check" in sys.argv
stale = []
for source in paths:
    destination = root / "public" / source
    original = root / source
    if not original.exists() or (destination.exists() and original.read_bytes() == destination.read_bytes()):
        continue
    stale.append(str(source))
    if not check:
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(original, destination)
if stale:
    print(("Out of sync: " if check else "Synced: ") + ", ".join(stale))
if check and stale:
    sys.exit(1)

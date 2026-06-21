#!/usr/bin/env python3
"""Verify visible mission-context cards have real producers or explicit stub treatment."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / 'index.html').read_text(encoding='utf-8')
API = (ROOT / 'assets/js/api.js').read_text(encoding='utf-8')
APP = (ROOT / 'assets/js/app.js').read_text(encoding='utf-8')
TELEMETRY = (ROOT / 'assets/js/telemetry.js').read_text(encoding='utf-8')
CONTEXT = (ROOT / 'assets/js/context.js').read_text(encoding='utf-8')
WORKER = (ROOT / 'src/worker.js').read_text(encoding='utf-8')

CHECKS = [
    ('Docked vehicles card', 'id="docked-card"' in INDEX),
    ('Docked vehicles endpoint route', "'/api/docked-vehicles'" in WORKER),
    ('Docked vehicles client helper', 'function getDockedVehicles' in API),
    ('Docked vehicles renderer', 'function renderDockedVehicles' in TELEMETRY),
    ('Docked vehicles refresh call', 'renderDockedVehicles(dockedVehicles)' in APP),
    ('Mission context artifact module', 'function renderEarthEventsDetails' in CONTEXT and 'updateContextArtifact' in CONTEXT),
    ('Mission context card controls', INDEX.count('class="card-toggle"') >= 4 and 'initContextArtifacts' in APP),
    ('Space weather endpoint route', "'/api/space-weather'" in WORKER),
    ('Space weather renderer', 'function renderSpaceWeather' in TELEMETRY),
    ('Earth events renderer path', 'earth-events-summary' in TELEMETRY and 'renderEvents(weather.events || [])' in APP),
    ('Local pass explicit stub copy', 'later wave' in INDEX and 'initLocalPassStub' in APP),
]

failed = [name for name, ok in CHECKS if not ok]
for name, ok in CHECKS:
    print(f'{"PASS" if ok else "FAIL"} {name}')
if failed:
    print('\nMissing source coverage:', ', '.join(failed), file=sys.stderr)
    sys.exit(1)

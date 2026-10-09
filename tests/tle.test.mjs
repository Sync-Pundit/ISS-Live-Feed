import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/iss/tle.js';

const line1 = '1 25544U 98067A   26281.98258931  .00005946  00000+0  11685-3 0  9991';
const line2 = '2 25544  51.6313  96.9458 0006821 239.5445 120.4870 15.48782794589392';

test('uses the documented ISS TLE fallback when CelesTrak fails', async () => {
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  const calls = [];
  globalThis.caches = { default: { match: async () => null, put: async () => {} } };
  globalThis.fetch = async url => {
    calls.push(String(url));
    if (String(url).startsWith('https://celestrak.org/')) return new Response('', { status: 500 });
    return Response.json({ header: 'ISS (ZARYA)', line1, line2 });
  };
  try {
    const response = await onRequestGet({ request: new Request('https://example.test/api/iss/tle') });
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.source, 'wheretheiss.at');
    assert.equal(data.status, 'fallback');
    assert.deepEqual(data.lines, [line1, line2]);
    assert.equal(calls.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.caches = originalCaches;
  }
});

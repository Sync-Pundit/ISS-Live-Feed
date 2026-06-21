import { onRequestGet as stream } from '../functions/api/stream.js';
import { onRequestGet as issState } from '../functions/api/iss/state.js';
import { onRequestGet as issTle } from '../functions/api/iss/tle.js';
import { onRequestGet as dockedVehicles } from '../functions/api/docked-vehicles.js';
import { onRequestGet as spaceWeather } from '../functions/api/space-weather.js';
import { json } from '../functions/_shared/utils.js';

const routes = new Map([
	['/api/stream', stream],
	['/api/iss/state', issState],
	['/api/iss/tle', issTle],
	['/api/docked-vehicles', dockedVehicles],
	['/api/space-weather', spaceWeather]
]);

const blockedAssetPrefixes = [
	'/.codex/',
	'/.git/',
	'/functions/',
	'/src/'
];

const blockedAssetPaths = new Set([
	'/wrangler.jsonc',
	'/package-lock.json',
	'/package.json'
]);

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		if (request.method === 'OPTIONS' && url.pathname.startsWith('/api/')) {
			return json({ ok: true });
		}
		const handler = routes.get(url.pathname);
		if (handler) {
			if (request.method !== 'GET') {
				return json({ error: 'method not allowed' }, { status: 405 });
			}
			return handler({ request, env, ctx });
		}
		if (url.pathname.startsWith('/api/')) {
			return json({ error: 'not found' }, { status: 404 });
		}
		if (
			blockedAssetPaths.has(url.pathname) ||
			blockedAssetPrefixes.some(prefix => url.pathname.startsWith(prefix))
		) {
			return json({ error: 'not found' }, { status: 404 });
		}
		return env.ASSETS.fetch(request);
	}
};

import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverLiveStream, onRequestGet, refreshLiveStream } from '../functions/api/stream.js';

const channelId = 'official-nasa-channel';
const station = (id, title, overrides = {}) => ({
	id,
	snippet: { channelId, title, liveBroadcastContent: 'live', ...overrides.snippet },
	status: { embeddable: true, ...overrides.status }
});

function api(responses, calls) {
	return async url => {
		const path = url.pathname.split('/').at(-1);
		calls.push({ path, params: Object.fromEntries(url.searchParams) });
		return Response.json(responses[path]);
	};
}

function storage(initial = null) {
	let value = initial;
	return {
		get: async () => value,
		put: async (_key, next) => { value = JSON.parse(next); }
	};
}

test('discovers the current embeddable NASA station camera without a fixed video ID', async () => {
	const calls = [];
	const result = await discoverLiveStream('test-key', api({
		channels: { items: [{ id: channelId }] },
		search: { items: ['news', 'camera', 'hd', 'spoof'].map(videoId => ({ id: { videoId } })) },
		videos: { items: [
			station('news', 'NASA Live: Space Station docking coverage'),
			station('camera', 'Live Video from the International Space Station'),
			station('hd', 'Live High-Definition Views from the International Space Station'),
			station('spoof', 'ISS live camera', { snippet: { channelId: 'another-channel' } })
		] }
	}, calls));
	assert.equal(result.status, 'live');
	assert.equal(result.videoId, 'hd');
	assert.deepEqual(calls.map(call => call.path), ['channels', 'search', 'videos']);
	assert.equal(calls[0].params.forHandle, '@NASA');
	assert.equal(calls[1].params.channelId, channelId);
	assert.equal(calls[1].params.eventType, 'live');
});

test('does not label an upcoming, unembeddable, or event video as a live camera', async () => {
	const result = await discoverLiveStream('test-key', api({
		channels: { items: [{ id: channelId }] },
		search: { items: ['upcoming', 'blocked', 'launch'].map(videoId => ({ id: { videoId } })) },
		videos: { items: [
			station('upcoming', 'ISS live camera', { snippet: { liveBroadcastContent: 'upcoming' } }),
			station('blocked', 'ISS live camera', { status: { embeddable: false } }),
			station('launch', 'NASA Live: Space Station launch coverage')
		] }
	}, []));
	assert.equal(result.status, 'unavailable');
	assert.equal(result.videoId, null);
});

test('stores one scheduled result and serves it without another YouTube call', async () => {
	const calls = [];
	const env = { YOUTUBE_API_KEY: 'test-key', STREAM_STATE: storage() };
	await refreshLiveStream(env, api({
		channels: { items: [{ id: channelId }] },
		search: { items: [{ id: { videoId: 'current' } }] },
		videos: { items: [station('current', 'Live Video from the International Space Station')] }
	}, calls));
	const response = await onRequestGet({ env });
	assert.equal((await response.json()).videoId, 'current');
	assert.equal(response.headers.get('cache-control'), 'no-store');
	assert.equal(calls.length, 3);
});

test('does not serve a live claim after its verification expires', async () => {
	const old = new Date(Date.now() - 60 * 60 * 1000).toISOString();
	const env = { STREAM_STATE: storage({ ...station('old', 'ISS live camera'), videoId: 'old', status: 'live', checkedAt: old }) };
	const response = await onRequestGet({ env });
	const result = await response.json();
	assert.equal(result.status, 'unavailable');
	assert.equal(result.videoId, null);
});

test('missing or rejected keys never publish a video or reveal the key', async () => {
	const env = { STREAM_STATE: storage() };
	const withoutKey = await refreshLiveStream(env, () => { throw new Error('fetch should not run'); });
	assert.equal(withoutKey.status, 'unavailable');
	const logged = [];
	const originalError = console.error;
	console.error = (...args) => logged.push(args.join(' '));
	try {
		env.YOUTUBE_API_KEY = 'private-test-key';
		const rejected = await refreshLiveStream(env, async () => Response.json({
			error: { errors: [{ reason: 'accessNotConfigured' }] }
		}, { status: 403 }));
		assert.equal(rejected.status, 'unavailable');
		assert.equal(rejected.videoId, null);
		assert.match(logged[0], /accessNotConfigured/);
		assert.doesNotMatch(logged.join(' '), /private-test-key/);
		await refreshLiveStream(env, async url => { throw new Error(`failed to fetch ${url}`); });
		assert.match(logged[1], /network/);
		assert.doesNotMatch(logged.join(' '), /private-test-key/);
	} finally {
		console.error = originalError;
	}
});

import { json } from '../_shared/utils.js';

const NASA_HANDLE = '@NASA';
const STREAM_KEY = 'nasa-iss-live';
const MAX_AGE_MS = 45 * 60 * 1000;
const STATION_TITLE = /\b(?:international space station|space station|iss)\b/i;
const CAMERA_TITLE = /\b(?:live|views?|camera|feed)\b/i;
const EVENT_TITLE = /\b(?:launch|docking|undocking|departure|arrival|briefing|conference|re-entry|splashdown)\b/i;

function unavailable(note, checkedAt = new Date().toISOString()) {
	return {
		videoId: null,
		embedUrl: null,
		title: 'Station video unavailable',
		source: 'NASA YouTube',
		status: 'unavailable',
		officialUrl: 'https://www.nasa.gov/live/',
		checkedAt,
		note
	};
}

async function youtube(apiKey, resource, params, fetcher) {
	const url = new URL(`https://www.googleapis.com/youtube/v3/${resource}`);
	for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
	url.searchParams.set('key', apiKey.trim());
	let response;
	try {
		response = await fetcher(url);
	} catch {
		throw new Error(`YouTube ${resource} failed: network`);
	}
	if (!response.ok) {
		const body = await response.json().catch(() => ({}));
		const reported = body.error?.errors?.[0]?.reason;
		const reason = ['accessNotConfigured', 'keyInvalid', 'quotaExceeded', 'dailyLimitExceeded', 'rateLimitExceeded', 'ipRefererBlocked'].includes(reported)
			? reported : `http_${response.status}`;
		throw new Error(`YouTube ${resource} failed: ${reason}`);
	}
	return response.json();
}

export async function discoverLiveStream(apiKey, fetcher = fetch) {
	const channel = await youtube(apiKey, 'channels', { part: 'id', forHandle: NASA_HANDLE }, fetcher);
	const channelId = channel.items?.[0]?.id;
	if (!channelId) return unavailable('NASA video discovery is temporarily unavailable.');

	const search = await youtube(apiKey, 'search', {
		part: 'snippet',
		channelId,
		eventType: 'live',
		type: 'video',
		maxResults: '25'
	}, fetcher);
	const ids = [...new Set((search.items || []).map(item => item.id?.videoId).filter(Boolean))];
	if (!ids.length) return unavailable('No live station camera is listed on NASA’s channel right now.');

	const videos = await youtube(apiKey, 'videos', {
		part: 'snippet,status',
		id: ids.join(',')
	}, fetcher);
	const live = (videos.items || [])
		.filter(item => item.snippet?.channelId === channelId)
		.filter(item => item.snippet?.liveBroadcastContent === 'live' && item.status?.embeddable === true)
		.filter(item => STATION_TITLE.test(item.snippet.title) && CAMERA_TITLE.test(item.snippet.title))
		.filter(item => !EVENT_TITLE.test(item.snippet.title))
		.sort((a, b) => Number(/high.definition|\bhd\b/i.test(b.snippet.title)) - Number(/high.definition|\bhd\b/i.test(a.snippet.title)))[0];
	if (!live) return unavailable('No embeddable live station camera is listed on NASA’s channel right now.');
	return {
		videoId: live.id,
		embedUrl: null,
		title: live.snippet.title,
		source: 'NASA YouTube',
		status: 'live',
		officialUrl: 'https://www.nasa.gov/live/',
		checkedAt: new Date().toISOString(),
		note: 'Live station camera verified on NASA’s channel.'
	};
}

export async function refreshLiveStream(env, fetcher = fetch) {
	let result;
	if (!env.YOUTUBE_API_KEY) {
		result = unavailable('Video discovery is temporarily unavailable.');
	} else {
		try {
			result = await discoverLiveStream(env.YOUTUBE_API_KEY, fetcher);
		} catch (error) {
			console.error('NASA video discovery:', error.message);
			result = unavailable('Video discovery failed. Open NASA Live for the current station view.');
		}
	}
	await env.STREAM_STATE.put(STREAM_KEY, JSON.stringify(result));
	return result;
}

export async function onRequestGet({ env }) {
	let state;
	try {
		state = await env.STREAM_STATE?.get(STREAM_KEY, 'json');
	} catch (error) {
		console.error('NASA video state read failed:', error.message);
	}
	if (!state) return json(unavailable('Waiting for the next station video check.', null), { cacheControl: 'no-store' });
	const age = Date.now() - Date.parse(state.checkedAt);
	if (state.status === 'live' && (!Number.isFinite(age) || age > MAX_AGE_MS)) {
		return json(unavailable('Waiting for a fresh check of NASA’s live video.', state.checkedAt), { cacheControl: 'no-store' });
	}
	return json(state, { cacheControl: 'no-store' });
}

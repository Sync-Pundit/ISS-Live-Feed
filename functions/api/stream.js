import { cachedJson, envList, fetchJson, json } from '../_shared/utils.js';

function fallback(env, note = 'Video discovery is not configured. Open the official NASA live page for the latest station view.') {
	const videoId = env.YOUTUBE_FALLBACK_VIDEO_ID || null;
	const embedUrl = !videoId && env.YOUTUBE_FALLBACK_CHANNEL_ID
		? `https://www.youtube-nocookie.com/embed/live_stream?channel=${encodeURIComponent(env.YOUTUBE_FALLBACK_CHANNEL_ID)}&autoplay=1&mute=1&rel=0`
		: null;
	return {
		videoId,
		embedUrl,
		title: videoId || embedUrl ? (env.YOUTUBE_FALLBACK_TITLE || 'ISS live stream fallback') : 'Station video unavailable',
		source: 'fallback',
		status: videoId || embedUrl ? 'fallback' : 'unavailable',
		officialUrl: 'https://www.nasa.gov/live/',
		checkedAt: new Date().toISOString(),
		note
	};
}

async function findLiveVideo(apiKey, channelId) {
	const url = new URL('https://www.googleapis.com/youtube/v3/search');
	url.searchParams.set('part', 'snippet');
	url.searchParams.set('channelId', channelId);
	url.searchParams.set('eventType', 'live');
	url.searchParams.set('type', 'video');
	url.searchParams.set('q', 'International Space Station');
	url.searchParams.set('order', 'date');
	url.searchParams.set('maxResults', '3');
	url.searchParams.set('key', apiKey);
	const data = await fetchJson(url.toString());
	const item = data.items?.find(entry => entry.id?.videoId && /international space station|\biss\b|station view/i.test(entry.snippet?.title || ''));
	if (!item) return null;
	return {
		videoId: item.id.videoId,
		title: item.snippet?.title || 'Live ISS stream',
		source: `youtube:${channelId}`,
		status: 'live',
		checkedAt: new Date().toISOString(),
		note: 'Live stream discovered through YouTube Data API.'
	};
}

export async function onRequestGet({ request, env }) {
	const ttl = Math.max(3600, Number(env.STREAM_CACHE_SECONDS) || 10800);
	return cachedJson(request, 'stream-v4', ttl, async () => {
		if (!env.YOUTUBE_API_KEY) return fallback(env);
		const channels = envList(env.YOUTUBE_CHANNEL_IDS);
		if (!channels.length) return fallback(env, 'Set YOUTUBE_CHANNEL_IDS to enable discovery.');
		let failed = 0;
		for (const channel of channels.slice(0, 1)) {
			try {
				const live = await findLiveVideo(env.YOUTUBE_API_KEY, channel);
				if (live) return live;
			} catch {
				failed += 1;
			}
		}
		return fallback(env, failed ? 'Video discovery failed. Check the YouTube API configuration.' : 'No active ISS video found on the configured channel.');
	});
}

export async function onRequestOptions() {
	return json({ ok: true });
}

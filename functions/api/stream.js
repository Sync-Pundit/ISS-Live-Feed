import { cachedJson, envList, fetchJson, json } from '../_shared/utils.js';

function fallback(env, note = 'YouTube discovery not configured; using fallback stream.') {
	const embedUrl = env.YOUTUBE_FALLBACK_CHANNEL_ID
		? `https://www.youtube-nocookie.com/embed/live_stream?channel=${encodeURIComponent(env.YOUTUBE_FALLBACK_CHANNEL_ID)}&autoplay=1&mute=1&rel=0`
		: null;
	return {
		videoId: env.YOUTUBE_FALLBACK_VIDEO_ID || null,
		embedUrl,
		title: env.YOUTUBE_FALLBACK_TITLE || 'ISS live stream fallback',
		source: 'fallback',
		status: 'fallback',
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
	url.searchParams.set('order', 'date');
	url.searchParams.set('maxResults', '3');
	url.searchParams.set('key', apiKey);
	const data = await fetchJson(url.toString());
	const item = data.items?.find(entry => entry.id?.videoId);
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
	const ttl = Number(env.STREAM_CACHE_SECONDS || 180);
	return cachedJson(request, 'stream-v1', ttl, async () => {
		if (!env.YOUTUBE_API_KEY) return fallback(env);
		const channels = envList(env.YOUTUBE_CHANNEL_IDS);
		if (!channels.length) return fallback(env, 'Set YOUTUBE_CHANNEL_IDS to enable discovery.');
		for (const channel of channels) {
			try {
				const live = await findLiveVideo(env.YOUTUBE_API_KEY, channel);
				if (live) return live;
			} catch (error) {
				// Try the next configured channel before giving up.
			}
		}
		return fallback(env, 'No active live stream found on configured channels.');
	});
}

export async function onRequestOptions() {
	return json({ ok: true });
}

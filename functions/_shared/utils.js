export function json(data, init = {}) {
	return new Response(JSON.stringify(data, null, 2), {
		...init,
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'cache-control': init.cacheControl || 'public, max-age=30',
			...(init.headers || {})
		}
	});
}

export function envList(value, fallback = []) {
	if (!value) return fallback;
	return String(value).split(',').map(item => item.trim()).filter(Boolean);
}

export async function cachedJson(request, key, ttlSeconds, producer) {
	const cache = caches.default;
	const url = new URL(request.url);
	url.pathname = `/__cache/${key}`;
	url.search = '';
	const cacheRequest = new Request(url.toString(), request);
	const cached = await cache.match(cacheRequest);
	if (cached) return cached;
	const data = await producer();
	const response = json(data, { cacheControl: `public, max-age=${ttlSeconds}` });
	await cache.put(cacheRequest, response.clone());
	return response;
}

export async function fetchJson(url, options = {}) {
	const response = await fetch(url, options);
	if (!response.ok) throw new Error(`${url} returned ${response.status}`);
	return response.json();
}

const FALLBACK_STREAM = {
	videoId: null,
	embedUrl: null,
	title: 'ISS live stream fallback',
	source: 'fallback',
	status: 'fallback',
	checkedAt: null,
	note: 'Cloudflare stream discovery is not configured yet.'
};

async function directIssState() {
	const response = await fetch('https://api.wheretheiss.at/v1/satellites/25544', { cache: 'no-store' });
	if (!response.ok) throw new Error(`Direct ISS API returned ${response.status}`);
	const data = await response.json();
	return {
		id: data.id || 25544,
		name: data.name || 'iss',
		latitude: Number(data.latitude),
		longitude: Number(data.longitude),
		altitude: Number(data.altitude),
		velocity: Number(data.velocity),
		visibility: data.visibility || 'unknown',
		footprint: Number(data.footprint),
		timestamp: data.timestamp,
		timestampMs: data.timestamp ? Number(data.timestamp) * 1000 : Date.now(),
		solarLat: Number(data.solar_lat),
		solarLon: Number(data.solar_lon),
		region: null,
		fetchedAt: new Date().toISOString(),
		source: 'wheretheiss.at direct fallback',
		degraded: true
	};
}

export async function fetchJson(url, fallback = null, options = {}) {
	try {
		const response = await fetch(url, { cache: 'no-store', ...options });
		if (!response.ok) throw new Error(`${url} returned ${response.status}`);
		return await response.json();
	} catch (error) {
		if (fallback !== null) return { ...fallback, degraded: true, error: error.message };
		throw error;
	}
}

export function getStream() {
	return fetchJson('/api/stream', FALLBACK_STREAM);
}

export async function getIssState() {
	try { return await fetchJson('/api/iss/state'); }
	catch { return directIssState(); }
}

export function getTle() {
	return fetchJson('/api/iss/tle', { status: 'unavailable', source: 'fallback', lines: [] });
}

export function getDockedVehicles() {
	return fetchJson('/api/docked-vehicles', {
		status: 'unavailable',
		count: null,
		summary: 'Source unavailable',
		detail: 'NASA visiting vehicle feed unavailable.',
		vehicles: [],
		source: 'NASA'
	});
}

export function getSpaceWeather() {
	return fetchJson('/api/space-weather', {
		status: 'unavailable',
		kp: null,
		xray: null,
		events: [],
		note: 'Space weather endpoint unavailable.'
	});
}

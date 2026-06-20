import { cachedJson, fetchJson } from '../../_shared/utils.js';

function approximateFootprint(altitudeKm) {
	if (!Number.isFinite(altitudeKm)) return null;
	const earthRadius = 6371;
	return earthRadius * Math.acos(earthRadius / (earthRadius + altitudeKm));
}

function visibilityFromSolar(data) {
	if (data.visibility) return data.visibility;
	return 'unknown';
}

async function reverseGeocode(lat, lon) {
	try {
		const url = new URL('https://api.wheretheiss.at/v1/coordinates/reverse');
		url.searchParams.set('lat', lat);
		url.searchParams.set('lon', lon);
		const data = await fetchJson(url.toString());
		return [data.timezone_id, data.country_code].filter(Boolean).join(' / ') || null;
	} catch {
		return null;
	}
}

export async function onRequestGet({ request }) {
	return cachedJson(request, 'iss-state-v1', 5, async () => {
		const data = await fetchJson('https://api.wheretheiss.at/v1/satellites/25544');
		const latitude = Number(data.latitude);
		const longitude = Number(data.longitude);
		const altitude = Number(data.altitude);
		const region = Number.isFinite(latitude) && Number.isFinite(longitude)
			? await reverseGeocode(latitude, longitude)
			: null;
		return {
			id: data.id || 25544,
			name: data.name || 'iss',
			latitude,
			longitude,
			altitude,
			velocity: Number(data.velocity),
			visibility: visibilityFromSolar(data),
			footprint: Number(data.footprint) || approximateFootprint(altitude),
			timestamp: data.timestamp,
			timestampMs: data.timestamp ? Number(data.timestamp) * 1000 : Date.now(),
			solarLat: Number(data.solar_lat),
			solarLon: Number(data.solar_lon),
			region,
			fetchedAt: new Date().toISOString(),
			source: 'wheretheiss.at'
		};
	});
}

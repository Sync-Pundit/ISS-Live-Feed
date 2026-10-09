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

export async function onRequestGet({ request }) {
	return cachedJson(request, 'iss-state-v1', 5, async () => {
		const data = await fetchJson('https://api.wheretheiss.at/v1/satellites/25544');
		const latitude = Number(data.latitude);
		const longitude = Number(data.longitude);
		const altitude = Number(data.altitude);
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
			region: null,
			fetchedAt: new Date().toISOString(),
			source: 'wheretheiss.at'
		};
	});
}

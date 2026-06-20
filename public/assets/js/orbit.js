const ISS_NORAD_ID = 25544;
const EARTH_RADIUS_KM = 6371;

export function buildFootprintCircle(lat, lon, footprintKm) {
	if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(footprintKm)) return [];
	const points = [];
	const angular = footprintKm / EARTH_RADIUS_KM;
	const latRad = lat * Math.PI / 180;
	const lonRad = lon * Math.PI / 180;
	for (let bearing = 0; bearing <= 360; bearing += 6) {
		const br = bearing * Math.PI / 180;
		const pointLat = Math.asin(Math.sin(latRad) * Math.cos(angular) + Math.cos(latRad) * Math.sin(angular) * Math.cos(br));
		const pointLon = lonRad + Math.atan2(Math.sin(br) * Math.sin(angular) * Math.cos(latRad), Math.cos(angular) - Math.sin(latRad) * Math.sin(pointLat));
		points.push([pointLat * 180 / Math.PI, ((pointLon * 180 / Math.PI + 540) % 360) - 180]);
	}
	return points;
}

function tleToSatrec(tle) {
	if (!window.satellite || !Array.isArray(tle?.lines) || tle.lines.length < 2) return null;
	try { return window.satellite.twoline2satrec(tle.lines[0], tle.lines[1]); }
	catch { return null; }
}

export function forecastFromTle(tle, minutes = 92, stepSeconds = 45) {
	const satrec = tleToSatrec(tle);
	if (!satrec || !window.satellite) return [];
	const points = [];
	const gmstNow = date => window.satellite.gstime(date);
	const now = Date.now();
	for (let offset = 0; offset <= minutes * 60; offset += stepSeconds) {
		const date = new Date(now + offset * 1000);
		const positionAndVelocity = window.satellite.propagate(satrec, date);
		if (!positionAndVelocity?.position) continue;
		const gd = window.satellite.eciToGeodetic(positionAndVelocity.position, gmstNow(date));
		points.push([
			window.satellite.degreesLat(gd.latitude),
			window.satellite.degreesLong(gd.longitude)
		]);
	}
	return points;
}

export function fallbackForecast(state) {
	if (!Number.isFinite(state?.latitude) || !Number.isFinite(state?.longitude)) return [];
	const points = [];
	const lat = state.latitude;
	let lon = state.longitude;
	for (let i = 0; i <= 90; i += 1) {
		lon = ((lon + 4 + 540) % 360) - 180;
		points.push([lat + Math.sin(i / 8) * 8, lon]);
	}
	return points;
}

export { ISS_NORAD_ID };

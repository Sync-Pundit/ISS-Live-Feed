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

export function predictPasses(tle, latitude, longitude, hours = 24) {
	const satrec = tleToSatrec(tle);
	if (!satrec || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
	const satellite = window.satellite;
	const observer = { latitude: latitude * Math.PI / 180, longitude: longitude * Math.PI / 180, height: 0 };
	const threshold = 10 * Math.PI / 180;
	const now = Date.now();
	const stepMs = 30_000;
	const passes = [];
	let pass = null;
	for (let offset = 0; offset <= hours * 3_600_000; offset += stepMs) {
		const date = new Date(now + offset);
		const propagated = satellite.propagate(satrec, date);
		if (!propagated?.position || !Number.isFinite(propagated.position.x)) continue;
		const ecf = satellite.eciToEcf(propagated.position, satellite.gstime(date));
		const elevation = satellite.ecfToLookAngles(observer, ecf).elevation;
		if (elevation >= threshold) {
			if (!pass) pass = { start: date.toISOString(), peak: date.toISOString(), maxElevation: elevation * 180 / Math.PI };
			if (elevation * 180 / Math.PI > pass.maxElevation) {
				pass.peak = date.toISOString();
				pass.maxElevation = elevation * 180 / Math.PI;
			}
		} else if (pass) {
			pass.end = date.toISOString();
			passes.push(pass);
			pass = null;
			if (passes.length >= 3) break;
		}
	}
	return passes;
}

export { ISS_NORAD_ID };

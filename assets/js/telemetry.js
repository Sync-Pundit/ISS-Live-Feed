export function fmtLat(value) {
	if (!Number.isFinite(value)) return '--';
	return `${Math.abs(value).toFixed(2)}°${value >= 0 ? 'N' : 'S'}`;
}

export function fmtLon(value) {
	if (!Number.isFinite(value)) return '--';
	return `${Math.abs(value).toFixed(2)}°${value >= 0 ? 'E' : 'W'}`;
}

export function fmtKm(value, precision = 1) {
	if (!Number.isFinite(value)) return '--';
	return `${value.toFixed(precision)} km`;
}

export function fmtKmh(value) {
	if (!Number.isFinite(value)) return '--';
	return `${Math.round(value).toLocaleString()} km/h`;
}

export function ageLabel(isoOrMs) {
	const time = typeof isoOrMs === 'number' ? isoOrMs : Date.parse(isoOrMs || '');
	if (!Number.isFinite(time)) return 'unknown age';
	const seconds = Math.max(0, Math.round((Date.now() - time) / 1000));
	if (seconds < 60) return `${seconds}s old`;
	const minutes = Math.round(seconds / 60);
	if (minutes < 60) return `${minutes}m old`;
	return `${Math.round(minutes / 60)}h old`;
}

export function nextTerminator(lat, lon) {
	if (!window.SunCalc || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
	const isDay = date => window.SunCalc.getPosition(date, lat, lon).altitude > 0;
	const now = Date.now();
	const nowIsDay = isDay(new Date(now));
	let lo = 0;
	let hi = 50 * 60 * 1000;
	for (let i = 0; i < 24; i += 1) {
		const mid = Math.floor((lo + hi) / 2);
		if (isDay(new Date(now + mid)) === nowIsDay) lo = mid;
		else hi = mid;
	}
	const label = nowIsDay ? 'Sunset' : 'Sunrise';
	const seconds = Math.max(0, Math.round(hi / 1000));
	const minutes = Math.floor(seconds / 60);
	const rest = seconds % 60;
	return `${label} in ${minutes}:${String(rest).padStart(2, '0')}`;
}

export function renderTelemetry(state, tle) {
	const $ = id => document.getElementById(id);
	$('lat').textContent = fmtLat(state.latitude);
	$('lon').textContent = fmtLon(state.longitude);
	$('alt').textContent = fmtKm(state.altitude);
	$('vel').textContent = fmtKmh(state.velocity);
	$('visibility').textContent = state.visibility || '--';
	$('footprint').textContent = fmtKm(state.footprint, 0);
	$('next-transition').textContent = nextTerminator(state.latitude, state.longitude) || '--';
	$('ground-region').textContent = state.region || 'Ocean / unresolved';
	$('tle-epoch').textContent = tle?.epoch || tle?.status || 'Pending';

	const freshness = $('telemetry-freshness');
	freshness.textContent = ageLabel(state.fetchedAt || state.timestampMs || Date.now());
	freshness.classList.toggle('fresh', !state.degraded);
	freshness.classList.toggle('stale', Boolean(state.degraded));
	$('map-updated').textContent = `Last fix ${new Date(state.fetchedAt || Date.now()).toLocaleTimeString()}`;
}

export function renderSpaceWeather(data) {
	const summary = document.getElementById('space-weather-summary');
	const detail = document.getElementById('space-weather-detail');
	const kp = data?.kp?.kp;
	const xray = data?.xray?.flux;
	if (Number.isFinite(kp)) {
		summary.textContent = `Kp ${kp}`;
		detail.textContent = xray ? `Latest GOES X-ray flux ${Number(xray).toExponential(2)} W/m².` : 'Planetary K-index loaded; X-ray feed pending.';
	} else {
		summary.textContent = 'Unavailable';
		detail.textContent = data?.note || 'Space weather feed unavailable.';
	}

	const events = Array.isArray(data?.events) ? data.events : [];
	document.getElementById('earth-events-summary').textContent = events.length ? `${events.length} active events` : 'No event feed';
	document.getElementById('earth-events-detail').textContent = events.length
		? events.slice(0, 3).map(event => event.title).join(' • ')
		: 'NASA EONET context will appear when available.';
}

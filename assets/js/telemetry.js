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

function safeUrl(value, fallback) {
	try {
		const url = new URL(value || fallback, window.location.origin);
		return url.protocol === 'https:' ? url.href : fallback;
	} catch {
		return fallback;
	}
}

export function renderTelemetry(state, tle) {
	const $ = id => document.getElementById(id);
	$('lat').textContent = fmtLat(state.latitude);
	$('lon').textContent = fmtLon(state.longitude);
	$('hero-lat').textContent = fmtLat(state.latitude);
	$('hero-lon').textContent = fmtLon(state.longitude);
	$('alt').textContent = fmtKm(state.altitude);
	$('vel').textContent = fmtKmh(state.velocity);
	$('visibility').textContent = state.visibility || '--';
	$('footprint').textContent = fmtKm(state.footprint, 0);
	$('next-transition').textContent = state.source || '--';
	$('tle-epoch').textContent = tle?.epoch || tle?.status || 'Pending';

	const freshness = $('telemetry-freshness');
	freshness.textContent = ageLabel(state.fetchedAt || state.timestampMs || Date.now());
	freshness.classList.toggle('fresh', !state.degraded);
	freshness.classList.toggle('stale', Boolean(state.degraded));
	$('map-updated').textContent = `Last fix ${new Date(state.fetchedAt || Date.now()).toLocaleTimeString('en-GB', { timeZone: 'UTC', hour12: false })} UTC`;
}

export function renderSpaceWeather(data) {
	const summary = document.getElementById('space-weather-summary');
	const detail = document.getElementById('space-weather-detail');
	const meta = document.getElementById('space-weather-meta');
	const card = document.getElementById('space-weather-card');
	const kp = data?.kp?.kp;
	const xray = data?.xray?.flux;
	if (Number.isFinite(kp)) {
		summary.textContent = `Kp ${kp}`;
		detail.textContent = xray ? `Latest GOES X-ray flux ${Number(xray).toExponential(2)} W/m².` : 'Planetary K-index loaded; X-ray feed pending.';
		meta.textContent = kp >= 5 ? 'geomagnetic storm watch' : 'nominal solar conditions';
		card.dataset.signal = kp >= 7 ? 'danger' : kp >= 5 ? 'warn' : 'good';
	} else {
		summary.textContent = 'Unavailable';
		detail.textContent = data?.note || 'Space weather feed unavailable.';
		meta.textContent = 'feed unavailable';
		card.dataset.signal = 'hold';
	}

	const events = Array.isArray(data?.events) ? data.events : [];
	const eventCard = document.getElementById('earth-events-card');
	const eventMeta = document.getElementById('earth-events-meta');
	document.getElementById('earth-events-summary').textContent = !data?.eventsAvailable ? 'Event feed unavailable' : events.length ? `${events.length} recent open events` : 'No open events returned';
	document.getElementById('earth-events-detail').textContent = events.length
		? events.slice(0, 3).map(event => event.title).join(' • ')
		: data?.eventsAvailable ? 'No open events in the current sample.' : 'NASA EONET feed could not be reached.';
	eventMeta.textContent = data?.eventsAvailable ? 'NASA EONET / latest 20' : 'feed unavailable';
	eventCard.dataset.signal = data?.eventsAvailable ? 'good' : 'hold';
}

export function renderDockedVehicles(data) {
	const summary = document.getElementById('docked-summary');
	const detail = document.getElementById('docked-list');
	const source = document.getElementById('docked-source');
	const card = document.getElementById('docked-card');
	if (!summary || !detail || !source || !card) return;

	const vehicles = Array.isArray(data?.vehicles) ? data.vehicles : [];
	const updatedAt = data?.updatedAt ? new Date(data.updatedAt) : null;
	const sourceAge = Number.isFinite(updatedAt?.getTime())
		? `NASA updated ${updatedAt.toISOString().slice(0, 10)}`
		: data?.source ? `${data.source} source` : 'source pending';

	summary.textContent = data?.summary || (vehicles.length ? `${vehicles.length} vehicles docked` : 'Source unavailable');
	detail.textContent = vehicles.length ? vehicles.slice(0, 5).join(' • ') : data?.detail || 'NASA visiting vehicle feed unavailable.';
	source.textContent = sourceAge;
	source.href = safeUrl(data?.sourceUrl, 'https://www.nasa.gov/international-space-station/space-station-visiting-vehicles/');
	card.dataset.signal = data?.status === 'ok' ? 'good' : data?.status === 'degraded' ? 'warn' : 'hold';
}

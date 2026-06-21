import { buildFootprintCircle, fallbackForecast, forecastFromTle } from './orbit.js';

let map;
let marker;
let liveTrail;
let forecastTrail;
let footprintLayer;
let terminatorLayer;
let eventLayer;
let focusLayer;
let previousFix;

function escapeHtml(value) {
	return String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function splitAntimeridian(prev, next) {
	return prev && Math.abs(next.longitude - prev.longitude) > 300;
}

export function initMap() {
	const dark = window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
		subdomains: 'abcd',
		maxZoom: 7
	});
	const darkLabels = window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', {
		subdomains: 'abcd',
		maxZoom: 7,
		pane: 'overlayPane'
	});
	const topo = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 7 });
	map = window.L.map('iss-map', {
		worldCopyJump: true,
		zoomControl: true,
		attributionControl: false,
		layers: [dark, darkLabels]
	}).setView([0, 0], 3);
	window.L.control.layers(
		{ 'Dark orbit': dark, 'Open map': topo },
		{ Labels: darkLabels },
		{ position: 'topright' }
	).addTo(map);

	const icon = window.L.divIcon({ className: 'iss-marker', html: '', iconSize: [38, 38], iconAnchor: [19, 19] });
	marker = window.L.marker([0, 0], { icon }).addTo(map);
	liveTrail = window.L.polyline([], { color: '#67f7a2', weight: 2, opacity: .9 }).addTo(map);
	forecastTrail = window.L.polyline([], { color: '#62e7ff', weight: 2, opacity: .72, dashArray: '8,10' }).addTo(map);
	footprintLayer = window.L.polygon([], { color: '#ffd166', weight: 1, opacity: .5, fillColor: '#ffd166', fillOpacity: .08 }).addTo(map);
	eventLayer = window.L.layerGroup().addTo(map);
	focusLayer = window.L.layerGroup().addTo(map);
	terminatorLayer = window.L.layerGroup().addTo(map);
	refreshTerminator();
	setInterval(refreshTerminator, 60_000);
	document.addEventListener('mission:event-focus', event => {
		const { lat, lon, title } = event.detail || {};
		if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
		focusLayer.clearLayers();
		window.L.circleMarker([lat, lon], {
			radius: 10,
			color: '#ffd166',
			fillColor: '#ffd166',
			fillOpacity: .36,
			weight: 2
		}).bindTooltip(escapeHtml(title || 'Earth event'), { permanent: false }).addTo(focusLayer).openTooltip();
		map.setView([lat, lon], Math.max(map.getZoom(), 4), { animate: true });
	});

	document.getElementById('toggle-terminator')?.addEventListener('change', event => {
		if (!terminatorLayer) return;
		event.target.checked ? terminatorLayer.addTo(map) : map.removeLayer(terminatorLayer);
	});
	document.getElementById('toggle-footprint')?.addEventListener('change', event => {
		event.target.checked ? footprintLayer.addTo(map) : map.removeLayer(footprintLayer);
	});
	document.getElementById('toggle-events')?.addEventListener('change', event => {
		event.target.checked ? eventLayer.addTo(map) : map.removeLayer(eventLayer);
	});
	return map;
}

function refreshTerminator() {
	if (!window.SunCalc || !terminatorLayer || !map) return;
	const checked = document.getElementById('toggle-terminator')?.checked !== false;
	terminatorLayer.clearLayers();
	if (!checked) return;

	const now = new Date();
	const step = 10;
	for (let lat = -90; lat < 90; lat += step) {
		for (let lon = -180; lon < 180; lon += step) {
			const centerLat = lat + step / 2;
			const centerLon = lon + step / 2;
			const altitude = window.SunCalc.getPosition(now, centerLat, centerLon).altitude;
			if (altitude >= 0) continue;
			window.L.rectangle(
				[[lat, lon], [lat + step, lon + step]],
				{
					stroke: false,
					fillColor: '#03080b',
					fillOpacity: Math.min(0.34, 0.14 + Math.abs(altitude) / 4),
					interactive: false
				}
			).addTo(terminatorLayer);
		}
	}
}

export function updateMap(state, tle) {
	if (!map || !state) return;
	const latLng = [state.latitude, state.longitude];
	marker.setLatLng(latLng);
	if (!previousFix) map.setView(latLng, 3);
	if (splitAntimeridian(previousFix, state)) liveTrail.setLatLngs([]);
	const trail = liveTrail.getLatLngs();
	trail.push(latLng);
	if (trail.length > 900) trail.splice(0, trail.length - 900);
	liveTrail.setLatLngs(trail);

	const forecast = forecastFromTle(tle);
	forecastTrail.setLatLngs(forecast.length ? forecast : fallbackForecast(state));
	document.getElementById('path-confidence').textContent = forecast.length ? 'Forecast: SGP4 from TLE' : 'Forecast: approximate fallback';

	const footprint = buildFootprintCircle(state.latitude, state.longitude, state.footprint);
	footprintLayer.setLatLngs(footprint);
	previousFix = state;
}

export function renderEvents(events = []) {
	if (!eventLayer) return;
	eventLayer.clearLayers();
	events.slice(0, 40).forEach(event => {
		const geometry = event.geometry?.find(item => Array.isArray(item.coordinates));
		const coords = geometry?.coordinates;
		if (!coords || coords.length < 2) return;
		const marker = window.L.circleMarker([coords[1], coords[0]], {
			radius: 5,
			color: '#ff5b6e',
			fillColor: '#ff5b6e',
			fillOpacity: .58,
			weight: 1
		}).bindTooltip(escapeHtml(event.title || 'Earth event'));
		marker.addTo(eventLayer);
	});
}

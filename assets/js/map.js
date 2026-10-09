import { buildFootprintCircle, forecastFromTle } from './orbit.js';

let map;
let marker;
let liveTrail;
let forecastTrail;
let footprintLayer;
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
	const earth = window.L.tileLayer('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/2004-12-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg', {
		minZoom: 1,
		maxZoom: 7,
		attribution: 'Imagery: <a href="https://earthdata.nasa.gov/gibs" target="_blank" rel="noopener noreferrer">NASA ESDIS GIBS</a>'
	});
	const night = window.L.tileLayer('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_CityLights_2012/default/2012-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg', {
		minZoom: 1,
		maxZoom: 7,
		attribution: 'Imagery: <a href="https://earthdata.nasa.gov/gibs" target="_blank" rel="noopener noreferrer">NASA ESDIS GIBS</a>'
	});
	map = window.L.map('iss-map', {
		worldCopyJump: true,
		minZoom: 1,
		maxZoom: 7,
		scrollWheelZoom: false,
		zoomControl: true,
		attributionControl: true,
		layers: [earth]
	}).setView([0, 0], 2);
	document.querySelectorAll('input[name="basemap"]').forEach(input => {
		input.addEventListener('change', () => {
			if (!input.checked) return;
			const next = input.value === 'night' ? night : earth;
			map.removeLayer(input.value === 'night' ? earth : night);
			next.addTo(map);
		});
	});

	const icon = window.L.divIcon({ className: 'iss-marker', html: '', iconSize: [38, 38], iconAnchor: [19, 19] });
	marker = window.L.marker([0, 0], { icon }).addTo(map);
	liveTrail = window.L.polyline([], { color: '#f8cf70', weight: 2, opacity: .9 }).addTo(map);
	forecastTrail = window.L.polyline([], { color: '#8fe4ed', weight: 2, opacity: .78, dashArray: '8,10' }).addTo(map);
	footprintLayer = window.L.polygon([], { color: '#f8cf70', weight: 1, opacity: .6, fillColor: '#f8cf70', fillOpacity: .08 }).addTo(map);
	eventLayer = window.L.layerGroup().addTo(map);
	focusLayer = window.L.layerGroup().addTo(map);
	document.addEventListener('mission:event-focus', event => {
		const { lat, lon, title } = event.detail || {};
		if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
		focusLayer.clearLayers();
		window.L.circleMarker([lat, lon], {
			radius: 10,
			color: '#f8cf70',
			fillColor: '#f8cf70',
			fillOpacity: .36,
			weight: 2
		}).bindTooltip(escapeHtml(title || 'Earth event'), { permanent: false }).addTo(focusLayer).openTooltip();
		map.setView([lat, lon], Math.max(map.getZoom(), 4), { animate: true });
	});

	document.getElementById('toggle-footprint')?.addEventListener('change', event => {
		event.target.checked ? footprintLayer.addTo(map) : map.removeLayer(footprintLayer);
	});
	document.getElementById('toggle-events')?.addEventListener('change', event => {
		event.target.checked ? eventLayer.addTo(map) : map.removeLayer(eventLayer);
	});
	return map;
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
	forecastTrail.setLatLngs(forecast);
	document.getElementById('path-confidence').textContent = forecast.length ? 'Forecast: SGP4 from TLE' : 'Forecast unavailable until orbit elements load';

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
			color: '#e889c3',
			fillColor: '#e889c3',
			fillOpacity: .58,
			weight: 1
		}).bindTooltip(escapeHtml(event.title || 'Earth event'));
		marker.addTo(eventLayer);
	});
}

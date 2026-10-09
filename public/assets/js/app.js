import { getDockedVehicles, getIssState, getSpaceWeather, getTle } from './api.js';
import { initContextArtifacts, updateContextArtifact } from './context.js';
import { initMap, renderEvents, updateMap } from './map.js';
import { predictPasses } from './orbit.js';
import { initStream } from './stream.js';
import { renderDockedVehicles, renderSpaceWeather, renderTelemetry } from './telemetry.js';

const state = {
	tickMs: 5000,
	latestIss: null,
	tle: null,
	observer: null
};

function initTheme() {
	let preference = null;
	try { preference = localStorage.getItem('iss-theme'); } catch { /* storage may be unavailable */ }
	const theme = preference || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
	const button = document.getElementById('theme-toggle');
	function setTheme(value) {
		document.documentElement.dataset.theme = value;
		button.setAttribute('aria-pressed', value === 'light' ? 'true' : 'false');
		button.setAttribute('aria-label', `Switch to ${value === 'light' ? 'dark' : 'light'} mode`);
	}
	setTheme(theme);
	button.addEventListener('click', () => {
		const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
		setTheme(next);
		try { localStorage.setItem('iss-theme', next); } catch { /* keep the choice for this page */ }
	});
}

function updateClock() {
	document.getElementById('utc-clock').textContent = new Date().toISOString().slice(11, 19) + ' UTC';
}

async function refreshTle() {
	state.tle = await getTle();
	if (state.tle?.epoch) document.getElementById('tle-epoch').textContent = state.tle.epoch;
	if (state.latestIss) updateMap(state.latestIss, state.tle);
	if (state.observer) renderPasses();
}

function renderPasses() {
	const { latitude, longitude } = state.observer;
	const passes = predictPasses(state.tle, latitude, longitude);
	const summary = document.getElementById('pass-summary');
	const detail = document.getElementById('pass-detail');
	if (!state.tle?.lines?.length) {
		summary.textContent = 'Waiting for orbit data';
		detail.textContent = 'Pass calculation needs current orbit elements.';
	} else {
		summary.textContent = passes.length ? `Next ${new Date(passes[0].start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'No pass in 24h';
		detail.textContent = passes.length ? `${passes.length} geometric passes above 10° in the next 24 hours.` : 'No 10° elevation pass found in the next 24 hours.';
	}
	updateContextArtifact('local-pass', { state: passes.length ? 'calculated' : 'unavailable', latitude, longitude, passes, detail: 'Predicted from the latest TLE in this browser. Weather, daylight, and station illumination are not included.' });
}

async function refreshContext() {
	const [weather, dockedVehicles] = await Promise.all([getSpaceWeather(), getDockedVehicles()]);
	updateContextArtifact('docked', dockedVehicles);
	updateContextArtifact('space-weather', weather);
	updateContextArtifact('earth-events', weather);
	renderDockedVehicles(dockedVehicles);
	renderSpaceWeather(weather);
	renderEvents(weather.events || []);
}

function runBackground(task, label) {
	Promise.resolve()
		.then(task)
		.catch(error => console.warn(`${label} failed`, error));
}

async function refreshIssLoop() {
	try {
		const iss = await getIssState();
		state.latestIss = iss;
		document.getElementById('tracking-status').textContent = 'TRACKING ISS';
		renderTelemetry(iss, state.tle);
		updateMap(iss, state.tle);
	} catch (error) {
		const freshness = document.getElementById('telemetry-freshness');
		document.getElementById('tracking-status').textContent = 'SIGNAL DELAYED';
		freshness.textContent = 'offline';
		freshness.className = 'freshness stale';
		document.getElementById('map-updated').textContent = `ISS state unavailable: ${error.message}`;
	} finally {
		setTimeout(refreshIssLoop, state.tickMs);
	}
}

function initLocalPass() {
	document.getElementById('local-pass')?.addEventListener('click', () => {
		if (!navigator.geolocation) {
			document.getElementById('pass-summary').textContent = 'Unsupported';
			updateContextArtifact('local-pass', {
				state: 'unsupported',
				detail: 'This browser does not expose geolocation. Pass calculation needs observer coordinates.'
			});
			return;
		}
		navigator.geolocation.getCurrentPosition(
			position => {
				const { latitude, longitude } = position.coords;
				state.observer = { latitude, longitude };
				renderPasses();
			},
			() => {
				document.getElementById('pass-summary').textContent = 'Location denied';
				updateContextArtifact('local-pass', {
					state: 'location denied',
					detail: 'Location was not available, so pass times were not calculated.'
				});
			},
			{ enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
		);
	});
}

async function boot() {
	initTheme();
	updateClock();
	setInterval(updateClock, 1000);
	initContextArtifacts();
	updateContextArtifact('local-pass', {
		state: 'optional',
		detail: 'Allow browser location to calculate geometric passes above 10° elevation. Coordinates stay in this browser.'
	});
	initMap();
	initLocalPass();
	refreshIssLoop();
	runBackground(initStream, 'stream initialisation');
	runBackground(refreshTle, 'TLE refresh');
	runBackground(refreshContext, 'mission context refresh');
	setInterval(refreshTle, 2 * 60 * 60 * 1000);
	setInterval(refreshContext, 10 * 60 * 1000);
}

boot();

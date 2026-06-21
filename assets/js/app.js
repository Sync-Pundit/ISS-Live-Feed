import { getDockedVehicles, getIssState, getSpaceWeather, getTle } from './api.js';
import { initContextArtifacts, updateContextArtifact } from './context.js';
import { initMap, renderEvents, updateMap } from './map.js';
import { initStream } from './stream.js';
import { renderDockedVehicles, renderSpaceWeather, renderTelemetry } from './telemetry.js';

const state = {
	tickMs: 5000,
	latestIss: null,
	tle: null
};

function updateClock() {
	document.getElementById('utc-clock').textContent = new Date().toISOString().slice(11, 19) + ' UTC';
}

async function refreshTle() {
	state.tle = await getTle();
	if (state.tle?.epoch) document.getElementById('tle-epoch').textContent = state.tle.epoch;
	if (state.latestIss) updateMap(state.latestIss, state.tle);
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
		renderTelemetry(iss, state.tle);
		updateMap(iss, state.tle);
	} catch (error) {
		const freshness = document.getElementById('telemetry-freshness');
		freshness.textContent = 'offline';
		freshness.className = 'freshness stale';
		document.getElementById('map-updated').textContent = `ISS state unavailable: ${error.message}`;
	} finally {
		setTimeout(refreshIssLoop, state.tickMs);
	}
}

function initLocalPassStub() {
	document.getElementById('local-pass')?.addEventListener('click', () => {
		if (!navigator.geolocation) {
			document.getElementById('pass-summary').textContent = 'Unsupported';
			updateContextArtifact('local-pass', {
				state: 'unsupported',
				detail: 'This browser does not expose geolocation, so local pass estimation cannot run here.'
			});
			return;
		}
		navigator.geolocation.getCurrentPosition(
			position => {
				const { latitude, longitude } = position.coords;
				document.getElementById('pass-summary').textContent = 'Location captured';
				document.querySelector('#pass-summary + p').textContent = `Local pass estimation queued for ${latitude.toFixed(2)}, ${longitude.toFixed(2)}.`;
				updateContextArtifact('local-pass', {
					state: 'location captured',
					latitude,
					longitude,
					detail: `Local pass estimation queued for ${latitude.toFixed(2)}, ${longitude.toFixed(2)}.`
				});
			},
			() => {
				document.getElementById('pass-summary').textContent = 'Location denied';
				updateContextArtifact('local-pass', {
					state: 'location denied',
					detail: 'Browser location permission was denied. Pass prediction remains unavailable.'
				});
			},
			{ enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
		);
	});
}

async function boot() {
	updateClock();
	setInterval(updateClock, 1000);
	initContextArtifacts();
	updateContextArtifact('local-pass', {
		state: 'optional',
		detail: 'Use browser location to estimate upcoming visible passes in a later wave.'
	});
	initMap();
	initLocalPassStub();
	refreshIssLoop();
	runBackground(initStream, 'stream initialisation');
	runBackground(refreshTle, 'TLE refresh');
	runBackground(refreshContext, 'mission context refresh');
	setInterval(refreshTle, 2 * 60 * 60 * 1000);
	setInterval(refreshContext, 10 * 60 * 1000);
}

boot();

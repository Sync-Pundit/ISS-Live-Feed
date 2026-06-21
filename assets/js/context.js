const ARTIFACT_COPY = {
	'docked': {
		kicker: 'Vehicle Manifest',
		title: 'Docked vehicles',
		body: '<p>Manifest details will expand here with vehicle names, source provenance, and update age.</p>'
	},
	'space-weather': {
		kicker: 'Solar Conditions',
		title: 'Space weather',
		body: '<p>Solar telemetry will expand here with Kp, GOES X-ray flux, source status, and operational interpretation.</p>'
	},
	'earth-events': {
		kicker: 'Earth Event Feed',
		title: 'Earth events',
		body: '<p>EONET hazards will expand here with categories, locations, and map actions.</p>'
	},
	'local-pass': {
		kicker: 'Observer Pass',
		title: 'Local pass',
		body: '<p>Local pass estimation is a planned wave. Location capture status will appear here when enabled.</p>'
	}
};

let activeCard = null;
const artifactData = {};

function esc(value) {
	return String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
}

function safeUrl(value, fallback) {
	try {
		const url = new URL(value || fallback, window.location.origin);
		return url.protocol === 'https:' ? url.href : fallback;
	} catch {
		return fallback;
	}
}

function formatDate(value) {
	const date = value ? new Date(value) : null;
	return Number.isFinite(date?.getTime()) ? date.toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : 'unknown';
}

function fluxClass(flux) {
	if (!Number.isFinite(flux)) return 'unknown';
	if (flux >= 1e-4) return 'X-class';
	if (flux >= 1e-5) return 'M-class';
	if (flux >= 1e-6) return 'C-class';
	if (flux >= 1e-7) return 'B-class';
	return 'A-class';
}

function kpInterpretation(kp) {
	if (!Number.isFinite(kp)) return 'Kp feed unavailable.';
	if (kp >= 7) return 'Strong geomagnetic storm conditions; navigation and radio disruption are possible.';
	if (kp >= 5) return 'Geomagnetic storm watch; aurora and minor radio impacts are possible.';
	if (kp >= 3) return 'Active but not storm-level geomagnetic conditions.';
	return 'Quiet geomagnetic conditions; no meaningful space-weather disruption indicated.';
}

function renderKeyValue(label, value) {
	return `<div class="artifact-kv"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
}

function renderRows(items) {
	return `<div class="artifact-rows">${items.join('')}</div>`;
}

function renderDockedDetails(data) {
	const vehicles = Array.isArray(data?.vehicles) ? data.vehicles : [];
	const source = data?.source || 'NASA';
	const updated = formatDate(data?.updatedAt || data?.fetchedAt);
	const vehicleRows = vehicles.length
		? vehicles.map((vehicle, index) => `
			<div class="artifact-row">
				<span class="row-index">${String(index + 1).padStart(2, '0')}</span>
				<div>
					<strong>${esc(vehicle)}</strong>
					<p>${esc(source)} manifest entry</p>
				</div>
			</div>
		`).join('')
		: '<p>No vehicle list was returned by the current source.</p>';

	return `
		<div class="artifact-grid">
			${renderKeyValue('Status', data?.status || 'unavailable')}
			${renderKeyValue('Count', data?.count ?? (vehicles.length || '--'))}
			${renderKeyValue('Source', source)}
			${renderKeyValue('Updated', updated)}
		</div>
		${renderRows([vehicleRows])}
		<p class="artifact-note">${esc(data?.description || data?.detail || 'Docked vehicle source returned no description.')}</p>
		<a class="artifact-link" href="${esc(safeUrl(data?.sourceUrl, 'https://www.nasa.gov/international-space-station/space-station-visiting-vehicles/'))}" target="_blank" rel="noopener noreferrer">Open source manifest</a>
	`;
}

function renderSpaceWeatherDetails(data) {
	const kp = data?.kp?.kp;
	const flux = Number(data?.xray?.flux);
	const events = Array.isArray(data?.events) ? data.events.length : 0;
	return `
		<div class="artifact-grid">
			${renderKeyValue('Kp index', Number.isFinite(kp) ? kp : '--')}
			${renderKeyValue('GOES flux', Number.isFinite(flux) ? `${flux.toExponential(2)} W/m²` : '--')}
			${renderKeyValue('Flux class', fluxClass(flux))}
			${renderKeyValue('Open EONET events', events)}
		</div>
		${renderRows([
			`<div class="artifact-row"><span class="row-index">KP</span><div><strong>${esc(kpInterpretation(kp))}</strong><p>Latest reading ${esc(formatDate(data?.kp?.time))}</p></div></div>`,
			`<div class="artifact-row"><span class="row-index">XR</span><div><strong>${esc(fluxClass(flux))} solar X-ray background</strong><p>Energy ${esc(data?.xray?.energy || 'unknown')} at ${esc(formatDate(data?.xray?.time))}</p></div></div>`
		])}
		<p class="artifact-note">Sources: ${esc((data?.sources || ['NOAA SWPC', 'NASA EONET']).join(' • '))}. Fetched ${esc(formatDate(data?.fetchedAt))}.</p>
	`;
}

function bodyFor(card) {
	const key = card.dataset.artifact;
	if (key === 'docked') return renderDockedDetails(artifactData.docked);
	if (key === 'space-weather') return renderSpaceWeatherDetails(artifactData['space-weather']);
	if (key === 'earth-events') return renderEarthEventsDetails(artifactData['earth-events']);
	if (key === 'local-pass') return renderLocalPassDetails(artifactData['local-pass']);
	return ARTIFACT_COPY[key]?.body || '<p>No artifact details available.</p>';
}

function latestGeometry(event) {
	const geometries = Array.isArray(event?.geometry) ? event.geometry : [];
	return [...geometries].reverse().find(item => Array.isArray(item.coordinates) && item.coordinates.length >= 2);
}

function renderEarthEventsDetails(data) {
	const events = Array.isArray(data?.events) ? data.events : [];
	const rows = events.slice(0, 10).map((event, index) => {
		const geometry = latestGeometry(event);
		const coords = geometry?.coordinates || [];
		const category = event.categories?.[0]?.title || 'Unclassified';
		const magnitude = Number.isFinite(geometry?.magnitudeValue)
			? `${geometry.magnitudeValue} ${geometry.magnitudeUnit || ''}`.trim()
			: 'no magnitude';
		const hasCoords = Number.isFinite(Number(coords[0])) && Number.isFinite(Number(coords[1]));
		return `
			<div class="artifact-row event-row">
				<span class="row-index">${String(index + 1).padStart(2, '0')}</span>
				<div>
					<strong>${esc(event.title || 'Untitled event')}</strong>
					<p>${esc(category)} • ${esc(magnitude)} • updated ${esc(formatDate(geometry?.date))}</p>
					${hasCoords ? `<button class="inline-action" type="button" data-event-index="${index}">Track on map</button>` : ''}
				</div>
			</div>
		`;
	});

	return `
		<div class="artifact-grid">
			${renderKeyValue('Status', data?.status || 'unavailable')}
			${renderKeyValue('Open events', events.length)}
			${renderKeyValue('Source', 'NASA EONET')}
			${renderKeyValue('Fetched', formatDate(data?.fetchedAt))}
		</div>
		${rows.length ? renderRows(rows) : '<p>No active Earth events were returned by the feed.</p>'}
		<p class="artifact-note">Showing the first ${Math.min(events.length, 10)} events from the active EONET feed. Map actions use the latest point geometry available for each event.</p>
		<a class="artifact-link" href="https://eonet.gsfc.nasa.gov/" target="_blank" rel="noopener noreferrer">Open EONET source</a>
	`;
}

function renderLocalPassDetails(data = {}) {
	const state = data.state || 'optional';
	const detail = data.detail || 'Use browser location to estimate upcoming visible passes in a later wave.';
	return `
		<div class="artifact-grid">
			${renderKeyValue('State', state)}
			${renderKeyValue('Latitude', Number.isFinite(data.latitude) ? data.latitude.toFixed(2) : '--')}
			${renderKeyValue('Longitude', Number.isFinite(data.longitude) ? data.longitude.toFixed(2) : '--')}
			${renderKeyValue('Planner', 'later wave')}
		</div>
		<p class="artifact-note">${esc(detail)}</p>
	`;
}

function setCardState(card, expanded) {
	card.classList.toggle('is-expanded', expanded);
	card.querySelector('.card-toggle')?.setAttribute('aria-expanded', expanded ? 'true' : 'false');
}

function renderArtifact(card) {
	const artifact = document.getElementById('context-artifact');
	const kicker = document.getElementById('artifact-kicker');
	const title = document.getElementById('artifact-title');
	const body = document.getElementById('artifact-body');
	const content = ARTIFACT_COPY[card.dataset.artifact];
	if (!artifact || !kicker || !title || !body || !content) return;

	kicker.textContent = content.kicker;
	title.textContent = content.title;
	body.innerHTML = bodyFor(card);
	artifact.hidden = false;
}

function toggleCard(card) {
	if (activeCard === card) {
		setCardState(card, false);
		document.getElementById('context-artifact')?.setAttribute('hidden', '');
		activeCard = null;
		return;
	}
	if (activeCard) setCardState(activeCard, false);
	activeCard = card;
	setCardState(card, true);
	renderArtifact(card);
}

function shouldIgnoreCardClick(event) {
	if (event.target.closest('.card-toggle')) return false;
	return Boolean(event.target.closest('a, button, input, label, select, textarea'));
}

export function initContextArtifacts() {
	const cards = [...document.querySelectorAll('.context-card[data-artifact]')];
	cards.forEach(card => {
		card.addEventListener('click', event => {
			if (shouldIgnoreCardClick(event)) return;
			toggleCard(card);
		});
	});

	document.getElementById('artifact-close')?.addEventListener('click', () => {
		if (activeCard) setCardState(activeCard, false);
		activeCard = null;
		document.getElementById('context-artifact')?.setAttribute('hidden', '');
	});
	document.getElementById('artifact-body')?.addEventListener('click', event => {
		const button = event.target.closest('button[data-event-index]');
		if (!button) return;
		const events = Array.isArray(artifactData['earth-events']?.events) ? artifactData['earth-events'].events : [];
		const selected = events[Number(button.dataset.eventIndex)];
		const geometry = latestGeometry(selected);
		const coords = geometry?.coordinates || [];
		if (!Number.isFinite(Number(coords[0])) || !Number.isFinite(Number(coords[1]))) return;
		document.dispatchEvent(new CustomEvent('mission:event-focus', {
			detail: {
				title: esc(selected.title || 'Earth event'),
				lon: Number(coords[0]),
				lat: Number(coords[1])
			}
		}));
	});
	document.addEventListener('keydown', event => {
		if (event.key !== 'Escape' || !activeCard) return;
		setCardState(activeCard, false);
		activeCard = null;
		document.getElementById('context-artifact')?.setAttribute('hidden', '');
	});
}

export function updateContextArtifact(key, data) {
	artifactData[key] = data;
	if (activeCard?.dataset.artifact === key) renderArtifact(activeCard);
}

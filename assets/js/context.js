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

function setCardState(card, expanded) {
	card.classList.toggle('is-expanded', expanded);
	card.setAttribute('aria-expanded', expanded ? 'true' : 'false');
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
	body.innerHTML = content.body;
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
	return Boolean(event.target.closest('a, button, input, label, select, textarea'));
}

export function initContextArtifacts() {
	const cards = [...document.querySelectorAll('.context-card[data-artifact]')];
	cards.forEach(card => {
		card.addEventListener('click', event => {
			if (shouldIgnoreCardClick(event)) return;
			toggleCard(card);
		});
		card.addEventListener('keydown', event => {
			if (event.key !== 'Enter' && event.key !== ' ') return;
			event.preventDefault();
			toggleCard(card);
		});
	});

	document.getElementById('artifact-close')?.addEventListener('click', () => {
		if (activeCard) setCardState(activeCard, false);
		activeCard = null;
		document.getElementById('context-artifact')?.setAttribute('hidden', '');
	});
	document.addEventListener('keydown', event => {
		if (event.key !== 'Escape' || !activeCard) return;
		setCardState(activeCard, false);
		activeCard = null;
		document.getElementById('context-artifact')?.setAttribute('hidden', '');
	});
}

import { getStream } from './api.js';

let player = null;
let currentVideoId = null;
let currentEmbedUrl = null;
let retryTimer = null;

function setStatus(label, mode = 'muted') {
	const pill = document.getElementById('stream-status');
	pill.className = `status-pill ${mode}`.trim();
	pill.innerHTML = `<span class="pulse"></span>${label}`;
}

function setOverlay(message, show = true) {
	const overlay = document.getElementById('video-overlay');
	if (!overlay) return;
	overlay.classList.toggle('hidden', !show);
	if (show) overlay.innerHTML = `<span class="loader-dot"></span><span>${message}</span>`;
}

function updateStreamUi(stream) {
	document.getElementById('stream-title').textContent = stream.title || 'ISS live stream';
	document.getElementById('stream-source').textContent = stream.source ? `source ${stream.source}` : 'source unknown';
	document.getElementById('stream-checked').textContent = stream.checkedAt ? `checked ${new Date(stream.checkedAt).toLocaleTimeString()}` : 'not checked';
	document.getElementById('stream-note').textContent = stream.note || (stream.degraded ? 'Using fallback while discovery is degraded.' : 'Auto-discovery is active.');
}

function resetPlayerHost() {
	const host = document.getElementById('yt-player');
	if (!host) return null;
	if (player?.destroy) player.destroy();
	player = null;
	host.innerHTML = '';
	return host;
}

function loadEmbedUrl(embedUrl) {
	if (!embedUrl || currentEmbedUrl === embedUrl) return false;
	currentEmbedUrl = embedUrl;
	currentVideoId = null;
	const host = resetPlayerHost();
	if (!host) return false;
	const iframe = document.createElement('iframe');
	iframe.src = embedUrl;
	iframe.title = 'ISS live fallback stream';
	iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
	iframe.referrerPolicy = 'strict-origin-when-cross-origin';
	iframe.allowFullscreen = true;
	host.appendChild(iframe);
	return true;
}

function loadVideo(videoId) {
	if (!videoId) return;
	if (player && currentVideoId === videoId) return;
	currentEmbedUrl = null;
	currentVideoId = videoId;
	if (player?.loadVideoById) {
		player.loadVideoById(videoId);
		return;
	}
	player = new window.YT.Player('yt-player', {
		videoId,
		playerVars: {
			autoplay: 1,
			mute: 1,
			rel: 0,
			playsinline: 1,
			modestbranding: 1
		},
		events: {
			onReady: event => {
				setOverlay('Live signal acquired', false);
				event.target.mute();
				event.target.playVideo();
			},
			onStateChange: event => {
				if (event.data === window.YT.PlayerState.ENDED) scheduleRefresh('Stream ended. Searching for replacement.');
				if (event.data === window.YT.PlayerState.PLAYING) setOverlay('', false);
			},
			onError: () => scheduleRefresh('Stream error. Searching for replacement.')
		}
	});
}

function renderNoStreamSource() {
	currentVideoId = null;
	currentEmbedUrl = null;
	resetPlayerHost();
	setOverlay('No stream source configured', true);
}

async function refreshStream(reason = 'Refreshing stream metadata') {
	setOverlay(reason, true);
	const stream = await getStream();
	updateStreamUi(stream);
	const mode = stream.status === 'live' ? 'good' : stream.degraded || stream.status === 'fallback' ? 'warn' : 'muted';
	setStatus(`Stream: ${stream.status || 'fallback'}`, mode);
	if (stream.status === 'fallback' && stream.embedUrl) {
		loadEmbedUrl(stream.embedUrl);
		setOverlay('Fallback channel signal loaded', false);
	} else if (stream.videoId) {
		loadVideo(stream.videoId);
		setOverlay(stream.status === 'live' ? 'Live signal acquired' : 'Fallback signal loaded', false);
	} else if (stream.embedUrl) {
		loadEmbedUrl(stream.embedUrl);
		setOverlay('Fallback channel signal loaded', false);
	} else {
		renderNoStreamSource();
	}
	return stream;
}

function scheduleRefresh(reason) {
	setStatus('Stream: searching', 'warn');
	setOverlay(reason, true);
	clearTimeout(retryTimer);
	retryTimer = setTimeout(() => refreshStream(reason), 3500);
}

export async function initStream() {
	document.getElementById('refresh-stream')?.addEventListener('click', () => refreshStream('Manual stream refresh'));
	if (window.YT?.Player) return refreshStream('Acquiring live signal');
	window.onYouTubeIframeAPIReady = () => refreshStream('Acquiring live signal');
	return null;
}

import { cachedJson, fetchJson } from '../_shared/utils.js';

async function latestKp() {
	try {
		const rows = await fetchJson('https://services.swpc.noaa.gov/json/planetary_k_index_1m.json');
		const latest = rows?.at?.(-1);
		return latest ? { time: latest.time_tag, kp: Number(latest.kp_index) } : null;
	} catch { return null; }
}

async function latestXray() {
	try {
		const rows = await fetchJson('https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json');
		const latest = rows?.at?.(-1);
		return latest ? { time: latest.time_tag, flux: Number(latest.flux), energy: latest.energy } : null;
	} catch { return null; }
}

async function activeEvents() {
	try {
		const data = await fetchJson('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=20');
		return (data.events || []).map(event => ({
			id: event.id,
			title: event.title,
			categories: event.categories,
			geometry: event.geometry
		}));
	} catch { return []; }
}

export async function onRequestGet({ request }) {
	return cachedJson(request, 'space-weather-v1', 300, async () => {
		const [kp, xray, events] = await Promise.all([latestKp(), latestXray(), activeEvents()]);
		return {
			status: kp || xray || events.length ? 'ok' : 'degraded',
			kp,
			xray,
			events,
			fetchedAt: new Date().toISOString(),
			sources: ['NOAA SWPC', 'NASA EONET']
		};
	});
}

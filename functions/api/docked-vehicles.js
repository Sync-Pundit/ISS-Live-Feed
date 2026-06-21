import { cachedJson, fetchJson } from '../_shared/utils.js';

const NASA_VISITING_VEHICLES_API = 'https://www.nasa.gov/wp-json/wp/v2/topic/201318';
const NASA_VISITING_VEHICLES_PAGE = 'https://www.nasa.gov/international-space-station/space-station-visiting-vehicles/';

const NUMBER_WORDS = new Map([
	['one', 1],
	['two', 2],
	['three', 3],
	['four', 4],
	['five', 5],
	['six', 6],
	['seven', 7],
	['eight', 8],
	['nine', 9],
	['ten', 10]
]);

function stripHtml(value = '') {
	return String(value)
		.replace(/<[^>]*>/g, ' ')
		.replace(/&#8217;/g, "'")
		.replace(/&rsquo;/g, "'")
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/\s+/g, ' ')
		.trim();
}

function parseCount(text) {
	const match = text.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+spaceships?\b/i);
	if (!match) return null;
	const value = match[1].toLowerCase();
	return NUMBER_WORDS.get(value) || Number(value);
}

export function parseVehicles(text) {
	const vehicles = new Set();
	const patterns = [
		/SpaceX\s+Crew-\d+\s+Dragon/gi,
		/Northrop\s+Grumman['’]?s\s+Cygnus\s+XL/gi,
		/Soyuz\s+MS-\d+/gi,
		/Progress\s+\d+/gi
	];
	for (const pattern of patterns) {
		for (const match of text.matchAll(pattern)) vehicles.add(match[0].replace(/'s$/, "'s"));
	}

	const progressGroup = text.match(/Progress\s+(\d+)\s+and\s+(\d+)/i);
	if (progressGroup) {
		vehicles.add(`Progress ${progressGroup[1]}`);
		vehicles.add(`Progress ${progressGroup[2]}`);
	}

	return [...vehicles];
}

export async function onRequestGet({ request }) {
	return cachedJson(request, 'docked-vehicles-v1', 3600, async () => {
		try {
			const topic = await fetchJson(NASA_VISITING_VEHICLES_API);
			const excerpt = stripHtml(topic?.excerpt?.rendered);
			const vehicles = parseVehicles(excerpt);
			const count = parseCount(excerpt) || vehicles.length || null;
			return {
				status: excerpt ? 'ok' : 'degraded',
				count,
				summary: count ? `${count} vehicles docked` : 'Visiting vehicles active',
				detail: vehicles.length ? vehicles.join(' • ') : excerpt || 'NASA visiting vehicle summary unavailable.',
				vehicles,
				description: excerpt,
				updatedAt: topic?.modified_gmt || topic?.modified || null,
				source: 'NASA',
				sourceUrl: topic?.link || NASA_VISITING_VEHICLES_PAGE,
				fetchedAt: new Date().toISOString()
			};
		} catch (error) {
			return {
				status: 'unavailable',
				count: null,
				summary: 'Source unavailable',
				detail: 'NASA visiting vehicle feed could not be reached.',
				vehicles: [],
				source: 'NASA',
				sourceUrl: NASA_VISITING_VEHICLES_PAGE,
				error: error.message,
				fetchedAt: new Date().toISOString()
			};
		}
	});
}

import { cachedJson, fetchJson } from '../_shared/utils.js';

const NASA_VISITING_VEHICLES_API = 'https://www.nasa.gov/wp-json/wp/v2/topic/201318';
const NASA_VISITING_VEHICLES_PAGE = 'https://www.nasa.gov/international-space-station/space-station-visiting-vehicles/';
const WIKIMEDIA_ISS_API = 'https://en.wikipedia.org/w/api.php?action=parse&page=International_Space_Station&prop=text&format=json&formatversion=2&origin=*';
const WIKIMEDIA_ISS_PAGE = 'https://en.wikipedia.org/wiki/International_Space_Station#Currently_docked/berthed';

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
		.replace(/&#160;/g, ' ')
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

function tableCells(row) {
	return [...row.matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/gis)]
		.map(match => stripHtml(match[1]))
		.filter(Boolean);
}

function parseWikimediaDockedTable(html) {
	const marker = 'id="Currently_docked/berthed"';
	const start = html.indexOf(marker);
	if (start === -1) return [];
	const section = html.slice(start);
	const tableEnd = section.indexOf('</table>');
	if (tableEnd === -1) return [];
	const table = section.slice(0, tableEnd);
	return [...table.matchAll(/<tr[^>]*>(.*?)<\/tr>/gis)]
		.slice(1)
		.map(match => tableCells(match[1]))
		.filter(cells => cells.length >= 6)
		.map(cells => ({
			mission: cells[0],
			type: cells[2],
			spacecraft: cells[3],
			arrival: cells[4],
			departure: cells[5],
			port: cells[6] || null
		}));
}

async function nasaVehicles() {
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
}

async function wikimediaVehicles() {
	const data = await fetchJson(WIKIMEDIA_ISS_API);
	const rows = parseWikimediaDockedTable(data?.parse?.text || '');
	const vehicles = rows.map(row => row.mission);
	return {
		status: rows.length ? 'degraded' : 'unavailable',
		count: rows.length || null,
		summary: rows.length ? `${rows.length} vehicles docked` : 'Source unavailable',
		detail: rows.length ? rows.slice(0, 5).map(row => row.mission).join(' • ') : 'Docked vehicle table unavailable.',
		vehicles,
		table: rows,
		description: rows.length ? 'Fallback parsed from the Wikimedia currently docked/berthed ISS table.' : null,
		updatedAt: null,
		source: 'Wikimedia',
		sourceUrl: WIKIMEDIA_ISS_PAGE,
		fetchedAt: new Date().toISOString()
	};
}

export async function onRequestGet({ request }) {
	return cachedJson(request, 'docked-vehicles-v1', 3600, async () => {
		try {
			const primary = await nasaVehicles();
			if (primary.vehicles.length || primary.description) return primary;
			return await wikimediaVehicles();
		} catch (error) {
			try {
				return { ...(await wikimediaVehicles()), primaryError: error.message };
			} catch (fallbackError) {
				return {
					status: 'unavailable',
					count: null,
					summary: 'Source unavailable',
					detail: 'NASA visiting vehicle feed could not be reached.',
					vehicles: [],
					source: 'NASA',
					sourceUrl: NASA_VISITING_VEHICLES_PAGE,
					error: `${error.message}; fallback: ${fallbackError.message}`,
					fetchedAt: new Date().toISOString()
				};
			}
		}
	});
}

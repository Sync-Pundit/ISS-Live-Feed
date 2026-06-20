import { cachedJson } from '../../_shared/utils.js';

function parseTle(text) {
	const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
	const line1Index = lines.findIndex(line => line.startsWith('1 25544'));
	if (line1Index < 0 || !lines[line1Index + 1]?.startsWith('2 25544')) throw new Error('ISS TLE not found');
	const name = line1Index > 0 ? lines[line1Index - 1] : 'ISS (ZARYA)';
	const line1 = lines[line1Index];
	const line2 = lines[line1Index + 1];
	const epochYear = Number(line1.slice(18, 20));
	const epochDay = Number(line1.slice(20, 32));
	const fullYear = epochYear < 57 ? 2000 + epochYear : 1900 + epochYear;
	return {
		name,
		lines: [line1, line2],
		epoch: `${fullYear} day ${epochDay.toFixed(5)}`,
		status: 'fresh',
		source: 'celestrak',
		fetchedAt: new Date().toISOString()
	};
}

export async function onRequestGet({ request }) {
	return cachedJson(request, 'iss-tle-v1', 7200, async () => {
		const response = await fetch('https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE');
		if (!response.ok) throw new Error(`CelesTrak returned ${response.status}`);
		return parseTle(await response.text());
	});
}

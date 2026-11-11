import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

function filesUnder(dir) {
	return readdirSync(new URL(`../${dir}/`, import.meta.url), { recursive: true })
		.filter(name => name.endsWith('.js'))
		.map(name => `./${dir}/${name.replace(/\\/g, '/')}`);
}

test('every script under src is cached for offline use', () => {
	const serviceWorker = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
	for (const file of filesUnder('src')) {
		assert.ok(serviceWorker.includes(`'${file}'`), `${file} is missing from FILES in sw.js`);
	}
});

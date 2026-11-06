import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FONT_SIZES, DEFAULT_FONT_SIZE, fontSizePx } from '../src/logic/settings.js';

test('three font sizes, default is normal', () => {
	assert.deepEqual(FONT_SIZES.map(s => [s.key, s.label, s.px]), [
		['normal', 'רגיל', 20],
		['large', 'גדול', 23],
		['xlarge', 'גדול מאוד', 26],
	]);
	assert.equal(DEFAULT_FONT_SIZE, 'normal');
});

test('fontSizePx falls back to the default for unknown keys', () => {
	assert.equal(fontSizePx('large'), 23);
	assert.equal(fontSizePx('huge'), 20);
	assert.equal(fontSizePx(null), 20);
});

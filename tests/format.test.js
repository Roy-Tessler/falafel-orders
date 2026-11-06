import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatMoney, formatTime, formatDate, formatShortDate } from '../src/dom.js';

test('formatMoney uses the shekel sign and whole numbers', () => {
	assert.equal(formatMoney(66), '₪66');
	assert.equal(formatMoney(1480), '₪1,480');
	assert.equal(formatMoney(0), '₪0');
});

test('formatTime shows local HH:MM', () => {
	assert.equal(formatTime(new Date(2026, 10, 6, 9, 5).toISOString()), '09:05');
});

test('formatDate shows the Hebrew day name and day.month', () => {
	assert.equal(formatDate('2026-11-06'), 'יום שישי 6.11');
	assert.equal(formatDate('2026-11-05'), 'יום חמישי 5.11');
	assert.equal(formatDate('2026-11-07'), 'שבת 7.11');
});

test('formatShortDate shows only day.month', () => {
	assert.equal(formatShortDate('2026-11-06'), '6.11');
	assert.equal(formatShortDate('2026-01-15'), '15.1');
});

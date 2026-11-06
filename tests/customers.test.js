import { test } from 'node:test';
import assert from 'node:assert/strict';
import { customerSuggestions, lastOrderOf, repeatLines } from '../src/logic/customers.js';

const o = (name, createdAt, lines = []) => ({ customerName: name, createdAt, lines });
const ORDERS = [
	o('דנה כהן', '2026-11-01T18:00:00Z', [{ itemId: 'a', name: 'פלאפל', price: 20, qty: 1 }]),
	o('דני לוי', '2026-11-03T18:00:00Z'),
	o('דנה כהן', '2026-11-05T18:00:00Z', [{ itemId: 'a', name: 'פלאפל', price: 20, qty: 2 }, { itemId: 'gone', name: 'ישן', price: 5, qty: 1 }]),
	o('  דנה   כהן ', '2026-10-01T18:00:00Z'),
	o('יוסי', '2026-11-04T18:00:00Z'),
];

test('suggestions match any word start, newest first, without duplicates', () => {
	assert.deepEqual(customerSuggestions(ORDERS, 'דנ', 5), ['דנה כהן', 'דני לוי']);
	assert.deepEqual(customerSuggestions(ORDERS, 'כה', 5), ['דנה כהן']);
	assert.deepEqual(customerSuggestions(ORDERS, 'דנ', 1), ['דנה כהן']);
});

test('no suggestions for empty text or an exact full match only', () => {
	assert.deepEqual(customerSuggestions(ORDERS, ' ', 5), []);
	assert.deepEqual(customerSuggestions(ORDERS, 'יוסי', 5), []);
});

test('lastOrderOf finds the newest order with normalized names', () => {
	assert.equal(lastOrderOf(ORDERS, 'דנה  כהן').createdAt, '2026-11-05T18:00:00Z');
	assert.equal(lastOrderOf(ORDERS, 'אין כזה'), undefined);
});

test('repeatLines uses current prices and skips removed items', () => {
	const menu = [{ id: 'a', name: 'מנה פלאפל', price: 25, active: true }, { id: 'gone', name: 'ישן', price: 5, active: false }];
	assert.deepEqual(repeatLines(lastOrderOf(ORDERS, 'דנה כהן').lines, menu), [{ itemId: 'a', name: 'מנה פלאפל', price: 25, qty: 2 }]);
});

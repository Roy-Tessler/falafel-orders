import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
	DEFAULT_MENU, eveningKey, addItem, changeQty, orderTotal,
	validateOrder, createOrder, validateMenuItem, isValidImage, orderSummary, removeLine,
} from '../src/logic/model.js';

test('DEFAULT_MENU has the real menu', () => {
	assert.deepEqual(DEFAULT_MENU, [
		{ name: 'מנה פלאפל', price: 25, image: 'images/falafel.svg', balls: 5 },
		{ name: 'חצי מנה', price: 12, image: 'images/half.svg', balls: 3 },
		{ name: 'צלחת חומוס עם פלאפל וסלט', price: 28, image: 'images/hummus.svg', balls: 6 },
		{ name: 'נקניקיה בלחמניה', price: 15, image: 'images/hotdog.svg' },
		{ name: "צ'יפס", price: 15, image: 'images/fries.svg' },
		{ name: 'מלבי', price: 10, image: 'images/malabi.svg' },
		{ name: 'פחית שתייה', price: 10, image: 'images/drink.svg' },
	]);
});

test('every DEFAULT_MENU image exists and is cached for offline use', () => {
	const serviceWorker = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
	for (const item of DEFAULT_MENU) {
		assert.ok(existsSync(new URL(`../${item.image}`, import.meta.url)), item.image);
		assert.ok(serviceWorker.includes(`'./${item.image}'`), item.image);
	}
});

test('eveningKey uses local date, and 00:05 belongs to the new day', () => {
	assert.equal(eveningKey(new Date(2026, 10, 6, 23, 59)), '2026-11-06');
	assert.equal(eveningKey(new Date(2026, 10, 7, 0, 5)), '2026-11-07');
	assert.equal(eveningKey(new Date(2026, 0, 3, 12, 0)), '2026-01-03');
});

test('addItem adds a new line then increments it', () => {
	const item = { id: 'a', name: "צ'יפס", price: 12 };
	const one = addItem([], item);
	assert.deepEqual(one, [{ itemId: 'a', name: "צ'יפס", price: 12, qty: 1 }]);
	assert.equal(addItem(one, item)[0].qty, 2);
	assert.equal(one[0].qty, 1);
});

test('addItem puts the added item first, new or existing', () => {
	const fries = { id: 'a', name: "צ'יפס", price: 12 };
	const drink = { id: 'b', name: 'שתייה', price: 7 };
	const both = addItem(addItem([], fries), drink);
	assert.deepEqual(both.map(l => l.itemId), ['b', 'a']);
	const again = addItem(both, fries);
	assert.deepEqual(again.map(l => [l.itemId, l.qty]), [['a', 2], ['b', 1]]);
});

test('changeQty removes the line at zero', () => {
	const lines = [{ itemId: 'a', name: 'x', price: 12, qty: 1 }];
	assert.deepEqual(changeQty(lines, 'a', -1), []);
	assert.equal(changeQty(lines, 'a', 2)[0].qty, 3);
	assert.equal(lines[0].qty, 1);
});

test('orderTotal sums price times qty', () => {
	assert.equal(orderTotal([{ price: 20, qty: 2 }, { price: 12, qty: 1 }, { price: 7, qty: 2 }]), 66);
	assert.equal(orderTotal([]), 0);
});

test('validateOrder needs a trimmed name and at least one line', () => {
	assert.deepEqual(validateOrder({ customerName: '  ', lines: [] }), ['חסר שם לקוח', 'ההזמנה ריקה']);
	assert.deepEqual(validateOrder({ customerName: 'דנה', lines: [{ qty: 1 }] }), []);
});

test('createOrder copies prices, trims the name, and sets the evening', () => {
	const lines = [{ itemId: 'a', name: 'פלאפל בפיתה', price: 20, qty: 2 }];
	const now = new Date(2026, 10, 6, 20, 15);
	const order = createOrder({ customerName: ' דנה כהן ', note: '', lines, payments: [{ method: 'cash', amount: 40 }] }, now, () => 'id1');
	lines[0].price = 99;
	assert.equal(order.lines[0].price, 20);
	assert.equal(order.customerName, 'דנה כהן');
	assert.equal(order.eveningDate, '2026-11-06');
	assert.equal(order.id, 'id1');
	assert.deepEqual(order.payments, [{ method: 'cash', amount: 40, at: now.toISOString() }]);
	assert.equal('payment' in order, false);
});

test('createOrder drops zero payments and rejects bad ones', () => {
	const lines = [{ itemId: 'a', name: 'x', price: 10, qty: 1 }];
	const o = createOrder({ customerName: 'x', note: '', lines, payments: [{ method: 'cash', amount: 0 }] }, new Date(), () => 'i');
	assert.deepEqual(o.payments, []);
	assert.throws(() => createOrder({ customerName: 'x', note: '', lines, payments: [{ method: 'card', amount: 5 }] }, new Date(), () => 'i'), RangeError);
});

test('validateMenuItem rejects empty names and bad prices', () => {
	const PRICE_ERR = 'המחיר חייב להיות מספר שלם, 0 או יותר';
	assert.deepEqual(validateMenuItem({ name: 'שתייה', price: 7 }), []);
	assert.deepEqual(validateMenuItem({ name: ' ', price: 7 }), ['חסר שם פריט']);
	assert.deepEqual(validateMenuItem({ name: 'x', price: 7.5 }), [PRICE_ERR]);
	assert.deepEqual(validateMenuItem({ name: 'x', price: -1 }), [PRICE_ERR]);
});

test('isValidImage accepts bundled images and photo data urls only', () => {
	assert.equal(isValidImage('images/falafel.svg'), true);
	assert.equal(isValidImage('data:image/jpeg;base64,AAAA'), true);
	assert.equal(isValidImage(''), false);
	assert.equal(isValidImage('javascript:alert(1)'), false);
	assert.equal(isValidImage('https://example.com/x.png'), false);
	assert.equal(isValidImage('images/../../x.svg'), false);
});

test('orderSummary lists quantity and name of each line', () => {
	const lines = [
		{ itemId: 'a', name: 'מנה פלאפל', price: 25, qty: 2 },
		{ itemId: 'b', name: 'שתייה', price: 10, qty: 1 },
	];
	assert.equal(orderSummary(lines), '2× מנה פלאפל, 1× שתייה');
});

test('orderSummary of no lines is empty', () => {
	assert.equal(orderSummary([]), '');
});

test('removeLine drops the whole line whatever its quantity', () => {
	const lines = [
		{ itemId: 'a', name: 'מנה פלאפל', price: 25, qty: 5 },
		{ itemId: 'b', name: 'שתייה', price: 10, qty: 1 },
	];
	assert.deepEqual(removeLine(lines, 'a'), [lines[1]]);
	assert.equal(lines.length, 2);
	assert.deepEqual(removeLine(lines, 'missing'), lines);
});

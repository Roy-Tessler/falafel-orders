import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	DEFAULT_MENU, eveningKey, addItem, changeQty, orderTotal,
	validateOrder, createOrder, validateMenuItem, isValidImage,
} from '../src/logic/model.js';

test('DEFAULT_MENU has the real menu', () => {
	assert.deepEqual(DEFAULT_MENU, [
		{ name: 'מנה פלאפל', price: 25, image: 'images/falafel.svg' },
		{ name: "צ'יפס", price: 15, image: 'images/fries.svg' },
		{ name: 'שתייה', price: 10, image: 'images/drink.svg' },
		{ name: 'נקניקייה בלחמניה', price: 15, image: 'images/hotdog.svg' },
		{ name: 'כדור פלאפל', price: 2, image: 'images/ball.svg' },
	]);
});

test('eveningKey uses local date, and 00:05 belongs to the new day', () => {
	assert.equal(eveningKey(new Date(2026, 10, 6, 23, 59)), '2026-11-06');
	assert.equal(eveningKey(new Date(2026, 10, 7, 0, 5)), '2026-11-07');
	assert.equal(eveningKey(new Date(2026, 0, 3, 12, 0)), '2026-01-03');
});

test('addItem appends then increments', () => {
	const item = { id: 'a', name: "צ'יפס", price: 12 };
	const one = addItem([], item);
	assert.deepEqual(one, [{ itemId: 'a', name: "צ'יפס", price: 12, qty: 1 }]);
	assert.equal(addItem(one, item)[0].qty, 2);
	assert.equal(one[0].qty, 1);
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

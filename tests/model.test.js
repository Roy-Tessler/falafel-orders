import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	PAYMENT, DEFAULT_MENU, eveningKey, addItem, changeQty, orderTotal,
	validateOrder, createOrder, setPayment, validateMenuItem,
} from '../src/logic/model.js';

test('DEFAULT_MENU has the real menu', () => {
	assert.deepEqual(DEFAULT_MENU, [
		{ name: 'מנה פלאפל', price: 25 },
		{ name: "צ'יפס", price: 15 },
		{ name: 'שתייה', price: 10 },
		{ name: 'נקניקייה בלחמניה', price: 15 },
		{ name: 'כדור פלאפל', price: 2 },
	]);
	assert.deepEqual(PAYMENT, { UNPAID: 'unpaid', BIT: 'bit', CASH: 'cash' });
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
	const order = createOrder({ customerName: ' דנה כהן ', note: '', lines, payment: 'cash' },
		new Date(2026, 10, 6, 20, 15), () => 'id1');
	lines[0].price = 99;
	assert.equal(order.lines[0].price, 20);
	assert.equal(order.customerName, 'דנה כהן');
	assert.equal(order.eveningDate, '2026-11-06');
	assert.equal(order.id, 'id1');
	assert.equal(order.payment, 'cash');
	assert.ok(order.paidAt);
});

test('createOrder with unpaid has null paidAt', () => {
	const o = createOrder({ customerName: 'x', note: '', lines: [{ itemId: 'a', name: 'x', price: 1, qty: 1 }], payment: 'unpaid' }, new Date(), () => 'i');
	assert.equal(o.paidAt, null);
});

test('setPayment sets and clears paidAt and rejects unknown states', () => {
	const now = new Date(2026, 10, 7, 9, 0);
	const base = { payment: 'unpaid', paidAt: null };
	assert.equal(setPayment(base, 'bit', now).paidAt, now.toISOString());
	assert.equal(setPayment(base, 'bit', now).payment, 'bit');
	assert.equal(setPayment({ payment: 'bit', paidAt: 'x' }, 'unpaid', now).paidAt, null);
	assert.throws(() => setPayment(base, 'card', now), RangeError);
});

test('validateMenuItem rejects empty names and bad prices', () => {
	const PRICE_ERR = 'המחיר חייב להיות מספר שלם, 0 או יותר';
	assert.deepEqual(validateMenuItem({ name: 'שתייה', price: 7 }), []);
	assert.deepEqual(validateMenuItem({ name: ' ', price: 7 }), ['חסר שם פריט']);
	assert.deepEqual(validateMenuItem({ name: 'x', price: 7.5 }), [PRICE_ERR]);
	assert.deepEqual(validateMenuItem({ name: 'x', price: -1 }), [PRICE_ERR]);
});

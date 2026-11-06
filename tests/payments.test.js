import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	METHOD, STATUS, paidAmount, paidBy, remainingAmount, paymentStatus,
	addPayment, clearPayments, validatePayments, upgradeOrder,
} from '../src/logic/payments.js';

const NOW = new Date('2026-11-06T18:00:00Z');
const order = (payments, price = 70) => ({ lines: [{ itemId: 'a', name: 'x', price, qty: 1 }], payments });

test('methods and statuses', () => {
	assert.deepEqual(METHOD, { PAYBOX: 'paybox', CASH: 'cash' });
	assert.deepEqual(STATUS, { UNPAID: 'unpaid', PARTIAL: 'partial', PAID: 'paid' });
});

test('amounts and status follow the payments', () => {
	const split = order([{ method: 'cash', amount: 20, at: 'x' }, { method: 'paybox', amount: 50, at: 'x' }]);
	assert.equal(paidAmount(split), 70);
	assert.equal(paidBy(split, 'cash'), 20);
	assert.equal(paidBy(split, 'paybox'), 50);
	assert.equal(remainingAmount(split), 0);
	assert.equal(paymentStatus(split), 'paid');
	const part = order([{ method: 'cash', amount: 20, at: 'x' }]);
	assert.equal(remainingAmount(part), 50);
	assert.equal(paymentStatus(part), 'partial');
	assert.equal(paymentStatus(order([])), 'unpaid');
});

test('an order whose total dropped below the payments counts as paid with nothing remaining', () => {
	const over = order([{ method: 'paybox', amount: 80, at: 'x' }]);
	assert.equal(remainingAmount(over), 0);
	assert.equal(paymentStatus(over), 'paid');
});

test('a free order with no payments counts as paid', () => {
	assert.equal(paymentStatus(order([], 0)), 'paid');
});

test('addPayment appends and validates', () => {
	const o = addPayment(order([]), 'paybox', 30, NOW);
	assert.deepEqual(o.payments, [{ method: 'paybox', amount: 30, at: NOW.toISOString() }]);
	assert.throws(() => addPayment(o, 'card', 10, NOW), RangeError);
	assert.throws(() => addPayment(o, 'cash', 0, NOW), RangeError);
	assert.throws(() => addPayment(o, 'cash', 2.5, NOW), RangeError);
});

test('clearPayments empties the list without touching the input', () => {
	const o = order([{ method: 'cash', amount: 20, at: 'x' }]);
	assert.deepEqual(clearPayments(o).payments, []);
	assert.equal(o.payments.length, 1);
});

test('validatePayments checks whole amounts and the order total', () => {
	assert.deepEqual(validatePayments([{ method: 'cash', amount: 20 }, { method: 'paybox', amount: 50 }], 70), []);
	assert.deepEqual(validatePayments([{ method: 'cash', amount: 0 }], 70), []);
	assert.deepEqual(validatePayments([{ method: 'cash', amount: 2.5 }], 70), ['סכום תשלום חייב להיות מספר שלם, 0 או יותר']);
	assert.deepEqual(validatePayments([{ method: 'cash', amount: NaN }], 70), ['סכום תשלום חייב להיות מספר שלם, 0 או יותר']);
	assert.deepEqual(validatePayments([{ method: 'cash', amount: 50 }, { method: 'paybox', amount: 30 }], 70), ['התשלום גבוה מסכום ההזמנה']);
});

test('upgradeOrder converts the old single payment field', () => {
	const base = { id: 'o', lines: [{ itemId: 'a', name: 'x', price: 30, qty: 2 }] };
	assert.deepEqual(upgradeOrder({ ...base, payment: 'paybox', paidAt: 't' }).payments, [{ method: 'paybox', amount: 60, at: 't' }]);
	assert.deepEqual(upgradeOrder({ ...base, payment: 'unpaid', paidAt: null }).payments, []);
	const upgraded = upgradeOrder({ ...base, payment: 'cash', paidAt: 't' });
	assert.equal('payment' in upgraded || 'paidAt' in upgraded, false);
	const modern = { ...base, payments: [] };
	assert.equal(upgradeOrder(modern), modern);
});

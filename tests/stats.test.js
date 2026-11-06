import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eveningList, eveningSummary, unpaidByEvening, trend } from '../src/logic/stats.js';

let seq = 0;
function o(date, hh, mm, payment, lines) {
	const [y, m, d] = date.split('-').map(Number);
	seq += 1;
	return {
		id: `o${seq}`, eveningDate: date, createdAt: new Date(y, m - 1, d, hh, mm).toISOString(),
		customerName: `c${seq}`, note: '', lines, payment, paidAt: payment === 'unpaid' ? null : 'x',
	};
}
const L = (itemId, name, price, qty) => ({ itemId, name, price, qty });
const FALAFEL = (q) => L('a', 'פלאפל', 20, q);
const FRIES = (q) => L('b', "צ'יפס", 12, q);
const DRINK = (q) => L('c', 'שתייה', 7, q);

test('eveningList groups by date, newest first', () => {
	const orders = [
		o('2026-11-02', 19, 0, 'cash', [L('x', 'x', 10, 1)]),
		o('2026-11-06', 19, 0, 'unpaid', [L('x', 'x', 20, 1)]),
		o('2026-11-06', 19, 5, 'paybox', [L('x', 'x', 30, 1)]),
	];
	assert.deepEqual(eveningList(orders), [
		{ date: '2026-11-06', count: 2, total: 50, unpaid: 20 },
		{ date: '2026-11-02', count: 1, total: 10, unpaid: 0 },
	]);
});

test('eveningSummary splits payments and ranks items', () => {
	const orders = [
		o('2026-11-06', 19, 10, 'paybox', [FALAFEL(2)]),
		o('2026-11-06', 19, 40, 'cash', [FRIES(1), FALAFEL(1)]),
		o('2026-11-06', 20, 20, 'unpaid', [DRINK(3)]),
	];
	const s = eveningSummary(orders);
	assert.equal(s.orderCount, 3);
	assert.equal(s.total, 93);
	assert.equal(s.average, 31);
	assert.equal(s.paidPaybox, 40);
	assert.equal(s.paidCash, 32);
	assert.equal(s.unpaid, 21);
	assert.deepEqual(s.items.map(i => [i.name, i.qty, i.amount]), [['פלאפל', 3, 60], ['שתייה', 3, 21], ["צ'יפס", 1, 12]]);
	assert.deepEqual(s.byHalfHour, [{ label: '19:00', count: 1 }, { label: '19:30', count: 1 }, { label: '20:00', count: 1 }]);
});

test('byHalfHour includes empty slots between orders', () => {
	const s = eveningSummary([o('2026-11-06', 19, 0, 'paybox', [FALAFEL(1)]), o('2026-11-06', 20, 10, 'paybox', [FALAFEL(1)])]);
	assert.deepEqual(s.byHalfHour, [{ label: '19:00', count: 1 }, { label: '19:30', count: 0 }, { label: '20:00', count: 1 }]);
});

test('eveningSummary of no orders is all zero', () => {
	const s = eveningSummary([]);
	assert.equal(s.orderCount, 0);
	assert.equal(s.average, 0);
	assert.deepEqual(s.items, []);
	assert.deepEqual(s.byHalfHour, []);
});

test('items keep the price on the order and the newest name after a rename', () => {
	const s = eveningSummary([
		o('2026-11-06', 19, 0, 'paybox', [L('a', 'פלאפל', 20, 1)]),
		o('2026-11-06', 20, 0, 'paybox', [L('a', 'פלאפל גדול', 25, 1)]),
	]);
	assert.deepEqual(s.items[0], { itemId: 'a', name: 'פלאפל גדול', qty: 2, amount: 45 });
});

test('unpaidByEvening lists only unpaid orders, newest date first', () => {
	const orders = [
		o('2026-11-02', 19, 0, 'unpaid', [FALAFEL(1)]),
		o('2026-11-06', 19, 30, 'unpaid', [FRIES(1)]),
		o('2026-11-06', 19, 0, 'unpaid', [DRINK(1)]),
		o('2026-11-06', 19, 45, 'paybox', [FALAFEL(3)]),
		o('2026-11-03', 19, 0, 'cash', [FALAFEL(3)]),
	];
	const groups = unpaidByEvening(orders);
	assert.deepEqual(groups.map(g => [g.date, g.orders.length, g.total]), [['2026-11-06', 2, 19], ['2026-11-02', 1, 20]]);
	assert.deepEqual(groups[0].orders.map(x => x.lines[0].name), ['שתייה', "צ'יפס"]);
});

test('trend takes the last N dates and filters by weekday', () => {
	const orders = [
		o('2026-10-29', 19, 0, 'paybox', [FALAFEL(4)]),
		o('2026-11-02', 19, 0, 'paybox', [FRIES(1)]),
		o('2026-11-05', 19, 0, 'paybox', [FALAFEL(1), FRIES(2)]),
		o('2026-11-06', 19, 0, 'paybox', [DRINK(5)]),
	];
	const t = trend(orders, { lastN: 2, weekday: null });
	assert.deepEqual(t.dates, ['2026-11-05', '2026-11-06']);
	assert.deepEqual(t.items.map(i => [i.name, i.perDate, i.total]), [['שתייה', [0, 5], 5], ["צ'יפס", [2, 0], 2], ['פלאפל', [1, 0], 1]]);
	const thu = trend(orders, { lastN: 8, weekday: 4 });
	assert.deepEqual(thu.dates, ['2026-10-29', '2026-11-05']);
	assert.deepEqual(thu.items[0], { itemId: 'a', name: 'פלאפל', perDate: [4, 1], total: 5 });
});

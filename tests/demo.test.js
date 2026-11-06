import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateDemoOrders, seededRandom } from '../src/logic/demo.js';
import { validateOrder, eveningKey, orderTotal } from '../src/logic/model.js';
import { weekdayOf } from '../src/logic/stats.js';

const MENU = [
	{ id: 'f', name: 'מנה פלאפל', price: 25, position: 0, active: true },
	{ id: 'c', name: "צ'יפס", price: 15, position: 1, active: true },
	{ id: 'd', name: 'שתייה', price: 10, position: 2, active: true },
	{ id: 'h', name: 'נקניקייה בלחמניה', price: 15, position: 3, active: true },
	{ id: 'b', name: 'כדור פלאפל', price: 2, position: 4, active: true },
	{ id: 'x', name: 'פריט שהוסר', price: 99, position: 5, active: false },
];
const NOW = new Date(2026, 10, 6, 20, 30);

test('seededRandom is deterministic', () => {
	const a = seededRandom(7);
	const b = seededRandom(7);
	assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});

test('demo covers 8 past Thursday and Saturday evenings plus today', () => {
	const orders = generateDemoOrders(MENU, NOW, seededRandom(1));
	const dates = [...new Set(orders.map(o => o.eveningDate))].sort();
	assert.equal(dates.length, 9);
	assert.equal(dates.at(-1), eveningKey(NOW));
	for (const date of dates.slice(0, -1)) {
		assert.ok([4, 6].includes(weekdayOf(date)), date);
	}
});

test('demo orders are valid and use active menu prices', () => {
	const orders = generateDemoOrders(MENU, NOW, seededRandom(2));
	for (const order of orders) {
		assert.deepEqual(validateOrder(order), []);
		assert.ok(new Date(order.createdAt) <= NOW);
		for (const line of order.lines) {
			const item = MENU.find(m => m.id === line.itemId);
			assert.ok(item.active);
			assert.equal(line.price, item.price);
			assert.ok(line.qty > 0);
		}
	}
	assert.equal(new Set(orders.map(o => o.id)).size, orders.length);
});

test('demo has busy evenings and realistic payments', () => {
	const orders = generateDemoOrders(MENU, NOW, seededRandom(3));
	const today = eveningKey(NOW);
	const older = orders.filter(o => o.eveningDate !== today);
	const perEvening = older.length / 8;
	assert.ok(perEvening >= 15 && perEvening <= 35, String(perEvening));
	const recentUnpaid = orders.filter(o => o.eveningDate === today && o.payment === 'unpaid').length;
	assert.ok(recentUnpaid > 0);
	assert.ok(orders.some(o => o.payment === 'paybox') && orders.some(o => o.payment === 'cash'));
	const paidOld = older.filter(o => o.payment !== 'unpaid').length / older.length;
	assert.ok(paidOld > 0.8, String(paidOld));
	assert.ok(orders.every(o => (o.payment === 'unpaid') === (o.paidAt === null)));
	assert.ok(orders.every(o => orderTotal(o.lines) > 0));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateDemoOrders, generateDemoExpenses, seededRandom } from '../src/logic/demo.js';
import { validateExpense, unsplitAmount } from '../src/logic/expenses.js';
import { validateOrder, eveningKey, orderTotal } from '../src/logic/model.js';
import { paymentStatus, paidBy, validatePayments } from '../src/logic/payments.js';
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

test('demo covers 8 past Monday and Wednesday evenings plus today', () => {
	const orders = generateDemoOrders(MENU, NOW, seededRandom(1));
	const dates = [...new Set(orders.map(o => o.eveningDate))].sort();
	assert.equal(dates.length, 9);
	assert.equal(dates.at(-1), eveningKey(NOW));
	for (const date of dates.slice(0, -1)) {
		assert.ok([1, 3].includes(weekdayOf(date)), date);
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
	const recentUnpaid = orders.filter(o => o.eveningDate === today && paymentStatus(o) !== 'paid').length;
	assert.ok(recentUnpaid > 0);
	assert.ok(orders.some(o => paidBy(o, 'paybox') > 0) && orders.some(o => paidBy(o, 'cash') > 0));
	assert.ok(orders.some(o => paymentStatus(o) === 'partial'));
	assert.ok(orders.some(o => paidBy(o, 'paybox') > 0 && paidBy(o, 'cash') > 0));
	const paidOld = older.filter(o => paymentStatus(o) === 'paid').length / older.length;
	assert.ok(paidOld > 0.8, String(paidOld));
	assert.ok(orders.every(o => validatePayments(o.payments, orderTotal(o.lines)).length === 0));
	assert.ok(orders.every(o => orderTotal(o.lines) > 0));
});

test('demo expenses are valid receipts on the demo evenings', () => {
	const expenses = generateDemoExpenses(NOW, seededRandom(4));
	const orderDates = new Set(generateDemoOrders(MENU, NOW, seededRandom(4)).map(o => o.eveningDate));
	assert.ok(expenses.length > 0);
	for (const expense of expenses) {
		assert.deepEqual(validateExpense(expense), []);
		assert.ok(orderDates.has(expense.date), expense.date);
		assert.ok(new Date(expense.createdAt) <= NOW);
	}
	assert.equal(new Set(expenses.map(e => e.id)).size, expenses.length);
	assert.ok(expenses.some(e => e.date === eveningKey(NOW)));
	assert.ok(expenses.some(e => unsplitAmount(e) > 0));
});

test('demo expenses leave a profit', () => {
	const random = seededRandom(5);
	const income = generateDemoOrders(MENU, NOW, random).reduce((sum, o) => sum + orderTotal(o.lines), 0);
	const spent = generateDemoExpenses(NOW, random).reduce((sum, e) => sum + e.total, 0);
	assert.ok(spent > income * 0.2 && spent < income * 0.7, `${spent} of ${income}`);
});

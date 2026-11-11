import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXPENSE_CATEGORIES, OTHER_CATEGORY, validateExpense, unsplitAmount, expensesTotal, categoryTotals, expensesInPeriod } from '../src/logic/expenses.js';
import { PERIOD } from '../src/logic/stats.js';

const receipt = (fields = {}) => ({ id: 'e1', date: '2026-11-08', shop: 'מאפיית אבי', total: 200, lines: [], createdAt: '2026-11-11T10:00:00.000Z', ...fields });

test('categories include pitas, oil, and the leftover category', () => {
	assert.ok(EXPENSE_CATEGORIES.includes('פיתות'));
	assert.ok(EXPENSE_CATEGORIES.includes('שמן'));
	assert.equal(OTHER_CATEGORY, 'שונות');
	assert.ok(EXPENSE_CATEGORIES.includes(OTHER_CATEGORY));
});

test('validateExpense accepts a receipt with only a shop, a total, and a date', () => {
	assert.deepEqual(validateExpense(receipt()), []);
});

test('validateExpense accepts a split that adds up to less than the total', () => {
	assert.deepEqual(validateExpense(receipt({ lines: [{ category: 'פיתות', amount: 120 }, { category: 'שמן', amount: 80 }] })), []);
});

test('validateExpense rejects a missing shop, a bad total, and a bad date', () => {
	assert.deepEqual(validateExpense(receipt({ shop: '  ' })), ['חסר שם החנות']);
	for (const total of [0, -5, 12.5, NaN]) {
		assert.deepEqual(validateExpense(receipt({ total })), ['הסכום חייב להיות מספר שלם גדול מ-0'], String(total));
	}
	assert.deepEqual(validateExpense(receipt({ date: '8.11.2026' })), ['תאריך לא תקין']);
});

test('validateExpense rejects bad split lines and a split above the total', () => {
	assert.deepEqual(validateExpense(receipt({ lines: [{ category: 'פיתות', amount: 0 }] })), ['כל סכום בפירוט חייב להיות מספר שלם גדול מ-0']);
	assert.deepEqual(validateExpense(receipt({ lines: [{ category: 'יהלומים', amount: 10 }] })), ['קטגוריה לא מוכרת']);
	assert.deepEqual(validateExpense(receipt({ lines: [{ category: 'פיתות', amount: 150 }, { category: 'שמן', amount: 80 }] })), ['הפירוט גדול מסכום הקבלה']);
});

test('unsplitAmount is the part of the total with no category', () => {
	assert.equal(unsplitAmount(receipt()), 200);
	assert.equal(unsplitAmount(receipt({ lines: [{ category: 'פיתות', amount: 120 }] })), 80);
});

test('categoryTotals adds lines per category and puts unsplit amounts under שונות', () => {
	const expenses = [
		receipt({ total: 200, lines: [{ category: 'פיתות', amount: 120 }, { category: 'שמן', amount: 50 }] }),
		receipt({ total: 90, lines: [{ category: 'פיתות', amount: 90 }] }),
		receipt({ total: 40, lines: [] }),
	];
	assert.equal(expensesTotal(expenses), 330);
	assert.deepEqual(categoryTotals(expenses), [
		{ category: 'פיתות', amount: 210 },
		{ category: 'שונות', amount: 70 },
		{ category: 'שמן', amount: 50 },
	]);
});

test('expensesInPeriod uses the receipt date', () => {
	const expenses = ['2026-10-30', '2026-11-02', '2025-12-01'].map(date => receipt({ date }));
	assert.deepEqual(expensesInPeriod(expenses, PERIOD.THIS_MONTH, '2026-11-11').map(e => e.date), ['2026-11-02']);
	assert.deepEqual(expensesInPeriod(expenses, PERIOD.LAST_YEAR, '2026-11-11').map(e => e.date), ['2025-12-01']);
});

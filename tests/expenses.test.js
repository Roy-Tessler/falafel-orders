import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXPENSE_CATEGORIES, OTHER_CATEGORY, MAX_CATEGORY_LENGTH, categoryList, withCategory, validateExpense, unsplitAmount, expensesTotal, categoryTotals, expensesInPeriod, shopSuggestions } from '../src/logic/expenses.js';
import { PERIOD } from '../src/logic/stats.js';

const receipt = (fields = {}) => ({ id: 'e1', date: '2026-11-08', shop: 'מאפיית אבי', total: 200, lines: [], createdAt: '2026-11-11T10:00:00.000Z', ...fields });

test('categories include pitas, oil, and the leftover category', () => {
	assert.ok(EXPENSE_CATEGORIES.includes('פיתות'));
	assert.ok(EXPENSE_CATEGORIES.includes('שמן'));
	assert.equal(OTHER_CATEGORY, 'שונות');
	assert.ok(EXPENSE_CATEGORIES.includes(OTHER_CATEGORY));
});

test('categories include the store items from the owner list once each', () => {
	const items = ['חומוס גרגירים', 'חומוס ממרח', "צ'יפס", 'שמן', 'פח חמוצים', 'פח כרוב כבוש', 'קרטון שתייה', 'פיתות', 'לחמניות', 'נקניקיות'];
	items.forEach(item => assert.ok(EXPENSE_CATEGORIES.includes(item), item));
	assert.equal(new Set(EXPENSE_CATEGORIES).size, EXPENSE_CATEGORIES.length);
	assert.equal(EXPENSE_CATEGORIES.at(-1), OTHER_CATEGORY);
});

test('categoryList puts added items before שונות and skips duplicates', () => {
	const list = categoryList(['טחינה גולמית', 'שמן']);
	assert.equal(list.at(-1), OTHER_CATEGORY);
	assert.equal(list.at(-2), 'טחינה גולמית');
	assert.equal(list.filter(category => category === 'שמן').length, 1);
	assert.deepEqual(categoryList([]), [...EXPENSE_CATEGORIES]);
});

test('withCategory adds a trimmed new item and ignores empty or known ones', () => {
	assert.deepEqual(withCategory([], '  טחינה גולמית '), ['טחינה גולמית']);
	assert.deepEqual(withCategory(['טחינה גולמית'], 'טחינה גולמית'), ['טחינה גולמית']);
	assert.deepEqual(withCategory([], 'פיתות'), []);
	assert.deepEqual(withCategory([], '   '), []);
	assert.deepEqual(withCategory([], 'א'.repeat(MAX_CATEGORY_LENGTH + 1)), []);
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
	assert.deepEqual(validateExpense(receipt({ lines: [{ category: '  ', amount: 10 }] })), ['חסר סוג בפירוט']);
	assert.deepEqual(validateExpense(receipt({ lines: [{ category: 'א'.repeat(MAX_CATEGORY_LENGTH + 1), amount: 10 }] })), ['שם הסוג ארוך מדי']);
	assert.deepEqual(validateExpense(receipt({ lines: [{ category: 'פיתות', amount: 150 }, { category: 'שמן', amount: 80 }] })), ['הפירוט גדול מסכום הקבלה']);
});

test('validateExpense accepts a free text category that is not in the list', () => {
	assert.deepEqual(validateExpense(receipt({ lines: [{ category: 'יהלומים', amount: 10 }] })), []);
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

test('shopSuggestions shows recent shops at first, then matches what is typed', () => {
	const receipt = (shop, date, createdAt = `${date}T10:00:00Z`) => ({ shop, date, createdAt, total: 10, lines: [] });
	const expenses = [
		receipt('שופרסל', '2026-11-01'),
		receipt('מאפיית אבו סאלח', '2026-11-10'),
		receipt(' שופרסל  ', '2026-11-12'),
		receipt('ירקות דוד', '2026-11-05'),
	];
	assert.deepEqual(shopSuggestions(expenses, '', 5), ['שופרסל', 'מאפיית אבו סאלח', 'ירקות דוד']);
	assert.deepEqual(shopSuggestions(expenses, '', 2), ['שופרסל', 'מאפיית אבו סאלח']);
	assert.deepEqual(shopSuggestions(expenses, 'אבו', 5), ['מאפיית אבו סאלח']);
	assert.deepEqual(shopSuggestions(expenses, 'שופרסל', 5), []);
	assert.deepEqual(shopSuggestions([], '', 5), []);
});

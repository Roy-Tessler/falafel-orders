import { isInPeriod } from './stats.js';

export const OTHER_CATEGORY = 'שונות';
export const EXPENSE_CATEGORIES = Object.freeze(['פיתות', 'שמן', 'ירקות', 'חומוס וטחינה', 'בשר ונקניקיות', 'שתייה', 'גז', 'אריזות', OTHER_CATEGORY]);

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isPositiveWhole(value) {
	return Number.isInteger(value) && value > 0;
}

function splitSum(expense) {
	return expense.lines.reduce((sum, line) => sum + line.amount, 0);
}

function lineErrors(lines) {
	const errors = [];
	if (!lines.every(line => isPositiveWhole(line.amount))) {
		errors.push('כל סכום בפירוט חייב להיות מספר שלם גדול מ-0');
	}
	if (!lines.every(line => EXPENSE_CATEGORIES.includes(line.category))) {
		errors.push('קטגוריה לא מוכרת');
	}
	return errors;
}

export function validateExpense(expense) {
	const errors = [];
	if (!expense.shop.trim()) {
		errors.push('חסר שם החנות');
	}
	if (!isPositiveWhole(expense.total)) {
		errors.push('הסכום חייב להיות מספר שלם גדול מ-0');
	}
	if (!DATE_PATTERN.test(expense.date) || Number.isNaN(Date.parse(expense.date))) {
		errors.push('תאריך לא תקין');
	}
	const splitProblems = lineErrors(expense.lines);
	errors.push(...splitProblems);
	if (splitProblems.length === 0 && isPositiveWhole(expense.total) && splitSum(expense) > expense.total) {
		errors.push('הפירוט גדול מסכום הקבלה');
	}
	return errors;
}

export function unsplitAmount(expense) {
	return expense.total - splitSum(expense);
}

export function expensesTotal(expenses) {
	return expenses.reduce((sum, expense) => sum + expense.total, 0);
}

export function categoryTotals(expenses) {
	const totals = new Map();
	const add = (category, amount) => totals.set(category, (totals.get(category) || 0) + amount);
	for (const expense of expenses) {
		expense.lines.forEach(line => add(line.category, line.amount));
		if (unsplitAmount(expense) > 0) {
			add(OTHER_CATEGORY, unsplitAmount(expense));
		}
	}
	return [...totals.entries()]
		.map(([category, amount]) => ({ category, amount }))
		.sort((a, b) => b.amount - a.amount);
}

export function expensesInPeriod(expenses, period, todayKey) {
	return expenses.filter(expense => isInPeriod(expense.date, period, todayKey));
}

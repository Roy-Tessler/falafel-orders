import { isInPeriod } from './stats.js';
import { nameSuggestions, recentNames } from './names.js';

export const OTHER_CATEGORY = 'שונות';
export const MAX_CATEGORY_LENGTH = 30;
export const EXPENSE_CATEGORIES = Object.freeze([
	'פיתות', 'לחמניות', 'שמן', 'ירקות', 'חומוס גרגירים', 'חומוס ממרח', 'חומוס וטחינה', "צ'יפס",
	'פח חמוצים', 'פח כרוב כבוש', 'נקניקיות', 'בשר ונקניקיות', 'שתייה', 'קרטון שתייה', 'גז', 'אריזות',
	OTHER_CATEGORY,
]);

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isPositiveWhole(value) {
	return Number.isInteger(value) && value > 0;
}

function splitSum(expense) {
	return expense.lines.reduce((sum, line) => sum + line.amount, 0);
}

function isFilledText(value) {
	return typeof value === 'string' && value.trim() !== '';
}

export function newestExpenseFirst(a, b) {
	return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);
}

export function shopSuggestions(expenses, text, limit) {
	const shops = [...expenses].sort(newestExpenseFirst).map(expense => expense.shop);
	return text.trim() ? nameSuggestions(shops, text, limit) : recentNames(shops, limit);
}

export function categoryList(customCategories) {
	const custom = customCategories.filter(category => !EXPENSE_CATEGORIES.includes(category));
	return [...EXPENSE_CATEGORIES.slice(0, -1), ...custom, OTHER_CATEGORY];
}

export function withCategory(customCategories, name) {
	const category = String(name).trim();
	const known = categoryList(customCategories).includes(category);
	if (category === '' || category.length > MAX_CATEGORY_LENGTH || known) {
		return customCategories;
	}
	return [...customCategories, category];
}

function lineErrors(lines) {
	const errors = [];
	if (!lines.every(line => isPositiveWhole(line.amount))) {
		errors.push('כל סכום בפירוט חייב להיות מספר שלם גדול מ-0');
	}
	if (!lines.every(line => isFilledText(line.category))) {
		errors.push('חסר סוג בפירוט');
	} else if (!lines.every(line => line.category.length <= MAX_CATEGORY_LENGTH)) {
		errors.push('שם הסוג ארוך מדי');
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

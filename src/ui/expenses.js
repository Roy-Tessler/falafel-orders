import { EXPENSE_CATEGORIES, categoryList, withCategory, MAX_CATEGORY_LENGTH, validateExpense, unsplitAmount, expensesTotal } from '../logic/expenses.js';
import { eveningKey } from '../logic/model.js';
import { h, icon, formatMoney, formatShortDate, confirmPanel, showToast, reveal, SAVE_FAILED } from '../dom.js';

const MONTH_FORMAT = new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' });
const SHOP_LIST_ID = 'shop-list';
const FREE_TEXT = '__free-text__';

function parseAmount(text) {
	const trimmed = String(text).trim();
	return trimmed === '' ? NaN : Number(trimmed);
}

function emptyForm() {
	return { date: eveningKey(new Date()), shop: '', total: '', lines: [] };
}

function formFromExpense(expense, categories) {
	return {
		date: expense.date,
		shop: expense.shop,
		total: String(expense.total),
		lines: expense.lines.map(line => ({ category: line.category, amount: String(line.amount), freeText: !categories.includes(line.category) })),
	};
}

function expenseFromForm(form, existing) {
	return {
		id: existing ? existing.id : crypto.randomUUID(),
		date: form.date,
		shop: form.shop.trim(),
		total: parseAmount(form.total),
		lines: form.lines.map(line => ({ category: line.category.trim(), amount: parseAmount(line.amount) })),
		createdAt: existing ? existing.createdAt : new Date().toISOString(),
	};
}

function categorySelect(line, categories, onPick) {
	const options = categories.list.map(category => h('option', { value: category, selected: !line.freeText && category === line.category }, category));
	options.push(h('option', { value: FREE_TEXT, selected: line.freeText }, 'אחר…'));
	return h('select', { 'aria-label': 'קטגוריה', onchange: e => onPick(e.target.value) }, options);
}

function freeTextRow(line, categories, onChange) {
	const input = h('input', { placeholder: 'מה קנית?', 'aria-label': 'סוג חדש', maxlength: MAX_CATEGORY_LENGTH, value: line.category,
		oninput: e => { line.category = e.target.value; } });
	const addButton = h('button', { class: 'small', onclick: async () => {
		addButton.disabled = true;
		if (await categories.add(line.category)) {
			line.freeText = false;
			line.category = line.category.trim();
			onChange();
		}
		addButton.disabled = false;
	} }, icon('plus', 'text-icon'), 'הוסף לרשימה');
	return h('div', { class: 'split-free' }, input, addButton);
}

function splitRow(line, categories, onChange, onRemove) {
	const select = categorySelect(line, categories, value => {
		line.freeText = value === FREE_TEXT;
		line.category = line.freeText ? '' : value;
		onChange();
	});
	const amount = h('input', { inputmode: 'numeric', placeholder: 'סכום', 'aria-label': 'סכום', value: line.amount,
		oninput: e => { line.amount = e.target.value; onChange(false); } });
	const row = h('div', { class: 'split-row' }, select, amount,
		h('button', { class: 'remove-line', 'aria-label': `הסר ${line.category || 'שורה'}`, onclick: onRemove }, icon('trash')));
	return h('div', {}, row, line.freeText ? freeTextRow(line, categories, onChange) : null);
}

function leftoverText(amount) {
	return amount >= 0 ? `ללא פירוט (שונות): ${formatMoney(amount)}` : `הפירוט גדול מסכום הקבלה ב-${formatMoney(-amount)}`;
}

function splitBox(form, categories) {
	const rows = h('div', {});
	const leftover = h('p', { class: 'muted' });
	const onChange = (redraw = true) => (redraw ? refresh() : updateLeftover());
	function refresh() {
		rows.replaceChildren(...form.lines.map((line, index) => splitRow(line, categories, onChange, () => {
			form.lines.splice(index, 1);
			refresh();
		})));
		updateLeftover();
	}
	function updateLeftover() {
		const total = parseAmount(form.total);
		const split = form.lines.reduce((sum, line) => sum + (parseAmount(line.amount) || 0), 0);
		leftover.textContent = form.lines.length > 0 && Number.isFinite(total) ? leftoverText(total - split) : '';
	}
	const add = h('button', { class: 'small', onclick: () => {
		form.lines.push({ category: EXPENSE_CATEGORIES[0], amount: '', freeText: false });
		refresh();
		rows.lastElementChild.querySelector('input').focus();
	} }, icon('plus', 'text-icon'), 'פירוט לפי סוג (לא חובה)');
	refresh();
	return { element: h('div', { class: 'split-box' }, rows, add, leftover), refresh: updateLeftover };
}

function receiptForm(form, shops, categories) {
	const errors = h('div', { class: 'error', role: 'alert' });
	const split = splitBox(form, categories);
	const field = (label, input) => h('label', { class: 'field' }, h('span', { class: 'muted' }, label), input);
	const element = h('div', { class: 'card' },
		field('תאריך הקבלה', h('input', { type: 'date', value: form.date, max: eveningKey(new Date()), oninput: e => { form.date = e.target.value; } })),
		field('חנות', h('input', { value: form.shop, list: SHOP_LIST_ID, autocomplete: 'off', oninput: e => { form.shop = e.target.value; } })),
		h('datalist', { id: SHOP_LIST_ID }, shops.map(shop => h('option', { value: shop }))),
		field('סכום הקבלה', h('input', { inputmode: 'numeric', value: form.total, oninput: e => { form.total = e.target.value; split.refresh(); } })),
		split.element,
		errors,
	);
	const showErrors = list => {
		errors.replaceChildren(...list.map(message => h('div', {}, message)));
		if (list.length > 0) {
			reveal(errors);
		}
		return list.length === 0;
	};
	return { element, showErrors };
}

function shopNames(expenses) {
	return [...new Set(expenses.map(expense => expense.shop))].sort((a, b) => a.localeCompare(b, 'he'));
}

function newestFirst(a, b) {
	return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);
}

function receiptRow(expense) {
	const detail = expense.lines.map(line => `${line.category} ${formatMoney(line.amount)}`);
	if (expense.lines.length > 0 && unsplitAmount(expense) > 0) {
		detail.push(`שונות ${formatMoney(unsplitAmount(expense))}`);
	}
	return h('a', { class: 'receipt-row', href: `#/expenses/${expense.id}` },
		h('span', { class: 'muted' }, formatShortDate(expense.date)),
		h('span', { class: 'grow' }, h('strong', {}, expense.shop), detail.length > 0 ? h('div', { class: 'muted' }, detail.join(' · ')) : null),
		h('strong', {}, formatMoney(expense.total)));
}

function receiptList(expenses) {
	if (expenses.length === 0) {
		return h('p', { class: 'muted' }, 'עוד אין קבלות');
	}
	const months = new Map();
	for (const expense of [...expenses].sort(newestFirst)) {
		const key = expense.date.slice(0, 7);
		months.set(key, [...(months.get(key) || []), expense]);
	}
	return h('div', {}, [...months.entries()].map(([key, list]) => h('div', { class: 'card' },
		h('h2', {}, `${MONTH_FORMAT.format(new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1))} · ${formatMoney(expensesTotal(list))}`),
		list.map(receiptRow))));
}

async function loadCategories(store) {
	let custom = await store.getExpenseCategories();
	const categories = { list: categoryList(custom) };
	categories.add = async name => {
		const updated = withCategory(custom, name);
		if (updated === custom) {
			showToast(String(name).trim() === '' ? 'צריך לכתוב שם' : 'הסוג כבר ברשימה');
			return categories.list.includes(String(name).trim());
		}
		try {
			await store.saveExpenseCategories(updated);
		} catch (error) {
			console.error(error);
			showToast(SAVE_FAILED);
			return false;
		}
		custom = updated;
		categories.list = categoryList(custom);
		showToast('נוסף לרשימה');
		return true;
	};
	return categories;
}

async function saveReceipt(store, form, view, existing, button) {
	const expense = expenseFromForm(form, existing);
	if (button.disabled || !view.showErrors(validateExpense(expense))) {
		return false;
	}
	button.disabled = true;
	try {
		await store.saveExpense(expense);
		return true;
	} catch (error) {
		console.error(error);
		view.showErrors([SAVE_FAILED]);
		return false;
	} finally {
		button.disabled = false;
	}
}

async function renderNew(store) {
	const section = h('section', {});
	async function fill() {
		const expenses = await store.getExpenses();
		const form = emptyForm();
		const view = receiptForm(form, shopNames(expenses), await loadCategories(store));
		const saveButton = h('button', { class: 'primary save-button' }, 'שמור קבלה');
		saveButton.addEventListener('click', async () => {
			if (await saveReceipt(store, form, view, null, saveButton)) {
				showToast('הקבלה נשמרה');
				await fill();
			}
		});
		view.element.append(saveButton);
		section.replaceChildren(h('h1', {}, 'הוצאות'), view.element, receiptList(expenses));
	}
	await fill();
	return section;
}

async function renderEdit(store, id) {
	const expense = await store.getExpense(id);
	if (!expense) {
		return h('p', { class: 'error' }, 'הקבלה לא נמצאה');
	}
	const back = () => { location.hash = '#/expenses'; };
	const categories = await loadCategories(store);
	const form = formFromExpense(expense, categories.list);
	const view = receiptForm(form, shopNames(await store.getExpenses()), categories);
	const saveButton = h('button', { class: 'primary grow' }, 'שמור שינויים');
	saveButton.addEventListener('click', async () => {
		if (await saveReceipt(store, form, view, expense, saveButton)) {
			back();
		}
	});
	const actions = h('div', { class: 'row' }, saveButton, h('button', { class: 'danger', onclick: () => {
		actions.after(confirmPanel(`למחוק את הקבלה מ${expense.shop} על ${formatMoney(expense.total)}?`, 'כן, למחוק', async () => {
			await store.deleteExpense(expense.id);
			back();
		}));
	} }, 'מחק קבלה'));
	view.element.append(actions);
	return h('section', {}, h('button', { class: 'back-button', onclick: back }, '→ חזרה לקבלות'), h('h1', {}, 'עריכת קבלה'), view.element);
}

export async function render(store, params) {
	return params.id ? renderEdit(store, params.id) : renderNew(store);
}

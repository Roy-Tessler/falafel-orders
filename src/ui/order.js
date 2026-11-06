import { addItem, changeQty, orderTotal, validateOrder, createOrder, PAYMENT } from '../logic/model.js';
import { h, formatMoney, confirmPanel, showToast, SAVE_FAILED } from '../dom.js';

const DRAFT_KEY = 'draft';

const PAYMENT_CHOICES = [
	[PAYMENT.UNPAID, 'לא שולם'],
	[PAYMENT.PAYBOX, 'פייבוקס'],
	[PAYMENT.CASH, 'מזומן'],
];

function emptyDraft() {
	return { customerName: '', note: '', lines: [], payment: PAYMENT.UNPAID };
}

function loadDraft() {
	try {
		const saved = JSON.parse(localStorage.getItem(DRAFT_KEY));
		if (!saved || !Array.isArray(saved.lines)) {
			return emptyDraft();
		}
		const known = PAYMENT_CHOICES.some(([value]) => value === saved.payment);
		return { ...saved, payment: known ? saved.payment : PAYMENT.UNPAID };
	} catch {
		return emptyDraft();
	}
}

function storeDraft(draft) {
	try {
		localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
	} catch {
		// Storage can be unavailable; the draft is only a convenience.
	}
}

function clearDraft() {
	try {
		localStorage.removeItem(DRAFT_KEY);
	} catch {
		// See storeDraft.
	}
}

function lineRow(line, onChange) {
	return h('div', { class: 'order-line' },
		h('span', { class: 'grow' }, `${line.qty} × ${line.name}`),
		h('span', { class: 'line-total' }, formatMoney(line.price * line.qty)),
		h('button', { class: 'small', 'aria-label': 'הפחת', onclick: () => onChange(line.itemId, -1) }, '−'),
		h('button', { class: 'small', 'aria-label': 'הוסף', onclick: () => onChange(line.itemId, 1) }, '+'),
	);
}

function itemGrid(menu, onAdd) {
	return h('div', { class: 'item-grid' },
		menu.map(item => h('button', { class: 'item-button', onclick: () => onAdd(item) },
			item.image ? h('img', { class: 'item-image', src: item.image, alt: '' }) : null,
			h('span', { class: 'item-name' }, item.name),
			h('span', { class: 'item-price' }, formatMoney(item.price)),
		)),
	);
}

function buildForm(menu, state, onChange) {
	const linesBox = h('div', { class: 'order-lines' });
	const totalBox = h('div', { class: 'big-total' });
	const errorsBox = h('div', { class: 'error', role: 'alert' });
	const nameInput = h('input', { placeholder: 'שם הלקוח', value: state.customerName, autocomplete: 'off',
		oninput: e => { state.customerName = e.target.value; onChange(); } });
	const noteInput = h('input', { placeholder: 'הערה (לא חובה)', value: state.note,
		oninput: e => { state.note = e.target.value; onChange(); } });

	function refresh() {
		linesBox.replaceChildren(...state.lines.map(line => lineRow(line, (itemId, delta) => {
			state.lines = changeQty(state.lines, itemId, delta);
			refresh();
			onChange();
		})));
		totalBox.textContent = `סה"כ: ${formatMoney(orderTotal(state.lines))}`;
	}
	const grid = itemGrid(menu, item => {
		state.lines = addItem(state.lines, item);
		refresh();
		onChange();
	});
	refresh();
	return { nameInput, noteInput, grid, linesBox, totalBox, errorsBox, refresh };
}

function layout(title, form, actions) {
	return h('section', { class: 'order-screen' },
		h('h1', {}, title),
		h('div', { class: 'card' }, form.nameInput),
		form.grid,
		h('div', { class: 'card' }, form.linesBox, form.totalBox, form.noteInput),
		form.errorsBox,
		actions,
	);
}

function paymentChoice(state, onChange) {
	const buttons = PAYMENT_CHOICES.map(([value, label]) => h('button', {
		class: `choice choice-${value}`,
		onclick: () => {
			state.payment = value;
			refresh();
			onChange();
		},
	}, label));
	function refresh() {
		buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(PAYMENT_CHOICES[i][0] === state.payment)));
	}
	refresh();
	return { element: h('div', { class: 'payment-choice', role: 'group', 'aria-label': 'תשלום' }, buttons), refresh };
}

function showErrors(form, draft) {
	const errors = validateOrder(draft);
	form.errorsBox.replaceChildren(...errors.map(message => h('div', {}, message)));
	return errors.length === 0;
}

function renderNew(store, menu) {
	const state = loadDraft();
	const form = buildForm(menu, state, () => storeDraft(state));
	const payment = paymentChoice(state, () => storeDraft(state));
	const saveButton = h('button', { class: 'primary save-button' }, 'שמור');

	async function save() {
		if (saveButton.disabled || !showErrors(form, state)) {
			return;
		}
		saveButton.disabled = true;
		try {
			await store.saveOrder(createOrder(state, new Date(), () => crypto.randomUUID()));
			Object.assign(state, emptyDraft());
			clearDraft();
			form.nameInput.value = '';
			form.noteInput.value = '';
			form.refresh();
			payment.refresh();
			showToast('ההזמנה נשמרה');
		} catch (error) {
			console.error(error);
			form.errorsBox.replaceChildren(h('div', {}, SAVE_FAILED));
		} finally {
			saveButton.disabled = false;
			form.nameInput.focus();
		}
	}
	saveButton.addEventListener('click', save);
	const view = layout('הזמנה חדשה', form, h('div', {}, payment.element, saveButton));
	setTimeout(() => form.nameInput.focus(), 0);
	return view;
}

function renderEdit(store, menu, order) {
	const state = { customerName: order.customerName, note: order.note, lines: order.lines };
	const form = buildForm(menu, state, () => {});
	const back = () => { location.hash = `#/evening/${order.eveningDate}`; };
	const saveButton = h('button', { class: 'primary grow' }, 'שמור שינויים');
	const deleteButton = h('button', { class: 'danger' }, 'מחק הזמנה');
	const actions = h('div', { class: 'row' }, saveButton, deleteButton);

	saveButton.addEventListener('click', async () => {
		if (saveButton.disabled || !showErrors(form, state)) {
			return;
		}
		saveButton.disabled = true;
		try {
			await store.saveOrder({ ...order, customerName: state.customerName.trim(), note: state.note.trim(), lines: state.lines });
		} catch (error) {
			console.error(error);
			saveButton.disabled = false;
			form.errorsBox.replaceChildren(h('div', {}, SAVE_FAILED));
			return;
		}
		back();
	});
	deleteButton.addEventListener('click', () => {
		actions.after(confirmPanel(`למחוק את ההזמנה של ${order.customerName}?`, 'כן, למחוק', async () => {
			await store.deleteOrder(order.id);
			back();
		}));
	});
	return layout(`עריכת הזמנה – ${order.customerName}`, form, actions);
}

export async function render(store, params) {
	const menu = (await store.getMenu()).filter(item => item.active);
	if (!params.id) {
		return renderNew(store, menu);
	}
	const order = await store.getOrder(params.id);
	if (!order) {
		return h('p', { class: 'error' }, 'ההזמנה לא נמצאה');
	}
	return renderEdit(store, menu, order);
}

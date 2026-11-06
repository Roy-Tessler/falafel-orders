import { addItem, changeQty, orderTotal, validateOrder, createOrder, PAYMENT } from '../logic/model.js';
import { h, formatMoney, confirmPanel, showToast, SAVE_FAILED } from '../dom.js';

const DRAFT_KEY = 'draft';

function emptyDraft() {
	return { customerName: '', note: '', lines: [] };
}

function loadDraft() {
	try {
		const saved = JSON.parse(localStorage.getItem(DRAFT_KEY));
		return saved && Array.isArray(saved.lines) ? saved : emptyDraft();
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

function showErrors(form, draft) {
	const errors = validateOrder(draft);
	form.errorsBox.replaceChildren(...errors.map(message => h('div', {}, message)));
	return errors.length === 0;
}

function renderNew(store, menu) {
	const state = loadDraft();
	const form = buildForm(menu, state, () => storeDraft(state));
	const saveUnpaid = h('button', { class: 'primary grow' }, 'שמור');
	const saveCash = h('button', { class: 'grow' }, 'שמור – שולם במזומן');

	async function save(payment) {
		if (saveUnpaid.disabled || !showErrors(form, state)) {
			return;
		}
		saveUnpaid.disabled = true;
		saveCash.disabled = true;
		try {
			await store.saveOrder(createOrder({ ...state, payment }, new Date(), () => crypto.randomUUID()));
			Object.assign(state, emptyDraft());
			clearDraft();
			form.nameInput.value = '';
			form.noteInput.value = '';
			form.refresh();
			showToast('ההזמנה נשמרה');
		} catch (error) {
			console.error(error);
			form.errorsBox.replaceChildren(h('div', {}, SAVE_FAILED));
		} finally {
			saveUnpaid.disabled = false;
			saveCash.disabled = false;
			form.nameInput.focus();
		}
	}
	saveUnpaid.addEventListener('click', () => save(PAYMENT.UNPAID));
	saveCash.addEventListener('click', () => save(PAYMENT.CASH));
	const view = layout('הזמנה חדשה', form, h('div', { class: 'row' }, saveUnpaid, saveCash));
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

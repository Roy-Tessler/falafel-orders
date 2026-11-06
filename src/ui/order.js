import { addItem, changeQty, orderTotal, validateOrder, createOrder } from '../logic/model.js';
import { validatePayments } from '../logic/payments.js';
import { h, formatMoney, confirmPanel, showToast, SAVE_FAILED } from '../dom.js';
import { emptyDraft, loadDraft, storeDraft, clearDraft } from './draft.js';
import { paymentChoice, draftPayments } from './paymentChoice.js';
import { customerPicker } from './customerPicker.js';

function lineRow(line, onChange) {
	return h('div', { class: 'order-line' },
		h('span', { class: 'qty-badge' }, String(line.qty)),
		h('span', { class: 'grow line-name' }, line.name),
		h('div', { class: 'stepper' },
			h('button', { class: 'step-button', 'aria-label': 'הוסף', onclick: () => onChange(line.itemId, 1) }, '+'),
			h('button', { class: 'step-button minus', 'aria-label': 'הפחת', onclick: () => onChange(line.itemId, -1) }, '−'),
		),
		h('span', { class: 'line-total' }, formatMoney(line.price * line.qty)),
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

function layout(title, form, nameExtras, actions) {
	return h('section', { class: 'order-screen' },
		h('h1', {}, title),
		h('div', { class: 'card' }, form.nameInput, nameExtras),
		form.grid,
		h('div', { class: 'card' }, form.linesBox, form.totalBox, form.noteInput),
		form.errorsBox,
		actions,
	);
}

function showErrors(form, errors) {
	form.errorsBox.replaceChildren(...errors.map(message => h('div', {}, message)));
	return errors.length === 0;
}

function newOrderErrors(state) {
	const total = orderTotal(state.lines);
	return [...validateOrder(state), ...validatePayments(draftPayments(state, total), total)];
}

function resetForm(state, parts) {
	Object.assign(state, emptyDraft());
	clearDraft();
	parts.form.nameInput.value = '';
	parts.form.noteInput.value = '';
	parts.form.refresh();
	parts.payment.refresh();
	parts.picker.update('');
}

function renderNew(store, menu, orders) {
	const state = loadDraft();
	const parts = {};
	const changed = () => {
		storeDraft(state);
		parts.payment?.updateRemaining();
	};
	parts.form = buildForm(menu, state, changed);
	parts.payment = paymentChoice(state, () => orderTotal(state.lines), changed);
	parts.picker = customerPicker(orders, menu, {
		onPick: name => { state.customerName = name; parts.form.nameInput.value = name; changed(); },
		onRepeat: lines => { state.lines = lines; parts.form.refresh(); changed(); },
	});
	parts.form.nameInput.addEventListener('input', () => parts.picker.update(parts.form.nameInput.value));
	parts.picker.update(state.customerName);
	const saveButton = h('button', { class: 'primary save-button' }, 'שמור');
	saveButton.addEventListener('click', () => saveNew(store, state, parts, saveButton, orders));
	const view = layout('הזמנה חדשה', parts.form, parts.picker.element, h('div', {}, parts.payment.element, saveButton));
	setTimeout(() => parts.form.nameInput.focus(), 0);
	return view;
}

async function saveNew(store, state, parts, saveButton, orders) {
	if (saveButton.disabled || !showErrors(parts.form, newOrderErrors(state))) {
		return;
	}
	saveButton.disabled = true;
	try {
		const total = orderTotal(state.lines);
		const order = createOrder({ ...state, payments: draftPayments(state, total) }, new Date(), () => crypto.randomUUID());
		await store.saveOrder(order);
		orders.push(order);
		resetForm(state, parts);
		showToast('ההזמנה נשמרה');
	} catch (error) {
		console.error(error);
		showErrors(parts.form, [SAVE_FAILED]);
	} finally {
		saveButton.disabled = false;
		parts.form.nameInput.focus();
	}
}

function renderEdit(store, menu, order) {
	const state = { customerName: order.customerName, note: order.note, lines: order.lines };
	const form = buildForm(menu, state, () => {});
	const back = () => { location.hash = `#/evening/${order.eveningDate}`; };
	const saveButton = h('button', { class: 'primary grow' }, 'שמור שינויים');
	const deleteButton = h('button', { class: 'danger' }, 'מחק הזמנה');
	const actions = h('div', { class: 'row' }, saveButton, deleteButton);

	saveButton.addEventListener('click', async () => {
		if (saveButton.disabled || !showErrors(form, validateOrder(state))) {
			return;
		}
		saveButton.disabled = true;
		try {
			await store.saveOrder({ ...order, customerName: state.customerName.trim(), note: state.note.trim(), lines: state.lines });
		} catch (error) {
			console.error(error);
			saveButton.disabled = false;
			showErrors(form, [SAVE_FAILED]);
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
	return layout(`עריכת הזמנה – ${order.customerName}`, form, null, actions);
}

export async function render(store, params) {
	const menu = (await store.getMenu()).filter(item => item.active);
	if (!params.id) {
		return renderNew(store, menu, await store.getOrders());
	}
	const order = await store.getOrder(params.id);
	if (!order) {
		return h('p', { class: 'error' }, 'ההזמנה לא נמצאה');
	}
	return renderEdit(store, menu, order);
}

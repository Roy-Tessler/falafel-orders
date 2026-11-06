import { orderTotal, orderSummary } from '../logic/model.js';
import { METHOD, STATUS, addPayment, clearPayments, paymentStatus, remainingAmount, paidAmount } from '../logic/payments.js';
import { eveningSummary } from '../logic/stats.js';
import { h, setChildren, formatMoney, formatDate, formatTime, showToast, SAVE_FAILED } from '../dom.js';

const TAP_GUARD_MS = 600;
const METHOD_LABELS = { [METHOD.PAYBOX]: 'פייבוקס', [METHOD.CASH]: 'מזומן' };

let s_busy = false;
let s_lastChangeAt = -Infinity;

async function applyChange(store, makeOrder, onChange) {
	if (s_busy || performance.now() - s_lastChangeAt < TAP_GUARD_MS) {
		return;
	}
	s_busy = true;
	const updated = makeOrder();
	try {
		await store.saveOrder(updated);
	} catch (error) {
		console.error(error);
		showToast(SAVE_FAILED, true);
		return;
	} finally {
		s_busy = false;
	}
	s_lastChangeAt = performance.now();
	onChange(updated);
}

function amountBox(order) {
	const status = paymentStatus(order);
	const breakdown = order.payments.map(p => `${METHOD_LABELS[p.method]} ${formatMoney(p.amount)}`).join(' + ');
	if (status === STATUS.PAID) {
		return h('div', { class: 'pay-amount paid-amount' }, h('strong', {}, formatMoney(orderTotal(order.lines))),
			breakdown ? h('div', { class: 'pay-detail' }, breakdown) : null);
	}
	if (status === STATUS.PARTIAL) {
		return h('div', { class: 'pay-amount' },
			h('strong', { class: 'unpaid' }, `נשאר ${formatMoney(remainingAmount(order))}`),
			h('div', { class: 'pay-detail paid-amount' }, `שולם ${formatMoney(paidAmount(order))} מתוך ${formatMoney(orderTotal(order.lines))}: ${breakdown}`));
	}
	return h('div', { class: 'pay-amount' }, h('strong', { class: 'unpaid' }, formatMoney(orderTotal(order.lines))));
}

function otherAmountForm(store, order, onChange) {
	const input = h('input', { inputmode: 'numeric', class: 'other-amount', placeholder: 'סכום', 'aria-label': 'סכום אחר' });
	const error = h('div', { class: 'error' });
	const pay = method => {
		const amount = Number(input.value.trim());
		if (!Number.isInteger(amount) || amount <= 0 || amount > remainingAmount(order)) {
			error.textContent = `סכום בין 1 ל-${remainingAmount(order)}`;
			return;
		}
		applyChange(store, () => addPayment(order, method, amount, new Date()), onChange);
	};
	return h('div', { class: 'other-form' },
		h('div', { class: 'row' }, input,
			h('button', { class: 'pay-paybox', onclick: () => pay(METHOD.PAYBOX) }, 'פייבוקס'),
			h('button', { class: 'pay-cash', onclick: () => pay(METHOD.CASH) }, 'מזומן')),
		error);
}

function actionsBox(store, order, onChange, row) {
	const remaining = remainingAmount(order);
	const payRest = method => applyChange(store, () => addPayment(order, method, remaining, new Date()), onChange);
	const undo = () => applyChange(store, () => clearPayments(order), onChange);
	return h('div', { class: 'row pay-actions' },
		remaining > 0 ? h('button', { class: 'pay-paybox', onclick: () => payRest(METHOD.PAYBOX) }, 'פייבוקס') : null,
		remaining > 0 ? h('button', { class: 'pay-cash', onclick: () => payRest(METHOD.CASH) }, 'מזומן') : null,
		remaining > 1 ? h('button', { class: 'small', onclick: e => {
			e.target.remove();
			row.append(otherAmountForm(store, order, onChange));
		} }, 'סכום אחר') : null,
		order.payments.length > 0 ? h('button', { class: 'small', onclick: undo }, 'בטל') : null,
	);
}

export function paymentRow(store, order, onChange) {
	const row = h('div', { class: `pay-row ${paymentStatus(order)}` });
	setChildren(row,
		h('div', { class: 'pay-main' },
			h('span', { class: 'muted pay-time' }, formatTime(order.createdAt)),
			h('a', { class: 'grow pay-name', href: `#/order/${order.id}` }, order.customerName),
			amountBox(order),
		),
		h('div', { class: 'pay-summary' }, orderSummary(order.lines)),
		order.note ? h('div', { class: 'pay-summary muted' }, order.note) : null,
		actionsBox(store, order, onChange, row),
	);
	return row;
}

function totalsBox(orders) {
	const s = eveningSummary(orders);
	const cell = (label, value, cls) => h('div', { class: 'total-cell' }, h('div', { class: 'muted' }, label), h('strong', { class: cls }, formatMoney(value)));
	return h('div', { class: 'totals row' },
		cell('שולם בפייבוקס', s.paidPaybox, 'paid-amount'),
		cell('שולם במזומן', s.paidCash, 'paid-amount'),
		cell('לא שולם', s.unpaid, s.unpaid > 0 ? 'unpaid' : ''),
	);
}

export async function render(store, params) {
	const orders = (await store.getOrdersByDate(params.date)).reverse();
	const filter = { text: '', unpaidOnly: false };
	const keepVisible = new Set();
	const totals = h('div', {});
	const list = h('div', { class: 'card' });

	function refresh() {
		totals.replaceChildren(totalsBox(orders));
		const text = filter.text.trim().toLowerCase();
		const visible = orders.filter(o => (!filter.unpaidOnly || remainingAmount(o) > 0 || keepVisible.has(o.id))
			&& o.customerName.toLowerCase().includes(text));
		list.replaceChildren(...visible.map(order => paymentRow(store, order, updated => {
			orders[orders.findIndex(o => o.id === updated.id)] = updated;
			keepVisible.add(updated.id);
			refresh();
		})));
		if (visible.length === 0) {
			list.append(h('p', { class: 'muted' }, 'אין הזמנות להצגה'));
		}
	}
	const search = h('input', { type: 'search', placeholder: 'חיפוש לפי שם', oninput: e => { filter.text = e.target.value; keepVisible.clear(); refresh(); } });
	const toggle = h('label', { class: 'toggle' },
		h('input', { type: 'checkbox', onchange: e => { filter.unpaidOnly = e.target.checked; keepVisible.clear(); refresh(); } }),
		'רק מי שלא שילם');
	refresh();
	return h('section', {},
		h('h1', {}, formatDate(params.date)),
		h('p', { class: 'muted' }, `${orders.length} הזמנות · ההזמנה האחרונה למעלה`),
		totals,
		h('div', { class: 'card row' }, h('div', { class: 'grow' }, search), toggle),
		list,
	);
}

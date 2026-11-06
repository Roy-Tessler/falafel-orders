import { setPayment, orderTotal, PAYMENT } from '../logic/model.js';
import { eveningSummary } from '../logic/stats.js';
import { h, formatMoney, formatDate, formatTime, showToast, SAVE_FAILED } from '../dom.js';

const TAP_GUARD_MS = 600;
const PAID_LABELS = { [PAYMENT.PAYBOX]: 'שולם בפייבוקס', [PAYMENT.CASH]: 'שולם במזומן' };

let s_busy = false;
let s_lastChangeAt = -Infinity;

export function paymentRow(store, order, onChange) {
	async function update(payment) {
		if (s_busy || performance.now() - s_lastChangeAt < TAP_GUARD_MS) {
			return;
		}
		s_busy = true;
		const updated = setPayment(order, payment, new Date());
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
	const status = order.payment === PAYMENT.UNPAID
		? h('div', { class: 'row' },
			h('button', { class: 'pay-paybox', onclick: () => update(PAYMENT.PAYBOX) }, 'פייבוקס'),
			h('button', { class: 'pay-cash', onclick: () => update(PAYMENT.CASH) }, 'מזומן'))
		: h('div', { class: 'row' },
			h('span', { class: `paid paid-${order.payment}` }, PAID_LABELS[order.payment]),
			h('button', { class: 'small', onclick: () => update(PAYMENT.UNPAID) }, 'בטל'));
	return h('div', { class: `pay-row ${order.payment}` },
		h('span', { class: 'muted pay-time' }, formatTime(order.createdAt)),
		h('a', { class: 'grow pay-name', href: `#/order/${order.id}` }, order.customerName),
		h('span', { class: 'pay-amount' }, formatMoney(orderTotal(order.lines))),
		status,
	);
}

function totalsBox(orders) {
	const s = eveningSummary(orders);
	return h('div', { class: 'totals row' },
		h('div', { class: 'total-cell' }, h('div', { class: 'muted' }, 'שולם בפייבוקס'), h('strong', {}, formatMoney(s.paidPaybox))),
		h('div', { class: 'total-cell' }, h('div', { class: 'muted' }, 'שולם במזומן'), h('strong', {}, formatMoney(s.paidCash))),
		h('div', { class: 'total-cell' }, h('div', { class: 'muted' }, 'לא שולם'), h('strong', { class: s.unpaid > 0 ? 'unpaid' : '' }, formatMoney(s.unpaid))),
	);
}

export async function render(store, params) {
	const orders = await store.getOrdersByDate(params.date);
	const filter = { text: '', unpaidOnly: false };
	const keepVisible = new Set();
	const totals = h('div', {});
	const list = h('div', { class: 'card' });

	function refresh() {
		totals.replaceChildren(totalsBox(orders));
		const text = filter.text.trim().toLowerCase();
		const visible = orders.filter(o => (!filter.unpaidOnly || o.payment === PAYMENT.UNPAID || keepVisible.has(o.id))
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
		h('p', { class: 'muted' }, `${orders.length} הזמנות`),
		totals,
		h('div', { class: 'card row' }, h('div', { class: 'grow' }, search), toggle),
		list,
	);
}

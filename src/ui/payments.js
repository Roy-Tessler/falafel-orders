import { setPayment, orderTotal, PAYMENT } from '../logic/model.js';
import { eveningSummary } from '../logic/stats.js';
import { h, formatMoney, formatDate, formatTime } from '../dom.js';

const PAID_LABELS = { [PAYMENT.BIT]: 'שולם בביט', [PAYMENT.CASH]: 'שולם במזומן' };

export function paymentRow(store, order, onChange) {
	async function update(payment) {
		const updated = setPayment(order, payment, new Date());
		await store.saveOrder(updated);
		onChange(updated);
	}
	const status = order.payment === PAYMENT.UNPAID
		? h('div', { class: 'row' },
			h('button', { class: 'pay-bit', onclick: () => update(PAYMENT.BIT) }, 'ביט'),
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
		h('div', { class: 'total-cell' }, h('div', { class: 'muted' }, 'שולם בביט'), h('strong', {}, formatMoney(s.paidBit))),
		h('div', { class: 'total-cell' }, h('div', { class: 'muted' }, 'שולם במזומן'), h('strong', {}, formatMoney(s.paidCash))),
		h('div', { class: 'total-cell' }, h('div', { class: 'muted' }, 'לא שולם'), h('strong', { class: s.unpaid > 0 ? 'unpaid' : '' }, formatMoney(s.unpaid))),
	);
}

export async function render(store, params) {
	const orders = await store.getOrdersByDate(params.date);
	const filter = { text: '', unpaidOnly: false };
	const totals = h('div', {});
	const list = h('div', { class: 'card' });

	function refresh() {
		totals.replaceChildren(totalsBox(orders));
		const text = filter.text.trim().toLowerCase();
		const visible = orders.filter(o => (!filter.unpaidOnly || o.payment === PAYMENT.UNPAID)
			&& o.customerName.toLowerCase().includes(text));
		list.replaceChildren(...visible.map(order => paymentRow(store, order, updated => {
			orders[orders.findIndex(o => o.id === updated.id)] = updated;
			refresh();
		})));
		if (visible.length === 0) {
			list.append(h('p', { class: 'muted' }, 'אין הזמנות להצגה'));
		}
	}
	const search = h('input', { type: 'search', placeholder: 'חיפוש לפי שם', oninput: e => { filter.text = e.target.value; refresh(); } });
	const toggle = h('label', { class: 'toggle' },
		h('input', { type: 'checkbox', onchange: e => { filter.unpaidOnly = e.target.checked; refresh(); } }),
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

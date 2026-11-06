import { unpaidByEvening } from '../logic/stats.js';
import { h, formatMoney, formatDate } from '../dom.js';
import { paymentRow } from './payments.js';

export async function render(store) {
	const orders = await store.getOrders();
	const view = h('section', {});

	function refresh() {
		const groups = unpaidByEvening(orders);
		const total = groups.reduce((sum, g) => sum + g.total, 0);
		view.replaceChildren(
			h('h1', {}, 'מי עוד לא שילם'),
			h('p', { class: 'big-total' + (total > 0 ? ' unpaid' : '') }, `סה"כ חוב: ${formatMoney(total)}`),
		);
		if (groups.length === 0) {
			view.append(h('p', { class: 'card' }, 'כולם שילמו'));
			return;
		}
		for (const group of groups) {
			view.append(h('div', { class: 'card' },
				h('h2', {}, h('a', { href: `#/evening/${group.date}` }, formatDate(group.date)), ` – ${formatMoney(group.total)}`),
				group.orders.map(order => paymentRow(store, order, updated => {
					orders[orders.findIndex(o => o.id === updated.id)] = updated;
					refresh();
				})),
			));
		}
	}
	refresh();
	return view;
}

import { remainingAmount } from '../logic/payments.js';
import { h, formatMoney, formatDate } from '../dom.js';
import { paymentRow } from './payments.js';

function groupsOf(orders) {
	const dates = [...new Set(orders.map(o => o.eveningDate))].sort().reverse();
	return dates.map(date => {
		const list = orders.filter(o => o.eveningDate === date).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
		const unpaid = list.reduce((sum, o) => sum + remainingAmount(o), 0);
		return { date, orders: list, unpaid };
	});
}

export async function render(store) {
	const orders = (await store.getOrders()).filter(o => remainingAmount(o) > 0);
	const view = h('section', {});

	function refresh() {
		const groups = groupsOf(orders);
		const total = groups.reduce((sum, g) => sum + g.unpaid, 0);
		view.replaceChildren(
			h('h1', {}, 'מי עוד לא שילם'),
			h('p', { class: 'big-total' + (total > 0 ? ' unpaid' : '') }, `סה"כ חוב: ${formatMoney(total)}`),
		);
		if (orders.length === 0) {
			view.append(h('p', { class: 'card' }, 'כולם שילמו'));
			return;
		}
		for (const group of groups) {
			view.append(h('div', { class: 'card' },
				h('h2', {}, h('a', { href: `#/evening/${group.date}` }, formatDate(group.date)), ` – ${formatMoney(group.unpaid)}`),
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

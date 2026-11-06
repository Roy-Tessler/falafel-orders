import { eveningKey } from '../logic/model.js';
import { eveningList } from '../logic/stats.js';
import { needsBackupReminder } from '../logic/backup.js';
import { h, formatMoney, formatDate } from '../dom.js';

function todayCard(today, evening) {
	const stats = evening || { count: 0, total: 0, unpaid: 0 };
	return h('a', { class: 'card today-card', href: `#/evening/${today}` },
		h('h2', {}, `היום – ${formatDate(today)}`),
		h('div', { class: 'row' },
			h('span', {}, `${stats.count} הזמנות`),
			h('span', {}, `סה"כ ${formatMoney(stats.total)}`),
			h('span', { class: stats.unpaid > 0 ? 'unpaid' : '' }, `לא שולם ${formatMoney(stats.unpaid)}`),
		),
	);
}

function pastRow(evening) {
	return h('a', { class: 'past-row', href: `#/evening/${evening.date}` },
		h('span', { class: 'grow' }, formatDate(evening.date)),
		h('span', {}, `${evening.count} הזמנות`),
		h('span', {}, formatMoney(evening.total)),
		h('span', { class: evening.unpaid > 0 ? 'unpaid' : 'muted' }, evening.unpaid > 0 ? `חוב ${formatMoney(evening.unpaid)}` : 'הכל שולם'),
	);
}

export async function render(store) {
	const orders = await store.getOrders();
	const today = eveningKey(new Date());
	const evenings = eveningList(orders);
	const past = evenings.filter(e => e.date !== today);
	const remind = needsBackupReminder(await store.getMeta('lastExportAt'), orders.length > 0, new Date());
	return h('section', {},
		remind ? h('a', { class: 'card reminder', href: '#/backup' }, 'לא נעשה גיבוי כבר שבוע. לגיבוי') : null,
		h('a', { class: 'button primary new-order', href: '#/order' }, 'הזמנה חדשה'),
		todayCard(today, evenings.find(e => e.date === today)),
		h('h2', {}, 'ערבים קודמים'),
		past.length > 0
			? h('div', { class: 'card' }, past.map(pastRow))
			: h('p', { class: 'muted' }, 'עוד אין ערבים קודמים'),
	);
}

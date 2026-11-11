import { eveningList, eveningSummary, trend, weekdayOf } from '../logic/stats.js';
import { h, formatMoney, formatDate, formatShortDate } from '../dom.js';

const LAST_N = 8;
const WEEKDAY_FILTERS = ['רק ימי ראשון', 'רק ימי שני', 'רק ימי שלישי', 'רק ימי רביעי', 'רק ימי חמישי', 'רק ימי שישי', 'רק שבתות'];

function stat(label, value, cls = '') {
	return h('div', { class: 'total-cell' }, h('div', { class: 'muted' }, label), h('strong', { class: cls }, value));
}

function halfHourBars(slots) {
	const max = Math.max(1, ...slots.map(s => s.count));
	return h('div', { class: 'bars' }, slots.map(slot => h('div', { class: 'bar-row' },
		h('span', { class: 'bar-label' }, slot.label),
		h('div', { class: 'bar-track' }, h('div', { class: 'bar', style: `width: ${(slot.count / max) * 100}%` })),
		h('span', { class: 'bar-count' }, String(slot.count)),
	)));
}

function eveningSection(orders) {
	const s = eveningSummary(orders);
	return h('div', {},
		h('div', { class: 'totals row' },
			stat('הזמנות', String(s.orderCount)),
			stat('סה"כ', formatMoney(s.total)),
			stat('ממוצע להזמנה', formatMoney(s.average)),
			stat('פייבוקס', formatMoney(s.paidPaybox), 'paid-amount'),
			stat('מזומן', formatMoney(s.paidCash), 'paid-amount'),
			stat('לא שולם', formatMoney(s.unpaid), s.unpaid > 0 ? 'unpaid' : ''),
			stat('כדורי פלאפל', String(s.falafelBalls)),
		),
		h('div', { class: 'card table-scroll' }, h('table', {},
			h('thead', {}, h('tr', {}, h('th', {}, 'פריט'), h('th', {}, 'כמות'), h('th', {}, 'סכום'))),
			h('tbody', {}, s.items.map(item => h('tr', {},
				h('td', {}, item.name), h('td', {}, String(item.qty)), h('td', {}, formatMoney(item.amount))))),
		)),
		h('div', { class: 'card' }, h('h3', {}, 'הזמנות לפי חצי שעה'), halfHourBars(s.byHalfHour)),
	);
}

function itemRow(item, index, last) {
	return h('tr', {},
		h('td', {}, item.name,
			index === 0 ? h('span', { class: 'badge best' }, 'הכי נמכר') : null,
			index === last && last > 0 ? h('span', { class: 'badge worst' }, 'הכי חלש') : null),
		item.perDate.map(qty => h('td', {}, String(qty))),
		h('td', {}, h('strong', {}, String(item.total))),
		h('td', {}, formatMoney(item.income)),
	);
}

function incomeRow(result) {
	return h('tr', { class: 'income-row' },
		h('td', {}, h('strong', {}, 'הכנסה')),
		result.incomePerDate.map(value => h('td', {}, h('strong', {}, formatMoney(value)))),
		h('td', {}),
		h('td', {}, h('strong', {}, formatMoney(result.incomeTotal))),
	);
}

function trendTable(result) {
	if (result.dates.length < 2) {
		return h('p', { class: 'muted' }, 'צריך לפחות שני ערבים כדי לראות מגמה');
	}
	const last = result.items.length - 1;
	const average = Math.round(result.incomeTotal / result.dates.length);
	return h('div', {},
		h('div', { class: 'totals row' },
			stat(`הכנסה ב-${result.dates.length} ערבים`, formatMoney(result.incomeTotal)),
			stat('ממוצע לערב', formatMoney(average))),
		h('div', { class: 'table-scroll' }, h('table', {},
			h('thead', {}, h('tr', {}, h('th', {}, 'פריט'), result.dates.map(d => h('th', {}, formatShortDate(d))),
				h('th', {}, 'כמות'), h('th', {}, 'הכנסה'))),
			h('tbody', {}, result.items.map((item, index) => itemRow(item, index, last))),
			h('tfoot', {}, incomeRow(result)),
		)),
	);
}

function trendSection(orders) {
	const box = h('div', {});
	const weekdays = [...new Set(orders.map(o => weekdayOf(o.eveningDate)))].sort();
	const select = h('select', { 'aria-label': 'סינון מגמה', onchange: e => show(e.target.value) },
		h('option', { value: 'all' }, `${LAST_N} ערבים אחרונים`),
		weekdays.map(day => h('option', { value: String(day) }, WEEKDAY_FILTERS[day])),
	);
	function show(value) {
		const weekday = value === 'all' ? null : Number(value);
		box.replaceChildren(trendTable(trend(orders, { lastN: LAST_N, weekday })));
	}
	show('all');
	return h('div', { class: 'card' }, h('h2', {}, 'מגמה'), select, box);
}

export async function render(store, params) {
	const orders = await store.getOrders();
	const evenings = eveningList(orders);
	if (evenings.length === 0) {
		return h('section', {}, h('h1', {}, 'נתונים'), h('p', { class: 'muted' }, 'עוד אין הזמנות'));
	}
	const date = evenings.some(e => e.date === params.date) ? params.date : evenings[0].date;
	const picker = h('select', { 'aria-label': 'בחירת ערב', onchange: e => { location.hash = `#/stats/${e.target.value}`; } },
		evenings.map(e => h('option', { value: e.date, selected: e.date === date }, formatDate(e.date))));
	return h('section', {},
		h('h1', {}, 'נתונים'),
		h('div', { class: 'card' }, picker),
		eveningSection(orders.filter(o => o.eveningDate === date)),
		trendSection(orders),
	);
}

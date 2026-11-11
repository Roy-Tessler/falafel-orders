import { eveningList, eveningSummary, trend, weekdayOf, ordersInPeriod, PERIOD } from '../logic/stats.js';
import { eveningKey } from '../logic/model.js';
import { h, formatMoney, formatDate, formatShortDate } from '../dom.js';

const LAST_N = 8;
const PERIOD_LABELS = {
	[PERIOD.ALL]: 'כל הזמנים',
	[PERIOD.THIS_MONTH]: 'החודש',
	[PERIOD.LAST_MONTH]: 'החודש הקודם',
	[PERIOD.THIS_YEAR]: 'השנה',
	[PERIOD.LAST_YEAR]: 'השנה הקודמת',
};
const WEEKDAY_FILTERS = ['רק ימי ראשון', 'רק ימי שני', 'רק ימי שלישי', 'רק ימי רביעי', 'רק ימי חמישי', 'רק ימי שישי', 'רק שבתות'];
const MONTH_FORMAT = new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' });

function fullDate(key) {
	const [year, month, day] = key.split('-').map(Number);
	return `${day}.${month}.${year}`;
}

function periodDetail(period, today, firstDate) {
	const year = today.getFullYear();
	switch (period) {
		case PERIOD.THIS_MONTH:
			return MONTH_FORMAT.format(today);
		case PERIOD.LAST_MONTH:
			return MONTH_FORMAT.format(new Date(year, today.getMonth() - 1, 1));
		case PERIOD.THIS_YEAR:
			return String(year);
		case PERIOD.LAST_YEAR:
			return String(year - 1);
		default:
			return `מאז ${fullDate(firstDate)}`;
	}
}

function periodTitle(period, today, firstDate) {
	return `${PERIOD_LABELS[period]} (${periodDetail(period, today, firstDate)})`;
}

const SHORT_MONTH_FORMAT = new Intl.DateTimeFormat('he-IL', { month: 'short', year: 'numeric' });
const EVENING_UNIT = { plural: 'ערבים', single: 'ערב', header: formatShortDate };
const MONTH_UNIT = {
	plural: 'חודשים',
	single: 'חודש',
	header: key => SHORT_MONTH_FORMAT.format(new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1)),
};

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
		item.perColumn.map(qty => h('td', {}, String(qty))),
		h('td', {}, h('strong', {}, String(item.total))),
		h('td', {}, formatMoney(item.income)),
	);
}

function incomeRow(result) {
	return h('tr', { class: 'income-row' },
		h('td', {}, h('strong', {}, 'הכנסה')),
		result.incomePerColumn.map(value => h('td', {}, h('strong', {}, formatMoney(value)))),
		h('td', {}),
		h('td', {}, h('strong', {}, formatMoney(result.incomeTotal))),
	);
}

function trendTable(result, unit) {
	if (result.columns.length < 2) {
		return h('p', { class: 'muted' }, `צריך לפחות שני ${unit.plural} כדי לראות מגמה`);
	}
	const last = result.items.length - 1;
	const average = Math.round(result.incomeTotal / result.columns.length);
	return h('div', {},
		h('div', { class: 'totals row' },
			stat(`הכנסה ב-${result.columns.length} ${unit.plural}`, formatMoney(result.incomeTotal)),
			stat(`ממוצע ל${unit.single}`, formatMoney(average))),
		h('div', { class: 'table-scroll' }, h('table', {},
			h('thead', {}, h('tr', {}, h('th', {}, 'פריט'), result.columns.map(c => h('th', {}, unit.header(c))),
				h('th', {}, 'כמות'), h('th', {}, 'הכנסה'))),
			h('tbody', {}, result.items.map((item, index) => itemRow(item, index, last))),
			h('tfoot', {}, incomeRow(result)),
		)),
	);
}

function trendRanges(today, firstDate) {
	const monthRange = period => ({ label: periodTitle(period, today, firstDate), options: { lastN: Infinity, period }, unit: EVENING_UNIT });
	return {
		'last-evenings': { label: `${LAST_N} ערבים אחרונים`, options: { lastN: LAST_N }, unit: EVENING_UNIT },
		[PERIOD.THIS_MONTH]: monthRange(PERIOD.THIS_MONTH),
		[PERIOD.LAST_MONTH]: monthRange(PERIOD.LAST_MONTH),
		'months-6': { label: '6 חודשים אחרונים, לפי חודש', options: { lastN: 6, byMonth: true }, unit: MONTH_UNIT },
		'months-12': { label: '12 חודשים אחרונים, לפי חודש', options: { lastN: 12, byMonth: true }, unit: MONTH_UNIT },
	};
}

function trendSection(orders, today, firstDate) {
	const box = h('div', {});
	const ranges = trendRanges(today, firstDate);
	const choice = { range: 'last-evenings', weekday: null };
	const weekdays = [...new Set(orders.map(o => weekdayOf(o.eveningDate)))].sort();
	const rangeSelect = h('select', { 'aria-label': 'טווח מגמה', onchange: e => { choice.range = e.target.value; show(); } },
		Object.entries(ranges).map(([key, range]) => h('option', { value: key }, range.label)));
	const daySelect = h('select', { 'aria-label': 'ימים במגמה', onchange: e => { choice.weekday = e.target.value === '' ? null : Number(e.target.value); show(); } },
		h('option', { value: '' }, 'כל הימים'),
		weekdays.map(day => h('option', { value: String(day) }, WEEKDAY_FILTERS[day])));
	function show() {
		const range = ranges[choice.range];
		const result = trend(orders, { ...range.options, weekday: choice.weekday, todayKey: eveningKey(today) });
		box.replaceChildren(trendTable(result, range.unit));
	}
	show();
	return h('div', { class: 'card' }, h('h2', {}, 'מגמה'), rangeSelect, daySelect, box);
}

export async function render(store, params) {
	const orders = await store.getOrders();
	const evenings = eveningList(orders);
	if (evenings.length === 0) {
		return h('section', {}, h('h1', {}, 'נתונים'), h('p', { class: 'muted' }, 'עוד אין הזמנות'));
	}
	const today = new Date();
	const firstDate = evenings[evenings.length - 1].date;
	const isPeriod = params.date in PERIOD_LABELS;
	const selected = isPeriod || evenings.some(e => e.date === params.date) ? params.date : evenings[0].date;
	const option = (value, label) => h('option', { value, selected: value === selected }, label);
	const picker = h('select', { 'aria-label': 'בחירת תקופה או ערב', onchange: e => { location.hash = `#/stats/${e.target.value}`; } },
		h('optgroup', { label: 'תקופה' }, Object.keys(PERIOD_LABELS).map(period => option(period, periodTitle(period, today, firstDate)))),
		h('optgroup', { label: 'ערב' }, evenings.map(e => option(e.date, formatDate(e.date)))));
	const shown = isPeriod ? ordersInPeriod(orders, selected, eveningKey(today)) : orders.filter(o => o.eveningDate === selected);
	return h('section', {},
		h('h1', {}, 'נתונים'),
		h('div', { class: 'card' }, picker),
		shown.length > 0 ? eveningSection(shown) : h('p', { class: 'muted' }, 'אין הזמנות בתקופה הזו'),
		trendSection(orders, today, firstDate),
	);
}

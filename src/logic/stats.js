import { orderTotal, DEFAULT_MENU } from './model.js';
import { METHOD, paidBy, paidAmount, remainingAmount } from './payments.js';

const SLOT_MINUTES = 30;
const BALLS_BY_NAME = new Map(DEFAULT_MENU.filter(item => item.balls).map(item => [item.name, item.balls]));

function falafelBalls(order) {
	return order.lines.reduce((sum, line) => sum + (BALLS_BY_NAME.get(line.name) || 0) * line.qty, 0);
}

function byDateDesc(a, b) {
	return b.localeCompare(a);
}

function groupByDate(orders) {
	const groups = new Map();
	for (const order of orders) {
		if (!groups.has(order.eveningDate)) {
			groups.set(order.eveningDate, []);
		}
		groups.get(order.eveningDate).push(order);
	}
	return groups;
}

function sumWhere(orders, predicate) {
	return orders.filter(predicate).reduce((sum, o) => sum + orderTotal(o.lines), 0);
}

function sumOf(orders, amount) {
	return orders.reduce((sum, o) => sum + amount(o), 0);
}

export function eveningList(orders) {
	return [...groupByDate(orders).entries()]
		.sort(([a], [b]) => byDateDesc(a, b))
		.map(([date, list]) => ({
			date,
			count: list.length,
			total: sumWhere(list, () => true),
			unpaid: sumOf(list, remainingAmount),
		}));
}

function byCreatedAt(a, b) {
	return a.createdAt.localeCompare(b.createdAt);
}

function itemTotals(orders) {
	const items = new Map();
	for (const order of [...orders].sort(byCreatedAt)) {
		for (const line of order.lines) {
			const current = items.get(line.itemId) || { itemId: line.itemId, name: line.name, qty: 0, amount: 0 };
			current.name = line.name;
			current.qty += line.qty;
			current.amount += line.price * line.qty;
			items.set(line.itemId, current);
		}
	}
	return [...items.values()].sort((a, b) => b.qty - a.qty);
}

function slotOf(iso) {
	const d = new Date(iso);
	return Math.floor((d.getHours() * 60 + d.getMinutes()) / SLOT_MINUTES);
}

function slotLabel(slot) {
	const minutes = slot * SLOT_MINUTES;
	return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function halfHourCounts(orders) {
	if (orders.length === 0) {
		return [];
	}
	const slots = orders.map(o => slotOf(o.createdAt));
	const first = Math.min(...slots);
	const last = Math.max(...slots);
	const result = [];
	for (let slot = first; slot <= last; slot++) {
		result.push({ label: slotLabel(slot), count: slots.filter(s => s === slot).length });
	}
	return result;
}

export function eveningSummary(orders) {
	const total = sumWhere(orders, () => true);
	return {
		orderCount: orders.length,
		total,
		average: orders.length === 0 ? 0 : Math.round(total / orders.length),
		paidPaybox: sumOf(orders, o => paidBy(o, METHOD.PAYBOX)),
		paidCash: sumOf(orders, o => paidBy(o, METHOD.CASH)),
		paidTotal: sumOf(orders, paidAmount),
		unpaid: sumOf(orders, remainingAmount),
		falafelBalls: sumOf(orders, falafelBalls),
		items: itemTotals(orders),
		byHalfHour: halfHourCounts(orders),
	};
}

export const PERIOD = Object.freeze({
	ALL: 'all',
	THIS_MONTH: 'this-month',
	LAST_MONTH: 'last-month',
	THIS_YEAR: 'this-year',
	LAST_YEAR: 'last-year',
});

function periodBounds(period, todayKey) {
	const year = Number(todayKey.slice(0, 4));
	const month = Number(todayKey.slice(5, 7));
	const lastMonthYear = month === 1 ? year - 1 : year;
	const lastMonth = String(month === 1 ? 12 : month - 1).padStart(2, '0');
	switch (period) {
		case PERIOD.THIS_MONTH:
			return [`${todayKey.slice(0, 7)}-01`, todayKey];
		case PERIOD.LAST_MONTH:
			return [`${lastMonthYear}-${lastMonth}-01`, `${lastMonthYear}-${lastMonth}-31`];
		case PERIOD.THIS_YEAR:
			return [`${year}-01-01`, todayKey];
		case PERIOD.LAST_YEAR:
			return [`${year - 1}-01-01`, `${year - 1}-12-31`];
		default:
			return ['', '9999-12-31'];
	}
}

export function isInPeriod(dateKey, period, todayKey) {
	const [from, to] = periodBounds(period, todayKey);
	return dateKey >= from && dateKey <= to;
}

export function ordersInPeriod(orders, period, todayKey) {
	return orders.filter(o => isInPeriod(o.eveningDate, period, todayKey));
}

export function unpaidByEvening(orders) {
	const unpaid = orders.filter(o => remainingAmount(o) > 0);
	return [...groupByDate(unpaid).entries()]
		.sort(([a], [b]) => byDateDesc(a, b))
		.map(([date, list]) => ({ date, orders: [...list].sort(byCreatedAt), total: sumOf(list, remainingAmount) }));
}

export function weekdayOf(date) {
	const [y, m, d] = date.split('-').map(Number);
	return new Date(y, m - 1, d).getDay();
}

export function trend(orders, options) {
	const { lastN, weekday = null, period = null, todayKey = '', byMonth = false } = options;
	const columnOf = byMonth ? o => o.eveningDate.slice(0, 7) : o => o.eveningDate;
	const inRange = period ? ordersInPeriod(orders, period, todayKey) : orders;
	const filtered = inRange.filter(o => weekday === null || weekdayOf(o.eveningDate) === weekday);
	const columns = [...new Set(filtered.map(columnOf))].sort().slice(-lastN);
	const selected = filtered.filter(o => columns.includes(columnOf(o)));
	const inColumn = column => selected.filter(o => columnOf(o) === column);
	const items = itemTotals(selected).map(item => ({
		itemId: item.itemId,
		name: item.name,
		perColumn: columns.map(column => qtyOf(inColumn(column), item.itemId)),
		total: item.qty,
		income: item.amount,
	}));
	const incomePerColumn = columns.map(column => sumWhere(inColumn(column), () => true));
	return {
		columns,
		items: items.sort((a, b) => b.total - a.total),
		incomePerColumn,
		incomeTotal: incomePerColumn.reduce((sum, value) => sum + value, 0),
	};
}

function qtyOf(orders, itemId) {
	return orders
		.flatMap(o => o.lines)
		.filter(l => l.itemId === itemId)
		.reduce((sum, l) => sum + l.qty, 0);
}

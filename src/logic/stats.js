import { PAYMENT, orderTotal } from './model.js';

const SLOT_MINUTES = 30;

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

export function eveningList(orders) {
	return [...groupByDate(orders).entries()]
		.sort(([a], [b]) => byDateDesc(a, b))
		.map(([date, list]) => ({
			date,
			count: list.length,
			total: sumWhere(list, () => true),
			unpaid: sumWhere(list, o => o.payment === PAYMENT.UNPAID),
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
		paidBit: sumWhere(orders, o => o.payment === PAYMENT.BIT),
		paidCash: sumWhere(orders, o => o.payment === PAYMENT.CASH),
		unpaid: sumWhere(orders, o => o.payment === PAYMENT.UNPAID),
		items: itemTotals(orders),
		byHalfHour: halfHourCounts(orders),
	};
}

export function unpaidByEvening(orders) {
	const unpaid = orders.filter(o => o.payment === PAYMENT.UNPAID);
	return [...groupByDate(unpaid).entries()]
		.sort(([a], [b]) => byDateDesc(a, b))
		.map(([date, list]) => ({ date, orders: [...list].sort(byCreatedAt), total: sumWhere(list, () => true) }));
}

export function weekdayOf(date) {
	const [y, m, d] = date.split('-').map(Number);
	return new Date(y, m - 1, d).getDay();
}

export function trend(orders, options) {
	const allDates = [...new Set(orders.map(o => o.eveningDate))]
		.filter(date => options.weekday === null || weekdayOf(date) === options.weekday)
		.sort();
	const dates = allDates.slice(-options.lastN);
	const selected = orders.filter(o => dates.includes(o.eveningDate));
	const items = itemTotals(selected).map(item => ({
		itemId: item.itemId,
		name: item.name,
		perDate: dates.map(date => qtyOn(selected, item.itemId, date)),
		total: item.qty,
	}));
	return { dates, items: items.sort((a, b) => b.total - a.total) };
}

function qtyOn(orders, itemId, date) {
	return orders
		.filter(o => o.eveningDate === date)
		.flatMap(o => o.lines)
		.filter(l => l.itemId === itemId)
		.reduce((sum, l) => sum + l.qty, 0);
}

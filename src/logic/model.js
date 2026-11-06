export const PAYMENT = Object.freeze({ UNPAID: 'unpaid', BIT: 'bit', CASH: 'cash' });

export const DEFAULT_MENU = Object.freeze([
	{ name: 'פלאפל בפיתה', price: 20 },
	{ name: 'פלאפל בלאפה', price: 25 },
	{ name: "צ'יפס", price: 12 },
	{ name: 'נקניקייה', price: 18 },
	{ name: 'שתייה', price: 7 },
]);

const PRICE_ERROR = 'המחיר חייב להיות מספר שלם, 0 או יותר';
const PAYMENT_VALUES = Object.values(PAYMENT);

function pad(n) {
	return String(n).padStart(2, '0');
}

export function eveningKey(date) {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addItem(lines, item) {
	if (lines.some(l => l.itemId === item.id)) {
		return lines.map(l => (l.itemId === item.id ? { ...l, qty: l.qty + 1 } : l));
	}
	return [...lines, { itemId: item.id, name: item.name, price: item.price, qty: 1 }];
}

export function changeQty(lines, itemId, delta) {
	return lines
		.map(l => (l.itemId === itemId ? { ...l, qty: l.qty + delta } : l))
		.filter(l => l.qty > 0);
}

export function orderTotal(lines) {
	return lines.reduce((sum, l) => sum + l.price * l.qty, 0);
}

export function validateOrder(draft) {
	const errors = [];
	if (!(draft.customerName || '').trim()) {
		errors.push('חסר שם לקוח');
	}
	if (!draft.lines || draft.lines.length === 0) {
		errors.push('ההזמנה ריקה');
	}
	return errors;
}

function assertPayment(payment) {
	if (!PAYMENT_VALUES.includes(payment)) {
		throw new RangeError(`Unknown payment state: ${payment}`);
	}
}

export function createOrder(draft, now, newId) {
	assertPayment(draft.payment);
	return {
		id: newId(),
		eveningDate: eveningKey(now),
		createdAt: now.toISOString(),
		customerName: draft.customerName.trim(),
		note: (draft.note || '').trim(),
		lines: draft.lines.map(l => ({ itemId: l.itemId, name: l.name, price: l.price, qty: l.qty })),
		payment: draft.payment,
		paidAt: draft.payment === PAYMENT.UNPAID ? null : now.toISOString(),
	};
}

export function setPayment(order, payment, now) {
	assertPayment(payment);
	return { ...order, payment, paidAt: payment === PAYMENT.UNPAID ? null : now.toISOString() };
}

export function validateMenuItem(item) {
	const errors = [];
	if (!(item.name || '').trim()) {
		errors.push('חסר שם פריט');
	}
	if (!Number.isInteger(item.price) || item.price < 0) {
		errors.push(PRICE_ERROR);
	}
	return errors;
}

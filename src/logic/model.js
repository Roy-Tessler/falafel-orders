export const PAYMENT = Object.freeze({ UNPAID: 'unpaid', PAYBOX: 'paybox', CASH: 'cash' });

export const DEFAULT_MENU = Object.freeze([
	{ name: 'מנה פלאפל', price: 25, image: 'images/falafel.svg' },
	{ name: "צ'יפס", price: 15, image: 'images/fries.svg' },
	{ name: 'שתייה', price: 10, image: 'images/drink.svg' },
	{ name: 'נקניקייה בלחמניה', price: 15, image: 'images/hotdog.svg' },
	{ name: 'כדור פלאפל', price: 2, image: 'images/ball.svg' },
]);

const BUNDLED_IMAGE = /^images\/[a-z0-9-]+\.svg$/;
const PHOTO_IMAGE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

export function isValidImage(image) {
	return typeof image === 'string' && (BUNDLED_IMAGE.test(image) || PHOTO_IMAGE.test(image));
}

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

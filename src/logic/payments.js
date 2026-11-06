export const METHOD = Object.freeze({ PAYBOX: 'paybox', CASH: 'cash' });
export const STATUS = Object.freeze({ UNPAID: 'unpaid', PARTIAL: 'partial', PAID: 'paid' });

const METHOD_VALUES = Object.values(METHOD);
const AMOUNT_ERROR = 'סכום תשלום חייב להיות מספר שלם, 0 או יותר';
const OVERPAY_ERROR = 'התשלום גבוה מסכום ההזמנה';

export function isMethod(method) {
	return METHOD_VALUES.includes(method);
}

function totalOf(order) {
	return order.lines.reduce((sum, l) => sum + l.price * l.qty, 0);
}

export function paidAmount(order) {
	return order.payments.reduce((sum, p) => sum + p.amount, 0);
}

export function paidBy(order, method) {
	return order.payments.filter(p => p.method === method).reduce((sum, p) => sum + p.amount, 0);
}

export function remainingAmount(order) {
	return Math.max(0, totalOf(order) - paidAmount(order));
}

export function paymentStatus(order) {
	if (remainingAmount(order) === 0) {
		return STATUS.PAID;
	}
	return paidAmount(order) > 0 ? STATUS.PARTIAL : STATUS.UNPAID;
}

export function addPayment(order, method, amount, now) {
	if (!isMethod(method)) {
		throw new RangeError(`Unknown payment method: ${method}`);
	}
	if (!Number.isInteger(amount) || amount <= 0) {
		throw new RangeError(`Invalid payment amount: ${amount}`);
	}
	return { ...order, payments: [...order.payments, { method, amount, at: now.toISOString() }] };
}

export function clearPayments(order) {
	return { ...order, payments: [] };
}

export function validatePayments(payments, total) {
	if (payments.some(p => !Number.isInteger(p.amount) || p.amount < 0)) {
		return [AMOUNT_ERROR];
	}
	const sum = payments.reduce((s, p) => s + p.amount, 0);
	return sum > total ? [OVERPAY_ERROR] : [];
}

export function upgradeOrder(order) {
	if (Array.isArray(order.payments)) {
		return order;
	}
	const { payment, paidAt, ...rest } = order;
	const payments = isMethod(payment) ? [{ method: payment, amount: totalOf(order), at: paidAt }] : [];
	return { ...rest, payments };
}

import { PAYMENT, orderTotal } from './model.js';

const APP_ID = 'falafel-orders';
const BACKUP_VERSION = 1;
const INVALID_MESSAGE = 'הקובץ אינו גיבוי תקין';
const REMINDER_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PAYMENT_LABELS = { [PAYMENT.UNPAID]: 'לא שולם', [PAYMENT.BIT]: 'ביט', [PAYMENT.CASH]: 'מזומן' };
const CSV_HEADER = ['תאריך', 'שעה', 'שם', 'פריטים', 'סכום', 'תשלום', 'הערה'];

export class BackupError extends Error {
	constructor(message = INVALID_MESSAGE) {
		super(message);
		this.name = 'BackupError';
	}
}

export function toBackupJson(data, now) {
	return JSON.stringify({
		app: APP_ID,
		version: BACKUP_VERSION,
		exportedAt: now.toISOString(),
		menu: data.menu,
		orders: data.orders,
	});
}

function isValidOrder(order) {
	return order !== null
		&& typeof order === 'object'
		&& typeof order.id === 'string'
		&& typeof order.eveningDate === 'string'
		&& DATE_PATTERN.test(order.eveningDate)
		&& Array.isArray(order.lines)
		&& Object.values(PAYMENT).includes(order.payment);
}

export function parseBackup(text) {
	let data;
	try {
		data = JSON.parse(text);
	} catch {
		throw new BackupError();
	}
	const valid = data !== null
		&& typeof data === 'object'
		&& data.app === APP_ID
		&& data.version === BACKUP_VERSION
		&& Array.isArray(data.menu)
		&& Array.isArray(data.orders)
		&& data.orders.every(isValidOrder);
	if (!valid) {
		throw new BackupError();
	}
	return { menu: data.menu, orders: data.orders };
}

function csvCell(value) {
	let text = String(value);
	if (/^[=+\-@]/.test(text)) {
		text = `'${text}`;
	}
	return `"${text.replace(/"/g, '""')}"`;
}

function localTime(iso) {
	const d = new Date(iso);
	return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function orderRow(order) {
	const items = order.lines.map(l => `${l.qty}× ${l.name}`).join('; ');
	return [
		order.eveningDate,
		localTime(order.createdAt),
		order.customerName,
		items,
		orderTotal(order.lines),
		PAYMENT_LABELS[order.payment],
		order.note || '',
	];
}

export function ordersToCsv(orders) {
	const rows = [CSV_HEADER, ...orders.map(orderRow)];
	return '﻿' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function needsBackupReminder(lastExportAt, hasOrders, now) {
	if (!hasOrders) {
		return false;
	}
	if (!lastExportAt) {
		return true;
	}
	return now.getTime() - new Date(lastExportAt).getTime() >= REMINDER_DAYS * DAY_MS;
}

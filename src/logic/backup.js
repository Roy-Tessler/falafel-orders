import { orderTotal, isValidImage } from './model.js';
import { METHOD, isMethod, remainingAmount, upgradeOrder } from './payments.js';

const APP_ID = 'falafel-orders';
const BACKUP_VERSION = 2;
const SUPPORTED_VERSIONS = [1, 2];
const INVALID_MESSAGE = 'הקובץ אינו גיבוי תקין';
const REMINDER_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const METHOD_LABELS = { [METHOD.PAYBOX]: 'פייבוקס', [METHOD.CASH]: 'מזומן' };
const CSV_HEADER = ['תאריך', 'שעה', 'שם', 'פריטים', 'סכום', 'תשלום', 'נשאר לשלם', 'הערה'];

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

function isObject(value) {
	return value !== null && typeof value === 'object';
}

function isWholeNumber(value) {
	return Number.isInteger(value) && value >= 0;
}

function isValidMenuItem(item) {
	return isObject(item)
		&& typeof item.id === 'string'
		&& typeof item.name === 'string'
		&& isWholeNumber(item.price)
		&& Number.isFinite(item.position)
		&& typeof item.active === 'boolean'
		&& (item.image === undefined || isValidImage(item.image));
}

function isValidLine(line) {
	return isObject(line)
		&& typeof line.itemId === 'string'
		&& typeof line.name === 'string'
		&& isWholeNumber(line.price)
		&& Number.isInteger(line.qty) && line.qty > 0;
}

function isValidPayment(payment) {
	return isObject(payment)
		&& isMethod(payment.method)
		&& Number.isInteger(payment.amount) && payment.amount > 0
		&& typeof payment.at === 'string';
}

function isValidOrder(order) {
	return isObject(order)
		&& typeof order.id === 'string'
		&& typeof order.eveningDate === 'string'
		&& DATE_PATTERN.test(order.eveningDate)
		&& typeof order.createdAt === 'string'
		&& !Number.isNaN(Date.parse(order.createdAt))
		&& typeof order.customerName === 'string'
		&& Array.isArray(order.lines)
		&& order.lines.every(isValidLine)
		&& Array.isArray(order.payments)
		&& order.payments.every(isValidPayment);
}

export function parseBackup(text) {
	let data;
	try {
		data = JSON.parse(text);
	} catch {
		throw new BackupError();
	}
	const shapeOk = isObject(data)
		&& data.app === APP_ID
		&& SUPPORTED_VERSIONS.includes(data.version)
		&& Array.isArray(data.menu)
		&& Array.isArray(data.orders)
		&& data.orders.every(isObject);
	if (!shapeOk) {
		throw new BackupError();
	}
	const orders = data.version === 1 ? data.orders.map(upgradeOrder) : data.orders;
	if (!data.menu.every(isValidMenuItem) || !orders.every(isValidOrder)) {
		throw new BackupError();
	}
	return { menu: data.menu, orders };
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
	const paid = order.payments.map(p => `${METHOD_LABELS[p.method]} ₪${p.amount}`).join(' + ');
	return [
		order.eveningDate,
		localTime(order.createdAt),
		order.customerName,
		items,
		orderTotal(order.lines),
		paid || 'לא שולם',
		remainingAmount(order),
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

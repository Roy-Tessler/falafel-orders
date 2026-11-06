import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BackupError, toBackupJson, parseBackup, ordersToCsv, needsBackupReminder } from '../src/logic/backup.js';

const menuItem = { id: 'm1', name: 'פלאפל בפיתה', price: 20, position: 0, active: true };
const order = {
	id: 'o1', eveningDate: '2026-11-06', createdAt: new Date(2026, 10, 6, 19, 5).toISOString(),
	customerName: 'דנה כהן', note: '', payments: [],
	lines: [{ itemId: 'm1', name: 'פלאפל בפיתה', price: 20, qty: 2 }, { itemId: 'm2', name: "צ'יפס", price: 12, qty: 1 }],
};

test('backup round-trips', () => {
	const data = { menu: [menuItem], orders: [order] };
	assert.deepEqual(parseBackup(toBackupJson(data, new Date())), data);
});

test('backup json carries app, version, and exportedAt', () => {
	const now = new Date('2026-11-06T20:00:00Z');
	const parsed = JSON.parse(toBackupJson({ menu: [], orders: [] }, now));
	assert.equal(parsed.app, 'falafel-orders');
	assert.equal(parsed.version, 2);
	assert.equal(parsed.exportedAt, now.toISOString());
});

const BAD = [
	'not json',
	'{}',
	'null',
	'{"app":"other","version":1,"menu":[],"orders":[]}',
	'{"app":"falafel-orders","version":3,"menu":[],"orders":[]}',
	'{"app":"falafel-orders","version":1,"menu":{},"orders":[]}',
	'{"app":"falafel-orders","version":1,"menu":[],"orders":[{"id":"x"}]}',
	'{"app":"falafel-orders","version":2,"menu":[],"orders":[{"id":"x","eveningDate":"2026-11-06","createdAt":"2026-11-06T18:00:00.000Z","customerName":"x","lines":[],"payments":[{"method":"card","amount":1,"at":"x"}]}]}',
];
for (const bad of BAD) {
	test(`parseBackup rejects ${bad}`, () => {
		assert.throws(() => parseBackup(bad), err => err instanceof BackupError && err.name === 'BackupError' && err.message === 'הקובץ אינו גיבוי תקין');
	});
}

test('csv has BOM, header, Hebrew payment, and neutralizes formulas', () => {
	const csv = ordersToCsv([{ ...order, customerName: '=HYPERLINK("x")', note: 'בלי "טחינה"', payments: [{ method: 'paybox', amount: 52, at: 'x' }] }]);
	assert.ok(csv.startsWith('\uFEFF"תאריך","שעה","שם","פריטים","סכום","תשלום","נשאר לשלם","הערה"\r\n'));
	assert.ok(csv.includes('"\'=HYPERLINK(""x"")"'));
	assert.ok(csv.includes('"בלי ""טחינה"""'));
	assert.ok(csv.includes('"פייבוקס ₪52"'));
});

test('csv row has date, time, items, and total', () => {
	const row = ordersToCsv([order]).split('\r\n')[1];
	assert.equal(row, '"2026-11-06","19:05","דנה כהן","2× פלאפל בפיתה; 1× צ\'יפס","52","לא שולם","52",""');
});

test('reminder after 7 days only when orders exist', () => {
	const now = new Date('2026-11-14T12:00:00Z');
	assert.equal(needsBackupReminder(null, false, now), false);
	assert.equal(needsBackupReminder(null, true, now), true);
	assert.equal(needsBackupReminder('2026-11-08T12:00:00Z', true, now), false);
	assert.equal(needsBackupReminder('2026-11-07T12:00:00Z', true, now), true);
});

const BAD_CONTENT = [
	['menu item without id', { menu: [{ name: 'x', price: 1, position: 0, active: true }], orders: [] }],
	['menu item with a foreign image', { menu: [{ id: 'm', name: 'x', price: 1, position: 0, active: true, image: 'https://evil.example/x.png' }], orders: [] }],
	['menu item with fractional price', { menu: [{ id: 'm', name: 'x', price: 1.5, position: 0, active: true }], orders: [] }],
	['order without customerName', { menu: [], orders: [{ id: 'o', eveningDate: '2026-11-06', createdAt: '2026-11-06T18:00:00.000Z', lines: [], payments: [] }] }],
	['order line without qty', { menu: [], orders: [{ id: 'o', eveningDate: '2026-11-06', createdAt: '2026-11-06T18:00:00.000Z', customerName: 'x', lines: [{ itemId: 'a', name: 'x', price: 1 }], payments: [] }] }],
];
for (const [label, content] of BAD_CONTENT) {
	test(`parseBackup rejects ${label}`, () => {
		const text = JSON.stringify({ app: 'falafel-orders', version: 2, ...content });
		assert.throws(() => parseBackup(text), err => err instanceof BackupError);
	});
}

test('parseBackup keeps menu items with a photo or no image', () => {
	const menu = [
		{ id: 'a', name: 'x', price: 1, position: 0, active: true, image: 'data:image/jpeg;base64,AAAA' },
		{ id: 'b', name: 'y', price: 1, position: 1, active: true },
	];
	assert.deepEqual(parseBackup(JSON.stringify({ app: 'falafel-orders', version: 2, menu, orders: [] })).menu, menu);
});

test('parseBackup upgrades a version 1 backup to payment lists', () => {
	const old = { ...order, payments: undefined, payment: 'cash', paidAt: 't' };
	delete old.payments;
	const parsed = parseBackup(JSON.stringify({ app: 'falafel-orders', version: 1, menu: [], orders: [old] }));
	assert.deepEqual(parsed.orders[0].payments, [{ method: 'cash', amount: 52, at: 't' }]);
});

test('csv shows a split payment and the remainder', () => {
	const row = ordersToCsv([{ ...order, payments: [{ method: 'cash', amount: 20, at: 'x' }, { method: 'paybox', amount: 10, at: 'x' }] }]).split('\r\n')[1];
	assert.ok(row.includes('"מזומן ₪20 + פייבוקס ₪10","22"'));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BackupError, toBackupJson, parseBackup, ordersToCsv, needsBackupReminder } from '../src/logic/backup.js';

const menuItem = { id: 'm1', name: 'פלאפל בפיתה', price: 20, position: 0, active: true };
const order = {
	id: 'o1', eveningDate: '2026-11-06', createdAt: new Date(2026, 10, 6, 19, 5).toISOString(),
	customerName: 'דנה כהן', note: '', payment: 'unpaid', paidAt: null,
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
	assert.equal(parsed.version, 1);
	assert.equal(parsed.exportedAt, now.toISOString());
});

const BAD = [
	'not json',
	'{}',
	'null',
	'{"app":"other","version":1,"menu":[],"orders":[]}',
	'{"app":"falafel-orders","version":2,"menu":[],"orders":[]}',
	'{"app":"falafel-orders","version":1,"menu":{},"orders":[]}',
	'{"app":"falafel-orders","version":1,"menu":[],"orders":[{"id":"x"}]}',
	'{"app":"falafel-orders","version":1,"menu":[],"orders":[{"id":"x","eveningDate":"2026-11-06","lines":[],"payment":"card"}]}',
];
for (const bad of BAD) {
	test(`parseBackup rejects ${bad}`, () => {
		assert.throws(() => parseBackup(bad), err => err instanceof BackupError && err.name === 'BackupError' && err.message === 'הקובץ אינו גיבוי תקין');
	});
}

test('csv has BOM, header, Hebrew payment, and neutralizes formulas', () => {
	const csv = ordersToCsv([{ ...order, customerName: '=HYPERLINK("x")', note: 'בלי "טחינה"', payment: 'bit' }]);
	assert.ok(csv.startsWith('\uFEFF"תאריך","שעה","שם","פריטים","סכום","תשלום","הערה"\r\n'));
	assert.ok(csv.includes('"\'=HYPERLINK(""x"")"'));
	assert.ok(csv.includes('"בלי ""טחינה"""'));
	assert.ok(csv.includes('"ביט"'));
});

test('csv row has date, time, items, and total', () => {
	const row = ordersToCsv([order]).split('\r\n')[1];
	assert.equal(row, '"2026-11-06","19:05","דנה כהן","2× פלאפל בפיתה; 1× צ\'יפס","52","לא שולם",""');
});

test('reminder after 7 days only when orders exist', () => {
	const now = new Date('2026-11-14T12:00:00Z');
	assert.equal(needsBackupReminder(null, false, now), false);
	assert.equal(needsBackupReminder(null, true, now), true);
	assert.equal(needsBackupReminder('2026-11-08T12:00:00Z', true, now), false);
	assert.equal(needsBackupReminder('2026-11-07T12:00:00Z', true, now), true);
});

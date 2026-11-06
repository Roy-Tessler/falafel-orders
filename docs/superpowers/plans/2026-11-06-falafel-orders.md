# Falafel Orders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An offline Hebrew web app for one operator on an Android tablet. It takes falafel orders, tracks Bit and cash payments, and shows sales statistics.

**Architecture:** Plain HTML, CSS, and JavaScript ES modules with no build step and no runtime dependencies. Pure logic lives in `src/logic/` and has Node unit tests. Storage is a thin IndexedDB module. Screens are small DOM modules under `src/ui/`, switched by a hash router. A service worker caches the app shell so the app works offline after the first load.

**Tech Stack:** Vanilla JS (ES2022 modules), IndexedDB, Service Worker, Web App Manifest. Tests use Node 22 built-in `node:test` and `node:assert/strict`. Local serving uses `python -m http.server`.

**Spec:** `docs/2026-11-06-falafel-orders-design.md`

## Global Constraints

- All UI text is Hebrew. `<html lang="he" dir="rtl">`.
- Currency is whole shekels. Display format: `₪66`. Prices are integers. Reject non-integer or negative prices.
- No runtime dependencies, no server, no login, no network calls besides loading the app itself.
- Minimum touch target: 56px tall. Base font size: 18px. The order total is at least 32px.
- Render user text (customer names, notes, item names) only with `textContent`, never with `innerHTML`.
- Saved orders store a copy of each item's name and price. Old orders never read the current menu.
- An evening is one local calendar date, `YYYY-MM-DD`. New orders always go to today's date.
- Payment state is exactly one of `'unpaid'`, `'bit'`, `'cash'`.
- Default menu: פלאפל בפיתה 20, פלאפל בלאפה 25, צ'יפס 12, נקניקייה 18, שתייה 7.
- If 7 or more days passed since the last export and at least one order exists, the home screen shows a backup reminder.
- Target browser: Chrome on Android. Must also work in Chrome and Edge on Windows.

## Review Focus

1. A customer name like `<img src=x onerror=alert(1)>` or `=HYPERLINK(...)`: the screen shows it as plain text, and the CSV export does not turn it into a formula. Tests: Task 3 CSV escape test, Task 5 manual step.
2. An order saved at 00:05: it belongs to the new date, not the previous evening. Test: Task 1 `eveningKey` midnight test.
3. The operator changes a price or deletes an item after orders exist: old orders, payment totals, and statistics keep the old values. Tests: Task 1 `createOrder` copy test, Task 2 renamed-item test.
4. A double tap on "save" during a rush: exactly one order is saved. Test: Task 5 manual step, button disabled while saving.
5. The operator imports a wrong file (a photo, an old CSV, broken JSON): she sees a Hebrew error and her current data stays untouched. Tests: Task 3 `parseBackup` rejection tests, Task 9 manual step.

---

## File Structure

```
index.html                 app shell, loads src/app.js
styles.css                 all styles
manifest.webmanifest       PWA manifest
sw.js                      service worker (cache-first app shell)
icons/icon.svg             app icon
package.json               "type": "module", "scripts": { "test": "node --test tests/" }
README.md                  how to run, test, deploy, install on the tablet
src/app.js                 starts store, registers sw, mounts router
src/router.js              hash routes -> screen render functions
src/dom.js                 h() element helper, formatMoney(), formatTime()
src/store.js               IndexedDB access
src/logic/model.js         orders, lines, payment, menu validation
src/logic/stats.js         summaries and trends
src/logic/backup.js        JSON backup, CSV export, reminder rule
src/ui/home.js             home screen
src/ui/order.js            new/edit order screen
src/ui/payments.js         one evening's payments screen
src/ui/debts.js            all unpaid orders screen
src/ui/menu.js             menu editing screen
src/ui/stats.js            statistics screen
src/ui/backup.js           export/import screen
tests/model.test.js
tests/stats.test.js
tests/backup.test.js
```

## Data Shapes (shared by all tasks)

```js
// MenuItem
{ id: string, name: string, price: number, position: number, active: boolean }
// OrderLine
{ itemId: string, name: string, price: number, qty: number }
// Order
{ id: string, eveningDate: 'YYYY-MM-DD', createdAt: string /* ISO */, customerName: string,
  note: string, lines: OrderLine[], payment: 'unpaid'|'bit'|'cash', paidAt: string|null }
```

Ids come from `crypto.randomUUID()`.

---

### Task 1: Project setup and order logic

**Files:**
- Create: `package.json`, `src/logic/model.js`, `tests/model.test.js`

**Interfaces:**
- Produces (all exported from `src/logic/model.js`):
  - `PAYMENT = Object.freeze({ UNPAID: 'unpaid', BIT: 'bit', CASH: 'cash' })`
  - `DEFAULT_MENU: Array<{name, price}>` (the five items from Global Constraints, in that order)
  - `eveningKey(date: Date): string` local date `YYYY-MM-DD`
  - `addItem(lines: OrderLine[], item: MenuItem): OrderLine[]` returns a new array. If the item is present, it adds 1 to qty. If not, it appends qty 1 with a copy of name and price.
  - `changeQty(lines: OrderLine[], itemId: string, delta: number): OrderLine[]` returns a new array. If qty reaches 0, it removes the line.
  - `orderTotal(lines: OrderLine[]): number`
  - `validateOrder(draft: {customerName, lines}): string[]` returns Hebrew error messages. If the draft is valid, it returns an empty array.
  - `createOrder(draft: {customerName, note, lines, payment}, now: Date, newId: () => string): Order`
  - `setPayment(order: Order, payment: string, now: Date): Order` returns a new order. `paidAt` is `now.toISOString()` for bit or cash, and `null` for unpaid.
  - `validateMenuItem(item: {name, price}): string[]`

- [ ] **Step 1: Create `package.json`** with `"type": "module"`, `"private": true`, and script `"test": "node --test tests/"`. Run `git add package.json`.

- [ ] **Step 2: Write the failing tests in `tests/model.test.js`**

```js
test('eveningKey uses local date, and 00:05 belongs to the new day', () => {
	assert.equal(eveningKey(new Date(2026, 10, 6, 23, 59)), '2026-11-06');
	assert.equal(eveningKey(new Date(2026, 10, 7, 0, 5)), '2026-11-07');
	assert.equal(eveningKey(new Date(2026, 0, 3, 12, 0)), '2026-01-03');
});
test('addItem appends then increments', () => {
	const item = { id: 'a', name: 'צ\'יפס', price: 12 };
	const one = addItem([], item);
	assert.deepEqual(one, [{ itemId: 'a', name: 'צ\'יפס', price: 12, qty: 1 }]);
	assert.equal(addItem(one, item)[0].qty, 2);
	assert.equal(one[0].qty, 1); // input not mutated
});
test('changeQty removes the line at zero', () => {
	const lines = [{ itemId: 'a', name: 'x', price: 12, qty: 1 }];
	assert.deepEqual(changeQty(lines, 'a', -1), []);
	assert.equal(changeQty(lines, 'a', 2)[0].qty, 3);
});
test('orderTotal sums price times qty', () => {
	assert.equal(orderTotal([{ price: 20, qty: 2 }, { price: 12, qty: 1 }, { price: 7, qty: 2 }]), 66);
	assert.equal(orderTotal([]), 0);
});
test('validateOrder needs a trimmed name and at least one line', () => {
	assert.deepEqual(validateOrder({ customerName: '  ', lines: [] }), ['חסר שם לקוח', 'ההזמנה ריקה']);
	assert.deepEqual(validateOrder({ customerName: 'דנה', lines: [{ qty: 1 }] }), []);
});
test('createOrder copies prices, trims the name, and sets the evening', () => {
	const lines = [{ itemId: 'a', name: 'פלאפל בפיתה', price: 20, qty: 2 }];
	const order = createOrder({ customerName: ' דנה כהן ', note: '', lines, payment: 'cash' },
		new Date(2026, 10, 6, 20, 15), () => 'id1');
	lines[0].price = 99;
	assert.equal(order.lines[0].price, 20);
	assert.equal(order.customerName, 'דנה כהן');
	assert.equal(order.eveningDate, '2026-11-06');
	assert.equal(order.id, 'id1');
	assert.equal(order.payment, 'cash');
	assert.ok(order.paidAt);
});
test('createOrder with unpaid has null paidAt', () => {
	const o = createOrder({ customerName: 'x', note: '', lines: [{ itemId: 'a', name: 'x', price: 1, qty: 1 }], payment: 'unpaid' }, new Date(), () => 'i');
	assert.equal(o.paidAt, null);
});
test('setPayment sets and clears paidAt and rejects unknown states', () => {
	const now = new Date(2026, 10, 7, 9, 0);
	const base = { payment: 'unpaid', paidAt: null };
	assert.equal(setPayment(base, 'bit', now).paidAt, now.toISOString());
	assert.equal(setPayment({ payment: 'bit', paidAt: 'x' }, 'unpaid', now).paidAt, null);
	assert.throws(() => setPayment(base, 'card', now), RangeError);
});
test('validateMenuItem rejects empty names and bad prices', () => {
	assert.deepEqual(validateMenuItem({ name: 'שתייה', price: 7 }), []);
	assert.deepEqual(validateMenuItem({ name: ' ', price: 7 }), ['חסר שם פריט']);
	assert.deepEqual(validateMenuItem({ name: 'x', price: 7.5 }), ['המחיר חייב להיות מספר שלם, 0 או יותר']);
	assert.deepEqual(validateMenuItem({ name: 'x', price: -1 }), ['המחיר חייב להיות מספר שלם, 0 או יותר']);
});
```

Import with `import { test } from 'node:test'; import assert from 'node:assert/strict';`.

- [ ] **Step 3: Run `npm test`.** Expected: FAIL, module `src/logic/model.js` not found.

- [ ] **Step 4: Implement `src/logic/model.js`** with the interfaces above. `createOrder` and `setPayment` throw `RangeError` for a payment state not in `PAYMENT`. `createOrder` deep-copies lines.

- [ ] **Step 5: Run `npm test`.** Expected: all model tests PASS.

- [ ] **Step 6: Commit** `feat: order and menu logic`.

---

### Task 2: Statistics logic

**Files:**
- Create: `src/logic/stats.js`, `tests/stats.test.js`

**Interfaces:**
- Consumes: `orderTotal`, `PAYMENT` from Task 1.
- Produces (exported from `src/logic/stats.js`):
  - `eveningList(orders: Order[]): Array<{date, count, total, unpaid}>` newest date first
  - `eveningSummary(orders: Order[]): {orderCount, total, average, paidBit, paidCash, unpaid, items: Array<{itemId, name, qty, amount}>, byHalfHour: Array<{label: 'HH:MM', count}>}`. `average` is rounded to a whole shekel. If there are no orders, it is 0. `items` sorted by qty descending. `name` is taken from the newest order that has the item. `byHalfHour` covers only slots from the first to the last order, including empty slots between them, using local time of `createdAt`.
  - `unpaidByEvening(orders: Order[]): Array<{date, orders: Order[], total}>` only unpaid orders, newest date first, orders inside a date oldest first
  - `trend(orders: Order[], options: {lastN: number, weekday: number|null}): {dates: string[], items: Array<{itemId, name, perDate: number[], total}>}`. Picks the last `lastN` distinct dates (after the weekday filter, 0 = Sunday), oldest first. Items sorted by `total` descending. The first item is the best seller and the last item is the weakest.

- [ ] **Step 1: Write the failing tests in `tests/stats.test.js`.** Build orders with a local helper `o(date, hh, mm, payment, lines)`. Tests:

```js
test('eveningList groups by date, newest first', () => {
	// two orders on 11-06 (20 unpaid, 30 bit), one on 11-02 (10 cash)
	assert.deepEqual(eveningList(orders), [
		{ date: '2026-11-06', count: 2, total: 50, unpaid: 20 },
		{ date: '2026-11-02', count: 1, total: 10, unpaid: 0 },
	]);
});
test('eveningSummary splits payments and ranks items', () => {
	// orders: 19:10 bit [falafel x2 @20], 19:40 cash [fries x1 @12, falafel x1 @20], 20:20 unpaid [drink x3 @7]
	const s = eveningSummary(orders);
	assert.equal(s.orderCount, 3);
	assert.equal(s.total, 93);
	assert.equal(s.average, 31);
	assert.equal(s.paidBit, 40);
	assert.equal(s.paidCash, 32);
	assert.equal(s.unpaid, 21);
	assert.deepEqual(s.items.map(i => [i.name, i.qty, i.amount]), [['פלאפל', 3, 60], ['שתייה', 3, 21], ["צ'יפס", 1, 12]]);
	assert.deepEqual(s.byHalfHour, [{ label: '19:00', count: 1 }, { label: '19:30', count: 1 }, { label: '20:00', count: 1 }]);
});
test('eveningSummary of no orders is all zero', () => {
	const s = eveningSummary([]);
	assert.equal(s.average, 0);
	assert.deepEqual(s.items, []);
	assert.deepEqual(s.byHalfHour, []);
});
test('items keep the price on the order and the newest name after a rename', () => {
	// item 'a' sold as 'פלאפל' @20 at 19:00, then as 'פלאפל גדול' @25 at 20:00
	const s = eveningSummary(orders);
	assert.deepEqual(s.items[0], { itemId: 'a', name: 'פלאפל גדול', qty: 2, amount: 45 });
});
test('unpaidByEvening lists only unpaid orders', () => { /* assert dates and totals */ });
test('trend takes the last N dates and filters by weekday', () => {
	// dates 2026-10-29 (Thu), 2026-11-02 (Mon), 2026-11-05 (Thu), 2026-11-06 (Fri)
	assert.deepEqual(trend(orders, { lastN: 2, weekday: null }).dates, ['2026-11-05', '2026-11-06']);
	assert.deepEqual(trend(orders, { lastN: 8, weekday: 4 }).dates, ['2026-10-29', '2026-11-05']);
	// an item not sold on a date has 0 in perDate
});
```

The `unpaidByEvening` fixture has two unpaid orders on one date, one unpaid order on another date, and paid orders. The test asserts the exact dates, the order count per date, and the totals. Paid orders must not appear.

- [ ] **Step 2: Run `npm test`.** Expected: FAIL, `src/logic/stats.js` not found.
- [ ] **Step 3: Implement `src/logic/stats.js`** with the interfaces above. Group items by `itemId`.
- [ ] **Step 4: Run `npm test`.** Expected: all tests PASS.
- [ ] **Step 5: Commit** `feat: evening statistics and trends`.

---

### Task 3: Backup and CSV logic

**Files:**
- Create: `src/logic/backup.js`, `tests/backup.test.js`

**Interfaces:**
- Produces (exported from `src/logic/backup.js`):
  - `class BackupError extends Error` with a Hebrew `message`
  - `toBackupJson(data: {menu: MenuItem[], orders: Order[]}, now: Date): string` produces `{ app: 'falafel-orders', version: 1, exportedAt, menu, orders }`
  - `parseBackup(text: string): {menu, orders}` throws `BackupError('הקובץ אינו גיבוי תקין')` for these inputs: invalid JSON, a wrong `app`, a `version` other than 1, or a `menu` or `orders` that is not an array. It also throws for an order without a string `id`, a `YYYY-MM-DD` `eveningDate`, an array `lines`, or a valid `payment`
  - `ordersToCsv(orders: Order[]): string` starts with `﻿`, uses CRLF, header row `תאריך,שעה,שם,פריטים,סכום,תשלום,הערה`. Items cell format: `2× פלאפל בפיתה; 1× צ'יפס`. Payment cell: `לא שולם` / `ביט` / `מזומן`. Every cell is quoted, and inner quotes are doubled. If a cell starts with `=`, `+`, `-`, or `@`, it gets a `'` prefix.
  - `needsBackupReminder(lastExportAt: string|null, hasOrders: boolean, now: Date): boolean`

- [ ] **Step 1: Write the failing tests in `tests/backup.test.js`:**

```js
test('backup round-trips', () => {
	const data = { menu: [menuItem], orders: [order] };
	assert.deepEqual(parseBackup(toBackupJson(data, new Date())), data);
});
for (const bad of ['not json', '{}', '{"app":"other","version":1,"menu":[],"orders":[]}',
	'{"app":"falafel-orders","version":2,"menu":[],"orders":[]}',
	'{"app":"falafel-orders","version":1,"menu":[],"orders":[{"id":"x"}]}']) {
	test(`parseBackup rejects ${bad}`, () => {
		assert.throws(() => parseBackup(bad), { name: 'BackupError', message: 'הקובץ אינו גיבוי תקין' });
	});
}
test('csv has BOM, header, Hebrew payment, and neutralizes formulas', () => {
	const csv = ordersToCsv([{ ...order, customerName: '=HYPERLINK("x")', note: 'בלי "טחינה"', payment: 'bit' }]);
	assert.ok(csv.startsWith('﻿"תאריך","שעה","שם","פריטים","סכום","תשלום","הערה"\r\n'));
	assert.ok(csv.includes('"\'=HYPERLINK(""x"")"'));
	assert.ok(csv.includes('"בלי ""טחינה"""'));
	assert.ok(csv.includes('"ביט"'));
});
test('reminder after 7 days only when orders exist', () => {
	const now = new Date('2026-11-14T12:00:00Z');
	assert.equal(needsBackupReminder(null, false, now), false);
	assert.equal(needsBackupReminder(null, true, now), true);
	assert.equal(needsBackupReminder('2026-11-08T12:00:00Z', true, now), false);
	assert.equal(needsBackupReminder('2026-11-07T12:00:00Z', true, now), true);
});
```

Note: the header row is quoted too, so the expected start is the quoted header shown above.

- [ ] **Step 2: Run `npm test`.** Expected: FAIL, module not found.
- [ ] **Step 3: Implement `src/logic/backup.js`.** The CSV time column uses local `HH:MM` from `createdAt`.
- [ ] **Step 4: Run `npm test`.** Expected: all tests PASS.
- [ ] **Step 5: Commit** `feat: backup and csv export`.

---

### Task 4: Storage, app shell, and router

**Files:**
- Create: `index.html`, `styles.css`, `src/app.js`, `src/router.js`, `src/dom.js`, `src/store.js`

**Interfaces:**
- Consumes: `DEFAULT_MENU` from Task 1.
- Produces:
  - `src/dom.js`: `h(tag: string, props?: object, ...children: (Node|string|null)[]): HTMLElement`. String children become text nodes. Props: `class`, `onclick` and other `on*` handlers, `disabled`, `value`, `type`, `placeholder`, other attributes through `setAttribute`. No `innerHTML` anywhere. Also `formatMoney(n: number): string` returns `₪66`, `formatTime(iso: string): string` returns local `HH:MM`, `formatDate(date: 'YYYY-MM-DD'): string` returns `יום חמישי 6.11`.
  - `src/store.js`: `openStore(): Promise<Store>`. DB name `falafel-orders`, version 1, object stores `menu` (keyPath `id`), `orders` (keyPath `id`, index `eveningDate`), `meta` (keyPath `key`). If `menu` is empty on open, it seeds `DEFAULT_MENU` with ids, `position` 0..4, `active: true`. `Store` methods, all async:
    - `getMenu(): MenuItem[]` sorted by `position`
    - `saveMenuItem(item: MenuItem)`
    - `getOrders(): Order[]`
    - `getOrdersByDate(date: string): Order[]` sorted by `createdAt`
    - `getOrder(id: string): Order|undefined`
    - `saveOrder(order: Order)`
    - `deleteOrder(id: string)`
    - `getMeta(key: string): any`, `setMeta(key: string, value: any)`
    - `replaceAll({menu, orders})` clears `menu` and `orders` and writes the new data in one transaction
  - `requestPersistence(): Promise<boolean>` in `src/store.js`, calls `navigator.storage.persist()`. If the browser does not support it, it returns false.
  - `src/router.js`: `startRouter(store: Store, root: HTMLElement)`. Routes: `#/` home, `#/order` new order, `#/order/:id` edit order, `#/evening/:date` payments, `#/debts`, `#/menu`, `#/stats`, `#/stats/:date`, `#/backup`. Each screen module exports `render(store, params): Promise<HTMLElement>`. Until a screen exists, its route renders a placeholder `h('p', {}, 'בקרוב')`.
  - Top bar in `index.html` with links: בית, הזמנה חדשה, מי חייב, תפריט, נתונים, גיבוי.

- [ ] **Step 1: Write the files.** `index.html` has `lang="he" dir="rtl"`, a viewport meta, `styles.css`, a `<nav>` top bar, `<main id="app">`, and `<script type="module" src="src/app.js">`. `app.js` opens the store, calls `requestPersistence()`, and starts the router. Styles follow Global Constraints (56px targets, 18px base).
- [ ] **Step 2: Serve and open.** Run `python -m http.server 8080` in the project root. Open `http://localhost:8080/` in Chrome. Expected: Hebrew right-to-left top bar, no console errors.
- [ ] **Step 3: Check the seed.** In DevTools > Application > IndexedDB > `falafel-orders` > `menu`. Expected: the five default items.
- [ ] **Step 4: Check routing.** Click every top-bar link. Expected: the hash changes and `בקרוב` shows, no console errors.
- [ ] **Step 5: Run `npm test`.** Expected: still PASS.
- [ ] **Step 6: Commit** `feat: storage, app shell, and router`.

---

### Task 5: Order screen

**Files:**
- Create: `src/ui/order.js`
- Modify: `src/router.js` (wire `#/order` and `#/order/:id`)

**Interfaces:**
- Consumes: `addItem`, `changeQty`, `orderTotal`, `validateOrder`, `createOrder`, `PAYMENT`, `eveningKey` (Task 1) and `h`, `formatMoney` (Task 4) and `Store` (Task 4).
- Produces: `render(store, params: {id?: string}): Promise<HTMLElement>`.

Behavior:
- Name field (`placeholder="שם הלקוח"`) gets focus on open.
- A grid of active menu items, 3 columns on a tablet held sideways, each button shows name and `formatMoney(price)`.
- The line list shows `qty × name`, line total, and `−` and `+` buttons. The total reads `סה"כ: ₪66` at 32px or more.
- Optional note field `placeholder="הערה (לא חובה)"`.
- New order: two buttons, `שמור` (unpaid) and `שמור – שולם במזומן` (cash). On a validation error, show the messages from `validateOrder` and save nothing. Both buttons are disabled from the first tap until the save finishes. After a save, the screen clears and the name field gets focus. A short message `ההזמנה נשמרה` shows for 2 seconds.
- The draft (name, note, lines) is kept in `localStorage` key `draft` after every change and restored on open, and cleared after a save. Wrap `localStorage` calls in try/catch.
- Edit mode (`#/order/:id`): loads the order, keeps its `id`, `eveningDate`, `createdAt`, `payment`, and `paidAt`, and replaces name, note, and lines. Edit mode does not use the draft. Buttons: `שמור שינויים` and `מחק הזמנה`. Delete uses an in-page question panel `למחוק את ההזמנה של {name}?` with `כן, למחוק` and `ביטול`, not `window.confirm`. After save or delete, go back to `#/evening/{eveningDate}`.

- [ ] **Step 1: Implement `src/ui/order.js`** and wire the routes.
- [ ] **Step 2: Manual test, a normal order.** Open `#/order`. Type `דנה כהן`, tap פלאפל בפיתה twice, צ'יפס once, שתייה twice. Expected: `סה"כ: ₪66`. Tap `שמור`. Expected: `ההזמנה נשמרה`, screen clears, IndexedDB `orders` has one order with today's `eveningDate` and `payment: 'unpaid'`.
- [ ] **Step 3: Manual test, validation.** Tap `שמור` with an empty screen. Expected: `חסר שם לקוח` and `ההזמנה ריקה`, nothing saved.
- [ ] **Step 4: Manual test, hostile name.** Save an order with the name `<img src=x onerror=alert(1)>`. Expected: the text shows literally later on the payments screen, no alert.
- [ ] **Step 5: Manual test, double tap.** In DevTools, throttle the CPU 6×, then double-click `שמור – שולם במזומן` on a valid order. Expected: exactly one new order, with `payment: 'cash'`.
- [ ] **Step 6: Manual test, refresh.** Add a name and two items, refresh the page. Expected: the draft returns.
- [ ] **Step 7: Run `npm test`.** Expected: PASS.
- [ ] **Step 8: Commit** `feat: order screen`.

---

### Task 6: Home, evening payments, and debts screens

**Files:**
- Create: `src/ui/home.js`, `src/ui/payments.js`, `src/ui/debts.js`
- Modify: `src/router.js`

**Interfaces:**
- Consumes: `eveningList`, `eveningSummary`, `unpaidByEvening` (Task 2) and `setPayment`, `eveningKey`, `PAYMENT` (Task 1) and `needsBackupReminder` (Task 3) and `h`, `formatMoney`, `formatDate`, `formatTime` (Task 4).
- Produces: `render(store, params)` in each file. `payments.js` reads `params.date`.

Behavior:
- Home: a large `הזמנה חדשה` button. Today's card: `formatDate(today)`, order count, total, unpaid, and a link to `#/evening/{today}`. Below it, `ערבים קודמים`: one row per date from `eveningList`, without today. Each row shows count, total, and unpaid, and links to its payments screen. If unpaid is above 0, it shows in red. When `needsBackupReminder(await store.getMeta('lastExportAt'), orders.length > 0, new Date())` is true, show a banner `לא נעשה גיבוי כבר שבוע. לגיבוי` linking to `#/backup`.
- Payments (`#/evening/:date`): header with `formatDate`, then three totals: `שולם בביט`, `שולם במזומן`, `לא שולם`. A search field `חיפוש לפי שם` filters by substring, case-insensitive. A toggle `רק מי שלא שילם`. One row per order: time, name, amount, payment state. An unpaid row has two buttons `ביט` and `מזומן`. A paid row shows `שולם בביט` or `שולם במזומן` and a small `בטל` button that sets it back to unpaid. Tapping the name opens `#/order/{id}`. Totals update right after a tap without a full reload of the screen. Changing payment keeps the search text and the toggle.
- Debts (`#/debts`): the total unpaid at the top, then groups from `unpaidByEvening` with the date as a heading and the same row component as payments. Export the row builder from `payments.js` as `paymentRow(store, order, onChange): HTMLElement` and reuse it in `debts.js`. When nothing is unpaid, show `כולם שילמו`.

- [ ] **Step 1: Implement the three screens.**
- [ ] **Step 2: Manual test.** With the orders from Task 5, open home. Expected: today's card with the right totals. Open the evening, tap `ביט` on `דנה כהן`. Expected: `שולם בביט` rises by 66 and `לא שולם` drops by 66. Tap `בטל`. Expected: totals return.
- [ ] **Step 3: Manual test, past evening.** In DevTools, edit one order's `eveningDate` to two days ago, reload home. Expected: it appears under `ערבים קודמים`, and `#/debts` lists it under that date.
- [ ] **Step 4: Manual test, reminder.** Expected: the backup banner shows, because no export happened yet and orders exist.
- [ ] **Step 5: Run `npm test`.** Expected: PASS.
- [ ] **Step 6: Commit** `feat: home, payments, and debts screens`.

---

### Task 7: Menu screen

**Files:**
- Create: `src/ui/menu.js`
- Modify: `src/router.js`

**Interfaces:**
- Consumes: `validateMenuItem` (Task 1) and `Store.getMenu`, `Store.saveMenuItem` (Task 4).
- Produces: `render(store, params)`.

Behavior:
- One row per active item: name field, price field (`inputmode="numeric"`), `▲` and `▼` buttons that swap `position` with the neighbor, and `הסר`.
- `הסר` sets `active: false` after an in-page question `להסיר את {name} מהתפריט? הזמנות קודמות לא ישתנו.` The item disappears from the order screen. Removed items are listed under `פריטים שהוסרו` with `החזר`, which sets `active: true`.
- `הוסף פריט` adds a row with an empty name and price 0 at the last position.
- If `validateMenuItem` returns no errors, the row saves on blur or Enter. On errors, the row shows the message and keeps the old saved value in storage.

- [ ] **Step 1: Implement `src/ui/menu.js`.**
- [ ] **Step 2: Manual test, price change.** Change פלאפל בפיתה to 22. Open the order screen. Expected: the button shows `₪22`. Open the evening from Task 5. Expected: `דנה כהן` still shows `₪66`.
- [ ] **Step 3: Manual test, bad input.** Enter price `7.5`. Expected: the error message, and after reload the price is the old value.
- [ ] **Step 4: Manual test, remove and restore.** Remove שתייה, check the order screen, restore it.
- [ ] **Step 5: Commit** `feat: menu editing`.

---

### Task 8: Statistics screen

**Files:**
- Create: `src/ui/stats.js`
- Modify: `src/router.js`

**Interfaces:**
- Consumes: `eveningList`, `eveningSummary`, `trend` (Task 2) and `h`, `formatMoney`, `formatDate` (Task 4).
- Produces: `render(store, params: {date?: string})`.

Behavior:
- `#/stats` shows a date picker list from `eveningList` (default: the newest date) and the trend section. `#/stats/:date` selects that date.
- Evening section: `הזמנות`, `סה"כ`, `ממוצע להזמנה`, `ביט`, `מזומן`, `לא שולם`. A table of items with columns `פריט`, `כמות`, `סכום`. A horizontal bar chart of `byHalfHour` built from `div` elements whose width is proportional to the count, with the label and count as text.
- Trend section, title `מגמה`: a selector for `8 ערבים אחרונים` and one option per weekday that has data (`רק ימי חמישי` and so on). A table with one row per item and one column per date, plus a `סה"כ` column. Mark the first row `הכי נמכר` and the last row `הכי חלש`. With fewer than 2 dates, show `צריך לפחות שני ערבים כדי לראות מגמה` instead of the table.

- [ ] **Step 1: Implement `src/ui/stats.js`.**
- [ ] **Step 2: Manual test.** Create 5 orders today with mixed items and payments. Expected: the numbers match a hand count. The half-hour bars show the times of the orders.
- [ ] **Step 3: Manual test, trend.** With the past-evening order from Task 6, expected: two date columns. Choose a weekday filter. Expected: only matching dates.
- [ ] **Step 4: Commit** `feat: statistics screen`.

---

### Task 9: Backup screen

**Files:**
- Create: `src/ui/backup.js`
- Modify: `src/router.js`

**Interfaces:**
- Consumes: `toBackupJson`, `parseBackup`, `ordersToCsv`, `BackupError` (Task 3) and `Store.getMenu`, `getOrders`, `replaceAll`, `setMeta` (Task 4).
- Produces: `render(store, params)`.

Behavior:
- `שמור גיבוי` downloads `falafel-backup-YYYY-MM-DD.json` through a Blob and an `<a download>` click, then sets meta `lastExportAt` to now.
- `ייצוא לאקסל` downloads `falafel-orders-YYYY-MM-DD.csv` with all orders. It also sets `lastExportAt`.
- `שחזור מגיבוי` opens a file input (`accept=".json,application/json"`). The app reads the text, calls `parseBackup`, then shows an in-page question: `השחזור יחליף את כל הנתונים במכשיר ב-{n} הזמנות מהקובץ. להמשיך?`. Only after `כן` it calls `replaceAll`. On `BackupError`, it shows the error message and changes nothing.
- Shows the last backup date, or `עוד לא נעשה גיבוי`.

- [ ] **Step 1: Implement `src/ui/backup.js`.**
- [ ] **Step 2: Manual test, round trip.** Save a backup. Delete the IndexedDB database in DevTools, reload, restore the file. Expected: all orders and the edited menu return.
- [ ] **Step 3: Manual test, bad file.** Restore from a `.png` renamed to `.json` and from the CSV file. Expected: `הקובץ אינו גיבוי תקין`, and the orders in IndexedDB stay the same.
- [ ] **Step 4: Manual test, Excel.** Open the CSV in Excel. Expected: Hebrew shows correctly, one row per order.
- [ ] **Step 5: Manual test.** Home no longer shows the backup banner.
- [ ] **Step 6: Commit** `feat: backup and restore`.

---

### Task 10: Offline install and README

**Files:**
- Create: `manifest.webmanifest`, `sw.js`, `icons/icon.svg`, `README.md`
- Modify: `index.html` (manifest link, theme color), `src/app.js` (register `sw.js`)

**Interfaces:**
- Consumes: the full file list from the File Structure section.

Behavior:
- Manifest: `name` `הזמנות פלאפל`, `short_name` `פלאפל`, `lang` `he`, `dir` `rtl`, `display` `standalone`, `start_url` `./`, `scope` `./`, one SVG icon with `sizes: "any"` and `purpose: "any maskable"`.
- `sw.js`: a constant `CACHE = 'falafel-v1'` and a list of every app file. Install caches the list. Activate deletes other caches. Fetch is cache-first for same-origin GET requests, falling back to network. Use relative paths so the app works under a sub-path such as GitHub Pages.
- README in English, for the person who maintains the app. It has these sections:
  - Run the tests, and serve the app locally.
  - Deploy to GitHub Pages.
  - Install on the Android tablet: open the URL in Chrome, open the menu, tap `Add to Home screen`.
  - Update the app: change `CACHE` to a new value.
  - Data: it lives only on the tablet, and the backup file is the only other copy.

- [ ] **Step 1: Write the files and register the service worker.**
- [ ] **Step 2: Manual test, offline.** Serve locally, load once, in DevTools > Network choose `Offline`, reload. Expected: the app loads and saving an order works.
- [ ] **Step 3: Manual test, installable.** DevTools > Application > Manifest. Expected: no install errors.
- [ ] **Step 4: Manual test, tablet size.** DevTools device mode, 1280×800 (sideways) and 800×1280 (upright). Expected: no horizontal scroll, buttons at least 56px tall.
- [ ] **Step 5: Run `npm test`.** Expected: PASS.
- [ ] **Step 6: Commit** `feat: offline install and README`.

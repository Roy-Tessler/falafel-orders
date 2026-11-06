# Falafel Orders: Design

## Intent

A family runs a falafel stand two evenings a week in their home town. The owner (called "the operator" below) takes every order by hand. She asks for the customer's full name, writes the items, and adds up the total on paper. Most customers pay later through Bit, usually within one or two days. Some customers pay cash at the stand when they order.

The program replaces the paper. It must do three things:

1. Take an order fast: name, items, total.
2. Let the operator match Bit transfers to orders and see who still owes money.
3. Show what sold on each evening and over time, so the operator can decide how much to prepare and which items to keep.

## Users and devices

One person, the operator, uses the program on one device during a shift. She always uses the same device, most likely an Android tablet with Chrome. The app must also work on a Windows laptop in Chrome or Edge, in case the device changes. The operator is not technical. Nobody else enters orders at the same time.

## Language and layout

The whole interface is in Hebrew, right-to-left. Currency is the shekel (₪), whole shekels.

## Platform (builder's decision, recommended by the designer)

A single web app that runs fully in the browser with no server. It works without internet and stores data on the device (for example IndexedDB). It must be installable to the home screen of a tablet (PWA) and open from a desktop shortcut on a laptop. Large touch targets, because the operator taps with fingers during a busy shift.

## Screens

### 1. Home

- An evening is one calendar date. The first order saved on a date creates that evening automatically. There is no "start" or "end" button, so the operator cannot forget one (designer's call).
- Every new order goes to today's evening. Orders cannot be added to a past evening, but past orders can be edited or deleted.
- Shows today's evening at the top with a large "new order" button.
- Lists past evenings, newest first, with order count, total amount, and unpaid amount.
- Link to "everyone who still owes money" (screen 4), menu editing (screen 5), and statistics (screen 6).

### 2. New order (the main screen)

- A field for the customer's full name. Free text. Required.
- A grid of large buttons, one per menu item, with name and price.
- Each tap adds one unit. The order list shows quantity, line total, and minus and plus buttons.
- The order total updates on every change and is large and easy to read.
- An optional free-text note per order (for example "no tahini").
- Two save buttons: "save" (unpaid, the default) and "save, paid cash". Each stores the order with the current time and clears the screen for the next customer.
- An order has one payment state: unpaid, paid by Bit, or paid in cash.
- The operator can open a saved order and edit or delete it. Delete asks for confirmation.

Mockup reference: `.superpowers/brainstorm/313-1793967489/content/screens.html`, screen 1. Prices in the mockup are placeholders.

### 3. Evening payments

- Lists every order of one evening: name, amount, and payment state. Each unpaid order has two buttons: "Bit" and "cash".
- Shows totals: paid by Bit, paid in cash, and unpaid.
- Search by name. Filter to "unpaid only".
- The operator works next to the Bit app: she finds a transfer by name and amount and taps "Bit". If she made a mistake, she can set the order back to unpaid.
- An evening stays open for payment marking forever. There is no "close" step that locks it.

Mockup reference: same file, screen 2.

### 4. Everyone who owes money

- One list of all unpaid orders from all evenings, grouped by evening date, with name, amount, and the same "Bit" and "cash" buttons.
- Shows the total unpaid amount.

### 5. Menu

- The operator adds, renames, deletes, and reorders items, and changes prices.
- Start with placeholder items and prices: פלאפל בפיתה ₪20, פלאפל בלאפה ₪25, צ'יפס ₪12, נקניקייה ₪18, שתייה ₪7. The operator replaces them.
- Each saved order stores the item name and price at the time of the order. A later price change or rename does not change old orders.
- Deleting an item removes it from the order screen only. Old orders keep it.
- No item options or variants, and no free-price "other item" button (the mockup showed one, the designer dropped it). If the operator needs a variant or a new item, she creates it in the menu. This takes a few seconds and keeps the statistics clean.

### 6. Statistics

Per evening:

- Number of orders, total amount, average order amount.
- Amount paid by Bit, amount paid in cash, and amount still unpaid. The cash amount lets her count the cash box at the end of the evening.
- Each item: quantity sold and amount, sorted by quantity.
- Orders per half hour, so the operator sees the busy times.

Across evenings:

- A table or chart of quantity per item per evening. It covers the last 8 evenings, or all evenings if there are fewer.
- Best and weakest items over the selected period.
- Optional: compare the same weekday only (for example all Thursdays).

The goal of the statistics is practical: how much to prepare, and which items to drop or push.

## Backup

Data lives only on the device. To protect against loss:

- An "export" button saves all data to a file (Excel-compatible CSV for reading, and a JSON file for full restore).
- An "import" button restores from the JSON file, for example on a new device.
- The app asks the browser for persistent storage (navigator.storage.persist) so that Chrome does not clear the data.
- If 7 days pass since the last export, the home screen shows a short reminder to export.

## Non-goals

- No payment processing, and no connection to Bit.
- No login, no user accounts, no multiple devices or sync.
- No customer database. The name on each order is free text.
- No printing of receipts.
- No inventory tracking.

## Anti-goals (it fails if...)

- Taking an order is slower than paper.
- The operator loses a night of orders because of a browser refresh, a closed tab, or no internet.
- The operator needs help from her child to use it day to day, including editing the menu.

## Left to the builder

- Framework and libraries, or none.
- Exact visual design, colors, and fonts, within the large-touch-target and Hebrew right-to-left constraints.
- Chart style in statistics.
- How the app is hosted for the first install, for example a free static host or a single local HTML file. After the first install, it must work offline.

import { eveningKey, orderTotal } from './model.js';
import { METHOD } from './payments.js';

const PAST_EVENINGS = 8;
const DEMO_WEEKDAYS = [1, 3];
const TODAY_ORDERS = 6;
const OPEN_MINUTES = 18 * 60;
const SHIFT_MINUTES = 210;
const MINUTE_MS = 60 * 1000;
const UNPAID_CHANCE = { today: 0.5, lastEvening: 0.3, older: 0.05 };
const PAYBOX_SHARE = 0.65;
const SPLIT_SHARE = 0.1;
const PARTIAL_CHANCE = 0.3;
const ITEM_CHANCES = [0.85, 0.45, 0.5, 0.25, 0.15];
const OTHER_ITEM_CHANCE = 0.2;
const SMALL_ITEM_PRICE = 5;
const FIRST_NAMES = ['דנה', 'יוסי', 'רונית', 'משה', 'מיכל', 'אבי', 'שירה', 'עומר', 'נועה', 'איתי', 'טל', 'רחל', 'דוד', 'מאיה', 'אורי', 'יעל', 'גיל', 'הדס', 'אלון', 'ליאת'];
const LAST_NAMES = ['כהן', 'לוי', 'מזרחי', 'פרץ', 'ביטון', 'אברהם', 'פרידמן', 'שפירא', 'אזולאי', 'דהן', 'גולן', 'ברק', 'חדד', 'אוחיון', 'רוזן'];
const NOTES = ['בלי חריף', 'בלי טחינה', 'הרבה סלט', 'חריף בצד'];

export function seededRandom(seed) {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6D2B79F5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function pick(list, random) {
	return list[Math.floor(random() * list.length)];
}

function pastEvenings(now) {
	const dates = [];
	const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	while (dates.length < PAST_EVENINGS) {
		day.setDate(day.getDate() - 1);
		if (DEMO_WEEKDAYS.includes(day.getDay())) {
			dates.push(new Date(day));
		}
	}
	return dates.reverse();
}

function demoLines(menu, random) {
	const lines = [];
	menu.forEach((item, index) => {
		if (random() >= (ITEM_CHANCES[index] ?? OTHER_ITEM_CHANCE)) {
			return;
		}
		const qty = item.price <= SMALL_ITEM_PRICE ? 3 + Math.floor(random() * 8) : 1 + Math.floor(random() * random() * 3);
		lines.push({ itemId: item.id, name: item.name, price: item.price, qty });
	});
	if (lines.length === 0) {
		lines.push({ itemId: menu[0].id, name: menu[0].name, price: menu[0].price, qty: 1 });
	}
	return lines;
}

function paidLater(createdAt, now, random) {
	return new Date(Math.min(now.getTime(), createdAt.getTime() + random() * 36 * 60 * MINUTE_MS)).toISOString();
}

function demoPayments(total, createdAt, unpaidChance, now, random) {
	const cash = amount => ({ method: METHOD.CASH, amount, at: createdAt.toISOString() });
	const paybox = amount => ({ method: METHOD.PAYBOX, amount, at: paidLater(createdAt, now, random) });
	const part = Math.max(1, Math.min(total - 1, 10 * Math.ceil(random() * Math.floor(total / 10))));
	if (random() < unpaidChance) {
		return random() < PARTIAL_CHANCE && total > 1 ? [cash(part)] : [];
	}
	const roll = random();
	if (roll < SPLIT_SHARE && total > 1) {
		return [cash(part), paybox(total - part)];
	}
	return roll < SPLIT_SHARE + PAYBOX_SHARE ? [paybox(total)] : [cash(total)];
}

function demoOrder(menu, createdAt, eveningDate, unpaidChance, now, random) {
	const lines = demoLines(menu, random);
	return {
		id: `demo-${eveningDate}-${createdAt.getTime()}-${Math.floor(random() * 1e9)}`,
		eveningDate,
		createdAt: createdAt.toISOString(),
		customerName: `${pick(FIRST_NAMES, random)} ${pick(LAST_NAMES, random)}`,
		note: random() < 0.15 ? pick(NOTES, random) : '',
		lines,
		payments: demoPayments(orderTotal(lines), createdAt, unpaidChance, now, random),
	};
}

function eveningOrders(menu, day, unpaidChance, now, random) {
	const count = 15 + Math.floor(random() * 16);
	const orders = [];
	for (let i = 0; i < count; i++) {
		const minutes = OPEN_MINUTES + Math.floor(((random() + random()) / 2) * SHIFT_MINUTES);
		const createdAt = new Date(day.getTime() + minutes * MINUTE_MS);
		orders.push(demoOrder(menu, createdAt, eveningKey(day), unpaidChance, now, random));
	}
	return orders;
}

function todayOrders(menu, now, random) {
	const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const orders = [];
	for (let i = TODAY_ORDERS; i >= 1; i--) {
		const createdAt = new Date(Math.max(startOfDay.getTime(), now.getTime() - i * 7 * MINUTE_MS));
		orders.push(demoOrder(menu, createdAt, eveningKey(now), UNPAID_CHANCE.today, now, random));
	}
	return orders;
}

export function generateDemoOrders(menu, now, random) {
	const active = menu.filter(item => item.active);
	const days = pastEvenings(now);
	const past = days.flatMap((day, index) => {
		const chance = index === days.length - 1 ? UNPAID_CHANCE.lastEvening : UNPAID_CHANCE.older;
		return eveningOrders(active, day, chance, now, random);
	});
	return [...past, ...todayOrders(active, now, random)];
}

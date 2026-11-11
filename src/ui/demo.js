import { generateDemoOrders } from '../logic/demo.js';
import { h, confirmPanel, showToast } from '../dom.js';

async function replaceOrders(store, makeOrders, message) {
	const menu = await store.getMenu();
	try {
		await store.replaceAll({ menu, orders: makeOrders(menu), expenses: await store.getExpenses() });
	} catch (error) {
		console.error(error);
		showToast('הפעולה נכשלה', true);
		return;
	}
	showToast(message);
	location.hash = '#/';
}

export async function render(store) {
	const panelBox = h('div', {});
	const hasItems = (await store.getMenu()).some(item => item.active);
	const ask = (message, yesLabel, action) => () => panelBox.replaceChildren(confirmPanel(message, yesLabel, action));

	const load = ask('נתוני הדוגמה יחליפו את כל ההזמנות במכשיר. התפריט יישאר. להמשיך?', 'כן, לטעון',
		() => replaceOrders(store, menu => generateDemoOrders(menu, new Date(), Math.random), 'נתוני הדוגמה נטענו'));
	const clear = ask('כל ההזמנות במכשיר יימחקו. התפריט יישאר. להמשיך?', 'כן, למחוק הכל',
		() => replaceOrders(store, () => [], 'כל ההזמנות נמחקו'));

	return h('section', {},
		h('h1', {}, 'נתוני דוגמה'),
		h('p', {}, 'מסך לבדיקה בלבד. הוא טוען 8 ערבים קודמים והזמנות של הערב, עם שמות ותשלומים לדוגמה.'),
		hasItems
			? h('div', { class: 'card row' },
				h('button', { class: 'primary', onclick: load }, 'טען נתוני דוגמה'),
				h('button', { class: 'danger', onclick: clear }, 'מחק את כל ההזמנות'))
			: h('p', { class: 'error' }, 'אין פריטים פעילים בתפריט'),
		panelBox,
	);
}

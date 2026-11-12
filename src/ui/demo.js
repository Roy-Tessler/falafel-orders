import { generateDemoOrders, generateDemoExpenses } from '../logic/demo.js';
import { h, confirmPanel, showToast } from '../dom.js';

async function replaceData(store, makeData, message) {
	const menu = await store.getMenu();
	try {
		await store.replaceAll({ menu, ...makeData(menu) });
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

	const load = ask('נתוני הדוגמה יחליפו את כל ההזמנות והקבלות במכשיר. התפריט יישאר. להמשיך?', 'כן, לטעון',
		() => replaceData(store, menu => {
			const now = new Date();
			return { orders: generateDemoOrders(menu, now, Math.random), expenses: generateDemoExpenses(now, Math.random) };
		}, 'נתוני הדוגמה נטענו'));
	const clear = ask('כל ההזמנות והקבלות במכשיר יימחקו. התפריט יישאר. להמשיך?', 'כן, למחוק הכל',
		() => replaceData(store, () => ({ orders: [], expenses: [] }), 'כל ההזמנות והקבלות נמחקו'));

	return h('section', {},
		h('h1', {}, 'נתוני דוגמה'),
		h('p', {}, 'מסך לבדיקה בלבד. הוא טוען 8 ערבים קודמים והזמנות של הערב, עם שמות, תשלומים וקבלות לדוגמה.'),
		hasItems
			? h('div', { class: 'card row' },
				h('button', { class: 'primary', onclick: load }, 'טען נתוני דוגמה'),
				h('button', { class: 'danger', onclick: clear }, 'מחק הזמנות וקבלות'))
			: h('p', { class: 'error' }, 'אין פריטים פעילים בתפריט'),
		panelBox,
	);
}

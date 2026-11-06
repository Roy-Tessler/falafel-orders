import { toBackupJson, parseBackup, ordersToCsv, BackupError } from '../logic/backup.js';
import { eveningKey } from '../logic/model.js';
import { h, confirmPanel, showToast } from '../dom.js';

function download(fileName, content, type) {
	const url = URL.createObjectURL(new Blob([content], { type }));
	const link = h('a', { href: url, download: fileName });
	document.body.append(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function lastBackupText(lastExportAt) {
	if (!lastExportAt) {
		return 'עוד לא נעשה גיבוי';
	}
	const d = new Date(lastExportAt);
	return `גיבוי אחרון: ${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

async function exportFile(store, kind) {
	const now = new Date();
	const orders = await store.getOrders();
	if (kind === 'json') {
		download(`falafel-backup-${eveningKey(now)}.json`, toBackupJson({ menu: await store.getMenu(), orders }, now), 'application/json');
		await store.setMeta('lastExportAt', now.toISOString());
	} else {
		download(`falafel-orders-${eveningKey(now)}.csv`, ordersToCsv(orders), 'text/csv;charset=utf-8');
	}
}

function restoreControl(store, messageBox, onDone) {
	const input = h('input', { type: 'file', accept: '.json,application/json', class: 'file-input' });
	input.addEventListener('change', async () => {
		const file = input.files[0];
		input.value = '';
		if (!file) {
			return;
		}
		messageBox.replaceChildren();
		let data;
		try {
			data = parseBackup(await file.text());
		} catch (error) {
			const message = error instanceof BackupError ? error.message : 'לא ניתן לקרוא את הקובץ';
			messageBox.replaceChildren(h('p', { class: 'error' }, message));
			return;
		}
		messageBox.replaceChildren(confirmPanel(
			`השחזור יחליף את כל הנתונים במכשיר ב-${data.orders.length} הזמנות מהקובץ. להמשיך?`, 'כן',
			async () => {
				try {
					await store.replaceAll(data);
				} catch (error) {
					console.error(error);
					messageBox.replaceChildren(h('p', { class: 'error' }, 'השחזור נכשל. הנתונים הקודמים נשמרו.'));
					return;
				}
				showToast('השחזור הושלם');
				onDone();
			}));
	});
	return h('label', { class: 'button' }, 'שחזור מגיבוי', input);
}

export async function render(store) {
	const view = h('section', {});
	const messageBox = h('div', {});

	async function refresh() {
		const status = h('p', { class: 'muted' }, lastBackupText(await store.getMeta('lastExportAt')));
		const exportButton = (label, kind) => h('button', { class: 'primary', onclick: async () => {
			await exportFile(store, kind);
			refresh();
		} }, label);
		view.replaceChildren(
			h('h1', {}, 'גיבוי'),
			h('p', {}, 'כל הנתונים שמורים רק במכשיר הזה. שמרו גיבוי פעם בשבוע, למשל בגוגל דרייב או בוואטסאפ לעצמכם.'),
			status,
			h('div', { class: 'card row' }, exportButton('שמור גיבוי', 'json'), exportButton('ייצוא לאקסל', 'csv')),
			h('div', { class: 'card' }, restoreControl(store, messageBox, refresh), messageBox),
		);
	}
	await refresh();
	return view;
}

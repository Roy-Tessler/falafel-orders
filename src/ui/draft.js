const DRAFT_KEY = 'draft';

export function emptyDraft() {
	return { customerName: '', note: '', lines: [], payMode: 'unpaid', split: { paybox: '', cash: '' } };
}

// Versions before v28 kept the unsaved order here; remove it so no old order or name stays behind.
export function clearStoredDraft() {
	try {
		localStorage.removeItem(DRAFT_KEY);
	} catch {
		// Storage can be unavailable; there is then nothing to remove.
	}
}

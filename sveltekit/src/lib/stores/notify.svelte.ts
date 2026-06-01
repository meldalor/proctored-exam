const KEY = 'notifyEnabled';

export const notify = $state<{ enabled: boolean }>({ enabled: true });

export function initNotify(): void {
	try {
		notify.enabled = localStorage.getItem(KEY) !== '0';
	} catch {
		// localStorage недоступен
	}
}

export function toggleNotify(): void {
	notify.enabled = !notify.enabled;
	try {
		localStorage.setItem(KEY, notify.enabled ? '1' : '0');
	} catch {
		// localStorage недоступен
	}
}

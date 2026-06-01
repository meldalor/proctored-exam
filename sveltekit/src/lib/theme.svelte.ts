export const theme = $state<{ value: 'dark' | 'light' }>({ value: 'dark' });

export function initTheme(): void {
	const t = document.documentElement.dataset.theme;
	theme.value = t === 'light' ? 'light' : 'dark';
}

export function toggleTheme(): void {
	theme.value = theme.value === 'light' ? 'dark' : 'light';
	document.documentElement.dataset.theme = theme.value;
	try {
		localStorage.setItem('theme', theme.value);
	} catch {
		// localStorage недоступен
	}
}

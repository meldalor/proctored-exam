let resolver: ((v: boolean) => void) | null = null;

export const confirmState = $state<{ open: boolean; message: string }>({
	open: false,
	message: ''
});

export function appConfirm(message: string): Promise<boolean> {
	confirmState.message = message;
	confirmState.open = true;
	return new Promise<boolean>((res) => {
		resolver = res;
	});
}

export function resolveConfirm(value: boolean): void {
	confirmState.open = false;
	resolver?.(value);
	resolver = null;
}

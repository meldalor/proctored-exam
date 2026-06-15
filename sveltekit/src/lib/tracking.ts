export interface TrackEvent {
	field: string | null;
	type: string;
	payload: unknown;
	ts: number;
}

export function isTouchDevice(): boolean {
	// На тач-устройствах size/pointer-детект даёт false-positive: клавиатура и адресная строка меняют innerHeight.
	return Boolean(
		window.matchMedia?.('(pointer: coarse)').matches ||
		navigator.maxTouchPoints > 0 ||
		'ontouchstart' in window
	);
}

export class Tracker {
	buf: TrackEvent[] = [];
	activeField = '1';
	onFullscreenChange?: (active: boolean) => void;

	private devtoolsOpen = false;
	private pointerOutside = false;
	private lastHidden = false;
	private blurRecorded = false;
	private lastDevtoolsChange = 0;
	private lastCheckTs = 0;
	private timer?: ReturnType<typeof setInterval>;
	private listeners: Array<{ target: EventTarget; ev: string; fn: EventListener }> = [];

	record(field: string | null, type: string, payload: unknown = {}): void {
		this.buf.push({ field, type, payload, ts: Date.now() });
	}

	drain(): TrackEvent[] {
		return this.buf.splice(0);
	}

	private on(target: EventTarget, ev: string, fn: EventListener): void {
		target.addEventListener(ev, fn);
		this.listeners.push({ target, ev, fn });
	}

	attach(flush: () => void): void {
		this.lastHidden = document.hidden;
		this.lastCheckTs = Date.now();

		const isTouch = isTouchDevice();

		this.on(document, 'visibilitychange', () => {
			if (document.hidden === this.lastHidden) return;
			this.lastHidden = document.hidden;
			this.record(this.activeField, document.hidden ? 'tab_hidden' : 'tab_visible');
			flush();
		});

		this.on(document, 'copy', () => {
			const text = window.getSelection()?.toString() || '';
			if (text) this.record(this.activeField, 'copy', { text });
		});

		this.on(window, 'blur', () => {
			setTimeout(() => {
				if (document.hidden) return;
				if (Date.now() - this.lastDevtoolsChange < 500) return;
				this.blurRecorded = true;
				this.record(this.activeField, 'window_blur');
				flush();
			}, 100);
		});

		this.on(window, 'focus', () => {
			setTimeout(() => {
				if (document.hidden) return;
				if (Date.now() - this.lastDevtoolsChange < 500) return;
				if (!this.blurRecorded) return;
				this.blurRecorded = false;
				this.record(this.activeField, 'window_focus');
				flush();
			}, 100);
		});

		if (!isTouch) {
			this.on(document, 'mouseleave', () => {
				if (this.pointerOutside) return;
				this.pointerOutside = true;
				this.record(this.activeField, 'pointer_leave');
				flush();
			});
			this.on(document, 'mouseenter', () => {
				if (!this.pointerOutside) return;
				this.pointerOutside = false;
				this.record(this.activeField, 'pointer_return');
				flush();
			});

			const onFsChange = () => {
				const active = !!(
					document.fullscreenElement ??
					(document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement
				);
				this.record(this.activeField, active ? 'fullscreen_enter' : 'fullscreen_exit');
				this.onFullscreenChange?.(active);
				flush();
			};
			this.on(document, 'fullscreenchange', onFsChange);
			this.on(document, 'webkitfullscreenchange', onFsChange);
		}

		const threshold = 160;
		const check = () => {
			const now = Date.now();
			const gap = now - this.lastCheckTs;
			this.lastCheckTs = now;

			if (!isTouch) {
				const open =
					window.outerWidth - window.innerWidth > threshold ||
					window.outerHeight - window.innerHeight > threshold;
				if (open && !this.devtoolsOpen) {
					this.devtoolsOpen = true;
					this.lastDevtoolsChange = now;
					this.record(this.activeField, 'devtools_open');
					flush();
				} else if (!open && this.devtoolsOpen) {
					this.devtoolsOpen = false;
					this.lastDevtoolsChange = now;
					this.record(this.activeField, 'devtools_close');
					flush();
				}
			}

			if (gap > 2000) {
				const hiddenTs = now - gap + 500;
				this.buf.push({ field: this.activeField, type: 'tab_hidden', payload: {}, ts: hiddenTs });
				this.buf.push({ field: this.activeField, type: 'tab_visible', payload: {}, ts: now });
				this.lastHidden = false;
				flush();
			} else if (document.hidden !== this.lastHidden) {
				this.lastHidden = document.hidden;
				this.record(this.activeField, document.hidden ? 'tab_hidden' : 'tab_visible');
				flush();
			}
		};
		check();
		if (!isTouch) this.on(window, 'resize', check as EventListener);
		this.timer = setInterval(check, 1000);
	}

	detach(): void {
		if (this.timer) clearInterval(this.timer);
		for (const { target, ev, fn } of this.listeners) target.removeEventListener(ev, fn);
		this.listeners = [];
	}
}

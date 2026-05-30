export const EVENT_TYPES = Object.freeze({
	KEYSTROKE: 'keystroke',
	SNAPSHOT: 'answer_snapshot',
	COPY: 'copy',
	PASTE: 'paste',
	TAB_HIDDEN: 'tab_hidden',
	TAB_VISIBLE: 'tab_visible',
	WINDOW_BLUR: 'window_blur',
	WINDOW_FOCUS: 'window_focus',
	DEVTOOLS_OPEN: 'devtools_open',
	DEVTOOLS_CLOSE: 'devtools_close'
});

export const ALERT_TYPES = new Set<string>([
	EVENT_TYPES.COPY,
	EVENT_TYPES.PASTE,
	EVENT_TYPES.TAB_HIDDEN,
	EVENT_TYPES.TAB_VISIBLE,
	EVENT_TYPES.WINDOW_BLUR,
	EVENT_TYPES.WINDOW_FOCUS,
	EVENT_TYPES.DEVTOOLS_OPEN,
	EVENT_TYPES.DEVTOOLS_CLOSE
]);

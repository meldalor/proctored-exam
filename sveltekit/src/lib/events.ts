export const EV_LABELS: Record<string, string> = {
	copy: '[copy] Скопировал текст вопроса',
	paste: '[paste] Вставил текст в ответ',
	tab_hidden: '[tab] Переключил вкладку',
	tab_visible: '<- Вернулся на вкладку',
	window_blur: '[blur] Свернул окно',
	window_focus: '<- Развернул окно',
	devtools_open: '[devtools] Открыл DevTools',
	devtools_close: '<- Закрыл DevTools'
};

export const EV_SHORT: Record<string, string> = {
	copy: 'Копирование',
	paste: 'Вставка',
	tab_hidden: 'Смена вкладки',
	tab_visible: 'Возврат',
	window_blur: 'Blur окна',
	window_focus: 'Focus окна',
	keystroke: 'Ввод',
	devtools_open: 'DevTools',
	devtools_close: 'DevTools'
};

export const EV_CLASS: Record<string, string> = {
	copy: 'ev-copy',
	paste: 'ev-paste',
	tab_hidden: 'ev-tab',
	tab_visible: 'ev-focus',
	window_blur: 'ev-blur',
	window_focus: 'ev-focus',
	keystroke: 'ev-keystroke',
	devtools_open: 'ev-tab',
	devtools_close: 'ev-focus'
};

export const EV_MARKER: Record<string, string> = {
	copy: 't-marker-copy',
	paste: 't-marker-paste',
	tab_hidden: 't-marker-tab',
	tab_visible: 't-marker-focus',
	window_blur: 't-marker-blur',
	window_focus: 't-marker-focus',
	devtools_open: 't-marker-tab',
	devtools_close: 't-marker-focus'
};

export const EV_WARNING = new Set(['copy', 'paste', 'tab_hidden', 'window_blur', 'devtools_open']);

export const EV_COUNTER: Record<string, string> = {
	copy: 'copy_count',
	paste: 'paste_count',
	tab_hidden: 'tab_hidden_count',
	window_blur: 'window_blur_count'
};

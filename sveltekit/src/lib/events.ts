export const EV_LABELS: Record<string, string> = {
	copy: '[copy] Скопировал текст вопроса',
	paste: '[paste] Вставил текст в ответ',
	tab_hidden: '[tab] Переключил вкладку',
	tab_visible: '<- Вернулся на вкладку',
	window_blur: '[blur] Свернул окно',
	window_focus: '<- Развернул окно',
	devtools_open: '[devtools] Открыл DevTools',
	devtools_close: '<- Закрыл DevTools',
	fullscreen_exit: '[fullscreen] Вышел из полноэкранного режима',
	fullscreen_enter: '<- Вернулся в полноэкранный режим',
	pointer_leave: '[pointer] Курсор ушёл за пределы окна',
	pointer_return: '<- Курсор вернулся',
	screen_share_started: '[screen] Начал шаринг экрана',
	screen_share_stopped: '[screen] Остановил шаринг экрана',
	screen_share_denied: '[screen] Отказ от шаринга экрана'
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
	devtools_close: 'DevTools',
	fullscreen_exit: 'Выход ФП',
	fullscreen_enter: 'Возврат ФП',
	pointer_leave: 'Курсор вне окна',
	pointer_return: 'Курсор в окне',
	screen_share_started: 'Шаринг старт',
	screen_share_stopped: 'Шаринг стоп',
	screen_share_denied: 'Шаринг отказ'
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
	devtools_close: 'ev-focus',
	fullscreen_exit: 'ev-blur',
	fullscreen_enter: 'ev-focus',
	pointer_leave: 'ev-tab',
	pointer_return: 'ev-focus',
	screen_share_started: 'ev-focus',
	screen_share_stopped: 'ev-blur',
	screen_share_denied: 'ev-tab'
};

export const EV_MARKER: Record<string, string> = {
	copy: 't-marker-copy',
	paste: 't-marker-paste',
	tab_hidden: 't-marker-tab',
	tab_visible: 't-marker-focus',
	window_blur: 't-marker-blur',
	window_focus: 't-marker-focus',
	devtools_open: 't-marker-tab',
	devtools_close: 't-marker-focus',
	fullscreen_exit: 't-marker-blur',
	fullscreen_enter: 't-marker-focus',
	pointer_leave: 't-marker-tab',
	pointer_return: 't-marker-focus',
	screen_share_started: 't-marker-focus',
	screen_share_stopped: 't-marker-blur',
	screen_share_denied: 't-marker-tab'
};

export const EV_WARNING = new Set([
	'copy',
	'paste',
	'tab_hidden',
	'window_blur',
	'devtools_open',
	'fullscreen_exit',
	'screen_share_stopped',
	'screen_share_denied'
]);

export const EV_COUNTER: Record<string, string> = {
	copy: 'copy_count',
	paste: 'paste_count',
	tab_hidden: 'tab_hidden_count',
	window_blur: 'window_blur_count'
};

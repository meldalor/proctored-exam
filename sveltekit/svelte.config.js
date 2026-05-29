import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter(),
		// Строгий CSP: SvelteKit сам проставляет nonce своему bootstrap-скрипту и
		// %sveltekit.nonce% (mode 'auto': SSR → nonce). script-src закрывает XSS.
		// Стиль-элементы строгие (блок инъекции <style>); инлайн style="..."-атрибуты
		// разрешены — нужны для динамики (позиции маркеров replay, min-height и т.п.),
		// нонсами они не покрываются (это style-src-attr).
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'script-src': ['self'],
				'style-src-elem': ['self'],
				'style-src-attr': ['unsafe-inline'],
				'img-src': ['self', 'data:'],
				'connect-src': ['self'],
				'font-src': ['self'],
				'base-uri': ['self'],
				'form-action': ['self'],
				'frame-ancestors': ['none'],
				'object-src': ['none']
			}
		}
	}
};

export default config;

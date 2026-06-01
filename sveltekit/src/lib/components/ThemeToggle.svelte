<script lang="ts">
	import Icon from './Icon.svelte';
	import { theme, toggleTheme } from '$lib/theme.svelte';
</script>

<button
	class="btn-icon"
	onclick={toggleTheme}
	title={theme.value === 'light' ? 'Тёмная тема' : 'Светлая тема'}
	aria-label="Сменить тему"
>
	<Icon name={theme.value === 'light' ? 'moon' : 'sun'} />
</button>

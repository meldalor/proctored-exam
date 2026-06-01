<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import favicon from '$lib/assets/favicon.svg';
	import Toast from '$lib/components/Toast.svelte';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { initTheme } from '$lib/theme.svelte';

	let { children } = $props();

	// FAB темы только на логинах: в /teacher тоггл в Nav, на /exam — в потоке, иначе fixed-кнопка перекрывает контент.
	const inTeacherApp = $derived(
		page.url.pathname.startsWith('/teacher') && page.url.pathname !== '/teacher/login'
	);
	const showFab = $derived(!inTeacherApp && page.url.pathname !== '/exam');

	onMount(initTheme);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if showFab}
	<div class="theme-fab"><ThemeToggle /></div>
{/if}

{@render children()}

<Toast />
<ConfirmModal />

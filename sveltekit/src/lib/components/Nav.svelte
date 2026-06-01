<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import GroupPicker from './GroupPicker.svelte';
	import ThemeToggle from './ThemeToggle.svelte';

	let role = $state<string | null>(null);

	const links = $derived(
		role === 'admin'
			? [{ href: '/teacher/admin', label: 'Преподаватели' }]
			: [
					{ href: '/teacher', label: 'Экзамен' },
					{ href: '/teacher/students', label: 'Студенты' },
					{ href: '/teacher/questions', label: 'Вопросы' }
				]
	);

	async function logout() {
		await fetch('/api/auth/teacher/logout', { method: 'POST' });
		window.location.href = '/teacher/login';
	}

	onMount(async () => {
		const r = await fetch('/api/teacher/me');
		if (r.ok) role = (await r.json()).role;
	});
</script>

<nav>
	<div class="container">
		<span class="brand">Панель преподавателя</span>
		{#each links as l (l.href)}
			<a class="nav-link" href={l.href} class:active={page.url.pathname === l.href}>{l.label}</a>
		{/each}
		<span class="nav-spacer"></span>
		{#if role !== 'admin'}<GroupPicker />{/if}
		<ThemeToggle />
		<button class="btn btn-secondary btn-sm" onclick={logout}>[logout]</button>
	</div>
</nav>

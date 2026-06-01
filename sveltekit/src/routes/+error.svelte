<script lang="ts">
	import { page } from '$app/state';

	const status = $derived(page.status);
	const message = $derived(page.error?.message || 'Что-то пошло не так');
</script>

<div class="login-wrapper">
	<div class="login-card card">
		<h1>{status}</h1>
		<p class="login-subtitle">// {message}</p>
		<div class="mt-4 text-center">
			<a href="/" class="btn btn-primary w-full">На главную</a>
		</div>
	</div>
</div>

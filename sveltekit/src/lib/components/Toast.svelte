<script lang="ts">
	import { toasts, dismissToast } from '$lib/stores/toasts.svelte';
</script>

<div class="toast-container">
	{#each toasts.list as t (t.id)}
		{#if t.href}
			<a class="toast toast-{t.cls} toast-link" href={t.href} onclick={() => dismissToast(t.id)}>
				<span class="toast-icon">{t.icon}</span>
				<div>
					<div class="font-semibold text-sm">{t.title}</div>
					<div class="text-xs text-muted">{t.body}</div>
				</div>
			</a>
		{:else}
			<div class="toast toast-{t.cls}">
				<span class="toast-icon">{t.icon}</span>
				<div>
					<div class="font-semibold text-sm">{t.title}</div>
					<div class="text-xs text-muted">{t.body}</div>
				</div>
			</div>
		{/if}
	{/each}
</div>

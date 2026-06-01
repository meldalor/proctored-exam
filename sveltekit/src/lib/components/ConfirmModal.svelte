<script lang="ts">
	import { confirmState, resolveConfirm } from '$lib/stores/confirm.svelte';

	function onKey(e: KeyboardEvent) {
		if (!confirmState.open) return;
		if (e.key === 'Escape') resolveConfirm(false);
		if (e.key === 'Enter') resolveConfirm(true);
	}
</script>

<svelte:window onkeydown={onKey} />

{#if confirmState.open}
	<div
		class="confirm-overlay"
		role="presentation"
		onclick={(e) => {
			if (e.target === e.currentTarget) resolveConfirm(false);
		}}
	>
		<div class="confirm-modal">
			<div class="confirm-msg">{confirmState.message}</div>
			<div class="confirm-actions">
				<button class="btn btn-secondary btn-sm" onclick={() => resolveConfirm(false)}
					>[cancel]</button
				>
				<button class="btn btn-primary btn-sm" onclick={() => resolveConfirm(true)}>[ok]</button>
			</div>
		</div>
	</div>
{/if}

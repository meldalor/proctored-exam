<script lang="ts">
	import type { Snippet } from 'svelte';
	let { variant = 'gray', children }: { variant?: string; children?: Snippet } = $props();
</script>

<span class="badge badge-{variant}">{@render children?.()}</span>

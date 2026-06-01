<script lang="ts">
	import { md } from '$lib/markdown';
	let { source = '' }: { source?: string } = $props();
</script>

{@html md(source)}

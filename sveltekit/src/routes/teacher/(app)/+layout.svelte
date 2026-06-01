<script lang="ts">
	import { onMount } from 'svelte';
	import Nav from '$lib/components/Nav.svelte';
	import GroupModal from '$lib/components/GroupModal.svelte';
	import { loadGroups } from '$lib/stores/groups.svelte';

	let { children, data } = $props();

	// У админа нет групп — иначе /api/teacher/groups вернёт 401.
	onMount(() => {
		if (data.role !== 'admin') loadGroups();
	});
</script>

<Nav />
<GroupModal />

{@render children()}

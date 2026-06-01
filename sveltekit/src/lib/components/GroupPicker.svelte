<script lang="ts">
	import { groups, currentGroup, selectGroup, openGroupModal } from '$lib/stores/groups.svelte';
	import { clickOutside } from '$lib/actions/clickOutside';
</script>

<div class="nav-group-picker" use:clickOutside={() => (groups.dropdownOpen = false)}>
	<button
		class="btn btn-sm btn-secondary"
		onclick={() => (groups.dropdownOpen = !groups.dropdownOpen)}
	>
		<span>{currentGroup()?.name ?? 'группа…'}</span> ▾
	</button>
	{#if groups.dropdownOpen}
		<div class="group-dropdown">
			{#each groups.list as g (g.id)}
				<a
					class:active={g.id === groups.currentId}
					href="#select"
					onclick={(e) => {
						e.preventDefault();
						selectGroup(g.id);
					}}>{g.name}</a
				>
			{/each}
			<a
				class="group-manage"
				href="#manage"
				onclick={(e) => {
					e.preventDefault();
					openGroupModal();
				}}>управление группами</a
			>
		</div>
	{/if}
</div>

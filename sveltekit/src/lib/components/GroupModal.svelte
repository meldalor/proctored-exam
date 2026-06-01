<script lang="ts">
	import {
		groups,
		selectGroup,
		closeGroupModal,
		createGroup,
		startEditGroup,
		saveEditGroup,
		deleteGroup
	} from '$lib/stores/groups.svelte';
	import Icon from './Icon.svelte';
</script>

{#if groups.modalOpen}
	<div
		class="group-modal-overlay"
		role="presentation"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeGroupModal();
		}}
	>
		<div class="group-modal">
			<div class="flex items-center justify-between mb-3">
				<h2>Управление группами</h2>
				<button class="btn-icon btn-icon-bare" onclick={closeGroupModal} title="Закрыть">
					<Icon name="x" />
				</button>
			</div>

			<div class="group-modal-list">
				{#each groups.list as g (g.id)}
					<div class="group-row" class:active={g.id === groups.currentId}>
						<div class="group-row-main" role="presentation" onclick={() => selectGroup(g.id)}>
							{#if groups.editId === g.id}
								<input
									type="text"
									bind:value={groups.editName}
									onclick={(e) => e.stopPropagation()}
									onkeydown={(e) => {
										if (e.key === 'Enter') saveEditGroup();
									}}
									style="width:100%;box-sizing:border-box"
								/>
							{:else}
								<span class="font-semibold">{g.name}</span>
								{#if g.id === groups.currentId}
									<span class="badge badge-green" style="margin-left:.4rem">активна</span>
								{/if}
								<div class="text-xs text-muted">{g.students} студ. · {g.questions} вопр.</div>
							{/if}
						</div>
						<div class="flex gap-1" role="presentation" onclick={(e) => e.stopPropagation()}>
							{#if groups.editId === g.id}
								<button class="btn-icon" onclick={saveEditGroup} title="Сохранить">
									<Icon name="check" />
								</button>
								<button class="btn-icon" onclick={() => (groups.editId = null)} title="Отмена">
									<Icon name="x" />
								</button>
							{:else}
								<button class="btn-icon" onclick={() => startEditGroup(g)} title="Переименовать">
									<Icon name="pencil" />
								</button>
								<button
									class="btn-icon btn-icon-danger"
									onclick={() => deleteGroup(g)}
									title="Удалить группу"
								>
									<Icon name="trash" />
								</button>
							{/if}
						</div>
					</div>
				{/each}
			</div>

			<div class="flex gap-2 mt-3">
				<input
					type="text"
					bind:value={groups.newName}
					placeholder="Название новой группы"
					onkeydown={(e) => {
						if (e.key === 'Enter') createGroup();
					}}
				/>
				<button
					class="btn btn-primary"
					onclick={createGroup}
					disabled={!groups.newName.trim()}
					style="white-space:nowrap">+ Новая</button
				>
			</div>
		</div>
	</div>
{/if}

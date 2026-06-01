<script lang="ts">
	let { checked = $bindable(false), onchange }: { checked?: boolean; onchange?: () => void } =
		$props();
</script>

<label class="switch">
	<input type="checkbox" bind:checked {onchange} />
	<span class="switch-slider"></span>
</label>

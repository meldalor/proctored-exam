<script lang="ts">
	let { value, label }: { value: number | string; label: string } = $props();
</script>

<div class="stat-card">
	<div class="stat-value">{value}</div>
	<div class="stat-label">{label}</div>
</div>

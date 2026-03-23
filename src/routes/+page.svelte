<script>
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(() => {
		// Redirect to main functional page
		goto('/prices');
	});
</script>

<div class="welcome-container">
	<div class="loader"></div>
	<p>Redirecting to Dashboard...</p>
</div>

<style>
	.welcome-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 60vh;
		text-align: center;
		color: #64748b;
	}

	.loader {
		border: 3px solid #f3f3f3;
		border-radius: 50%;
		border-top: 3px solid #3b82f6;
		width: 40px;
		height: 40px;
		animation: spin 1s linear infinite;
		margin-bottom: 1rem;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}
</style>

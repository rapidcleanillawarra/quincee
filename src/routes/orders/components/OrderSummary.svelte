<script>
	import { fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { formatCurrency } from '../utils/format';

	let { items, grandTotal, handleSave, disabled = false } = $props();
</script>

<footer class="summary-footer" in:fly={{ y: 20, duration: 800, easing: quintOut }}>
	<div class="summary-info">
		<span class="summary-label">Grand Total</span>
		<span class="summary-value">{formatCurrency(grandTotal)}</span>
	</div>
	<button onclick={handleSave} class="save-btn" disabled={disabled || items.length === 0}>
		{disabled ? 'Saving...' : 'Save Order'}
	</button>
</footer>

<style>
	.summary-footer {
		background: #0f172a;
		border-radius: 20px;
		padding: 1.5rem;
		color: #fff;
		display: flex;
		justify-content: space-between;
		align-items: center;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
		margin-top: auto;
		position: sticky;
		bottom: 1.5rem;
		z-index: 10;
	}

	.summary-info {
		display: flex;
		flex-direction: column;
	}

	.summary-label {
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #94a3b8;
		font-weight: 600;
	}

	.summary-value {
		font-size: 1.75rem;
		font-weight: 800;
		letter-spacing: -0.025em;
	}

	.save-btn {
		background: #3b82f6;
		color: #fff;
		border: none;
		padding: 0.75rem 1.5rem;
		border-radius: 12px;
		font-weight: 700;
		font-size: 1rem;
		cursor: pointer;
		transition: all 0.2s;
		box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);
	}

	.save-btn:hover:not(:disabled) {
		background: #2563eb;
		transform: translateY(-2px);
		box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.4);
	}

	.save-btn:active:not(:disabled) {
		transform: translateY(0);
	}

	.save-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		filter: grayscale(1);
	}

	@media (max-width: 639px) {
		.summary-footer {
			flex-direction: column;
			gap: 1rem;
			text-align: center;
			bottom: 1rem;
			padding: 1.25rem;
		}

		.save-btn {
			width: 100%;
		}

		.summary-value {
			font-size: 1.5rem;
		}
	}
</style>

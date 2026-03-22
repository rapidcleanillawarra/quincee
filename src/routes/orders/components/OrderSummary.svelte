<script>
	import { fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { formatCurrency } from '../utils/format';

	let { items, grandTotal, totalCapital, totalProfit, handleSave, disabled = false } = $props();
</script>

<footer class="summary-footer" in:fly={{ y: 20, duration: 800, easing: quintOut }}>
	<div class="summary-content">
		<div class="summary-details">
			<div class="summary-info-group">
				<span class="summary-small-label">Total Capital</span>
				<span class="summary-small-value">{formatCurrency(totalCapital)}</span>
			</div>
			<div class="summary-info-group">
				<span class="summary-small-label">Profit</span>
				<span class="summary-small-value profit-highlight">{formatCurrency(totalProfit)}</span>
			</div>
		</div>
		<div class="summary-main">
			<span class="summary-label">Grand Total</span>
			<span class="summary-value">{formatCurrency(grandTotal)}</span>
		</div>
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

	.summary-content {
		display: flex;
		align-items: center;
		gap: 2.5rem;
	}

	.summary-details {
		display: flex;
		gap: 2rem;
		padding-right: 2rem;
		border-right: 1px solid rgba(255, 255, 255, 0.1);
	}

	.summary-info-group {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.summary-small-label {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #94a3b8;
		font-weight: 600;
	}

	.summary-small-value {
		font-size: 1.1rem;
		font-weight: 700;
		color: #e2e8f0;
	}

	.profit-highlight {
		color: #34d399; /* Emerald 400 */
	}

	.summary-main {
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
		color: #fff;
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

	@media (max-width: 768px) {
		.summary-content {
			flex-direction: column;
			gap: 1.25rem;
			align-items: center;
			width: 100%;
		}

		.summary-details {
			padding-right: 0;
			border-right: none;
			border-bottom: 1px solid rgba(255, 255, 255, 0.1);
			padding-bottom: 1rem;
			width: 100%;
			justify-content: center;
			gap: 1.5rem;
		}

		.summary-footer {
			flex-direction: column;
			gap: 1.5rem;
			text-align: center;
			bottom: 1rem;
			padding: 1.5rem;
		}

		.save-btn {
			width: 100%;
		}

		.summary-value {
			font-size: 1.5rem;
		}
	}
</style>

<script>
	import { slide } from 'svelte/transition';
	import { formatCurrency } from '../utils/format';
	import ProductSearch from './ProductSearch.svelte';

	let { items = $bindable(), removeItem, customerId } = $props();
</script>

<div class="table-container desktop-only">
	<table class="order-table">
		<thead>
			<tr>
				<th>Item Name</th>
				<th>Quantity</th>
				<th>Buy Price</th>
				<th>Sell Price</th>
				<th>Total</th>
				<th class="actions-header"></th>
			</tr>
		</thead>
		<tbody>
			{#each items as item (item.id)}
				<tr transition:slide={{ duration: 300 }}>
					<td>
						<ProductSearch 
							bind:value={item.name} 
							bind:sell_price={item.sell_price}
							bind:buy_price={item.buy_price}
							bind:original_buy_price={item.original_buy_price}
							bind:product_id={item.product_id}
							{customerId}
							placeholder="e.g. Talong"
						/>
					</td>
					<td>
						<input 
							type="number" 
							min="1" 
							bind:value={item.quantity}
							class="input-field qty-input"
						/>
					</td>
					<td>
						<div class="price-input-wrapper">
							<span class="currency-symbol">₱</span>
								<input 
									type="number" 
									min="0" 
									step="0.01"
									bind:value={item.buy_price}
									class="input-field price-input"
									class:price-lower={item.product_id && item.buy_price < item.original_buy_price}
									class:price-higher={item.product_id && item.buy_price > item.original_buy_price}
								/>
						</div>
					</td>
					<td>
						<div class="price-input-wrapper">
							<span class="currency-symbol">₱</span>
							<input 
								type="number" 
								min="0" 
								step="0.01"
								bind:value={item.sell_price}
								class="input-field price-input"
							/>
						</div>
					</td>
					<td class="row-total">
						{formatCurrency(item.quantity * item.sell_price)}
					</td>
					<td class="actions-cell">
						<button 
							onclick={() => removeItem(item.id)} 
							class="delete-btn"
							aria-label="Delete item"
						>
							<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
								<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
							</svg>
						</button>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	/* Desktop Table Styles */
	.table-container {
		background: rgba(255, 255, 255, 0.7);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-radius: 16px;
		border: 1px solid rgba(255, 255, 255, 0.3);
		box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 
					0 8px 10px -6px rgba(0, 0, 0, 0.05);
		/* Removed overflow: hidden to allow dropdown visibility */
		overflow: visible;
	}

	.order-table {
		width: 100%;
		border-collapse: collapse;
		text-align: left;
	}

	.order-table th {
		padding: 1rem;
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #64748b;
		background: rgba(248, 250, 252, 0.5);
		border-bottom: 1px solid #e2e8f0;
	}

	.order-table td {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #f1f5f9;
		vertical-align: middle;
	}

	.order-table tr:last-child td {
		border-bottom: none;
	}

	.input-field {
		width: 100%;
		padding: 0.6rem 0.75rem;
		border-radius: 8px;
		border: 1px solid #e2e8f0;
		background: #fff;
		font-size: 0.95rem;
		transition: all 0.2s;
		color: #1e293b;
		box-sizing: border-box;
	}

	.input-field:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.qty-input {
		width: 80px;
	}

	.price-input-wrapper {
		position: relative;
		display: flex;
		align-items: center;
	}

	.currency-symbol {
		position: absolute;
		left: 0.75rem;
		color: #94a3b8;
		pointer-events: none;
		font-size: 0.9rem;
	}

	.price-input {
		padding-left: 1.75rem;
		width: 120px;
	}

	.row-total {
		font-weight: 600;
		color: #0f172a;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.actions-cell {
		text-align: center;
		width: 50px;
	}

	.delete-btn {
		background: none;
		border: none;
		color: #94a3b8;
		cursor: pointer;
		padding: 0.5rem;
		border-radius: 8px;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.delete-btn:hover {
		color: #ef4444;
		background: #fef2f2;
	}

	.price-lower {
		color: #16a34a !important;
		background: #f0fdf4 !important;
		border-color: #bbf7d0 !important;
	}

	.price-higher {
		color: #dc2626 !important;
		background: #fef2f2 !important;
		border-color: #fecaca !important;
	}

	@media (max-width: 639px) {
		.desktop-only {
			display: none;
		}
	}
</style>

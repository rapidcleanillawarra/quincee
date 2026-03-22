<script>
	import { fly } from 'svelte/transition';
	import { formatCurrency } from '../utils/format';
	import ProductSearch from './ProductSearch.svelte';

	let { item = $bindable(), removeItem } = $props();
</script>

<div class="order-card" transition:fly={{ x: -20, duration: 300 }}>
	<div class="card-header">
		<ProductSearch 
			bind:value={item.name} 
			bind:sell_price={item.sell_price}
			bind:buy_price={item.buy_price}
			placeholder="Item Name"
		/>
		<button 
			onclick={() => removeItem(item.id)} 
			class="delete-btn"
			aria-label="Delete item"
		>
			<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
				<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
			</svg>
		</button>
	</div>
	<div class="card-body">
		<div class="input-group">
			<label for="qty-{item.id}">Qty</label>
			<input 
				id="qty-{item.id}"
				type="number" 
				min="1" 
				bind:value={item.quantity}
				class="input-field"
			/>
		</div>
		<div class="input-group">
			<label for="buy-price-{item.id}">Buy Price</label>
			<div class="price-input-wrapper">
				<span class="currency-symbol">₱</span>
				<input 
					id="buy-price-{item.id}"
					type="number" 
					min="0" 
					step="0.01"
					bind:value={item.buy_price}
					class="input-field"
				/>
			</div>
		</div>
		<div class="input-group">
			<label for="price-{item.id}">Sell Price</label>
			<div class="price-input-wrapper">
				<span class="currency-symbol">₱</span>
				<input 
					id="price-{item.id}"
					type="number" 
					min="0" 
					step="0.01"
					bind:value={item.sell_price}
					class="input-field"
				/>
			</div>
		</div>
	</div>
	<div class="card-footer">
		<span>Subtotal:</span>
		<span class="item-total">{formatCurrency(item.quantity * item.sell_price)}</span>
	</div>
</div>

<style>
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

	.order-card {
		background: rgba(255, 255, 255, 0.7);
		backdrop-filter: blur(12px);
		border-radius: 16px;
		border: 1px solid rgba(255, 255, 255, 0.3);
		padding: 1rem;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.card-header {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}


	.card-body {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 0.75rem;
	}

	.input-group {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.input-group label {
		font-size: 0.7rem;
		font-weight: 700;
		color: #64748b;
		text-transform: uppercase;
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

	.price-input-wrapper input {
		padding-left: 1.75rem;
	}

	.card-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-top: 0.75rem;
		border-top: 1px solid #f1f5f9;
		font-size: 0.9rem;
		color: #64748b;
	}

	.item-total {
		font-weight: 700;
		color: #0f172a;
		font-size: 1.1rem;
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
</style>

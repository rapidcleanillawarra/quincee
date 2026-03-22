<script>
	import { fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { supabase } from '$lib/supabase';
	import OrderTable from './components/OrderTable.svelte';
	import OrderCard from './components/OrderCard.svelte';
	import OrderSummary from './components/OrderSummary.svelte';
	import { formatCurrency } from './utils/format';

	// State for order items
	let items = $state([
		{ id: crypto.randomUUID(), product_id: null, name: '', quantity: 1, sell_price: 0, buy_price: 0, original_buy_price: 0 }
	]);

	// Derived state for totals
	let grandTotal = $derived(
		items.reduce((sum, item) => sum + (item.quantity * item.sell_price), 0)
	);

	function addItem() {
		items.push({
			id: crypto.randomUUID(),
			product_id: null,
			name: '',
			quantity: 1,
			sell_price: 0,
			buy_price: 0,
			original_buy_price: 0
		});
	}

	function removeItem(id) {
		if (items.length > 1) {
			items = items.filter(item => item.id !== id);
		} else {
			// Reset the last item instead of deleting it
			items[0] = { id: crypto.randomUUID(), name: '', quantity: 1, sell_price: 0, buy_price: 0 };
		}
	}

	async function handleSave() {
		// Log the order save
		console.log('Saving Order:', {
			items,
			grandTotal,
			timestamp: new Date().toISOString()
		});

		// Check for buy price updates
		const priceUpdates = items
			.filter(item => item.product_id && item.buy_price !== item.original_buy_price)
			.map(item => ({
				product_id: item.product_id,
				buy_price: item.buy_price,
				sell_price: item.sell_price,
				effective_from: new Date().toISOString()
			}));

		if (priceUpdates.length > 0) {
			const { error } = await supabase
				.from('quincees_prices')
				.insert(priceUpdates);
			
			if (error) {
				console.error('Error updating prices:', error);
				alert('Order saved, but there was an error updating price records.');
			} else {
				console.log('Prices updated successfully');
				// Update original prices to current to avoid duplicate records if saved again
				items.forEach(item => {
					item.original_buy_price = item.buy_price;
				});
				alert('Order saved and prices updated!');
			}
		} else {
			alert('Order saved! (Logged to console)');
		}
	}
</script>

<svelte:head>
	<title>Orders | Quincee's</title>
</svelte:head>

<div class="container">
	<header class="header" in:fly={{ y: -20, duration: 800, easing: quintOut }}>
		<div class="header-content">
			<a href="/prices" class="back-link">
				<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
					<path d="M19 12H5M12 19l-7-7 7-7" />
				</svg>
				Back
			</a>
			<h1>Orders</h1>
		</div>
		<p class="subtitle">Enter item details below to create a new order.</p>
	</header>

	<main class="main-content">
		<!-- Desktop Table View -->
		<OrderTable bind:items {removeItem} />

		<!-- Mobile Card View -->
		<div class="mobile-only card-list">
			{#each items as _, i (items[i].id)}
				<OrderCard bind:item={items[i]} {removeItem} />
			{/each}
		</div>

		<button onclick={addItem} class="add-btn">
			<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
				<line x1="12" y1="5" x2="12" y2="19" />
				<line x1="5" y1="12" x2="19" y2="12" />
			</svg>
			Add Item
		</button>
	</main>

	<OrderSummary {items} {grandTotal} {handleSave} />
</div>

<style>
	.container {
		max-width: 900px;
		margin: 0 auto;
		padding: 1.5rem;
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.header {
		margin-bottom: 0.5rem;
	}

	.header-content {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 0.5rem;
	}

	.back-link {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		text-decoration: none;
		color: #64748b;
		font-size: 0.9rem;
		font-weight: 500;
		transition: color 0.2s;
	}

	.back-link:hover {
		color: #1a202c;
	}

	h1 {
		font-size: 1.75rem;
		font-weight: 800;
		color: #0f172a;
		margin: 0;
		letter-spacing: -0.025em;
	}

	.subtitle {
		color: #64748b;
		margin: 0;
		font-size: 0.95rem;
	}

	.main-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	/* Card View (Mobile) */
	.card-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	/* Buttons */
	.add-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		background: #fff;
		border: 1px dashed #cbd5e1;
		color: #64748b;
		padding: 1rem;
		border-radius: 12px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.add-btn:hover {
		border-color: #3b82f6;
		color: #3b82f6;
		background: rgba(59, 130, 246, 0.05);
	}

	/* Responsive Visibility */
	@media (max-width: 639px) {
		.container {
			padding: 1rem;
		}
	}

	@media (min-width: 640px) {
		.mobile-only {
			display: none;
		}
	}
</style>

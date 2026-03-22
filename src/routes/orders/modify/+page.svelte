<script>
	import { fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { supabase } from '$lib/supabase';
	import OrderTable from './components/OrderTable.svelte';
	import OrderCard from './components/OrderCard.svelte';
	import OrderSummary from './components/OrderSummary.svelte';
	import CustomerSearch from './components/CustomerSearch.svelte';
	import { formatCurrency } from './utils/format';

	// State for order items
	let items = $state([
		{ id: crypto.randomUUID(), product_id: null, name: '', quantity: 1, sell_price: 0, buy_price: 0, original_buy_price: 0 }
	]);

	// State for customer
	let selectedCustomerName = $state("");
	let selectedCustomerId = $state(null);
	let lastAddedRowId = $state(null);
	let isSaving = $state(false);

	// Derived state for totals
	let grandTotal = $derived(
		items.reduce((sum, item) => sum + (item.quantity * item.sell_price), 0)
	);

	let totalCapital = $derived(
		items.reduce((sum, item) => sum + (item.quantity * (item.buy_price || 0)), 0)
	);

	let totalProfit = $derived(grandTotal - totalCapital);

	function addItem() {
		const newItem = {
			id: crypto.randomUUID(),
			product_id: null,
			name: '',
			quantity: 1,
			sell_price: 0,
			buy_price: 0,
			original_buy_price: 0
		};
		items.push(newItem);
		lastAddedRowId = newItem.id;
		return newItem;
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
		if (!selectedCustomerName) {
			alert('Please enter or select a customer name.');
			return;
		}

		const validItems = items.filter(item => (item.product_id || item.name) && item.quantity > 0);
		if (validItems.length === 0) {
			alert('Please add at least one valid product to the order.');
			return;
		}

		// Check if any new products are missing a buy price
		const missingBuyPrice = validItems.find(item => !item.product_id && item.name && (!item.buy_price || item.buy_price <= 0));
		if (missingBuyPrice) {
			alert(`Please enter a buy price for new product: ${missingBuyPrice.name}`);
			return;
		}

		isSaving = true;
		try {
			// 1. Ensure customer exists
			let customerId = selectedCustomerId;
			if (!customerId) {
				// Try to find if a customer with this name already exists
				const { data: existingCust, error: findError } = await supabase
					.from('quincees_customers')
					.select('id')
					.eq('name', selectedCustomerName)
					.maybeSingle();
				
				if (findError) throw findError;

				if (existingCust) {
					customerId = existingCust.id;
				} else {
					// Create new customer
					const { data: newCustomer, error: custError } = await supabase
						.from('quincees_customers')
						.insert({ name: selectedCustomerName })
						.select()
						.single();
					
					if (custError) throw custError;
					customerId = newCustomer.id;
				}
				selectedCustomerId = customerId;
			}

			// 2. Ensure all products exist
			for (let i = 0; i < validItems.length; i++) {
				if (!validItems[i].product_id) {
					// Check if a product with this name already exists (just in case)
					const { data: existingProd, error: prodFindError } = await supabase
						.from('quincees_products')
						.select('id')
						.eq('name', validItems[i].name)
						.maybeSingle();
					
					if (prodFindError) throw prodFindError;

					if (existingProd) {
						validItems[i].product_id = existingProd.id;
					} else {
						// Create new product
						const { data: newProd, error: prodError } = await supabase
							.from('quincees_products')
							.insert({ name: validItems[i].name })
							.select()
							.single();
						
						if (prodError) throw prodError;
						validItems[i].product_id = newProd.id;

						// Also create initial price record
						const { error: priceError } = await supabase
							.from('quincees_prices')
							.insert({
								product_id: newProd.id,
								buy_price: validItems[i].buy_price,
								effective_from: new Date().toISOString()
							});
						
						if (priceError) throw priceError;
						
						// Set original_buy_price to avoid redundant update in Step 4
						validItems[i].original_buy_price = validItems[i].buy_price;
					}
				}
			}

			// 3. Create Order
			const { data: order, error: orderError } = await supabase
				.from('quincees_orders')
				.insert({
					customer_id: customerId,
					customer_username: selectedCustomerName, // Keep for backward compatibility
					total_amount: grandTotal,
					status: 'completed'
				})
				.select()
				.single();

			if (orderError) throw orderError;

			// 4. Create Order Items
			const orderItems = validItems.map(item => ({
				order_id: order.id,
				product_id: item.product_id,
				quantity: item.quantity,
				price_at_order: item.sell_price
			}));

			const { error: itemsError } = await supabase
				.from('quincees_order_items')
				.insert(orderItems);

			if (itemsError) throw itemsError;

			// 5. Update Prices (Existing logic)
			const buyPriceUpdates = validItems
				.filter(item => item.buy_price !== item.original_buy_price)
				.map(item => ({
					product_id: item.product_id,
					buy_price: item.buy_price,
					effective_from: new Date().toISOString()
				}));

			if (buyPriceUpdates.length > 0) {
				const { error: priceError } = await supabase
					.from('quincees_prices')
					.insert(buyPriceUpdates);
				
				if (priceError) {
					console.error('Error updating buy prices:', priceError);
				}
			}

			// 6. Update Customer-Specific Sell Prices
			const sellPriceUpdates = validItems.map(item => ({
				customer_id: customerId,
				product_id: item.product_id,
				sell_price: item.sell_price,
				updated_at: new Date().toISOString()
			}));

			if (sellPriceUpdates.length > 0) {
				const { error: sellPriceError } = await supabase
					.from('quincees_customer_prices')
					.upsert(sellPriceUpdates, { onConflict: 'customer_id, product_id' });
				
				if (sellPriceError) {
					console.error('Error updating customer sell prices:', sellPriceError);
					alert('Order saved, but there was an error updating customer price records.');
				}
			}

			alert('Order saved successfully!');
			
			// Reset form
			items = [
				{ id: crypto.randomUUID(), product_id: null, name: '', quantity: 1, sell_price: 0, buy_price: 0, original_buy_price: 0 }
			];
			selectedCustomerName = "";
			selectedCustomerId = null;

		} catch (error) {
			console.error('Error saving order:', error);
			alert('Failed to save order: ' + error.message);
		} finally {
			isSaving = false;
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
		<div class="customer-section">
			<label for="customer-search">Customer Name <span class="required">*</span></label>
			<CustomerSearch 
				bind:value={selectedCustomerName} 
				bind:customer_id={selectedCustomerId}
				placeholder="Enter or search customer..."
			/>
		</div>
	</header>

	<main class="main-content">
		<!-- Desktop Table View -->
		<OrderTable bind:items {removeItem} {addItem} {lastAddedRowId} customerId={selectedCustomerId} />

		<!-- Mobile Card View -->
		<div class="mobile-only card-list">
			{#each items as _, i (items[i].id)}
				<OrderCard bind:item={items[i]} {removeItem} {addItem} {lastAddedRowId} index={i} isLast={i === items.length - 1} customerId={selectedCustomerId} />
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

	<OrderSummary {items} {grandTotal} {totalCapital} {totalProfit} {handleSave} disabled={isSaving} />
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

	.customer-section {
		margin-top: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.customer-section label {
		font-size: 0.85rem;
		font-weight: 700;
		color: #475569;
		text-transform: uppercase;
		letter-spacing: 0.025em;
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.required {
		color: #ef4444;
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

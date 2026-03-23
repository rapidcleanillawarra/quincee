<script>
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { supabase } from '$lib/supabase';
	import OrderTable from '../components/OrderTable.svelte';
	import OrderCard from '../components/OrderCard.svelte';
	import OrderSummary from '../components/OrderSummary.svelte';
	import CustomerSearch from '../components/CustomerSearch.svelte';
	import { formatCurrency } from '../utils/format';

	// State for order items
	let items = $state([
		{ id: crypto.randomUUID(), product_id: null, name: '', quantity: 1, sell_price: 0, buy_price: 0, original_buy_price: 0, selected: false }
	]);

	// State for customer
	let selectedCustomerName = $state("");
	let selectedCustomerId = $state(null);
	let lastAddedRowId = $state(null);
	let isSaving = $state(false);
	let orderId = $state(null);
	let isLoading = $state(false);
	let orderStatus = $state("quoted"); // quoted, unpaid, completed

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
			original_buy_price: 0,
			selected: false
		};
		items.push(newItem);
		lastAddedRowId = newItem.id;
		return newItem;
	}

	let anySelected = $derived(items.some(item => item.selected));
	let allSelected = $derived(items.length > 0 && items.every(item => item.selected));

	function toggleAllSelection() {
		const targetValue = !allSelected;
		items.forEach(item => item.selected = targetValue);
	}

	function removeItem(id) {
		if (items.length > 1) {
			items = items.filter(item => item.id !== id);
		} else {
			// Reset the last item instead of deleting it
			items[0] = { id: crypto.randomUUID(), product_id: null, name: '', quantity: 1, sell_price: 0, buy_price: 0, original_buy_price: 0, selected: false };
		}
	}

	async function loadOrder(id) {
		isLoading = true;
		try {
			const { data: order, error: orderError } = await supabase
				.from('quincees_orders')
				.select('*')
				.eq('id', id)
				.single();

			if (orderError) throw orderError;
			if (!order) return;

			orderId = order.id;
			selectedCustomerId = order.customer_id;
			selectedCustomerName = order.customer_username;
			orderStatus = order.status || 'quoted';

			// Fetch items for this order
			const { data: orderItems, error: itemsError } = await supabase
				.from('quincees_order_items')
				.select(`
					*,
					product:quincees_products(name)
				`)
				.eq('order_id', id);

			if (itemsError) throw itemsError;

			if (orderItems && orderItems.length > 0) {
				const mappedItems = await Promise.all(orderItems.map(async (item) => {
					// Get latest buy price for each product
					const { data: priceData } = await supabase
						.from('quincees_prices')
						.select('buy_price')
						.eq('product_id', item.product_id)
						.order('effective_from', { ascending: false })
						.limit(1)
						.maybeSingle();

					return {
						id: crypto.randomUUID(),
						product_id: item.product_id,
						name: item.product?.name || '',
						quantity: item.quantity,
						sell_price: item.price_at_order,
						buy_price: priceData?.buy_price || 0,
						original_buy_price: priceData?.buy_price || 0,
						selected: false
					};
				}));

				items = mappedItems;
			}
		} catch (error) {
			console.error('Error loading order:', error);
			alert('Failed to load order: ' + error.message);
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		const id = page.url.searchParams.get('id');
		if (id) {
			loadOrder(id);
		}
	});

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

			// 3. Create/Update Order
			let order;
			if (orderId) {
				const { data: updatedOrder, error: orderError } = await supabase
					.from('quincees_orders')
					.update({
						customer_id: customerId,
						customer_username: selectedCustomerName,
						total_amount: grandTotal,
						status: orderStatus
					})
					.eq('id', orderId)
					.select()
					.single();
				
				if (orderError) throw orderError;
				order = updatedOrder;

				// Delete existing items to replace with new ones
				const { error: deleteError } = await supabase
					.from('quincees_order_items')
					.delete()
					.eq('order_id', orderId);
				
				if (deleteError) throw deleteError;
			} else {
				const { data: newOrder, error: orderError } = await supabase
					.from('quincees_orders')
					.insert({
						customer_id: customerId,
						customer_username: selectedCustomerName, 
						total_amount: grandTotal,
						status: orderStatus
					})
					.select()
					.single();

				if (orderError) throw orderError;
				order = newOrder;
			}

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
			
			// If it was a new order, update the URL and state
			if (!orderId) {
				orderId = order.id;
				goto(`/orders/modify?id=${order.id}`, { replaceState: true });
			} else {
				// For existing orders, just reload to ensure everything is in sync
				loadOrder(orderId);
			}

		} catch (error) {
			console.error('Error saving order:', error);
			alert('Failed to save order: ' + error.message);
		} finally {
			isSaving = false;
		}
	}

	async function handleCreateNewFromSelected() {
		const selectedItems = items.filter(item => item.selected && (item.product_id || item.name));
		if (selectedItems.length === 0) {
			alert('Please select at least one valid item.');
			return;
		}

		if (!confirm(`Create a new order for ${selectedCustomerName} with ${selectedItems.length} selected items?`)) {
			return;
		}

		isSaving = true;
		try {
			// 1. Ensure customer exists (similar to handleSave)
			let customerId = selectedCustomerId;
			if (!customerId) {
				const { data: existingCust } = await supabase
					.from('quincees_customers')
					.select('id')
					.eq('name', selectedCustomerName)
					.maybeSingle();
				
				if (existingCust) {
					customerId = existingCust.id;
				} else {
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

			// 2. Create New Order
			const { data: newOrder, error: orderError } = await supabase
				.from('quincees_orders')
				.insert({
					customer_id: customerId,
					customer_username: selectedCustomerName,
					total_amount: selectedItems.reduce((sum, item) => sum + (item.quantity * item.sell_price), 0),
					status: 'quoted'
				})
				.select()
				.single();
			
			if (orderError) throw orderError;

			// 3. Create Order Items
			const newOrderItems = selectedItems.map(item => ({
				order_id: newOrder.id,
				product_id: item.product_id,
				quantity: item.quantity,
				price_at_order: item.sell_price
			}));

			const { error: itemsError } = await supabase
				.from('quincees_order_items')
				.insert(newOrderItems);
			
			if (itemsError) throw itemsError;

			alert('New order created successfully!');
			goto(`/orders/modify?id=${newOrder.id}`);
		} catch (error) {
			console.error('Error creating new order from selection:', error);
			alert('Failed to create new order: ' + error.message);
		} finally {
			isSaving = false;
		}
	}

	async function handleDelete() {
		if (!orderId) return;
		if (!confirm('Are you sure you want to delete this order? This action cannot be undone.')) {
			return;
		}

		isSaving = true;
		try {
			const { error } = await supabase
				.from('quincees_orders')
				.delete()
				.eq('id', orderId);

			if (error) throw error;

			alert('Order deleted successfully');
			window.location.href = '/orders';
		} catch (error) {
			console.error('Error deleting order:', error);
			alert('Failed to delete order: ' + error.message);
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
			<a href="/orders" class="back-link">
				<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
					<path d="M19 12H5M12 19l-7-7 7-7" />
				</svg>
				Back
			</a>
			<h1>Orders</h1>
		</div>

		{#if orderId}
			<div class="actions-section" in:fly={{ x: 20, duration: 600, delay: 100, easing: quintOut }}>
				<button 
					class="delete-order-btn" 
					onclick={handleDelete}
					disabled={isSaving}
				>
					<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
						<polyline points="3 6 5 6 21 6"></polyline>
						<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
					</svg>
					Delete Order
				</button>
			</div>
		{/if}

		{#if anySelected}
			<div class="selection-actions" in:fly={{ y: 20, duration: 400, easing: quintOut }}>
				<div class="selection-count">
					{items.filter(i => i.selected).length} items selected
				</div>
				<button 
					class="create-new-btn" 
					onclick={handleCreateNewFromSelected}
					disabled={isSaving}
				>
					<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
						<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
						<polyline points="14 2 14 8 20 8"></polyline>
						<line x1="12" y1="18" x2="12" y2="12"></line>
						<line x1="9" y1="15" x2="15" y2="15"></line>
					</svg>
					Create as New Order
				</button>
			</div>
		{/if}

		<div class="customer-section">
			<label for="customer-search">Customer Name <span class="required">*</span></label>
			<CustomerSearch 
				bind:value={selectedCustomerName} 
				bind:customer_id={selectedCustomerId}
				placeholder="Enter or search customer..."
			/>
		</div>

		<div class="status-section" in:fly={{ y: -10, duration: 600, delay: 200, easing: quintOut }}>
			<span class="section-label">Order Status</span>
			<div class="status-selector">
				<button 
					class="status-btn status-quoted" 
					class:active={orderStatus === 'quoted'} 
					onclick={() => orderStatus = 'quoted'}
				>
					<span class="dot"></span>
					Quoted
				</button>
				<button 
					class="status-btn status-unpaid" 
					class:active={orderStatus === 'unpaid'} 
					onclick={() => orderStatus = 'unpaid'}
				>
					<span class="dot"></span>
					Unpaid
				</button>
				<button 
					class="status-btn status-completed" 
					class:active={orderStatus === 'completed'} 
					onclick={() => orderStatus = 'completed'}
				>
					<span class="dot"></span>
					Completed
				</button>
			</div>
		</div>
	</header>

	<main class="main-content">
		{#if isLoading}
			<div class="loading-state">
				<div class="spinner"></div>
				<p>Loading order data...</p>
			</div>
		{:else}
			<!-- Desktop Table View -->
			<OrderTable 
				bind:items 
				{removeItem} 
				{addItem} 
				{lastAddedRowId} 
				customerId={selectedCustomerId} 
				{toggleAllSelection}
				{allSelected}
			/>

			<!-- Mobile Card View -->
			<div class="mobile-only card-list">
				{#each items as _, i (items[i].id)}
					<OrderCard 
						bind:item={items[i]} 
						{removeItem} 
						{addItem} 
						{lastAddedRowId} 
						index={i} 
						isLast={i === items.length - 1} 
						customerId={selectedCustomerId} 
					/>
				{/each}
			</div>

			<button onclick={addItem} class="add-btn">
				<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
					<line x1="12" y1="5" x2="12" y2="19" />
					<line x1="5" y1="12" x2="19" y2="12" />
				</svg>
				Add Item
			</button>
		{/if}
	</main>

	{#if !isLoading}
		<OrderSummary {items} {grandTotal} {totalCapital} {totalProfit} {handleSave} disabled={isSaving} />
	{/if}
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

	.status-section {
		margin-top: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		background: #f8fafc;
		padding: 1rem;
		border-radius: 12px;
		border: 1px solid #e2e8f0;
	}

	.status-section .section-label {
		font-size: 0.75rem;
		font-weight: 700;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.status-selector {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
	}

	.status-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.6rem;
		border-radius: 8px;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		border: 2px solid transparent;
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		background: #fff;
		color: #64748b;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: currentColor;
		opacity: 0.5;
	}

	.status-btn:hover {
		background: #f1f5f9;
	}

	/* Quoted - Blue */
	.status-quoted.active {
		background: #eff6ff;
		border-color: #3b82f6;
		color: #1e40af;
	}
	.status-quoted.active .dot {
		background: #3b82f6;
		opacity: 1;
	}

	/* Unpaid - Amber */
	.status-unpaid.active {
		background: #fffbeb;
		border-color: #f59e0b;
		color: #92400e;
	}
	.status-unpaid.active .dot {
		background: #f59e0b;
		opacity: 1;
	}

	/* Completed - Green */
	.status-completed.active {
		background: #f0fdf4;
		border-color: #22c55e;
		color: #166534;
	}
	.status-completed.active .dot {
		background: #22c55e;
		opacity: 1;
	}

	.customer-section label, .status-section .section-label {
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
	}

	.actions-section {
		display: flex;
		justify-content: flex-end;
		margin-top: -1rem;
		margin-bottom: 0.5rem;
	}

	.delete-order-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: #fee2e2;
		color: #991b1b;
		border: 1px solid #fecaca;
		border-radius: 8px;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.delete-order-btn:hover:not(:disabled) {
		background: #fecaca;
		color: #7f1d1d;
		border-color: #fca5a5;
	}

	.delete-order-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.selection-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: #f0f9ff;
		padding: 0.75rem 1.25rem;
		border-radius: 12px;
		border: 1px solid #bae6fd;
		margin-bottom: 0.5rem;
	}

	.selection-count {
		font-size: 0.9rem;
		font-weight: 600;
		color: #0369a1;
	}

	.create-new-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: #0ea5e9;
		color: #fff;
		border: none;
		border-radius: 8px;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.create-new-btn:hover:not(:disabled) {
		background: #0284c7;
		box-shadow: 0 4px 12px rgba(14, 165, 233, 0.2);
	}

	.create-new-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
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

	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem;
		background: #fff;
		border-radius: 12px;
		border: 1px solid #e2e8f0;
		color: #64748b;
		gap: 1rem;
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 3px solid #f3f3f3;
		border-top: 3px solid #3b82f6;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
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

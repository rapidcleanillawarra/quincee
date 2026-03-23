<script>
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';

	let shoppingItems = $state([]);
	let isLoading = $state(true);

	async function fetchShoppingList() {
		isLoading = true;
		try {
			// 1. Fetch active orders with items
			const { data: ordersData, error: ordersError } = await supabase
				.from('quincees_orders')
				.select(`
					id, status,
					items:quincees_order_items(
						product_id,
						quantity
					)
				`)
				.eq('status', 'quoted'); // Only quoted statuses

			if (ordersError) throw ordersError;

			// Aggregate required quantities by product_id
			const requiredQtyMap = {};
			(ordersData || []).forEach(order => {
				(order.items || []).forEach(item => {
					if (!requiredQtyMap[item.product_id]) {
						requiredQtyMap[item.product_id] = 0;
					}
					requiredQtyMap[item.product_id] += Number(item.quantity) || 0;
				});
			});

			const relevantProductIds = Object.keys(requiredQtyMap);

			if (relevantProductIds.length === 0) {
				shoppingItems = [];
				return;
			}

			// 2. Fetch products for these IDs
			const { data: productsData, error: productsError } = await supabase
				.from('quincees_products')
				.select('id, sku, name')
				.in('id', relevantProductIds);

			if (productsError) throw productsError;

			// 3. Fetch stocks for these IDs
			const { data: stocksData, error: stocksError } = await supabase
				.from('quincees_stocks')
				.select('product_id, quantity')
				.in('product_id', relevantProductIds);

			if (stocksError) throw stocksError;

			const stockMap = {};
			(stocksData || []).forEach(stock => {
				stockMap[stock.product_id] = Number(stock.quantity) || 0;
			});

			// 4. Combine data
			shoppingItems = (productsData || []).map(product => {
				const required = requiredQtyMap[product.id] || 0;
				const inStock = stockMap[product.id] || 0;
				const toOrder = Math.max(0, required - inStock);

				return {
					...product,
					required,
					inStock,
					toOrder
				};
			});

			// Sort by toOrder descending, then name
			shoppingItems.sort((a, b) => {
				if (b.toOrder !== a.toOrder) {
					return b.toOrder - a.toOrder;
				}
				return a.name.localeCompare(b.name);
			});

		} catch (error) {
			console.error('Error fetching shopping list:', error);
			alert('Failed to load shopping list: ' + error.message);
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		fetchShoppingList();
	});
</script>

<svelte:head>
	<title>Shopping List | Quincee's</title>
</svelte:head>

<div class="container">
	<header class="header" in:fly={{ y: -20, duration: 800, easing: quintOut }}>
		<div class="header-left">
			<div class="title-row">
				<h1>Shopping List</h1>
			</div>
			<p class="subtitle">Items required for quoted orders</p>
		</div>
	</header>

	<main class="main-content">
		{#if isLoading}
			<div class="loading-state">
				<div class="spinner"></div>
				<p>Calculating requirements...</p>
			</div>
		{:else if shoppingItems.length === 0}
			<div class="empty-state">
				<div class="empty-icon">🛒</div>
				<h3>No items needed</h3>
				<p>There are currently no active orders requiring products.</p>
			</div>
		{:else}
			<div class="table-container" in:fly={{ y: 20, duration: 800, delay: 200, easing: quintOut }}>
				<table class="list-table">
					<thead>
						<tr>
							<th>SKU</th>
							<th>Product Name</th>
							<th class="text-right">Required</th>
							<th class="text-right">In Stock</th>
							<th class="text-right">To Order</th>
						</tr>
					</thead>
					<tbody>
						{#each shoppingItems as item (item.id)}
							<tr class:highlight={item.toOrder > 0}>
								<td class="sku-cell" data-label="SKU">
									<span class="sku-badge">{item.sku || 'N/A'}</span>
								</td>
								<td class="name-cell" data-label="Product Name">{item.name}</td>
								<td class="text-right font-semibold" data-label="Required">{item.required}</td>
								<td class="text-right font-semibold text-gray" data-label="In Stock">{item.inStock}</td>
								<td class="text-right font-bold to-order-cell" class:positive={item.toOrder > 0} data-label="To Order">
									{#if item.toOrder > 0}
										{item.toOrder}
									{:else}
										<span class="text-gray flex items-center gap-1 justify-end">
											<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
												<polyline points="20 6 9 17 4 12"></polyline>
											</svg>
											Covered
										</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</main>
</div>

<style>
	.container {
		max-width: 1000px;
		margin: 0 auto;
		padding: 2rem 1.5rem;
		min-height: calc(100vh - 64px);
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 1rem;
	}

	.header-left h1 {
		font-size: 2rem;
		font-weight: 800;
		color: #0f172a;
		margin: 0;
		letter-spacing: -0.025em;
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		flex-wrap: wrap;
	}

	.subtitle {
		color: #64748b;
		margin: 0.25rem 0 0 0;
		font-size: 1rem;
	}

	.main-content {
		flex: 1;
	}

	.table-container {
		background: rgba(255, 255, 255, 0.7);
		backdrop-filter: blur(10px);
		border: 1px solid #e2e8f0;
		border-radius: 16px;
		overflow: hidden;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
	}

	.list-table {
		width: 100%;
		border-collapse: collapse;
		text-align: left;
	}

	.list-table th {
		padding: 1rem 1.5rem;
		font-size: 0.75rem;
		font-weight: 700;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		background: #f8fafc;
		border-bottom: 1px solid #e2e8f0;
	}

	.list-table td {
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid #f1f5f9;
		color: #334155;
		font-size: 0.95rem;
	}

	.list-table tr:last-child td {
		border-bottom: none;
	}

	.list-table tr:hover {
		background: #f8fafc;
	}

	.list-table tr.highlight {
		background: #fffbeb;
	}
	
	.list-table tr.highlight:hover {
		background: #fef3c7;
	}

	.sku-badge {
		background: #f1f5f9;
		color: #475569;
		padding: 0.25rem 0.6rem;
		border-radius: 6px;
		font-family: monospace;
		font-size: 0.85rem;
	}

	.name-cell {
		font-weight: 600;
		color: #1e293b;
	}

	.font-semibold {
		font-weight: 600;
	}

	.font-bold {
		font-weight: 700;
	}

	.text-gray {
		color: #94a3b8;
	}

	.text-right {
		text-align: right;
	}

	.to-order-cell.positive {
		color: #dc2626;
		font-size: 1.1rem;
	}

	.flex {
		display: flex;
	}

	.items-center {
		align-items: center;
	}

	.justify-end {
		justify-content: flex-end;
	}

	.gap-1 {
		gap: 0.25rem;
	}

	/* Loading state */
	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 5rem;
		color: #64748b;
		gap: 1.25rem;
	}

	.spinner {
		width: 48px;
		height: 48px;
		border: 4px solid #f1f5f9;
		border-top: 4px solid #3b82f6;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	/* Empty state */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 5rem 2rem;
		text-align: center;
		background: white;
		border-radius: 20px;
		border: 1px dashed #cbd5e1;
	}

	.empty-icon {
		font-size: 4rem;
		margin-bottom: 1.5rem;
	}

	.empty-state h3 {
		font-size: 1.5rem;
		color: #0f172a;
		margin: 0;
	}

	.empty-state p {
		color: #64748b;
		max-width: 320px;
		margin: 0.75rem 0 1.5rem 0;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	@media (max-width: 768px) {
		.container {
			padding: 1.5rem 1rem;
		}
		
		.header {
			flex-direction: column;
			align-items: flex-start;
		}

		.list-table thead {
			display: none;
		}

		.list-table td {
			display: block;
			padding: 0.75rem 1.5rem;
			border: none;
			text-align: right;
		}

		.list-table td:first-child {
			padding-top: 1.5rem;
		}

		.list-table td:last-child {
			padding-bottom: 1.5rem;
			border-bottom: 1px solid #f1f5f9;
		}

		.list-table td::before {
			content: attr(data-label);
			display: block;
			font-size: 0.7rem;
			font-weight: 700;
			text-transform: uppercase;
			color: #94a3b8;
			margin-bottom: 0.25rem;
			text-align: left;
		}
	}
</style>

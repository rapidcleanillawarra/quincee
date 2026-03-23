<script>
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';

	let orders = $state([]);
	let isLoading = $state(true);
	let overallProfit = $derived(orders.reduce((sum, order) => sum + (order.profit || 0), 0));
	let completedProfit = $derived(orders.filter(order => order.status?.toLowerCase() === 'completed').reduce((sum, order) => sum + (order.profit || 0), 0));

	import { formatCurrency, formatDate } from './utils/format';

	async function fetchOrders() {
		isLoading = true;
		try {
			const { data: ordersWithCustomers, error } = await supabase
				.from('quincees_orders')
				.select(`
					*,
					customer:quincees_customers(name),
					items:quincees_order_items(
						product_id,
						quantity,
						price_at_order
					)
				`)
				.order('created_at', { ascending: false });

			if (error) throw error;

			// Get all unique product IDs from all orders
			const productIds = [...new Set(ordersWithCustomers.flatMap(order => order.items.map(item => item.product_id)))];
			
			// Fetch current buy prices for these products
			const { data: pricesData } = await supabase
				.from('quincees_prices')
				.select('product_id, buy_price')
				.in('product_id', productIds)
				.order('effective_from', { ascending: false });
			
			// Map product_id to its latest buy_price
			const priceMap = {};
			pricesData?.forEach(p => {
				if (!priceMap[p.product_id]) {
					priceMap[p.product_id] = p.buy_price;
				}
			});

			// Calculate profit for each order
			orders = (ordersWithCustomers || []).map(order => {
				const profit = order.items.reduce((sum, item) => {
					const buyPrice = priceMap[item.product_id] || 0;
					return sum + ((item.price_at_order - buyPrice) * item.quantity);
				}, 0);
				return { ...order, profit };
			});
		} catch (error) {
			console.error('Error fetching orders:', error);
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		fetchOrders();
	});

	function getStatusClass(status) {
		switch (status?.toLowerCase()) {
			case 'quoted': return 'status-quoted';
			case 'unpaid': return 'status-unpaid';
			case 'completed': return 'status-completed';
			case 'pending': return 'status-pending';
			case 'cancelled': return 'status-cancelled';
			default: return 'status-default';
		}
	}

	async function handleDelete(id) {
		if (!confirm('Are you sure you want to delete this order? This action cannot be undone.')) {
			return;
		}

		try {
			const { error } = await supabase
				.from('quincees_orders')
				.delete()
				.eq('id', id);

			if (error) throw error;

			// Update local state
			orders = orders.filter(order => order.id !== id);
			alert('Order deleted successfully');
		} catch (error) {
			console.error('Error deleting order:', error);
			alert('Failed to delete order: ' + error.message);
		}
	}
</script>

<svelte:head>
	<title>Order History | Quincee's</title>
</svelte:head>

<div class="container">
	<header class="header" in:fly={{ y: -20, duration: 800, easing: quintOut }}>
		<div class="header-left">
			<div class="title-row">
				<h1>Order History</h1>
			</div>
			<div class="badges-row">
				{#if !isLoading && orders.length > 0}
					<div class="total-profit-badge" class:positive={overallProfit > 0} class:negative={overallProfit < 0} in:fly={{ x: 20, duration: 600, delay: 400, easing: quintOut }}>
						<span class="label">Total Profit:</span>
						<span class="value">{formatCurrency(overallProfit)}</span>
					</div>
					<div class="total-profit-badge" class:positive={completedProfit > 0} class:negative={completedProfit < 0} in:fly={{ x: 20, duration: 600, delay: 500, easing: quintOut }}>
						<span class="label">Completed Profit:</span>
						<span class="value">{formatCurrency(completedProfit)}</span>
					</div>
				{/if}
			</div>
			<p class="subtitle">Manage and track your recent orders</p>
		</div>
		<a href="/orders/modify" class="new-order-btn">
			<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
				<line x1="12" y1="5" x2="12" y2="19" />
				<line x1="5" y1="12" x2="19" y2="12" />
			</svg>
			New Order
		</a>
	</header>

	<main class="main-content">
		{#if isLoading}
			<div class="loading-state">
				<div class="spinner"></div>
				<p>Fetching orders...</p>
			</div>
		{:else if orders.length === 0}
			<div class="empty-state">
				<div class="empty-icon">📦</div>
				<h3>No orders yet</h3>
				<p>Your order history will appear here once you've created some orders.</p>
				<a href="/orders/modify" class="btn-primary">Create Your First Order</a>
			</div>
		{:else}
			<div class="table-container" in:fly={{ y: 20, duration: 800, delay: 200, easing: quintOut }}>
				<table class="orders-table">
					<thead>
						<tr>
							<th>Order ID</th>
							<th>Date</th>
							<th>Customer</th>
							<th>Total Amount</th>
							<th>Profit</th>
							<th>Status</th>
							<th class="text-right">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each orders as order (order.id)}
							<tr>
								<td class="order-id" data-label="Order ID">
									<span class="id-badge">#{order.id.slice(0, 8)}</span>
								</td>
								<td class="date-cell" data-label="Date">{formatDate(order.created_at)}</td>
								<td class="customer-cell" data-label="Customer">
									<div class="customer-info">
										<span class="customer-name">{order.customer?.name || order.customer_username || 'Unknown'}</span>
									</div>
								</td>
								<td class="amount-cell" data-label="Total Amount">{formatCurrency(order.total_amount)}</td>
								<td class="profit-cell" class:positive={order.profit > 0} class:negative={order.profit < 0} data-label="Profit">
									{formatCurrency(order.profit)}
								</td>
								<td data-label="Status">
									<span class="status-pill {getStatusClass(order.status)}">
										{order.status || 'Pending'}
									</span>
								</td>
								<td class="text-right actions-cell" data-label="Actions">
									<a href="/orders/modify?id={order.id}" class="edit-link">
										<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
											<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
											<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
										</svg>
										Edit
									</a>
									<button onclick={() => handleDelete(order.id)} class="delete-btn" aria-label="Delete order">
										<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
											<polyline points="3 6 5 6 21 6"></polyline>
											<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
											<line x1="10" y1="11" x2="10" y2="17"></line>
											<line x1="14" y1="11" x2="14" y2="17"></line>
										</svg>
										Delete
									</button>
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
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem 1.5rem;
		min-height: calc(100vh - 64px);
		display: flex;
		flex-direction: column;
		gap: 2rem;
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 1.5rem;
		background: linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.5));
		backdrop-filter: blur(10px);
		padding: 1.5rem 2rem;
		border-radius: 20px;
		border: 1px solid rgba(255, 255, 255, 0.8);
		box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.05);
	}

	.header-left h1 {
		font-size: 2.25rem;
		font-weight: 800;
		color: #0f172a;
		margin: 0;
		letter-spacing: -0.03em;
		background: linear-gradient(to right, #0f172a, #334155);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		flex-wrap: wrap;
	}

	.badges-row {
		display: flex;
		gap: 1rem;
		margin-top: 1rem;
		flex-wrap: wrap;
	}

	.total-profit-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: white;
		border: 1px solid rgba(226, 232, 240, 0.8);
		border-radius: 99px;
		font-size: 0.9rem;
		font-weight: 600;
		box-shadow: 0 4px 15px -5px rgba(0, 0, 0, 0.05);
		transition: transform 0.2s, box-shadow 0.2s;
	}

	.total-profit-badge:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 20px -5px rgba(0, 0, 0, 0.08);
	}

	.total-profit-badge .label {
		color: #64748b;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-weight: 700;
	}

	.total-profit-badge.positive {
		border-color: #bbf7d0;
		background: linear-gradient(to right, #ffffff, #f0fdf4);
	}

	.total-profit-badge.positive .value {
		color: #16a34a;
	}

	.total-profit-badge.negative {
		border-color: #fecaca;
		background: linear-gradient(to right, #ffffff, #fef2f2);
	}

	.total-profit-badge.negative .value {
		color: #dc2626;
	}

	.total-profit-badge .value {
		font-size: 1.1rem;
		font-weight: 800;
	}

	.subtitle {
		color: #64748b;
		margin: 0.5rem 0 0 0;
		font-size: 1rem;
		font-weight: 500;
	}

	.new-order-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: linear-gradient(135deg, #3b82f6, #2563eb);
		color: white;
		padding: 0.875rem 1.5rem;
		border-radius: 14px;
		font-weight: 600;
		text-decoration: none;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		box-shadow: 0 4px 15px -3px rgba(59, 130, 246, 0.4);
		white-space: nowrap;
	}

	.new-order-btn:hover {
		transform: translateY(-2px) scale(1.02);
		box-shadow: 0 8px 25px -5px rgba(59, 130, 246, 0.5);
	}

	.new-order-btn:active {
		transform: translateY(0) scale(0.98);
	}

	.main-content {
		flex: 1;
	}

	.table-container {
		background: rgba(255, 255, 255, 0.8);
		backdrop-filter: blur(20px);
		border: 1px solid rgba(255, 255, 255, 0.5);
		border-radius: 20px;
		overflow: hidden;
		box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.08);
	}

	.orders-table {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0;
		text-align: left;
	}

	.orders-table th {
		padding: 1.25rem 1.5rem;
		font-size: 0.75rem;
		font-weight: 700;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		background: rgba(248, 250, 252, 0.8);
		border-bottom: 2px solid #e2e8f0;
		backdrop-filter: blur(10px);
	}

	.orders-table td {
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid #f1f5f9;
		color: #334155;
		font-size: 0.95rem;
		background: transparent;
		transition: background-color 0.2s ease;
	}

	.orders-table tr:last-child td {
		border-bottom: none;
	}

	.orders-table tr:hover td {
		background: rgba(248, 250, 252, 0.9);
	}

	.order-id {
		font-weight: 600;
	}

	.id-badge {
		background: #f1f5f9;
		color: #475569;
		padding: 0.35rem 0.7rem;
		border-radius: 8px;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.85rem;
		border: 1px solid #e2e8f0;
	}

	.customer-name {
		font-weight: 600;
		color: #1e293b;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.customer-name::before {
		content: '';
		display: inline-block;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: linear-gradient(135deg, #e2e8f0, #cbd5e1);
		margin-right: 0.25rem;
	}

	.amount-cell {
		font-weight: 700;
		color: #0f172a;
		font-size: 1.05rem;
	}

	.profit-cell {
		font-weight: 700;
	}

	.profit-cell.positive {
		color: #16a34a;
	}

	.profit-cell.negative {
		color: #dc2626;
	}

	.status-pill {
		display: inline-flex;
		align-items: center;
		padding: 0.35rem 0.85rem;
		border-radius: 99px;
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		box-shadow: 0 2px 5px rgba(0,0,0,0.02);
	}

	.status-completed {
		background: #dcfce7;
		color: #166534;
		border: 1px solid #bbf7d0;
	}

	.status-quoted {
		background: #dbeafe;
		color: #1e40af;
		border: 1px solid #bfdbfe;
	}

	.status-unpaid {
		background: #ffedd5;
		color: #9a3412;
		border: 1px solid #fed7aa;
	}

	.status-pending {
		background: #fef9c3;
		color: #854d0e;
		border: 1px solid #fef08a;
	}

	.status-cancelled {
		background: #fee2e2;
		color: #991b1b;
		border: 1px solid #fecaca;
	}

	.status-default {
		background: #f1f5f9;
		color: #475569;
		border: 1px solid #e2e8f0;
	}

	.edit-link {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		color: #3b82f6;
		background: rgba(59, 130, 246, 0.1);
		padding: 0.5rem 0.75rem;
		border-radius: 8px;
		text-decoration: none;
		font-weight: 600;
		font-size: 0.85rem;
		transition: all 0.2s;
	}

	.edit-link:hover {
		color: white;
		background: #3b82f6;
	}

	.delete-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		color: #ef4444;
		background: rgba(239, 68, 68, 0.1);
		border: none;
		border-radius: 8px;
		padding: 0.5rem 0.75rem;
		font-weight: 600;
		font-size: 0.85rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.delete-btn:hover {
		color: white;
		background: #ef4444;
	}

	.actions-cell {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.text-right {
		text-align: right;
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
		background: rgba(255,255,255,0.5);
		border-radius: 20px;
		backdrop-filter: blur(10px);
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
		padding: 6rem 2rem;
		text-align: center;
		background: rgba(255, 255, 255, 0.8);
		backdrop-filter: blur(10px);
		border-radius: 20px;
		border: 2px dashed #cbd5e1;
		box-shadow: 0 4px 20px -5px rgba(0,0,0,0.05);
	}

	.empty-icon {
		font-size: 4rem;
		margin-bottom: 1.5rem;
		filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1));
		animation: float 3s ease-in-out infinite;
	}

	.empty-state h3 {
		font-size: 1.75rem;
		color: #0f172a;
		margin: 0;
		font-weight: 800;
	}

	.empty-state p {
		color: #64748b;
		max-width: 320px;
		margin: 0.75rem 0 2rem 0;
		line-height: 1.5;
	}

	.btn-primary {
		background: linear-gradient(135deg, #3b82f6, #2563eb);
		color: white;
		padding: 0.875rem 2rem;
		border-radius: 12px;
		font-weight: 600;
		text-decoration: none;
		transition: all 0.3s;
		box-shadow: 0 4px 15px -3px rgba(59, 130, 246, 0.4);
	}

	.btn-primary:hover {
		transform: translateY(-2px);
		box-shadow: 0 8px 25px -5px rgba(59, 130, 246, 0.5);
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	@keyframes float {
		0% { transform: translateY(0px); }
		50% { transform: translateY(-10px); }
		100% { transform: translateY(0px); }
	}

	@media (max-width: 768px) {
		.container {
			padding: 0.5rem;
			gap: 1rem;
			box-sizing: border-box;
		}
		
		.header {
			flex-direction: column;
			align-items: stretch;
			padding: 1.25rem;
			text-align: left;
			gap: 1rem;
			box-sizing: border-box;
		}

		.header-left h1 {
			font-size: 1.75rem;
		}

		.title-row {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.5rem;
		}

		.badges-row {
			flex-direction: column;
			width: 100%;
			gap: 0.5rem;
		}

		.total-profit-badge {
			width: 100%;
			justify-content: space-between;
			box-sizing: border-box;
			padding: 0.75rem 1rem;
		}
		
		.new-order-btn {
			width: 100%;
			justify-content: center;
			padding: 1rem;
			box-sizing: border-box;
		}

		.table-container {
			background: transparent;
			border: none;
			box-shadow: none;
			backdrop-filter: none;
			padding: 0;
		}

		.orders-table, .orders-table tbody, .orders-table tr, .orders-table td {
			display: block;
			width: 100%;
			box-sizing: border-box;
		}

		.orders-table thead {
			display: none;
		}

		.orders-table tr {
			background: white;
			border-radius: 16px;
			margin-bottom: 1rem;
			border: 1px solid #e2e8f0;
			box-shadow: 0 4px 15px -5px rgba(0,0,0,0.05);
			overflow: hidden;
			transition: transform 0.2s;
		}

		.orders-table tr:hover {
			transform: scale(1.01);
		}

		.orders-table td {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 0.85rem 1rem;
			border-bottom: 1px solid #f1f5f9;
			text-align: right;
		}

		.orders-table td:last-child {
			border-bottom: none;
			background: #f8fafc;
			padding: 1rem;
			justify-content: center;
		}

		.orders-table td::before {
			content: attr(data-label);
			font-size: 0.75rem;
			font-weight: 700;
			text-transform: uppercase;
			color: #64748b;
			text-align: left;
			flex-shrink: 0;
			margin-right: 0.5rem;
		}
		
		.customer-name::before {
			display: none;
		}

		.customer-info {
			text-align: right;
		}

		.actions-cell {
			width: 100%;
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 0.75rem;
		}
		
		.edit-link, .delete-btn {
			width: 100%;
		}
	}
</style>

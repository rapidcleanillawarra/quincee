<script>
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';

	let orders = $state([]);
	let isLoading = $state(true);

	import { formatCurrency, formatDate } from './utils/format';

	async function fetchOrders() {
		isLoading = true;
		try {
			const { data, error } = await supabase
				.from('quincees_orders')
				.select(`
					*,
					customer:quincees_customers(name)
				`)
				.order('created_at', { ascending: false });

			if (error) throw error;
			orders = data || [];
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
			<h1>Order History</h1>
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
							<th>Status</th>
							<th class="text-right">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each orders as order (order.id)}
							<tr>
								<td class="order-id">
									<span class="id-badge">#{order.id.slice(0, 8)}</span>
								</td>
								<td class="date-cell">{formatDate(order.created_at)}</td>
								<td class="customer-cell">
									<div class="customer-info">
										<span class="customer-name">{order.customer?.name || order.customer_username || 'Unknown'}</span>
									</div>
								</td>
								<td class="amount-cell">{formatCurrency(order.total_amount)}</td>
								<td>
									<span class="status-pill {getStatusClass(order.status)}">
										{order.status || 'Pending'}
									</span>
								</td>
								<td class="text-right actions-cell">
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

	.subtitle {
		color: #64748b;
		margin: 0.25rem 0 0 0;
		font-size: 1rem;
	}

	.new-order-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: #3b82f6;
		color: white;
		padding: 0.75rem 1.25rem;
		border-radius: 10px;
		font-weight: 600;
		text-decoration: none;
		transition: all 0.2s;
		box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.2), 0 2px 4px -2px rgba(59, 130, 246, 0.1);
	}

	.new-order-btn:hover {
		background: #2563eb;
		transform: translateY(-1px);
		box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.3);
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

	.orders-table {
		width: 100%;
		border-collapse: collapse;
		text-align: left;
	}

	.orders-table th {
		padding: 1rem 1.5rem;
		font-size: 0.75rem;
		font-weight: 700;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		background: #f8fafc;
		border-bottom: 1px solid #e2e8f0;
	}

	.orders-table td {
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid #f1f5f9;
		color: #334155;
		font-size: 0.95rem;
	}

	.orders-table tr:last-child td {
		border-bottom: none;
	}

	.orders-table tr:hover {
		background: #f8fafc;
	}

	.order-id {
		font-weight: 600;
	}

	.id-badge {
		background: #f1f5f9;
		color: #475569;
		padding: 0.25rem 0.6rem;
		border-radius: 6px;
		font-family: monospace;
		font-size: 0.85rem;
	}

	.customer-name {
		font-weight: 600;
		color: #1e293b;
	}

	.amount-cell {
		font-weight: 700;
		color: #0f172a;
	}

	.status-pill {
		display: inline-flex;
		align-items: center;
		padding: 0.25rem 0.75rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: capitalize;
	}

	.status-completed {
		background: #dcfce7;
		color: #166534;
	}

	.status-pending {
		background: #fef9c3;
		color: #854d0e;
	}

	.status-cancelled {
		background: #fee2e2;
		color: #991b1b;
	}

	.status-default {
		background: #f1f5f9;
		color: #475569;
	}

	.edit-link {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		color: #3b82f6;
		text-decoration: none;
		font-weight: 600;
		font-size: 0.9rem;
		transition: color 0.15s;
	}

	.edit-link:hover {
		color: #1d4ed8;
	}

	.actions-cell {
		display: flex;
		justify-content: flex-end;
		gap: 1rem;
	}

	.delete-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		color: #ef4444;
		background: none;
		border: none;
		font-weight: 600;
		font-size: 0.9rem;
		cursor: pointer;
		padding: 0;
		transition: color 0.15s;
	}

	.delete-btn:hover {
		color: #b91c1c;
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

	.btn-primary {
		background: #3b82f6;
		color: white;
		padding: 0.75rem 1.5rem;
		border-radius: 10px;
		font-weight: 600;
		text-decoration: none;
		transition: all 0.2s;
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
		
		.new-order-btn {
			width: 100%;
			justify-content: center;
		}

		.orders-table thead {
			display: none;
		}

		.orders-table td {
			display: block;
			padding: 0.75rem 1.5rem;
			border: none;
		}

		.orders-table td:first-child {
			padding-top: 1.5rem;
		}

		.orders-table td:last-child {
			padding-bottom: 1.5rem;
			border-bottom: 1px solid #f1f5f9;
		}

		.orders-table td::before {
			content: attr(data-label);
			display: block;
			font-size: 0.7rem;
			font-weight: 700;
			text-transform: uppercase;
			color: #94a3b8;
			margin-bottom: 0.25rem;
		}

		.amount-cell {
			font-size: 1.25rem;
		}
	}
</style>

<script>
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { formatCurrency } from '../orders/utils/format';

	let rows = $state([]);
	let isLoading = $state(true);
	let searchQuery = $state('');

	function toAmount(value) {
		const num = Number(value);
		return Number.isFinite(num) ? num : 0;
	}

	function normalizeStatus(status) {
		const normalized = typeof status === 'string' ? status.trim().toLowerCase() : '';
		return normalized || 'pending';
	}

	/** Same notion as reports: quoted + unpaid orders are not treated as collectible. */
	function isQuotedUnpaid(order) {
		const paymentStatus = order?.payment_status || 'unpaid';
		return paymentStatus === 'unpaid' && normalizeStatus(order?.status) === 'quoted';
	}

	function orderOutstanding(order, paidByOrderId) {
		if (isQuotedUnpaid(order)) return 0;
		const paymentStatus = order.payment_status || 'unpaid';
		const totalAmount = toAmount(order.total_amount);
		const paidAmount = toAmount(paidByOrderId[order.id] || 0);
		if (paymentStatus === 'unpaid') return totalAmount;
		if (paymentStatus === 'partial') return Math.max(totalAmount - paidAmount, 0);
		return 0;
	}

	let filteredRows = $derived(
		rows.filter((r) => {
			const q = searchQuery.toLowerCase();
			return (
				r.name.toLowerCase().includes(q) ||
				(r.email && r.email.toLowerCase().includes(q)) ||
				(r.phone && String(r.phone).toLowerCase().includes(q))
			);
		})
	);

	let totalOutstanding = $derived(
		rows.reduce((s, r) => s + toAmount(r.outstanding_balance), 0)
	);

	async function fetchCustomers() {
		isLoading = true;
		try {
			const [customersRes, ordersRes, paymentsRes] = await Promise.all([
				supabase.from('quincees_customers').select('*').order('name', { ascending: true }),
				supabase
					.from('quincees_orders')
					.select('id, customer_id, total_amount, payment_status, status')
					.not('customer_id', 'is', null),
				supabase.from('quincees_order_payments').select('order_id, amount')
			]);

			if (customersRes.error) throw customersRes.error;
			if (ordersRes.error) throw ordersRes.error;
			if (paymentsRes.error) throw paymentsRes.error;

			const customers = customersRes.data || [];
			const orders = ordersRes.data || [];
			const payments = paymentsRes.data || [];

			const paidByOrderId = {};
			for (const p of payments) {
				const oid = p.order_id;
				if (!oid) continue;
				paidByOrderId[oid] = (paidByOrderId[oid] || 0) + toAmount(p.amount);
			}

			const balanceByCustomer = {};
			const owingOrdersByCustomer = {};
			for (const o of orders) {
				const cid = o.customer_id;
				if (!cid) continue;
				const out = orderOutstanding(o, paidByOrderId);
				balanceByCustomer[cid] = (balanceByCustomer[cid] || 0) + out;
				if (out > 0) {
					owingOrdersByCustomer[cid] = (owingOrdersByCustomer[cid] || 0) + 1;
				}
			}

			rows = customers.map((c) => ({
				...c,
				outstanding_balance: balanceByCustomer[c.id] || 0,
				owing_orders: owingOrdersByCustomer[c.id] || 0
			}));
		} catch (err) {
			console.error('Error fetching customers:', err);
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		fetchCustomers();
	});
</script>

<svelte:head>
	<title>Customers | Quincee's</title>
</svelte:head>

<div class="container">
	<header class="header" in:fly={{ y: -20, duration: 800, easing: quintOut }}>
		<div class="header-left">
			<h1>Customers</h1>
			<p class="subtitle">
				Outstanding balance is unpaid or partial order totals (quoted quotes with no payment are excluded),
				matching the reports logic.
			</p>
		</div>
	</header>

	<main class="main-content">
		<div class="summary-bar" in:fly={{ y: 10, duration: 600, delay: 80, easing: quintOut }}>
			<div class="summary-item">
				<span class="summary-label">Total to collect</span>
				<span class="summary-value" class:has-balance={totalOutstanding > 0}>
					{formatCurrency(totalOutstanding)}
				</span>
			</div>
			<div class="summary-item muted">
				<span class="summary-label">Customers</span>
				<span class="summary-value">{rows.length}</span>
			</div>
		</div>

		<div class="controls-row" in:fly={{ y: 10, duration: 600, delay: 100, easing: quintOut }}>
			<div class="search-wrapper">
				<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
					<circle cx="11" cy="11" r="8" />
					<line x1="21" y1="21" x2="16.65" y2="16.65" />
				</svg>
				<input
					type="text"
					placeholder="Search by name, email, or phone..."
					bind:value={searchQuery}
					class="search-input"
				/>
			</div>
		</div>

		{#if isLoading}
			<div class="loading-state">
				<div class="spinner"></div>
				<p>Loading customers...</p>
			</div>
		{:else if filteredRows.length === 0}
			<div class="empty-state">
				<div class="empty-icon">👥</div>
				<h3>No customers found</h3>
				<p>{searchQuery ? 'Try another search.' : 'Add customers when you create orders.'}</p>
			</div>
		{:else}
			<div class="table-container" in:fly={{ y: 20, duration: 800, delay: 200, easing: quintOut }}>
				<table class="customers-table">
					<thead>
						<tr>
							<th>Customer</th>
							<th>Contact</th>
							<th class="text-right">Orders owing</th>
							<th class="text-right">Balance</th>
						</tr>
					</thead>
					<tbody>
						{#each filteredRows as c (c.id)}
							<tr>
								<td class="name-cell" data-label="Customer">
									<div class="customer-name">{c.name}</div>
								</td>
								<td data-label="Contact">
									<div class="contact-info">
										{#if c.email}
											<span class="email">{c.email}</span>
										{/if}
										{#if c.phone}
											<span class="phone">{c.phone}</span>
										{/if}
										{#if !c.email && !c.phone}
											<span>—</span>
										{/if}
									</div>
								</td>
								<td class="text-right" data-label="Orders owing">{c.owing_orders}</td>
								<td
									class="text-right balance-cell"
									data-label="Balance"
									class:balance-due={c.outstanding_balance > 0}
									class:balance-clear={c.outstanding_balance <= 0}
								>
									{formatCurrency(c.outstanding_balance)}
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
		gap: 1.5rem;
	}

	.header h1 {
		font-size: 2.5rem;
		font-weight: 800;
		color: #0f172a;
		margin: 0;
		letter-spacing: -0.025em;
	}

	.subtitle {
		color: #64748b;
		margin: 0.25rem 0 0 0;
		font-size: 0.95rem;
		max-width: 42rem;
		line-height: 1.5;
	}

	.summary-bar {
		display: flex;
		flex-wrap: wrap;
		gap: 1.25rem 2rem;
		padding: 1rem 1.25rem;
		background: rgba(255, 255, 255, 0.95);
		border: 1px solid #e2e8f0;
		border-radius: 16px;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
	}

	.summary-item {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.summary-item.muted .summary-value {
		color: #64748b;
		font-size: 1.25rem;
	}

	.summary-label {
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #94a3b8;
	}

	.summary-value {
		font-size: 1.5rem;
		font-weight: 800;
		color: #0f172a;
		letter-spacing: -0.02em;
	}

	.summary-value.has-balance {
		color: #c2410c;
	}

	.controls-row {
		margin-bottom: 0.25rem;
	}

	.search-wrapper {
		position: relative;
		display: flex;
		align-items: center;
		max-width: 400px;
	}

	.search-wrapper svg {
		position: absolute;
		left: 1rem;
		color: #94a3b8;
	}

	.search-input {
		width: 100%;
		padding: 0.75rem 1rem 0.75rem 2.75rem;
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		font-size: 0.95rem;
		transition: all 0.2s;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
	}

	.search-input:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
	}

	.table-container {
		background: rgba(255, 255, 255, 0.9);
		backdrop-filter: blur(10px);
		border: 1px solid #e2e8f0;
		border-radius: 20px;
		overflow: hidden;
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
	}

	.customers-table {
		width: 100%;
		border-collapse: collapse;
		text-align: left;
	}

	.customers-table th {
		padding: 1.25rem 1.5rem;
		background: #f8fafc;
		font-size: 0.75rem;
		font-weight: 700;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		border-bottom: 1px solid #e2e8f0;
	}

	.customers-table td {
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid #f1f5f9;
		color: #334155;
		font-size: 0.95rem;
		vertical-align: middle;
	}

	.customers-table tr:hover {
		background: #f8fafc;
	}

	.customer-name {
		font-weight: 700;
		color: #0f172a;
		font-size: 1.05rem;
	}

	.contact-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.email {
		font-weight: 500;
		color: #3b82f6;
	}

	.phone {
		color: #64748b;
		font-size: 0.85rem;
	}

	.balance-cell {
		font-variant-numeric: tabular-nums;
		font-weight: 700;
	}

	.balance-due {
		color: #c2410c;
	}

	.balance-clear {
		color: #15803d;
	}

	.text-right {
		text-align: right;
	}

	.loading-state,
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
		color: #64748b;
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 3px solid #f1f5f9;
		border-top: 3px solid #3b82f6;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin-bottom: 1rem;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.empty-icon {
		font-size: 3rem;
		margin-bottom: 1rem;
	}

	@media (max-width: 768px) {
		.customers-table thead {
			display: none;
		}
		.customers-table td {
			display: block;
			padding: 0.75rem 1.5rem;
			border: none;
		}
		.customers-table td:first-child {
			padding-top: 1.5rem;
		}
		.customers-table td:last-child {
			padding-bottom: 1.5rem;
			border-bottom: 1px solid #f1f5f9;
		}
		.customers-table td::before {
			content: attr(data-label);
			display: block;
			font-size: 0.7rem;
			font-weight: 700;
			text-transform: uppercase;
			color: #94a3b8;
			margin-bottom: 0.25rem;
		}
		.customers-table .text-right {
			text-align: left;
		}
	}
</style>

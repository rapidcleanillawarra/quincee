<script>
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { formatCurrency } from '../utils/format';

	let orders = $state([]);
	let profitOrders = $state([]);
	let orderPayments = $state([]);
	let isLoading = $state(true);

function toAmount(value) {
	const num = Number(value);
	return Number.isFinite(num) ? num : 0;
}

function normalizeStatus(status) {
	const normalized = typeof status === 'string' ? status.trim().toLowerCase() : '';
	return normalized || 'pending';
}

function isQuotedUnpaid(order) {
	const paymentStatus = order?.payment_status || 'unpaid';
	return paymentStatus === 'unpaid' && normalizeStatus(order?.status) === 'quoted';
}

	// ── Grand‑total by order status ────────────────────────────────────────────
	let statusTotals = $derived.by(() => {
		const map = {};
		for (const order of orders) {
		const status = normalizeStatus(order.status);
		map[status] = (map[status] || 0) + toAmount(order.total_amount);
		}
	return Object.entries(map)
		.map(([status, total]) => ({ status, total }))
		.sort((a, b) => b.total - a.total);
	});

let grandTotal = $derived.by(() => orders.reduce((sum, o) => sum + toAmount(o.total_amount), 0));

	// ── Profit by payment_status ────────────────────────────────────────────────
	let profitByPaymentStatus = $derived.by(() => {
		const map = { paid: 0, unpaid: 0, partial: 0 };
		for (const order of profitOrders) {
			const ps = order.payment_status || 'unpaid';
			const key = ['paid', 'partial', 'unpaid'].includes(ps) ? ps : 'unpaid';
			if (key === 'unpaid' && isQuotedUnpaid(order)) continue;
			const capital = (order.quincees_order_items || []).reduce(
				(s, item) => s + item.quantity * (item.buy_price_at_order ?? 0),
				0
			);
		const revenue = toAmount(order.total_amount);
			map[key] = (map[key] || 0) + (revenue - capital);
		}
		return [
			{ label: 'Paid', key: 'paid',    profit: map.paid    },
			{ label: 'Partial', key: 'partial', profit: map.partial },
			{ label: 'Unpaid', key: 'unpaid',  profit: map.unpaid  },
		];
	});

	let totalProfit = $derived(profitByPaymentStatus.reduce((s, r) => s + r.profit, 0));

let totalRevenue = $derived.by(() =>
	profitOrders.reduce((s, o) => {
		if (isQuotedUnpaid(o)) return s;
		return s + toAmount(o.total_amount);
	}, 0)
);
let paidAmountsByOrder = $derived.by(() =>
	orderPayments.reduce((map, payment) => {
		const orderId = payment.order_id;
		if (!orderId) return map;
		map[orderId] = (map[orderId] || 0) + toAmount(payment.amount);
		return map;
	}, {})
);
let totalCollection = $derived.by(() =>
	profitOrders.reduce((sum, order) => {
		if (isQuotedUnpaid(order)) return sum;
		return sum + (paidAmountsByOrder[order.id] || 0);
	}, 0)
);
	let totalCapital = $derived(
		profitOrders.reduce((s, o) => {
			if (isQuotedUnpaid(o)) return s;
			return s + (o.quincees_order_items || []).reduce(
				(si, item) => si + item.quantity * (item.buy_price_at_order ?? 0), 0
			);
		}, 0)
	);

	// ── Colors ──────────────────────────────────────────────────────────────────
	const STATUS_COLORS = {
		quoted:    '#3b82f6',
		unpaid:    '#f97316',
		delivered: '#f97316',
		completed: '#22c55e',
		pending:   '#eab308',
		cancelled: '#ef4444',
	};

	const PAYMENT_COLORS = {
		paid:    '#22c55e',
		partial: '#eab308',
		unpaid:  '#ef4444',
	};

	function colorFor(status) {
		return STATUS_COLORS[status?.toLowerCase()] ?? '#94a3b8';
	}
	function paymentColorFor(key) {
		return PAYMENT_COLORS[key] ?? '#94a3b8';
	}

	// ── SVG pie helpers ──────────────────────────────────────────────────────────
	function buildPieSlices(items, valueKey, colorFn, cx, cy, r) {
		const total = items.reduce((s, i) => s + Math.max(0, i[valueKey]), 0);
		if (total === 0) return [];
		let angle = -Math.PI / 2;
		return items
			.filter(i => i[valueKey] > 0)
			.map(item => {
				const fraction = item[valueKey] / total;
				const sweep = fraction * 2 * Math.PI;
				const x1 = cx + r * Math.cos(angle);
				const y1 = cy + r * Math.sin(angle);
				const x2 = cx + r * Math.cos(angle + sweep);
				const y2 = cy + r * Math.sin(angle + sweep);
				const largeArc = sweep > Math.PI ? 1 : 0;
				const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
				angle += sweep;
				return { d, color: colorFn(item.status ?? item.key), fraction, item };
			});
	}

	let slices = $derived(buildPieSlices(statusTotals, 'total', colorFor, 160, 160, 130));
	let profitSlices = $derived(
		buildPieSlices(profitByPaymentStatus, 'profit', paymentColorFor, 160, 160, 130)
	);

	// ── Data fetching ────────────────────────────────────────────────────────────
	async function fetchData() {
		isLoading = true;
		try {
			const [ordersRes, profitRes, paymentsRes] = await Promise.all([
				supabase.from('quincees_orders').select('id, total_amount, status'),
				supabase
					.from('quincees_orders')
					.select(`
						id,
						total_amount,
						payment_status,
						status,
						quincees_order_items (
							quantity,
							price_at_order,
							buy_price_at_order
						)
					`),
				supabase.from('quincees_order_payments').select('order_id, amount'),
			]);
			if (ordersRes.error) throw ordersRes.error;
			if (profitRes.error) throw profitRes.error;
			if (paymentsRes.error) throw paymentsRes.error;
			orders = ordersRes.data || [];
			profitOrders = profitRes.data || [];
			orderPayments = paymentsRes?.data || [];
		} catch (err) {
			console.error('Error fetching report data:', err);
		} finally {
			isLoading = false;
		}
	}

	onMount(fetchData);

	function capitalize(str) {
		if (!str) return '—';
		return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
	}
</script>

<svelte:head>
	<title>Reports | Quincee's</title>
</svelte:head>

<div class="container">
	<header class="page-header" in:fly={{ y: -20, duration: 800, easing: quintOut }}>
		<div class="header-left">
			<a href="/orders" class="back-link">
				<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
					<polyline points="15 18 9 12 15 6" />
				</svg>
				Orders
			</a>
			<h1>Reports</h1>
			<p class="subtitle">Grand total and profit breakdown</p>
		</div>
	</header>

	<main class="main-content">
		{#if isLoading}
			<div class="loading-state">
				<div class="spinner"></div>
				<p>Loading report data...</p>
			</div>
		{:else if orders.length === 0}
			<div class="empty-state">
				<div class="empty-icon">📊</div>
				<h3>No orders yet</h3>
				<p>Order data will appear here once orders exist.</p>
			</div>
		{:else}
			<!-- ── Grand Total Card ── -->
			<div class="report-card" in:fly={{ y: 20, duration: 700, easing: quintOut }}>
				<div class="card-header">
					<span class="card-label">Grand Total by Order Status</span>
					<span class="card-total">{formatCurrency(grandTotal)}</span>
				</div>

				<div class="chart-layout">
					<div class="chart-wrapper">
						{#if slices.length === 1}
							<svg viewBox="0 0 320 320" class="pie-svg">
								<circle cx="160" cy="160" r="130" fill={slices[0].color} />
								<text x="160" y="165" text-anchor="middle" class="chart-center-label">
									{capitalize(slices[0].item.status)}
								</text>
							</svg>
						{:else}
							<svg viewBox="0 0 320 320" class="pie-svg">
								{#each slices as slice}
									<path d={slice.d} fill={slice.color} class="pie-slice" style="transition: opacity 0.2s" />
								{/each}
								<circle cx="160" cy="160" r="55" fill="white" />
								<text x="160" y="152" text-anchor="middle" class="donut-label-top">Total</text>
								<text x="160" y="174" text-anchor="middle" class="donut-label-amount">{formatCurrency(grandTotal)}</text>
							</svg>
						{/if}
					</div>

					<div class="legend">
						{#each statusTotals as item}
							<div class="legend-item">
								<span class="legend-dot" style="background: {colorFor(item.status)}"></span>
								<div class="legend-info">
									<span class="legend-status">{capitalize(item.status)}</span>
									<span class="legend-amount">{formatCurrency(item.total)}</span>
									<span class="legend-pct">{grandTotal > 0 ? ((item.total / grandTotal) * 100).toFixed(1) : 0}%</span>
								</div>
							</div>
						{/each}
					</div>
				</div>
			</div>

			<!-- ── Profits Card ── -->
			<div class="report-card" in:fly={{ y: 20, duration: 700, delay: 120, easing: quintOut }}>
				<div class="card-header">
					<span class="card-label">Profit by Payment Status</span>
					<div class="card-header-right">
						<div class="collection-total">
							<span class="collection-label">Collection</span>
							<span class="collection-amount">{formatCurrency(totalCollection)}</span>
						</div>
						<span class="card-total" class:profit-positive={totalProfit >= 0} class:profit-negative={totalProfit < 0}>
							{formatCurrency(totalProfit)}
						</span>
					</div>
				</div>

				<div class="chart-layout">
					<div class="chart-wrapper">
						{#if profitSlices.length === 0}
							<div class="no-profit-chart">
								<span>No positive profit data</span>
							</div>
						{:else if profitSlices.length === 1}
							<svg viewBox="0 0 320 320" class="pie-svg">
								<circle cx="160" cy="160" r="130" fill={profitSlices[0].color} />
								<text x="160" y="165" text-anchor="middle" class="chart-center-label">
									{capitalize(profitSlices[0].item.label)}
								</text>
							</svg>
						{:else}
							<svg viewBox="0 0 320 320" class="pie-svg">
								{#each profitSlices as slice}
									<path d={slice.d} fill={slice.color} class="pie-slice" style="transition: opacity 0.2s" />
								{/each}
								<circle cx="160" cy="160" r="55" fill="white" />
								<text x="160" y="152" text-anchor="middle" class="donut-label-top">Profit</text>
								<text x="160" y="174" text-anchor="middle" class="donut-label-amount">{formatCurrency(totalProfit)}</text>
							</svg>
						{/if}
					</div>

					<div class="legend">
						{#each profitByPaymentStatus as row}
							<div class="legend-item">
								<span class="legend-dot" style="background: {paymentColorFor(row.key)}"></span>
								<div class="legend-info">
									<span class="legend-status">{row.label}</span>
									<span
										class="legend-amount"
										class:amount-positive={row.profit >= 0}
										class:amount-negative={row.profit < 0}
									>
										{formatCurrency(row.profit)}
									</span>
									<span class="legend-pct">
										{totalProfit !== 0 && row.profit > 0
											? ((row.profit / Math.max(totalProfit, 1)) * 100).toFixed(1) + '%'
											: '—'}
									</span>
								</div>
							</div>
						{/each}

						<div class="profit-info-note">
							<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
								<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
							</svg>
							Profit = Revenue − Cost (buy price at order)
						</div>
						<div class="profit-info-note">
							<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
								<circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/>
							</svg>
							Collection excludes unpaid order totals
						</div>
					</div>
				</div>

				<!-- Summary table -->
				<div class="profit-table-wrap">
					<table class="profit-table">
						<thead>
							<tr>
								<th>Payment Status</th>
								<th class="num">Revenue</th>
								<th class="num">Collection</th>
								<th class="num">Capital</th>
								<th class="num">Profit</th>
								<th class="num">Orders</th>
							</tr>
						</thead>
						<tbody>
							{#each ['paid','partial','unpaid'] as ps}
								{@const rowOrders = profitOrders.filter(o => {
									const paymentStatus = o.payment_status || 'unpaid';
									if (paymentStatus !== ps) return false;
									if (ps === 'unpaid' && isQuotedUnpaid(o)) return false;
									return true;
								})}
								{@const revenue = rowOrders.reduce((s, o) => s + toAmount(o.total_amount), 0)}
								{@const collection = rowOrders.reduce((s, o) => s + (paidAmountsByOrder[o.id] || 0), 0)}
								{@const capital = rowOrders.reduce((s, o) =>
									s + (o.quincees_order_items || []).reduce(
										(si, item) => si + item.quantity * (item.buy_price_at_order ?? 0), 0
									), 0
								)}
								{@const profit = revenue - capital}
								<tr>
									<td>
										<span class="status-badge" style="background:{paymentColorFor(ps)}20; color:{paymentColorFor(ps)}; border-color:{paymentColorFor(ps)}40">
											{capitalize(ps)}
										</span>
									</td>
									<td class="num">{formatCurrency(revenue)}</td>
									<td class="num">{formatCurrency(collection)}</td>
									<td class="num muted">{formatCurrency(capital)}</td>
									<td class="num" class:pos={profit >= 0} class:neg={profit < 0}>{formatCurrency(profit)}</td>
									<td class="num muted">{rowOrders.length}</td>
								</tr>
							{/each}
						</tbody>
						<tfoot>
							<tr>
								<td><strong>Total</strong></td>
								<td class="num"><strong>{formatCurrency(totalRevenue)}</strong></td>
								<td class="num"><strong>{formatCurrency(totalCollection)}</strong></td>
								<td class="num muted"><strong>{formatCurrency(totalCapital)}</strong></td>
								<td class="num" class:pos={totalProfit >= 0} class:neg={totalProfit < 0}><strong>{formatCurrency(totalProfit)}</strong></td>
								<td class="num muted"><strong>{profitOrders.length}</strong></td>
							</tr>
							<tr>
								<td><strong>Collection</strong></td>
								<td class="num muted">—</td>
								<td class="num"><strong>{formatCurrency(totalCollection)}</strong></td>
								<td class="num muted">—</td>
								<td class="num muted">—</td>
								<td class="num muted">—</td>
							</tr>
						</tfoot>
					</table>
				</div>
			</div>
		{/if}
	</main>
</div>

<style>
	.container {
		max-width: 900px;
		margin: 0 auto;
		padding: 2rem 1.5rem;
		min-height: calc(100vh - 64px);
		display: flex;
		flex-direction: column;
		gap: 2rem;
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
	}

	.page-header {
		background: linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.5));
		backdrop-filter: blur(10px);
		padding: 1.5rem 2rem;
		border-radius: 20px;
		border: 1px solid rgba(255,255,255,0.8);
		box-shadow: 0 10px 40px -10px rgba(0,0,0,0.05);
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		color: #64748b;
		text-decoration: none;
		font-size: 0.875rem;
		font-weight: 500;
		margin-bottom: 0.5rem;
		transition: color 0.2s;
	}
	.back-link:hover { color: #3b82f6; }

	.page-header h1 {
		font-size: 2.25rem;
		font-weight: 800;
		margin: 0;
		letter-spacing: -0.03em;
		background: linear-gradient(to right, #0f172a, #334155);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}

	.subtitle {
		color: #64748b;
		margin: 0.4rem 0 0;
		font-size: 1rem;
		font-weight: 500;
	}

	.main-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	/* Report card */
	.report-card {
		background: rgba(255,255,255,0.85);
		backdrop-filter: blur(20px);
		border: 1px solid rgba(255,255,255,0.6);
		border-radius: 24px;
		box-shadow: 0 10px 40px -10px rgba(0,0,0,0.08);
		overflow: hidden;
	}

	.card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.5rem 2rem;
		border-bottom: 1px solid #f1f5f9;
		background: rgba(248,250,252,0.8);
	}

	.card-label {
		font-size: 0.8rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #64748b;
	}

	.card-total {
		font-size: 1.75rem;
		font-weight: 800;
		color: #0f172a;
		letter-spacing: -0.02em;
	}
	.card-header-right {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.collection-total {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		line-height: 1.1;
	}
	.collection-label {
		font-size: 0.68rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #64748b;
	}
	.collection-amount {
		font-size: 0.95rem;
		font-weight: 700;
		color: #0f172a;
	}

	.profit-positive { color: #16a34a; }
	.profit-negative { color: #dc2626; }

	.chart-layout {
		display: flex;
		align-items: center;
		gap: 3rem;
		padding: 2.5rem 2rem;
	}

	.chart-wrapper { flex-shrink: 0; }

	.pie-svg {
		width: 280px;
		height: 280px;
		filter: drop-shadow(0 8px 24px rgba(0,0,0,0.10));
	}

	.pie-slice {
		stroke: white;
		stroke-width: 2;
	}
	.pie-slice:hover { opacity: 0.85; }

	.donut-label-top {
		font-size: 13px;
		font-weight: 600;
		fill: #94a3b8;
		font-family: 'Inter', system-ui, sans-serif;
	}
	.donut-label-amount {
		font-size: 14px;
		font-weight: 800;
		fill: #0f172a;
		font-family: 'Inter', system-ui, sans-serif;
	}
	.chart-center-label {
		font-size: 20px;
		font-weight: 800;
		fill: white;
		font-family: 'Inter', system-ui, sans-serif;
	}

	.no-profit-chart {
		width: 280px;
		height: 280px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #94a3b8;
		font-size: 0.9rem;
		border: 2px dashed #e2e8f0;
		border-radius: 50%;
	}

	/* Legend */
	.legend {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.875rem 1.25rem;
		background: #f8fafc;
		border-radius: 14px;
		border: 1px solid #e2e8f0;
		transition: background 0.2s, transform 0.2s;
	}
	.legend-item:hover {
		background: #f1f5f9;
		transform: translateX(4px);
	}

	.legend-dot {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		flex-shrink: 0;
		box-shadow: 0 2px 6px rgba(0,0,0,0.12);
	}

	.legend-info {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex: 1;
		gap: 0.5rem;
	}

	.legend-status {
		font-weight: 700;
		color: #1e293b;
		font-size: 0.95rem;
		text-transform: capitalize;
		min-width: 70px;
	}

	.legend-amount {
		font-weight: 700;
		color: #0f172a;
		font-size: 1rem;
	}
	.amount-positive { color: #16a34a; }
	.amount-negative { color: #dc2626; }

	.legend-pct {
		font-size: 0.8rem;
		font-weight: 600;
		color: #64748b;
		background: #e2e8f0;
		padding: 0.2rem 0.5rem;
		border-radius: 99px;
		min-width: 48px;
		text-align: center;
	}

	.profit-info-note {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.78rem;
		color: #94a3b8;
		padding: 0.25rem 0.25rem 0;
	}

	/* Profit table */
	.profit-table-wrap {
		padding: 0 2rem 2rem;
		overflow-x: auto;
	}

	.profit-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	.profit-table th,
	.profit-table td {
		padding: 0.75rem 1rem;
		text-align: left;
		border-bottom: 1px solid #f1f5f9;
	}

	.profit-table th {
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #64748b;
		background: #f8fafc;
	}

	.profit-table tfoot td {
		border-top: 2px solid #e2e8f0;
		border-bottom: none;
		background: #f8fafc;
	}

	.num { text-align: right; }
	.muted { color: #64748b; }
	.pos { color: #16a34a; font-weight: 700; }
	.neg { color: #dc2626; font-weight: 700; }

	.status-badge {
		display: inline-block;
		padding: 0.2rem 0.65rem;
		border-radius: 99px;
		font-size: 0.8rem;
		font-weight: 700;
		border: 1px solid;
	}

	/* States */
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

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 6rem 2rem;
		text-align: center;
		background: rgba(255,255,255,0.8);
		backdrop-filter: blur(10px);
		border-radius: 20px;
		border: 2px dashed #cbd5e1;
	}

	.empty-icon { font-size: 4rem; margin-bottom: 1.5rem; }

	.empty-state h3 {
		font-size: 1.75rem;
		color: #0f172a;
		margin: 0;
		font-weight: 800;
	}

	.empty-state p { color: #64748b; margin: 0.75rem 0 0; }

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	@media (max-width: 640px) {
		.container { padding: 1rem 0.75rem; gap: 1rem; }
		.page-header { padding: 1.25rem; }
		.page-header h1 { font-size: 1.75rem; }
		.card-header { padding: 1.25rem 1.5rem; }
		.card-header-right { flex-direction: column; align-items: flex-end; gap: 0.35rem; }
		.card-total { font-size: 1.35rem; }
		.chart-layout { flex-direction: column; padding: 1.5rem 1.25rem; gap: 2rem; }
		.pie-svg { width: 220px; height: 220px; }
		.no-profit-chart { width: 220px; height: 220px; }
		.legend { width: 100%; }
		.profit-table-wrap { padding: 0 1rem 1.5rem; }
	}
</style>

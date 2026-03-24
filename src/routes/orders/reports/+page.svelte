<script>
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { formatCurrency } from '../utils/format';

	let orders = $state([]);
	let isLoading = $state(true);

	// Derived: group grand totals by status
	let statusTotals = $derived.by(() => {
		const map = {};
		for (const order of orders) {
			const status = order.status || 'pending';
			map[status] = (map[status] || 0) + (order.total_amount || 0);
		}
		return Object.entries(map).map(([status, total]) => ({ status, total }));
	});

	let grandTotal = $derived(orders.reduce((sum, o) => sum + (o.total_amount || 0), 0));

	// Colors for each status
	const STATUS_COLORS = {
		quoted:    '#3b82f6',
		unpaid:    '#f97316',
		delivered: '#f97316',
		completed: '#22c55e',
		pending:   '#eab308',
		cancelled: '#ef4444',
	};

	function colorFor(status) {
		return STATUS_COLORS[status?.toLowerCase()] ?? '#94a3b8';
	}

	// SVG pie chart helpers
	function buildPieSlices(items, cx, cy, r) {
		const total = items.reduce((s, i) => s + i.total, 0);
		if (total === 0) return [];

		let angle = -Math.PI / 2; // start at top
		return items.map(item => {
			const fraction = item.total / total;
			const sweep = fraction * 2 * Math.PI;
			const x1 = cx + r * Math.cos(angle);
			const y1 = cy + r * Math.sin(angle);
			const x2 = cx + r * Math.cos(angle + sweep);
			const y2 = cy + r * Math.sin(angle + sweep);
			const largeArc = sweep > Math.PI ? 1 : 0;
			const midAngle = angle + sweep / 2;
			const labelX = cx + (r * 0.65) * Math.cos(midAngle);
			const labelY = cy + (r * 0.65) * Math.sin(midAngle);
			const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
			angle += sweep;
			return { d, color: colorFor(item.status), fraction, midAngle, labelX, labelY, item };
		});
	}

	let slices = $derived(buildPieSlices(statusTotals, 160, 160, 130));

	async function fetchOrders() {
		isLoading = true;
		try {
			const { data, error } = await supabase
				.from('quincees_orders')
				.select('id, total_amount, status');
			if (error) throw error;
			orders = data || [];
		} catch (err) {
			console.error('Error fetching orders:', err);
		} finally {
			isLoading = false;
		}
	}

	onMount(fetchOrders);

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
			<p class="subtitle">Grand total breakdown by order status</p>
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
			<div class="report-card" in:fly={{ y: 20, duration: 700, easing: quintOut }}>
				<div class="card-header">
					<span class="card-label">Grand Total</span>
					<span class="card-total">{formatCurrency(grandTotal)}</span>
				</div>

				<div class="chart-layout">
					<!-- Pie chart -->
					<div class="chart-wrapper">
						{#if slices.length === 1}
							<!-- Full circle for single status -->
							<svg viewBox="0 0 320 320" class="pie-svg">
								<circle cx="160" cy="160" r="130" fill={slices[0].color} />
								<text x="160" y="165" text-anchor="middle" class="chart-center-label">
									{capitalize(slices[0].item.status)}
								</text>
							</svg>
						{:else}
							<svg viewBox="0 0 320 320" class="pie-svg">
								{#each slices as slice, i}
									<path
										d={slice.d}
										fill={slice.color}
										class="pie-slice"
										style="transition: opacity 0.2s"
									/>
								{/each}
								<!-- Center hole -->
								<circle cx="160" cy="160" r="55" fill="white" />
								<text x="160" y="152" text-anchor="middle" class="donut-label-top">Total</text>
								<text x="160" y="174" text-anchor="middle" class="donut-label-amount">{formatCurrency(grandTotal)}</text>
							</svg>
						{/if}
					</div>

					<!-- Legend -->
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

	.back-link:hover {
		color: #3b82f6;
	}

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

	.chart-layout {
		display: flex;
		align-items: center;
		gap: 3rem;
		padding: 2.5rem 2rem;
	}

	.chart-wrapper {
		flex-shrink: 0;
	}

	.pie-svg {
		width: 280px;
		height: 280px;
		filter: drop-shadow(0 8px 24px rgba(0,0,0,0.10));
	}

	.pie-slice {
		stroke: white;
		stroke-width: 2;
	}

	.pie-slice:hover {
		opacity: 0.85;
	}

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

	/* Legend */
	.legend {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 1rem;
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
		min-width: 80px;
	}

	.legend-amount {
		font-weight: 700;
		color: #0f172a;
		font-size: 1rem;
	}

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

	.empty-icon {
		font-size: 4rem;
		margin-bottom: 1.5rem;
	}

	.empty-state h3 {
		font-size: 1.75rem;
		color: #0f172a;
		margin: 0;
		font-weight: 800;
	}

	.empty-state p {
		color: #64748b;
		margin: 0.75rem 0 0;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	@media (max-width: 640px) {
		.container {
			padding: 1rem 0.75rem;
			gap: 1rem;
		}

		.page-header {
			padding: 1.25rem;
		}

		.page-header h1 {
			font-size: 1.75rem;
		}

		.card-header {
			padding: 1.25rem 1.5rem;
		}

		.card-total {
			font-size: 1.35rem;
		}

		.chart-layout {
			flex-direction: column;
			padding: 1.5rem 1.25rem;
			gap: 2rem;
		}

		.pie-svg {
			width: 220px;
			height: 220px;
		}

		.legend {
			width: 100%;
		}
	}
</style>

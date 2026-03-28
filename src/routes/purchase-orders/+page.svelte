<script>
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { fly, fade } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { formatCurrency, formatDate } from '../orders/utils/format';

	/** @param {unknown} x */
	function asArray(x) {
		if (x == null) return [];
		return Array.isArray(x) ? x : [x];
	}

	/** @param {unknown} x */
	function one(x) {
		const a = asArray(x);
		return a[0] ?? null;
	}

	/** @param {Record<string, unknown>} order */
	function supplierOf(order) {
		return one(order.quincees_suppliers);
	}

	/** @param {Record<string, unknown>} order */
	function itemsOf(order) {
		return asArray(order.quincees_purchase_order_items);
	}

	/** @param {Record<string, unknown>} order */
	function receiptsOf(order) {
		return asArray(order.quincees_purchase_order_receipts);
	}

	/**
	 * @param {Record<string, unknown>} order
	 * @param {string} purchaseOrderItemId
	 */
	function receivedQtyForLine(order, purchaseOrderItemId) {
		let sum = 0;
		for (const r of receiptsOf(order)) {
			for (const ri of asArray(r.quincees_purchase_order_receipt_items)) {
				if (String(ri.purchase_order_item_id) === String(purchaseOrderItemId)) {
					sum += Number(ri.quantity_received) || 0;
				}
			}
		}
		return sum;
	}

	/** @param {Record<string, unknown>} order */
	function lineCount(order) {
		return itemsOf(order).length;
	}

	/** @param {Record<string, unknown>} order */
	function orderedValue(order) {
		return itemsOf(order).reduce((acc, row) => {
			const q = Number(row.quantity) || 0;
			const c = Number(row.unit_cost) || 0;
			return acc + q * c;
		}, 0);
	}

	/** @param {unknown} product */
	function stockSnapshot(product) {
		const p = product && typeof product === 'object' ? /** @type {Record<string, unknown>} */ (product) : null;
		if (!p) return { quantity: null, updated_at: null };
		const s = one(p.quincees_stocks);
		if (!s) return { quantity: 0, updated_at: null };
		return {
			quantity: Number(s.quantity) || 0,
			updated_at: s.updated_at ?? null
		};
	}

	let purchaseOrders = $state(/** @type {Record<string, unknown>[]} */ ([]));
	let isLoading = $state(true);
	let searchQuery = $state('');
	let statusFilter = $state('all');
	let expandedId = $state(/** @type {string | null} */ (null));
	let movementsByOrder = $state(/** @type {Record<string, Record<string, unknown>[]>} */ ({}));
	let loadingMovementsFor = $state(/** @type {string | null} */ (null));

	let filteredOrders = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		let rows = purchaseOrders;
		if (statusFilter !== 'all') {
			rows = rows.filter((o) => String(o.status || '').toLowerCase() === statusFilter);
		}
		if (!q) return rows;
		return rows.filter((o) => {
			const sup = supplierOf(o);
			const supplierName = String(sup?.name || '').toLowerCase();
			if (supplierName.includes(q)) return true;
			if (String(o.status || '')
				.toLowerCase()
				.includes(q)) return true;
			if (String(o.supplier_reference || '')
				.toLowerCase()
				.includes(q)) return true;
			if (String(o.notes || '')
				.toLowerCase()
				.includes(q)) return true;
			if (String(o.id || '').toLowerCase().includes(q)) return true;
			for (const it of itemsOf(o)) {
				const prod = one(it.quincees_products);
				const name = String(prod?.name || '').toLowerCase();
				const sku = String(prod?.sku || '').toLowerCase();
				if (name.includes(q) || sku.includes(q)) return true;
			}
			return false;
		});
	});

	async function fetchPurchaseOrders() {
		isLoading = true;
		try {
			const { data, error } = await supabase
				.from('quincees_purchase_orders')
				.select(
					`
					id,
					supplier_id,
					status,
					notes,
					supplier_reference,
					created_at,
					updated_at,
					quincees_suppliers ( id, name ),
					quincees_purchase_order_items (
						id,
						product_id,
						quantity,
						unit_cost,
						notes,
						created_at,
						quincees_products (
							id,
							name,
							sku,
							category,
							quincees_stocks ( quantity, updated_at )
						)
					),
					quincees_purchase_order_receipts (
						id,
						purchase_order_id,
						received_at,
						notes,
						quincees_purchase_order_receipt_items (
							id,
							purchase_order_item_id,
							product_id,
							quantity_received,
							unit_cost,
							notes,
							quincees_products ( id, name, sku )
						)
					)
				`
				)
				.order('created_at', { ascending: false });

			if (error) throw error;
			purchaseOrders = data || [];
		} catch (e) {
			console.error('Error fetching purchase orders:', e);
			purchaseOrders = [];
		} finally {
			isLoading = false;
		}
	}

	/**
	 * @param {Record<string, unknown>} order
	 */
	async function loadLinkedMovements(order) {
		const id = String(order.id);
		if (movementsByOrder[id] !== undefined) return;

		const receiptIds = receiptsOf(order).map((r) => r.id).filter(Boolean);
		const itemIds = [];
		for (const r of receiptsOf(order)) {
			for (const ri of asArray(r.quincees_purchase_order_receipt_items)) {
				if (ri.id) itemIds.push(ri.id);
			}
		}

		loadingMovementsFor = id;
		try {
			const chunks = [];
			if (receiptIds.length) {
				const { data: d1, error: e1 } = await supabase
					.from('quincees_stock_movements')
					.select(
						`
						id,
						product_id,
						movement_type,
						quantity,
						unit_cost,
						reference_table,
						reference_id,
						notes,
						created_at,
						created_by,
						quincees_products ( name, sku )
					`
					)
					.eq('reference_table', 'quincees_purchase_order_receipts')
					.in('reference_id', receiptIds);
				if (e1) throw e1;
				if (d1?.length) chunks.push(...d1);
			}
			if (itemIds.length) {
				const { data: d2, error: e2 } = await supabase
					.from('quincees_stock_movements')
					.select(
						`
						id,
						product_id,
						movement_type,
						quantity,
						unit_cost,
						reference_table,
						reference_id,
						notes,
						created_at,
						created_by,
						quincees_products ( name, sku )
					`
					)
					.eq('reference_table', 'quincees_purchase_order_receipt_items')
					.in('reference_id', itemIds);
				if (e2) throw e2;
				if (d2?.length) chunks.push(...d2);
			}

			const seen = new Set();
			const merged = [];
			for (const row of chunks) {
				const k = row.id;
				if (seen.has(k)) continue;
				seen.add(k);
				merged.push(row);
			}
			merged.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

			movementsByOrder = { ...movementsByOrder, [id]: merged };
		} catch (e) {
			console.error('Error loading stock movements:', e);
			movementsByOrder = { ...movementsByOrder, [id]: [] };
		} finally {
			loadingMovementsFor = null;
		}
	}

	/**
	 * @param {string} orderId
	 */
	function toggleExpand(orderId) {
		if (expandedId === orderId) {
			expandedId = null;
			return;
		}
		expandedId = orderId;
		const order = purchaseOrders.find((o) => String(o.id) === orderId);
		if (order && movementsByOrder[orderId] === undefined) {
			loadLinkedMovements(/** @type {Record<string, unknown>} */ (order));
		}
	}

	function statusClass(status) {
		const s = String(status || 'draft').toLowerCase();
		if (s === 'draft') return 'status-draft';
		if (s === 'cancelled' || s === 'canceled') return 'status-cancelled';
		if (s === 'received' || s === 'complete' || s === 'completed') return 'status-done';
		if (s === 'ordered' || s === 'sent' || s === 'partial') return 'status-active';
		return 'status-default';
	}

	onMount(() => {
		fetchPurchaseOrders();
	});
</script>

<svelte:head>
	<title>Purchase orders | Quincee's</title>
</svelte:head>

<div class="container">
	<header class="header" in:fly={{ y: -20, duration: 800, easing: quintOut }}>
		<div class="header-left">
			<h1>Purchase orders</h1>
			<p class="subtitle">Supplier POs, receipts, on-hand stock, and linked stock movements</p>
		</div>
	</header>

	<main class="main-content">
		<div class="controls-row" in:fly={{ y: 10, duration: 600, delay: 100, easing: quintOut }}>
			<div class="search-wrapper">
				<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
					<circle cx="11" cy="11" r="8" />
					<line x1="21" y1="21" x2="16.65" y2="16.65" />
				</svg>
				<input
					type="text"
					placeholder="Search supplier, status, SKU, product, reference…"
					bind:value={searchQuery}
					class="search-input"
				/>
			</div>
			<div class="filter-pills" role="group" aria-label="Filter by status">
				<button
					type="button"
					class="pill"
					class:active={statusFilter === 'all'}
					onclick={() => (statusFilter = 'all')}
				>
					All
				</button>
				<button
					type="button"
					class="pill"
					class:active={statusFilter === 'draft'}
					onclick={() => (statusFilter = 'draft')}
				>
					Draft
				</button>
				<button
					type="button"
					class="pill"
					class:active={statusFilter === 'ordered'}
					onclick={() => (statusFilter = 'ordered')}
				>
					Ordered
				</button>
				<button
					type="button"
					class="pill"
					class:active={statusFilter === 'partial'}
					onclick={() => (statusFilter = 'partial')}
				>
					Partial
				</button>
				<button
					type="button"
					class="pill"
					class:active={statusFilter === 'received'}
					onclick={() => (statusFilter = 'received')}
				>
					Received
				</button>
			</div>
		</div>

		{#if isLoading}
			<div class="loading-state">
				<div class="spinner"></div>
				<p>Loading purchase orders…</p>
			</div>
		{:else if filteredOrders.length === 0}
			<div class="empty-state">
				<div class="empty-icon">📋</div>
				<h3>No purchase orders</h3>
				<p>Try another search or status filter.</p>
			</div>
		{:else}
			<div class="table-container" in:fly={{ y: 20, duration: 800, delay: 200, easing: quintOut }}>
				<table class="po-table">
					<thead>
						<tr>
							<th class="col-expand"></th>
							<th>Supplier</th>
							<th>Status</th>
							<th class="text-right">Lines</th>
							<th class="text-right">Ordered value</th>
							<th>Created</th>
							<th>Supplier ref.</th>
						</tr>
					</thead>
					<tbody>
						{#each filteredOrders as order (order.id)}
							{@const sup = supplierOf(order)}
							{@const oid = String(order.id)}
							<tr class="summary-row" class:expanded={expandedId === oid}>
								<td class="expand-cell" data-label="">
									<button
										type="button"
										class="expand-btn"
										onclick={() => toggleExpand(oid)}
										aria-expanded={expandedId === oid}
										aria-label={expandedId === oid ? 'Collapse order' : 'Expand order'}
									>
										{expandedId === oid ? '▼' : '▶'}
									</button>
								</td>
								<td class="supplier-cell" data-label="Supplier">
									<div class="supplier-name">{sup?.name ?? '—'}</div>
									<div class="order-id">PO {oid.slice(0, 8)}…</div>
								</td>
								<td data-label="Status">
									<span class="status-badge {statusClass(order.status)}">{order.status ?? 'draft'}</span>
								</td>
								<td class="text-right" data-label="Lines">{lineCount(order)}</td>
								<td class="text-right mono" data-label="Ordered value">{formatCurrency(orderedValue(order))}</td>
								<td data-label="Created">{formatDate(order.created_at)}</td>
								<td class="ref-cell" data-label="Supplier ref.">{order.supplier_reference ?? '—'}</td>
							</tr>
							{#if expandedId === oid}
								<tr class="detail-row">
									<td colspan="7">
										<div class="detail-panel" transition:fade={{ duration: 150 }}>
											{#if order.notes}
												<div class="notes-block">
													<span class="detail-label">Notes</span>
													<p>{order.notes}</p>
												</div>
											{/if}

											<section class="detail-section">
												<h3>Line items ({itemsOf(order).length})</h3>
												<div class="subtable-wrap">
													<table class="subtable">
														<thead>
															<tr>
																<th>Product</th>
																<th class="text-right">Qty ordered</th>
																<th class="text-right">Received</th>
																<th class="text-right">Unit cost</th>
																<th class="text-right">Line total</th>
																<th class="text-right">Stock on hand</th>
															</tr>
														</thead>
														<tbody>
															{#each itemsOf(order) as line (line.id)}
																{@const prod = one(line.quincees_products)}
																{@const stk = stockSnapshot(prod)}
																{@const recv = receivedQtyForLine(order, String(line.id))}
																{@const q = Number(line.quantity) || 0}
																{@const c = Number(line.unit_cost) || 0}
																<tr>
																	<td>
																		<div class="prod-name">{prod?.name ?? '—'}</div>
																		{#if prod?.sku}
																			<div class="prod-sku">SKU {prod.sku}</div>
																		{/if}
																	</td>
																	<td class="text-right mono">{q}</td>
																	<td class="text-right mono" class:partial={recv > 0 && recv < q} class:full={recv >= q && q > 0}>
																		{recv}
																	</td>
																	<td class="text-right mono">{formatCurrency(c)}</td>
																	<td class="text-right mono">{formatCurrency(q * c)}</td>
																	<td class="text-right mono">
																		{stk.quantity != null ? stk.quantity : '—'}
																	</td>
																</tr>
															{/each}
														</tbody>
													</table>
												</div>
											</section>

											<section class="detail-section">
												<h3>Receipts ({receiptsOf(order).length})</h3>
												{#if receiptsOf(order).length === 0}
													<p class="muted">No receipts recorded for this order.</p>
												{:else}
													{#each receiptsOf(order) as rec (rec.id)}
														<div class="receipt-card">
															<div class="receipt-head">
																<span class="detail-label">Received</span>
																<strong>{formatDate(rec.received_at)}</strong>
															</div>
															{#if rec.notes}
																<p class="receipt-notes">{rec.notes}</p>
															{/if}
															<table class="subtable tight">
																<thead>
																	<tr>
																		<th>Product</th>
																		<th class="text-right">Qty received</th>
																		<th class="text-right">Unit cost</th>
																	</tr>
																</thead>
																<tbody>
																	{#each asArray(rec.quincees_purchase_order_receipt_items) as ri (ri.id)}
																		{@const rp = one(ri.quincees_products)}
																		<tr>
																			<td>
																				<div class="prod-name">{rp?.name ?? '—'}</div>
																				{#if rp?.sku}
																					<div class="prod-sku">SKU {rp.sku}</div>
																				{/if}
																			</td>
																			<td class="text-right mono">{ri.quantity_received}</td>
																			<td class="text-right mono">
																				{ri.unit_cost != null ? formatCurrency(Number(ri.unit_cost)) : '—'}
																			</td>
																		</tr>
																	{/each}
																</tbody>
															</table>
														</div>
													{/each}
												{/if}
											</section>

											<section class="detail-section">
												<h3>Stock movements (linked to receipts)</h3>
												{#if loadingMovementsFor === oid}
													<p class="muted">Loading movements…</p>
												{:else if (movementsByOrder[oid] ?? []).length === 0}
													<p class="muted">
														No rows in <code>quincees_stock_movements</code> with reference to these receipts
														(or no receipts yet).
													</p>
												{:else}
													<div class="subtable-wrap">
														<table class="subtable">
															<thead>
																<tr>
																	<th>When</th>
																	<th>Type</th>
																	<th>Product</th>
																	<th class="text-right">Qty</th>
																	<th>Reference</th>
																	<th>Notes</th>
																</tr>
															</thead>
															<tbody>
																{#each movementsByOrder[oid] ?? [] as mv (mv.id)}
																	{@const mp = one(mv.quincees_products)}
																	<tr>
																		<td class="nowrap">{formatDate(mv.created_at)}</td>
																		<td><span class="mv-type">{mv.movement_type}</span></td>
																		<td>
																			<div class="prod-name">{mp?.name ?? '—'}</div>
																			{#if mp?.sku}
																				<div class="prod-sku">SKU {mp.sku}</div>
																			{/if}
																		</td>
																		<td class="text-right mono">{mv.quantity}</td>
																		<td class="mono small">
																			{mv.reference_table}
																			{#if mv.reference_id}
																				<br /><span class="muted">{String(mv.reference_id).slice(0, 8)}…</span>
																			{/if}
																		</td>
																		<td class="small">{mv.notes ?? '—'}</td>
																	</tr>
																{/each}
															</tbody>
														</table>
													</div>
												{/if}
											</section>
										</div>
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</main>
</div>

<style>
	.container {
		max-width: 1100px;
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
		font-size: 1rem;
	}

	.controls-row {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-bottom: 0.5rem;
	}

	.search-wrapper {
		position: relative;
		display: flex;
		align-items: center;
		max-width: 520px;
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

	.filter-pills {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.pill {
		padding: 0.4rem 0.9rem;
		border-radius: 9999px;
		border: 1px solid #e2e8f0;
		background: white;
		color: #64748b;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.pill:hover {
		border-color: #93c5fd;
		color: #2563eb;
	}

	.pill.active {
		background: #2563eb;
		border-color: #2563eb;
		color: white;
	}

	.table-container {
		background: rgba(255, 255, 255, 0.9);
		backdrop-filter: blur(10px);
		border: 1px solid #e2e8f0;
		border-radius: 20px;
		overflow: hidden;
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
	}

	.po-table {
		width: 100%;
		border-collapse: collapse;
		text-align: left;
	}

	.po-table th {
		padding: 1rem 1.25rem;
		background: #f8fafc;
		font-size: 0.7rem;
		font-weight: 700;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		border-bottom: 1px solid #e2e8f0;
	}

	.po-table td {
		padding: 1rem 1.25rem;
		border-bottom: 1px solid #f1f5f9;
		color: #334155;
		font-size: 0.92rem;
		vertical-align: middle;
	}

	.summary-row:hover {
		background: #f8fafc;
	}

	.summary-row.expanded {
		background: #eff6ff;
	}

	.col-expand {
		width: 3rem;
	}

	.expand-btn {
		background: #f1f5f9;
		border: none;
		width: 2rem;
		height: 2rem;
		border-radius: 8px;
		cursor: pointer;
		font-size: 0.7rem;
		color: #475569;
		line-height: 1;
	}

	.expand-btn:hover {
		background: #e2e8f0;
	}

	.supplier-name {
		font-weight: 700;
		color: #0f172a;
	}

	.order-id {
		font-size: 0.75rem;
		color: #94a3b8;
		margin-top: 0.2rem;
	}

	.ref-cell {
		font-size: 0.85rem;
		color: #64748b;
		max-width: 140px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.status-badge {
		display: inline-flex;
		align-items: center;
		padding: 0.2rem 0.65rem;
		border-radius: 9999px;
		font-size: 0.78rem;
		font-weight: 700;
		text-transform: capitalize;
	}

	.status-draft {
		background: #f1f5f9;
		color: #475569;
	}
	.status-active {
		background: #eff6ff;
		color: #2563eb;
	}
	.status-done {
		background: #ecfdf5;
		color: #059669;
	}
	.status-cancelled {
		background: #fef2f2;
		color: #dc2626;
	}
	.status-default {
		background: #f8fafc;
		color: #334155;
	}

	.detail-row td {
		padding: 0;
		border-bottom: 1px solid #e2e8f0;
		background: #fafbfc;
	}

	.detail-panel {
		padding: 1.25rem 1.5rem 1.75rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.notes-block {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: 1rem 1.25rem;
	}

	.notes-block p {
		margin: 0.35rem 0 0 0;
		color: #475569;
		font-size: 0.95rem;
		line-height: 1.5;
	}

	.detail-section h3 {
		margin: 0 0 0.75rem 0;
		font-size: 0.95rem;
		font-weight: 800;
		color: #0f172a;
		letter-spacing: -0.02em;
	}

	.detail-label {
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		color: #94a3b8;
		letter-spacing: 0.04em;
	}

	.subtable-wrap {
		overflow-x: auto;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		background: white;
	}

	.subtable {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.88rem;
	}

	.subtable th {
		padding: 0.65rem 1rem;
		background: #f8fafc;
		font-size: 0.65rem;
		font-weight: 700;
		color: #64748b;
		text-transform: uppercase;
		text-align: left;
		border-bottom: 1px solid #e2e8f0;
	}

	.subtable td {
		padding: 0.65rem 1rem;
		border-bottom: 1px solid #f1f5f9;
		vertical-align: top;
	}

	.subtable.tight td,
	.subtable.tight th {
		padding: 0.5rem 0.75rem;
	}

	.subtable tr:last-child td {
		border-bottom: none;
	}

	.prod-name {
		font-weight: 600;
		color: #0f172a;
	}

	.prod-sku {
		font-size: 0.72rem;
		color: #94a3b8;
		margin-top: 0.15rem;
	}

	.mono {
		font-variant-numeric: tabular-nums;
	}

	.partial {
		color: #d97706;
		font-weight: 700;
	}

	.full {
		color: #059669;
		font-weight: 700;
	}

	.muted {
		color: #94a3b8;
		font-size: 0.9rem;
		margin: 0;
	}

	.receipt-card {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: 1rem 1.25rem;
		margin-bottom: 0.75rem;
	}

	.receipt-head {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		margin-bottom: 0.35rem;
	}

	.receipt-notes {
		margin: 0 0 0.75rem 0;
		font-size: 0.88rem;
		color: #64748b;
	}

	.mv-type {
		font-size: 0.78rem;
		font-weight: 600;
		background: #f1f5f9;
		padding: 0.15rem 0.45rem;
		border-radius: 6px;
		color: #475569;
	}

	.small {
		font-size: 0.82rem;
	}

	.nowrap {
		white-space: nowrap;
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

	code {
		font-size: 0.82em;
		background: #f1f5f9;
		padding: 0.1rem 0.35rem;
		border-radius: 4px;
	}

	@media (max-width: 900px) {
		.po-table thead {
			display: none;
		}
		.po-table .summary-row td {
			display: block;
			padding: 0.5rem 1.25rem;
			border: none;
		}
		.po-table .summary-row td:first-child {
			padding-top: 1rem;
		}
		.po-table .summary-row td:last-child {
			padding-bottom: 1rem;
			border-bottom: 1px solid #e2e8f0;
		}
		.po-table .summary-row td::before {
			content: attr(data-label);
			display: block;
			font-size: 0.65rem;
			font-weight: 700;
			text-transform: uppercase;
			color: #94a3b8;
			margin-bottom: 0.2rem;
		}
		.expand-cell::before {
			display: none !important;
		}
		.expand-cell {
			padding-bottom: 0 !important;
		}
		.detail-row td[colspan] {
			display: block;
		}
	}
</style>

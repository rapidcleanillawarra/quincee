<script>
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import { fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { formatCurrency } from '../../../orders/utils/format';

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

	/**
	 * @param {Record<string, unknown>[]} receipts
	 * @param {string} purchaseOrderItemId
	 */
	function receivedQtyForLine(receipts, purchaseOrderItemId) {
		let sum = 0;
		for (const r of receipts) {
			for (const ri of asArray(r.quincees_purchase_order_receipt_items)) {
				if (String(ri.purchase_order_item_id) === String(purchaseOrderItemId)) {
					sum += Number(ri.quantity_received) || 0;
				}
			}
		}
		return sum;
	}

	let isLoading = $state(true);
	let isSaving = $state(false);
	let loadError = $state(/** @type {string | null} */ (null));

	let supplierName = $state('');
	let poStatus = $state('');
	let receiptNotes = $state('');

	/** @type {string} — ISO date (yyyy-mm-dd) for <input type="date"> */
	let receivedDate = $state('');

	let receiveLines = $state(
		/** @type { { itemId: string; product_id: string; productName: string; sku: string; ordered: number; alreadyReceived: number; receiveNow: number; unit_cost: number }[] } */ (
			[]
		)
	);

	let canSubmit = $derived(
		receiveLines.some((l) => l.receiveNow > 0) &&
			String(poStatus).toLowerCase() !== 'cancelled' &&
			String(poStatus).toLowerCase() !== 'canceled'
	);

	$effect(() => {
		const id = page.params.id;
		if (!id) {
			loadError = 'Missing purchase order id';
			isLoading = false;
			return;
		}

		let cancelled = false;
		isLoading = true;
		loadError = null;

		(async () => {
			try {
				const { data: po, error } = await supabase
					.from('quincees_purchase_orders')
					.select(
						`
						id,
						status,
						quincees_suppliers ( name ),
						quincees_purchase_order_items (
							id,
							product_id,
							quantity,
							unit_cost,
							quincees_products ( id, name, sku )
						),
						quincees_purchase_order_receipts (
							id,
							quincees_purchase_order_receipt_items (
								purchase_order_item_id,
								quantity_received
							)
						)
					`
					)
					.eq('id', id)
					.single();

				if (error) throw error;
				if (!po) {
					loadError = 'Purchase order not found';
					return;
				}
				if (cancelled) return;

				const sup = one(po.quincees_suppliers);
				supplierName = sup?.name != null ? String(sup.name) : '—';
				poStatus = po.status != null ? String(po.status) : '';

				const receipts = asArray(po.quincees_purchase_order_receipts);
				const items = asArray(po.quincees_purchase_order_items);

				const today = new Date();
				receivedDate = today.toISOString().slice(0, 10);

				receiveLines = items.map((row) => {
					const p = one(row.quincees_products);
					const ordered = Number(row.quantity) || 0;
					const alreadyReceived = receivedQtyForLine(receipts, String(row.id));
					const remaining = Math.max(0, ordered - alreadyReceived);
					return {
						itemId: String(row.id),
						product_id: String(row.product_id),
						productName: p?.name != null ? String(p.name) : '—',
						sku: p?.sku != null ? String(p.sku) : '',
						ordered,
						alreadyReceived,
						receiveNow: remaining,
						unit_cost: Number(row.unit_cost) || 0
					};
				});
			} catch (e) {
				console.error(e);
				if (!cancelled) {
					loadError = e instanceof Error ? e.message : 'Failed to load purchase order';
				}
			} finally {
				if (!cancelled) isLoading = false;
			}
		})();

		return () => {
			cancelled = true;
		};
	});

	/**
	 * @param {typeof receiveLines[0]} line
	 * @param {number} v
	 */
	function clampReceiveNow(line, v) {
		const remaining = Math.max(0, line.ordered - line.alreadyReceived);
		const n = Number(v);
		if (!Number.isFinite(n) || n < 0) return 0;
		return Math.min(remaining, Math.floor(n));
	}

	async function handleSubmit() {
		const id = page.params.id;
		if (!id || !canSubmit) return;

		for (const line of receiveLines) {
			line.receiveNow = clampReceiveNow(line, line.receiveNow);
		}

		const linesToReceive = receiveLines.filter((l) => l.receiveNow > 0);
		const receivedAt = receivedDate
			? new Date(receivedDate + 'T12:00:00').toISOString()
			: new Date().toISOString();

		isSaving = true;
		try {
			const { data: authData } = await supabase.auth.getUser();
			const user = authData?.user;

			const { data: rec, error: rErr } = await supabase
				.from('quincees_purchase_order_receipts')
				.insert({
					purchase_order_id: id,
					received_at: receivedAt,
					notes: receiptNotes.trim() || null
				})
				.select()
				.single();

			if (rErr) throw rErr;
			if (!rec) throw new Error('No receipt returned');

			const receiptRows = linesToReceive.map((line) => ({
				receipt_id: rec.id,
				purchase_order_item_id: line.itemId,
				product_id: line.product_id,
				quantity_received: line.receiveNow,
				unit_cost: line.unit_cost,
				notes: null
			}));

			const { data: recItems, error: riErr } = await supabase
				.from('quincees_purchase_order_receipt_items')
				.insert(receiptRows)
				.select();

			if (riErr) throw riErr;

			for (const ri of recItems || []) {
				const { error: mErr } = await supabase.from('quincees_stock_movements').insert({
					product_id: ri.product_id,
					movement_type: 'purchase_in',
					quantity: Number(ri.quantity_received) || 0,
					unit_cost: ri.unit_cost,
					reference_table: 'quincees_purchase_order_receipt_items',
					reference_id: ri.id,
					notes: `PO ${String(id).slice(0, 8)}…`,
					created_by: user?.email ?? user?.id ?? null
				});
				if (mErr) throw mErr;
			}

			let allComplete = true;
			for (const line of receiveLines) {
				const totalAfter = line.alreadyReceived + (linesToReceive.find((l) => l.itemId === line.itemId)?.receiveNow ?? 0);
				if (totalAfter < line.ordered) allComplete = false;
			}

			const newStatus = allComplete ? 'received' : 'partial';
			const { error: uErr } = await supabase
				.from('quincees_purchase_orders')
				.update({ status: newStatus })
				.eq('id', id);
			if (uErr) throw uErr;

			goto('/purchase-orders');
		} catch (e) {
			console.error(e);
			alert('Receive failed: ' + (e instanceof Error ? e.message : String(e)));
		} finally {
			isSaving = false;
		}
	}
</script>

<svelte:head>
	<title>Receive purchase order | Quincee's</title>
</svelte:head>

<div class="container">
	<header class="header" in:fly={{ y: -20, duration: 800, easing: quintOut }}>
		<a href="/purchase-orders" class="back-link">← Purchase orders</a>
		<h1>Receive goods</h1>
		<p class="subtitle">{supplierName} · record quantities against this PO</p>
	</header>

	<main class="main-content">
		{#if isLoading}
			<div class="panel muted-panel">Loading…</div>
		{:else if loadError}
			<div class="panel error-panel">
				<p>{loadError}</p>
				<a href="/purchase-orders" class="btn-secondary">Back to list</a>
			</div>
		{:else if receiveLines.length === 0}
			<div class="panel muted-panel">
				<p>This purchase order has no line items.</p>
				<a href="/purchase-orders" class="btn-secondary">Back to list</a>
			</div>
		{:else if receiveLines.every((l) => l.ordered <= l.alreadyReceived)}
			<div class="panel muted-panel">
				<p>Everything on this order is already fully received.</p>
				<a href="/purchase-orders" class="btn-secondary">Back to list</a>
			</div>
		{:else}
			<form
				class="panel"
				onsubmit={(e) => {
					e.preventDefault();
					handleSubmit();
				}}
				in:fly={{ y: 12, duration: 600, easing: quintOut }}
			>
				<div class="field-grid">
					<label class="field">
						<span class="label">Received date</span>
						<input type="date" bind:value={receivedDate} class="input" required />
					</label>
					<label class="field full-width">
						<span class="label">Receipt notes</span>
						<input
							type="text"
							bind:value={receiptNotes}
							class="input"
							placeholder="Delivery note, batch, etc."
						/>
					</label>
				</div>

				<div class="subtable-wrap">
					<table class="subtable">
						<thead>
							<tr>
								<th>Product</th>
								<th class="text-right">Ordered</th>
								<th class="text-right">Already in</th>
								<th class="text-right">Receive now</th>
								<th class="text-right">Unit cost</th>
							</tr>
						</thead>
						<tbody>
							{#each receiveLines as line (line.itemId)}
								<tr class:done={line.alreadyReceived >= line.ordered}>
									<td>
										<div class="prod-name">{line.productName}</div>
										{#if line.sku}
											<div class="prod-sku">SKU {line.sku}</div>
										{/if}
									</td>
									<td class="text-right mono">{line.ordered}</td>
									<td class="text-right mono">{line.alreadyReceived}</td>
									<td class="text-right">
										{#if line.alreadyReceived >= line.ordered}
											<span class="muted">—</span>
										{:else}
											<input
												type="number"
												min="0"
												max={line.ordered - line.alreadyReceived}
												step="1"
												class="input input-tight"
												bind:value={line.receiveNow}
											/>
										{/if}
									</td>
									<td class="text-right mono">{formatCurrency(line.unit_cost)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<div class="form-actions">
					<a href="/purchase-orders" class="btn-secondary">Cancel</a>
					<button type="submit" class="btn-primary" disabled={isSaving || !canSubmit}>
						{isSaving ? 'Saving…' : 'Record receipt'}
					</button>
				</div>
			</form>
		{/if}
	</main>
</div>

<style>
	.container {
		max-width: 900px;
		margin: 0 auto;
		padding: 2rem 1.5rem;
		min-height: calc(100vh - 64px);
	}

	.header h1 {
		font-size: 2rem;
		font-weight: 800;
		color: #0f172a;
		margin: 0.35rem 0 0 0;
		letter-spacing: -0.025em;
	}

	.subtitle {
		color: #64748b;
		margin: 0.25rem 0 0 0;
		font-size: 0.95rem;
	}

	.back-link {
		font-size: 0.88rem;
		font-weight: 600;
		color: #2563eb;
		text-decoration: none;
	}

	.back-link:hover {
		text-decoration: underline;
	}

	.panel {
		background: rgba(255, 255, 255, 0.95);
		border: 1px solid #e2e8f0;
		border-radius: 16px;
		padding: 1.5rem;
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
	}

	.muted-panel,
	.error-panel {
		text-align: center;
		color: #64748b;
	}

	.error-panel p {
		margin: 0 0 1rem 0;
		color: #b91c1c;
	}

	.field-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-bottom: 1.25rem;
	}

	@media (max-width: 640px) {
		.field-grid {
			grid-template-columns: 1fr;
		}
	}

	.field.full-width {
		grid-column: 1 / -1;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.label {
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		color: #94a3b8;
		letter-spacing: 0.04em;
	}

	.input {
		padding: 0.6rem 0.75rem;
		border: 1px solid #e2e8f0;
		border-radius: 10px;
		font-size: 0.92rem;
		background: white;
	}

	.input:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
	}

	.input-tight {
		width: 5rem;
		margin-left: auto;
		display: block;
	}

	.subtable-wrap {
		overflow-x: auto;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		margin-bottom: 1.5rem;
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
		vertical-align: middle;
	}

	.subtable tr:last-child td {
		border-bottom: none;
	}

	tr.done {
		opacity: 0.55;
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

	.text-right {
		text-align: right;
	}

	.muted {
		color: #94a3b8;
	}

	.form-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		justify-content: flex-end;
	}

	.btn-primary {
		padding: 0.65rem 1.25rem;
		border-radius: 10px;
		border: none;
		background: #2563eb;
		color: white;
		font-weight: 700;
		font-size: 0.9rem;
		cursor: pointer;
	}

	.btn-primary:hover:not(:disabled) {
		background: #1d4ed8;
	}

	.btn-primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-secondary {
		padding: 0.65rem 1.25rem;
		border-radius: 10px;
		border: 1px solid #e2e8f0;
		background: white;
		color: #475569;
		font-weight: 600;
		font-size: 0.9rem;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
	}

	.btn-secondary:hover {
		background: #f8fafc;
	}
</style>

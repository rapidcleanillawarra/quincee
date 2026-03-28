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

	let isLoading = $state(true);
	let isSaving = $state(false);
	let loadError = $state(/** @type {string | null} */ (null));

	let supplierId = $state('');
	let notes = $state('');
	let supplierReference = $state('');
	let status = $state('draft');

	let lineRows = $state(
		/** @type { { id: string; productName: string; sku: string; quantity: number; unit_cost: number; notes: string }[] } */ ([])
	);
	let suppliers = $state(/** @type { { id: string; name: string }[] } */ ([]));

	const statusOptions = ['draft', 'ordered', 'partial', 'received', 'cancelled'];

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
				const { data: sups, error: supErr } = await supabase
					.from('quincees_suppliers')
					.select('id, name')
					.order('name');
				if (supErr) throw supErr;
				if (cancelled) return;
				suppliers = (sups || []).map((s) => ({ id: String(s.id), name: String(s.name) }));

				const { data: po, error } = await supabase
					.from('quincees_purchase_orders')
					.select(
						`
						id,
						supplier_id,
						status,
						notes,
						supplier_reference,
						quincees_suppliers ( id, name ),
						quincees_purchase_order_items (
							id,
							product_id,
							quantity,
							unit_cost,
							notes,
							quincees_products ( id, name, sku )
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

				supplierId = po.supplier_id ? String(po.supplier_id) : '';
				notes = po.notes != null ? String(po.notes) : '';
				supplierReference = po.supplier_reference != null ? String(po.supplier_reference) : '';
				status = po.status != null ? String(po.status) : 'draft';

				const items = asArray(po.quincees_purchase_order_items);
				lineRows = items.map((row) => {
					const p = one(row.quincees_products);
					return {
						id: String(row.id),
						productName: p?.name != null ? String(p.name) : '—',
						sku: p?.sku != null ? String(p.sku) : '',
						quantity: Number(row.quantity) || 0,
						unit_cost: Number(row.unit_cost) || 0,
						notes: row.notes != null ? String(row.notes) : ''
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

	async function handleSave() {
		const id = page.params.id;
		if (!id) return;
		if (!supplierId.trim()) {
			alert('Please choose a supplier');
			return;
		}

		isSaving = true;
		try {
			const { error: oErr } = await supabase
				.from('quincees_purchase_orders')
				.update({
					supplier_id: supplierId,
					notes: notes.trim() || null,
					supplier_reference: supplierReference.trim() || null,
					status
				})
				.eq('id', id);
			if (oErr) throw oErr;

			for (const line of lineRows) {
				const { error: lErr } = await supabase
					.from('quincees_purchase_order_items')
					.update({
						quantity: line.quantity,
						unit_cost: line.unit_cost,
						notes: line.notes.trim() || null
					})
					.eq('id', line.id);
				if (lErr) throw lErr;
			}

			goto('/purchase-orders');
		} catch (e) {
			console.error(e);
			alert('Save failed: ' + (e instanceof Error ? e.message : String(e)));
		} finally {
			isSaving = false;
		}
	}
</script>

<svelte:head>
	<title>Edit purchase order | Quincee's</title>
</svelte:head>

<div class="container">
	<header class="header" in:fly={{ y: -20, duration: 800, easing: quintOut }}>
		<div class="header-row">
			<div>
				<a href="/purchase-orders" class="back-link">← Purchase orders</a>
				<h1>Edit purchase order</h1>
				<p class="subtitle">Update supplier, status, notes, and line quantities</p>
			</div>
		</div>
	</header>

	<main class="main-content">
		{#if isLoading}
			<div class="panel muted-panel">Loading…</div>
		{:else if loadError}
			<div class="panel error-panel">
				<p>{loadError}</p>
				<a href="/purchase-orders" class="btn-secondary">Back to list</a>
			</div>
		{:else}
			<form
				class="panel"
				onsubmit={(e) => {
					e.preventDefault();
					handleSave();
				}}
				in:fly={{ y: 12, duration: 600, easing: quintOut }}
			>
				<div class="field-grid">
					<label class="field">
						<span class="label">Supplier</span>
						<select bind:value={supplierId} class="input" required>
							<option value="">Choose supplier</option>
							{#each suppliers as s (s.id)}
								<option value={s.id}>{s.name}</option>
							{/each}
						</select>
					</label>
					<label class="field">
						<span class="label">Status</span>
						<select bind:value={status} class="input">
							{#each statusOptions as opt}
								<option value={opt}>{opt}</option>
							{/each}
						</select>
					</label>
					<label class="field full-width">
						<span class="label">Supplier reference</span>
						<input type="text" bind:value={supplierReference} class="input" placeholder="Invoice or PO ref…" />
					</label>
					<label class="field full-width">
						<span class="label">Notes</span>
						<textarea bind:value={notes} class="input textarea" rows="3" placeholder="Internal notes…"></textarea>
					</label>
				</div>

				<h2 class="section-title">Line items</h2>
				<div class="subtable-wrap">
					<table class="subtable">
						<thead>
							<tr>
								<th>Product</th>
								<th class="text-right">Qty</th>
								<th class="text-right">Unit cost</th>
								<th class="text-right">Line total</th>
								<th>Line notes</th>
							</tr>
						</thead>
						<tbody>
							{#each lineRows as line (line.id)}
								<tr>
									<td>
										<div class="prod-name">{line.productName}</div>
										{#if line.sku}
											<div class="prod-sku">SKU {line.sku}</div>
										{/if}
									</td>
									<td class="text-right">
										<input
											type="number"
											min="0"
											step="1"
											bind:value={line.quantity}
											class="input input-tight"
										/>
									</td>
									<td class="text-right">
										<input
											type="number"
											min="0"
											step="0.01"
											bind:value={line.unit_cost}
											class="input input-tight"
										/>
									</td>
									<td class="text-right mono">{formatCurrency(line.quantity * line.unit_cost)}</td>
									<td>
										<input type="text" bind:value={line.notes} class="input input-tight" placeholder="—" />
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<div class="form-actions">
					<a href="/purchase-orders" class="btn-secondary">Cancel</a>
					<button type="submit" class="btn-primary" disabled={isSaving}>
						{isSaving ? 'Saving…' : 'Save changes'}
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
		margin-bottom: 1.5rem;
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

	.textarea {
		resize: vertical;
		min-height: 4rem;
	}

	.input-tight {
		width: 100%;
		max-width: 7rem;
		margin-left: auto;
		display: block;
	}

	tr .input-tight:last-of-type {
		max-width: 100%;
		margin-left: 0;
	}

	.section-title {
		margin: 0 0 0.75rem 0;
		font-size: 1rem;
		font-weight: 800;
		color: #0f172a;
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

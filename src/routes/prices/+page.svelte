<script>
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { fly, fade } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';

	const RETAIL_MARKUP = 15;

	let rows = $state([]);
	let isLoading = $state(true);
	let searchQuery = $state('');
	let isModalOpen = $state(false);
	let isSaving = $state(false);
	let editing = $state(null);
	let formBuyPrice = $state('');

	let filteredRows = $derived(
		rows.filter((r) => {
			const q = searchQuery.toLowerCase();
			return (
				r.name.toLowerCase().includes(q) ||
				(r.sku && r.sku.toLowerCase().includes(q)) ||
				(r.category && r.category.toLowerCase().includes(q))
			);
		})
	);

	function latestPriceRecord(priceRows) {
		const list = priceRows || [];
		return [...list].sort((a, b) => {
			const ta = new Date(a.effective_from || a.created_at || 0).getTime();
			const tb = new Date(b.effective_from || b.created_at || 0).getTime();
			return tb - ta;
		})[0];
	}

	async function fetchPrices() {
		isLoading = true;
		try {
			const { data, error } = await supabase
				.from('quincees_products')
				.select(
					`
					id,
					sku,
					name,
					category,
					quincees_prices ( buy_price, effective_from, created_at )
				`
				)
				.order('name', { ascending: true });

			if (error) throw error;

			rows = (data || []).map((p) => {
				const latest = latestPriceRecord(p.quincees_prices);
				const buy = latest?.buy_price != null ? Number(latest.buy_price) : 0;
				return {
					id: p.id,
					sku: p.sku,
					name: p.name,
					category: p.category,
					buy_price: buy
				};
			});
		} catch (e) {
			console.error('Error loading prices:', e);
			rows = [];
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		fetchPrices();
	});

	function formatMoney(n) {
		const v = Number(n);
		if (!Number.isFinite(v) || v <= 0) return '—';
		return `₱${v.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
	}

	function suggestedRetail(buy) {
		const b = Number(buy) || 0;
		if (b <= 0) return '—';
		return formatMoney(b + RETAIL_MARKUP);
	}

	function openEdit(row) {
		editing = row;
		formBuyPrice = row.buy_price > 0 ? String(row.buy_price) : '';
		isModalOpen = true;
	}

	function parseBuyInput() {
		const raw = String(formBuyPrice).replace(/,/g, '').trim();
		if (raw === '') return null;
		const n = Number.parseFloat(raw);
		return Number.isFinite(n) ? n : NaN;
	}

	async function handleSave() {
		const buy = parseBuyInput();
		if (editing == null) return;
		if (Number.isNaN(buy)) {
			alert('Enter a valid buy price (number).');
			return;
		}
		if (buy < 0) {
			alert('Buy price cannot be negative.');
			return;
		}

		const unchanged = buy === editing.buy_price;
		if (unchanged) {
			isModalOpen = false;
			return;
		}

		isSaving = true;
		try {
			const { error } = await supabase.from('quincees_prices').insert({
				product_id: editing.id,
				buy_price: buy,
				effective_from: new Date().toISOString()
			});

			if (error) throw error;

			await fetchPrices();
			isModalOpen = false;
			editing = null;
		} catch (e) {
			console.error('Error saving price:', e);
			alert('Failed to save price: ' + (e.message || String(e)));
		} finally {
			isSaving = false;
		}
	}
</script>

<svelte:head>
	<title>Prices | Quincee's</title>
</svelte:head>

<div class="container">
	<header class="header" in:fly={{ y: -20, duration: 800, easing: quintOut }}>
		<div class="header-left">
			<h1>Buy prices</h1>
			<p class="subtitle">
				Update supplier buy prices per kilo. A new price row is recorded each time you save (effective from now).
				Default customer sell price elsewhere is buy + ₱{RETAIL_MARKUP} when no custom price is set.
			</p>
		</div>
		<a href="/prices/print" class="print-link">Print price sheet</a>
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
					placeholder="Search by name, SKU or category…"
					bind:value={searchQuery}
					class="search-input"
				/>
			</div>
		</div>

		{#if isLoading}
			<div class="loading-state">
				<div class="spinner"></div>
				<p>Loading products…</p>
			</div>
		{:else if filteredRows.length === 0}
			<div class="empty-state">
				<div class="empty-icon">🏷️</div>
				<h3>No products found</h3>
				<p>Try another search term.</p>
			</div>
		{:else}
			<div class="table-container" in:fly={{ y: 20, duration: 800, delay: 200, easing: quintOut }}>
				<table class="prices-table">
					<thead>
						<tr>
							<th>Product</th>
							<th>Category</th>
							<th class="text-right">Buy / kilo</th>
							<th class="text-right hint">Suggested retail</th>
							<th class="text-right">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each filteredRows as row (row.id)}
							<tr>
								<td class="product-cell" data-label="Product">
									<div class="product-name">{row.name}</div>
									{#if row.sku}
										<div class="product-meta"><span class="sku">SKU: {row.sku}</span></div>
									{/if}
								</td>
								<td data-label="Category">
									{#if row.category}
										<span class="category-badge">{row.category}</span>
									{:else}
										<span class="text-muted">—</span>
									{/if}
								</td>
								<td class="text-right mono" data-label="Buy / kilo">{formatMoney(row.buy_price)}</td>
								<td class="text-right mono muted" data-label="Suggested retail">{suggestedRetail(row.buy_price)}</td>
								<td class="text-right actions-cell" data-label="Actions">
									<button type="button" class="edit-btn" onclick={() => openEdit(row)}>Edit buy price</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</main>
</div>

{#if isModalOpen && editing}
	<div
		class="modal-overlay"
		transition:fade={{ duration: 200 }}
		onclick={() => (isModalOpen = false)}
		onkeydown={(e) => e.key === 'Escape' && (isModalOpen = false)}
		role="presentation"
	>
		<div
			class="modal-content"
			transition:fly={{ y: 20, duration: 400 }}
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="presentation"
		>
			<header class="modal-header">
				<h2>Update buy price</h2>
				<button type="button" class="close-btn" onclick={() => (isModalOpen = false)}>&times;</button>
			</header>

			<div class="modal-body">
				<div class="display-group">
					<div class="display-label">Product</div>
					<div class="display-value">{editing.name}</div>
					{#if editing.sku}
						<div class="display-sub">SKU: {editing.sku}</div>
					{/if}
				</div>

				<div class="form-group">
					<label for="buy-price">Buy price per kilo (₱)</label>
					<input
						id="buy-price"
						type="text"
						inputmode="decimal"
						bind:value={formBuyPrice}
						placeholder="0"
						class="price-input"
						autocomplete="off"
					/>
					<p class="field-hint">Saves a new price effective immediately. Past prices stay in history.</p>
				</div>
			</div>

			<footer class="modal-footer">
				<button type="button" class="btn-secondary" onclick={() => (isModalOpen = false)}>Cancel</button>
				<button type="button" class="btn-primary" onclick={handleSave} disabled={isSaving}>
					{isSaving ? 'Saving…' : 'Save price'}
				</button>
			</footer>
		</div>
	</div>
{/if}

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

	.header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		flex-wrap: wrap;
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
		line-height: 1.5;
		max-width: 42rem;
	}

	.print-link {
		align-self: center;
		padding: 0.6rem 1rem;
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		color: #0f172a;
		font-weight: 600;
		font-size: 0.9rem;
		text-decoration: none;
		white-space: nowrap;
		transition:
			background 0.15s,
			border-color 0.15s;
	}

	.print-link:hover {
		background: #f8fafc;
		border-color: #cbd5e1;
	}

	.controls-row {
		margin-bottom: 1rem;
	}

	.search-wrapper {
		position: relative;
		display: flex;
		align-items: center;
		max-width: 500px;
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
		font-size: 1rem;
		outline: none;
		transition: border-color 0.15s;
	}

	.search-input:focus {
		border-color: #94a3b8;
	}

	.loading-state,
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem 1rem;
		color: #64748b;
		gap: 0.75rem;
	}

	.spinner {
		width: 36px;
		height: 36px;
		border: 3px solid #e2e8f0;
		border-top-color: #0f172a;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.empty-icon {
		font-size: 2.5rem;
	}

	.empty-state h3 {
		margin: 0;
		color: #0f172a;
	}

	.table-container {
		background: white;
		border-radius: 16px;
		border: 1px solid #e2e8f0;
		overflow: hidden;
		box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
	}

	.prices-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.95rem;
	}

	.prices-table th {
		text-align: left;
		padding: 0.875rem 1.25rem;
		background: #f8fafc;
		color: #475569;
		font-weight: 600;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		border-bottom: 1px solid #e2e8f0;
	}

	.prices-table th.hint {
		font-weight: 500;
		color: #94a3b8;
	}

	.prices-table td {
		padding: 1rem 1.25rem;
		border-bottom: 1px solid #f1f5f9;
		vertical-align: middle;
	}

	.prices-table tr:last-child td {
		border-bottom: none;
	}

	.product-name {
		font-weight: 600;
		color: #0f172a;
	}

	.product-meta {
		margin-top: 0.25rem;
		font-size: 0.8rem;
		color: #94a3b8;
	}

	.category-badge {
		display: inline-block;
		padding: 0.2rem 0.55rem;
		background: #f1f5f9;
		border-radius: 6px;
		font-size: 0.8rem;
		color: #475569;
	}

	.text-muted {
		color: #94a3b8;
	}

	.mono {
		font-variant-numeric: tabular-nums;
	}

	.muted {
		color: #64748b;
	}

	.text-right {
		text-align: right;
	}

	.edit-btn {
		padding: 0.45rem 0.85rem;
		background: #0f172a;
		color: white;
		border: none;
		border-radius: 10px;
		font-weight: 600;
		font-size: 0.85rem;
		cursor: pointer;
		transition: background 0.15s;
	}

	.edit-btn:hover {
		background: #1e293b;
	}

	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(15, 23, 42, 0.45);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		z-index: 1000;
	}

	.modal-content {
		background: white;
		border-radius: 16px;
		width: 100%;
		max-width: 440px;
		box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.25);
		overflow: hidden;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid #e2e8f0;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 700;
		color: #0f172a;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 1.5rem;
		line-height: 1;
		color: #94a3b8;
		cursor: pointer;
		padding: 0.25rem;
	}

	.close-btn:hover {
		color: #0f172a;
	}

	.modal-body {
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.display-group {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.display-label {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #94a3b8;
	}

	.display-value {
		font-weight: 600;
		color: #0f172a;
		font-size: 1.05rem;
	}

	.display-sub {
		font-size: 0.85rem;
		color: #64748b;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.form-group label {
		font-weight: 600;
		font-size: 0.9rem;
		color: #334155;
	}

	.price-input {
		padding: 0.75rem 1rem;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		font-size: 1.1rem;
		font-variant-numeric: tabular-nums;
	}

	.price-input:focus {
		outline: none;
		border-color: #64748b;
	}

	.field-hint {
		margin: 0;
		font-size: 0.8rem;
		color: #94a3b8;
		line-height: 1.4;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		padding: 1rem 1.5rem 1.5rem;
	}

	.btn-secondary {
		padding: 0.6rem 1.1rem;
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 10px;
		font-weight: 600;
		cursor: pointer;
		color: #475569;
	}

	.btn-secondary:hover {
		background: #f8fafc;
	}

	.btn-primary {
		padding: 0.6rem 1.1rem;
		background: #0f172a;
		color: white;
		border: none;
		border-radius: 10px;
		font-weight: 600;
		cursor: pointer;
	}

	.btn-primary:hover:not(:disabled) {
		background: #1e293b;
	}

	.btn-primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	@media (max-width: 768px) {
		.prices-table thead {
			display: none;
		}

		.prices-table tr {
			display: block;
			padding: 1rem;
			border-bottom: 1px solid #e2e8f0;
		}

		.prices-table td {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 0.4rem 0;
			border: none;
		}

		.prices-table td::before {
			content: attr(data-label);
			font-weight: 600;
			color: #64748b;
			font-size: 0.75rem;
			text-transform: uppercase;
			margin-right: 1rem;
		}

		.product-cell {
			flex-direction: column;
			align-items: flex-start !important;
		}

		.product-cell::before {
			display: none;
		}

		.actions-cell {
			padding-top: 0.75rem;
		}

		.actions-cell::before {
			display: none;
		}
	}
</style>

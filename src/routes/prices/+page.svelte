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
	let formSellPrice = $state('');
	let formDisplayOnPrint = $state(true);

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
					quincees_prices ( buy_price, sell_price, display_on_print, effective_from, created_at )
				`
				)
				.order('name', { ascending: true });

			if (error) throw error;

			rows = (data || []).map((p) => {
				const latest = latestPriceRecord(p.quincees_prices);
				const buy = latest?.buy_price != null ? Number(latest.buy_price) : 0;
				const rawSell = latest?.sell_price;
				const sell =
					rawSell != null && rawSell !== '' ? Number(rawSell) : null;
				const dop = latest?.display_on_print;
				return {
					id: p.id,
					sku: p.sku,
					name: p.name,
					category: p.category,
					buy_price: buy,
					sell_price: sell != null && Number.isFinite(sell) ? sell : null,
					display_on_print: dop !== false
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

	/** Stored sell, or buy + markup when none stored (for display). */
	function effectiveSell(row) {
		if (row.sell_price != null && Number.isFinite(row.sell_price) && row.sell_price > 0) {
			return row.sell_price;
		}
		const b = Number(row.buy_price) || 0;
		if (b > 0) return b + RETAIL_MARKUP;
		return null;
	}

	function sellUsesDefaultMarkup(row) {
		return row.sell_price == null && row.buy_price > 0;
	}

	function openEdit(row) {
		editing = row;
		formBuyPrice = row.buy_price > 0 ? String(row.buy_price) : '';
		formSellPrice =
			row.sell_price != null && row.sell_price > 0 ? String(row.sell_price) : '';
		formDisplayOnPrint = row.display_on_print !== false;
		isModalOpen = true;
	}

	function parseBuyInput() {
		const raw = String(formBuyPrice).replace(/,/g, '').trim();
		if (raw === '') return null;
		const n = Number.parseFloat(raw);
		return Number.isFinite(n) ? n : NaN;
	}

	/** `null` = leave blank / use default elsewhere; `NaN` = invalid */
	function parseSellInput() {
		const raw = String(formSellPrice).replace(/,/g, '').trim();
		if (raw === '') return null;
		const n = Number.parseFloat(raw);
		return Number.isFinite(n) ? n : NaN;
	}

	function pricesUnchanged(newBuy, newSell, newDisplay, row) {
		if (newBuy !== row.buy_price) return false;
		if (newDisplay !== row.display_on_print) return false;
		const oldSell = row.sell_price;
		if (newSell === oldSell) return true;
		if (oldSell == null && newSell == null) return true;
		if (oldSell == null && newSell != null && row.buy_price > 0) {
			return Math.abs(newSell - (row.buy_price + RETAIL_MARKUP)) < 0.005;
		}
		return false;
	}

	async function handleSave() {
		const buy = parseBuyInput();
		const sell = parseSellInput();
		if (editing == null) return;
		if (Number.isNaN(buy)) {
			alert('Enter a valid buy price (number).');
			return;
		}
		if (buy < 0) {
			alert('Buy price cannot be negative.');
			return;
		}
		if (Number.isNaN(sell)) {
			alert('Enter a valid sell price (number), or leave it blank.');
			return;
		}
		if (sell != null && sell < 0) {
			alert('Sell price cannot be negative.');
			return;
		}

		if (pricesUnchanged(buy, sell, formDisplayOnPrint, editing)) {
			isModalOpen = false;
			return;
		}

		isSaving = true;
		try {
			const { error } = await supabase.from('quincees_prices').insert({
				product_id: editing.id,
				buy_price: buy,
				sell_price: sell,
				display_on_print: formDisplayOnPrint,
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
			<h1>Prices</h1>
			<p class="subtitle">
				Set buy and sell per kilo. Each save adds a new row (effective from now). Leave sell blank to use buy + ₱{RETAIL_MARKUP} on screens that fall back to default.
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
							<th class="text-right">Sell / kilo</th>
							<th class="text-center col-print">Print</th>
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
								<td class="text-right mono sell-cell" data-label="Sell / kilo">
									<span>{formatMoney(effectiveSell(row))}</span>
									{#if sellUsesDefaultMarkup(row)}
										<span class="sell-hint" title="No sell stored; using buy + ₱{RETAIL_MARKUP}">default</span>
									{/if}
								</td>
								<td class="text-center" data-label="On print sheet">
									{#if row.display_on_print !== false}
										<span class="print-badge yes" title="Shown on print price sheet">Yes</span>
									{:else}
										<span class="print-badge no" title="Hidden from print price sheet">No</span>
									{/if}
								</td>
								<td class="text-right actions-cell" data-label="Actions">
									<button type="button" class="edit-btn" onclick={() => openEdit(row)}>Edit prices</button>
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
				<h2>Update prices</h2>
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
				</div>

				<div class="form-group">
					<label for="sell-price">Sell price per kilo (₱)</label>
					<input
						id="sell-price"
						type="text"
						inputmode="decimal"
						bind:value={formSellPrice}
						placeholder="Optional"
						class="price-input"
						autocomplete="off"
					/>
					<p class="field-hint">
						Leave blank to store no sell price (other screens use buy + ₱{RETAIL_MARKUP}). Saves one history row with both values.
					</p>
				</div>

				<div class="form-group checkbox-row">
					<label class="checkbox-label">
						<input type="checkbox" bind:checked={formDisplayOnPrint} />
						<span>Show on printed price sheet</span>
					</label>
					<p class="field-hint">When off, this product is hidden on /prices/print.</p>
				</div>
			</div>

			<footer class="modal-footer">
				<button type="button" class="btn-secondary" onclick={() => (isModalOpen = false)}>Cancel</button>
				<button type="button" class="btn-primary" onclick={handleSave} disabled={isSaving}>
					{isSaving ? 'Saving…' : 'Save prices'}
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

	.text-center {
		text-align: center;
	}

	.sell-cell {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.45rem;
		flex-wrap: wrap;
	}

	.sell-hint {
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #64748b;
		background: #f1f5f9;
		padding: 0.12rem 0.4rem;
		border-radius: 4px;
	}

	.col-print {
		width: 5rem;
	}

	.print-badge {
		display: inline-block;
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		padding: 0.2rem 0.45rem;
		border-radius: 6px;
	}

	.print-badge.yes {
		color: #166534;
		background: #dcfce7;
	}

	.print-badge.no {
		color: #991b1b;
		background: #fee2e2;
	}

	.checkbox-row {
		padding-top: 0.25rem;
	}

	.checkbox-label {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		font-weight: 600;
		color: #334155;
		cursor: pointer;
	}

	.checkbox-label input {
		margin-top: 0.2rem;
		width: 1.05rem;
		height: 1.05rem;
		accent-color: #0f172a;
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

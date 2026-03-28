<script>
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { fly, fade } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';

	let stocks = $state([]);
	let isLoading = $state(true);
	let searchQuery = $state('');
	let isModalOpen = $state(false);
	let isSaving = $state(false);
	let editingStock = $state(null);

	// Form state
	let formData = $state({
		quantity: 0
	});

	let filteredStocks = $derived(
		stocks.filter(s => 
			s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			(s.sku && s.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
			(s.category && s.category.toLowerCase().includes(searchQuery.toLowerCase()))
		)
	);

	async function fetchStocks() {
		isLoading = true;
		try {
			const { data, error } = await supabase
				.from('quincees_products')
				.select(`
					id,
					sku,
					name,
					category,
					quincees_stocks ( quantity, updated_at )
				`)
				.order('name', { ascending: true });

			if (error) throw error;
			
			stocks = data.map(product => {
				const stockData = product.quincees_stocks;
				const actualStockData = Array.isArray(stockData) ? stockData[0] : stockData;
				
				return {
					product_id: product.id,
					sku: product.sku,
					name: product.name,
					category: product.category,
					quantity: actualStockData?.quantity || 0,
					updated_at: actualStockData?.updated_at || null
				};
			});
		} catch (error) {
			console.error('Error fetching stocks:', error);
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		fetchStocks();
	});

	function openEditModal(stock) {
		editingStock = stock;
		formData = { quantity: stock.quantity };
		isModalOpen = true;
	}

	async function handleSave() {
		isSaving = true;
		try {
			const prev = Number(editingStock.quantity) || 0;
			const next = Number(formData.quantity) || 0;
			const delta = next - prev;

			if (delta === 0) {
				isModalOpen = false;
				return;
			}

			const movement_type = delta > 0 ? 'adjustment_in' : 'adjustment_out';
			const { data: authData } = await supabase.auth.getUser();
			const user = authData?.user;

			const { error } = await supabase.from('quincees_stock_movements').insert({
				product_id: editingStock.product_id,
				movement_type,
				quantity: delta,
				reference_table: 'stocks_ui',
				reference_id: null,
				notes: `Manual adjustment: ${prev} → ${next}`,
				created_by: user?.email ?? user?.id ?? null
			});

			if (error) throw error;

			await fetchStocks();
			isModalOpen = false;
		} catch (error) {
			console.error('Error saving stock:', error);
			alert('Failed to save stock: ' + error.message);
		} finally {
			isSaving = false;
		}
	}

	function formatDate(isoString) {
		if (!isoString) return 'Never';
		return new Date(isoString).toLocaleDateString('en-AU', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>Stocks | Quincee's</title>
</svelte:head>

<div class="container">
	<header class="header" in:fly={{ y: -20, duration: 800, easing: quintOut }}>
		<div class="header-left">
			<h1>Stocks</h1>
			<p class="subtitle">Manage current stock levels for products</p>
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
					placeholder="Search by product name, SKU or category..." 
					bind:value={searchQuery}
					class="search-input"
				/>
			</div>
		</div>

		{#if isLoading}
			<div class="loading-state">
				<div class="spinner"></div>
				<p>Fetching stock levels...</p>
			</div>
		{:else if filteredStocks.length === 0}
			<div class="empty-state">
				<div class="empty-icon">📦</div>
				<h3>No products found</h3>
				<p>Try matching another name, SKU or category.</p>
			</div>
		{:else}
			<div class="table-container" in:fly={{ y: 20, duration: 800, delay: 200, easing: quintOut }}>
				<table class="stocks-table">
					<thead>
						<tr>
							<th>Product Details</th>
							<th>Category</th>
							<th class="text-right">Current Stock</th>
							<th class="text-right">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each filteredStocks as stock (stock.product_id)}
							<tr>
								<td class="product-cell" data-label="Product Details">
									<div class="product-name">{stock.name}</div>
									<div class="product-meta">
										{#if stock.sku}
											<span class="sku">SKU: {stock.sku}</span>
										{/if}
										<span class="last-updated">Updated {formatDate(stock.updated_at)}</span>
									</div>
								</td>
								<td data-label="Category">
									{#if stock.category}
										<span class="category-badge">{stock.category}</span>
									{:else}
										<span class="text-gray">—</span>
									{/if}
								</td>
								<td class="text-right" data-label="Current Stock">
									<div class="quantity-wrapper" class:low-stock={stock.quantity <= 0}>
										<span class="quantity-number">{stock.quantity}</span>
									</div>
								</td>
								<td class="text-right actions-cell" data-label="Actions">
									<button onclick={() => openEditModal(stock)} class="edit-btn">
										Update Stock
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

{#if isModalOpen}
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
				<h2>Update Stock</h2>
				<button class="close-btn" onclick={() => (isModalOpen = false)}>&times;</button>
			</header>
			
			<div class="modal-body">
				<div class="display-group">
					<div class="display-label">Product</div>
					<div class="display-value">{editingStock?.name}</div>
					{#if editingStock?.sku}
						<div class="display-sub">SKU: {editingStock.sku}</div>
					{/if}
				</div>

				<div class="form-group">
					<label for="quantity">Current Stock Quantity</label>
					<input 
						id="quantity" 
						type="number" 
						bind:value={formData.quantity} 
						placeholder="0" 
						class="quantity-input"
					/>
				</div>
			</div>

			<footer class="modal-footer">
				<button class="btn-secondary" onclick={() => (isModalOpen = false)}>Cancel</button>
				<button class="btn-primary" onclick={handleSave} disabled={isSaving}>
					{isSaving ? 'Saving...' : 'Save Stock Level'}
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
		align-items: center;
		gap: 1rem;
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

	.stocks-table {
		width: 100%;
		border-collapse: collapse;
		text-align: left;
	}

	.stocks-table th {
		padding: 1.25rem 1.5rem;
		background: #f8fafc;
		font-size: 0.75rem;
		font-weight: 700;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		border-bottom: 1px solid #e2e8f0;
	}

	.stocks-table td {
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid #f1f5f9;
		color: #334155;
		font-size: 0.95rem;
		vertical-align: middle;
	}

	.stocks-table tr:hover {
		background: #f8fafc;
	}

	.product-name {
		font-weight: 700;
		color: #0f172a;
		font-size: 1.05rem;
	}

	.product-meta {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-top: 0.35rem;
	}

	.sku {
		font-size: 0.75rem;
		font-weight: 600;
		color: #64748b;
		background: #f1f5f9;
		padding: 0.15rem 0.4rem;
		border-radius: 4px;
	}

	.last-updated {
		font-size: 0.75rem;
		color: #94a3b8;
	}

	.category-badge {
		display: inline-flex;
		align-items: center;
		padding: 0.25rem 0.75rem;
		background: #eff6ff;
		color: #2563eb;
		border-radius: 9999px;
		font-size: 0.85rem;
		font-weight: 600;
	}

	.quantity-wrapper {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 3rem;
		padding: 0.35rem 0.75rem;
		background: #ecfdf5;
		color: #059669;
		border-radius: 8px;
		font-weight: 700;
		font-size: 1.1rem;
	}

	.quantity-wrapper.low-stock {
		background: #fef2f2;
		color: #ef4444;
	}

	.actions-cell {
		display: flex;
		justify-content: flex-end;
	}

	.edit-btn {
		padding: 0.5rem 1rem;
		border-radius: 8px;
		border: 1px solid #e2e8f0;
		background: white;
		color: #3b82f6;
		font-weight: 600;
		font-size: 0.85rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.edit-btn:hover {
		background: #eff6ff;
		border-color: #3b82f6;
	}

	/* Modal Styles */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(15, 23, 42, 0.4);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 1.5rem;
	}

	.modal-content {
		background: white;
		width: 100%;
		max-width: 450px;
		border-radius: 24px;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.modal-header {
		padding: 1.5rem 2rem;
		border-bottom: 1px solid #f1f5f9;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 700;
		color: #0f172a;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 1.5rem;
		color: #94a3b8;
		cursor: pointer;
		padding: 0.5rem;
	}

	.modal-body {
		padding: 2rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.display-group {
		background: #f8fafc;
		padding: 1rem;
		border-radius: 12px;
		border: 1px solid #e2e8f0;
	}

	.display-label {
		font-size: 0.75rem;
		text-transform: uppercase;
		font-weight: 700;
		color: #64748b;
		margin-bottom: 0.25rem;
	}

	.display-value {
		font-size: 1.1rem;
		font-weight: 700;
		color: #0f172a;
	}

	.display-sub {
		font-size: 0.85rem;
		color: #64748b;
		margin-top: 0.25rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.form-group label {
		font-size: 0.875rem;
		font-weight: 700;
		color: #475569;
	}

	.quantity-input {
		padding: 1rem;
		border: 2px solid #e2e8f0;
		border-radius: 12px;
		font-size: 1.5rem;
		font-weight: 700;
		text-align: center;
		color: #0f172a;
		transition: all 0.2s;
	}

	.quantity-input:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
	}

	.modal-footer {
		padding: 1.5rem 2rem;
		background: #f8fafc;
		display: flex;
		justify-content: flex-end;
		gap: 1rem;
	}

	.btn-secondary {
		padding: 0.75rem 1.5rem;
		border-radius: 10px;
		font-weight: 600;
		background: white;
		border: 1px solid #e2e8f0;
		color: #475569;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-secondary:hover {
		background: #f1f5f9;
	}

	.btn-primary {
		padding: 0.75rem 1.5rem;
		border-radius: 10px;
		font-weight: 600;
		background: #3b82f6;
		color: white;
		border: none;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-primary:hover {
		background: #2563eb;
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Common utilities */
	.text-right { text-align: right; }
	.text-gray { color: #94a3b8; }

	.loading-state, .empty-state {
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
		to { transform: rotate(360deg); }
	}

	.empty-icon {
		font-size: 3rem;
		margin-bottom: 1rem;
	}

	@media (max-width: 768px) {
		.header { flex-direction: column; align-items: flex-start; }
		
		.stocks-table thead { display: none; }
		.stocks-table td {
			display: block;
			padding: 0.75rem 1.5rem;
			border: none;
			text-align: left;
		}
		.stocks-table td:first-child { padding-top: 1.5rem; }
		.stocks-table td:last-child {
			padding-bottom: 1.5rem;
			border-bottom: 1px solid #f1f5f9;
		}
		.stocks-table td::before {
			content: attr(data-label);
			display: block;
			font-size: 0.7rem;
			font-weight: 700;
			text-transform: uppercase;
			color: #94a3b8;
			margin-bottom: 0.25rem;
		}
		.actions-cell { justify-content: flex-start; margin-top: 0.5rem; }
		.quantity-wrapper { min-width: auto; }
	}
</style>

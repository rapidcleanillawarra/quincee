<script>
	import { fade, slide, fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';

	// State for order items
	let items = $state([
		{ id: crypto.randomUUID(), name: '', quantity: 1, price: 0 }
	]);

	// Derived state for totals
	let grandTotal = $derived(
		items.reduce((sum, item) => sum + (item.quantity * item.price), 0)
	);

	function addItem() {
		items.push({
			id: crypto.randomUUID(),
			name: '',
			quantity: 1,
			price: 0
		});
	}

	function removeItem(id) {
		if (items.length > 1) {
			items = items.filter(item => item.id !== id);
		} else {
			// Reset the last item instead of deleting it
			items[0] = { id: crypto.randomUUID(), name: '', quantity: 1, price: 0 };
		}
	}

	function handleSave() {
		console.log('Saving Order:', {
			items,
			grandTotal,
			timestamp: new Date().toISOString()
		});
		alert('Order saved! (Logged to console)');
	}

	// Format currency
	const formatCurrency = (val) => {
		return new Intl.NumberFormat('en-PH', {
			style: 'currency',
			currency: 'PHP'
		}).format(val);
	};
</script>

<svelte:head>
	<title>Create New Order | Quincee's</title>
</svelte:head>

<div class="container">
	<header class="header" in:fly={{ y: -20, duration: 800, easing: quintOut }}>
		<div class="header-content">
			<a href="/prices" class="back-link">
				<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
					<path d="M19 12H5M12 19l-7-7 7-7" />
				</svg>
				Back
			</a>
			<h1>New Order</h1>
		</div>
		<p class="subtitle">Enter item details below to create a new order.</p>
	</header>

	<main class="main-content">
		<!-- Desktop Table View -->
		<div class="table-container desktop-only">
			<table class="order-table">
				<thead>
					<tr>
						<th>Item Name</th>
						<th>Quantity</th>
						<th>Price</th>
						<th>Total</th>
						<th class="actions-header"></th>
					</tr>
				</thead>
				<tbody>
					{#each items as item (item.id)}
						<tr transition:slide={{ duration: 300 }}>
							<td>
								<input 
									type="text" 
									placeholder="e.g. Talong" 
									bind:value={item.name}
									class="input-field"
								/>
							</td>
							<td>
								<input 
									type="number" 
									min="1" 
									bind:value={item.quantity}
									class="input-field qty-input"
								/>
							</td>
							<td>
								<div class="price-input-wrapper">
									<span class="currency-symbol">₱</span>
									<input 
										type="number" 
										min="0" 
										step="0.01"
										bind:value={item.price}
										class="input-field price-input"
									/>
								</div>
							</td>
							<td class="row-total">
								{formatCurrency(item.quantity * item.price)}
							</td>
							<td class="actions-cell">
								<button 
									onclick={() => removeItem(item.id)} 
									class="delete-btn"
									aria-label="Delete item"
								>
									<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
										<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
									</svg>
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Mobile Card View -->
		<div class="mobile-only card-list">
			{#each items as item (item.id)}
				<div class="order-card" transition:fly={{ x: -20, duration: 300 }}>
					<div class="card-header">
						<input 
							type="text" 
							placeholder="Item Name" 
							bind:value={item.name}
							class="input-field name-input"
						/>
						<button 
							onclick={() => removeItem(item.id)} 
							class="delete-btn"
							aria-label="Delete item"
						>
							<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
								<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
							</svg>
						</button>
					</div>
					<div class="card-body">
						<div class="input-group">
							<label for="qty-{item.id}">Qty</label>
							<input 
								id="qty-{item.id}"
								type="number" 
								min="1" 
								bind:value={item.quantity}
								class="input-field"
							/>
						</div>
						<div class="input-group">
							<label for="price-{item.id}">Price</label>
							<div class="price-input-wrapper">
								<span class="currency-symbol">₱</span>
								<input 
									id="price-{item.id}"
									type="number" 
									min="0" 
									step="0.01"
									bind:value={item.price}
									class="input-field"
								/>
							</div>
						</div>
					</div>
					<div class="card-footer">
						<span>Subtotal:</span>
						<span class="item-total">{formatCurrency(item.quantity * item.price)}</span>
					</div>
				</div>
			{/each}
		</div>

		<button onclick={addItem} class="add-btn">
			<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
				<line x1="12" y1="5" x2="12" y2="19" />
				<line x1="5" y1="12" x2="19" y2="12" />
			</svg>
			Add Item
		</button>
	</main>

	<footer class="summary-footer" in:fly={{ y: 20, duration: 800, easing: quintOut }}>
		<div class="summary-info">
			<span class="summary-label">Grand Total</span>
			<span class="summary-value">{formatCurrency(grandTotal)}</span>
		</div>
		<button onclick={handleSave} class="save-btn" disabled={items.length === 0}>
			Save Order
		</button>
	</footer>
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: 'Inter', -apple-system, system-ui, sans-serif;
		background: #f0f4f8;
		color: #1a202c;
		-webkit-font-smoothing: antialiased;
	}

	.container {
		max-width: 900px;
		margin: 0 auto;
		padding: 1.5rem;
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.header {
		margin-bottom: 0.5rem;
	}

	.header-content {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 0.5rem;
	}

	.back-link {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		text-decoration: none;
		color: #64748b;
		font-size: 0.9rem;
		font-weight: 500;
		transition: color 0.2s;
	}

	.back-link:hover {
		color: #1a202c;
	}

	h1 {
		font-size: 1.75rem;
		font-weight: 800;
		color: #0f172a;
		margin: 0;
		letter-spacing: -0.025em;
	}

	.subtitle {
		color: #64748b;
		margin: 0;
		font-size: 0.95rem;
	}

	.main-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	/* Table Styles */
	.table-container {
		background: rgba(255, 255, 255, 0.7);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-radius: 16px;
		border: 1px solid rgba(255, 255, 255, 0.3);
		box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 
					0 8px 10px -6px rgba(0, 0, 0, 0.05);
		overflow: hidden;
	}

	.order-table {
		width: 100%;
		border-collapse: collapse;
		text-align: left;
	}

	.order-table th {
		padding: 1rem;
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #64748b;
		background: rgba(248, 250, 252, 0.5);
		border-bottom: 1px solid #e2e8f0;
	}

	.order-table td {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #f1f5f9;
		vertical-align: middle;
	}

	.order-table tr:last-child td {
		border-bottom: none;
	}

	.input-field {
		width: 100%;
		padding: 0.6rem 0.75rem;
		border-radius: 8px;
		border: 1px solid #e2e8f0;
		background: #fff;
		font-size: 0.95rem;
		transition: all 0.2s;
		color: #1e293b;
		box-sizing: border-box;
	}

	.input-field:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.qty-input {
		width: 80px;
	}

	.price-input-wrapper {
		position: relative;
		display: flex;
		align-items: center;
	}

	.currency-symbol {
		position: absolute;
		left: 0.75rem;
		color: #94a3b8;
		pointer-events: none;
		font-size: 0.9rem;
	}

	.price-input {
		padding-left: 1.75rem;
		width: 120px;
	}

	.row-total {
		font-weight: 600;
		color: #0f172a;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.actions-cell {
		text-align: center;
		width: 50px;
	}

	/* Card View (Mobile) */
	.card-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.order-card {
		background: rgba(255, 255, 255, 0.7);
		backdrop-filter: blur(12px);
		border-radius: 16px;
		border: 1px solid rgba(255, 255, 255, 0.3);
		padding: 1rem;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.card-header {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.name-input {
		font-weight: 600;
		font-size: 1.05rem;
	}

	.card-body {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	.input-group {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.input-group label {
		font-size: 0.7rem;
		font-weight: 700;
		color: #64748b;
		text-transform: uppercase;
	}

	.card-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-top: 0.75rem;
		border-top: 1px solid #f1f5f9;
		font-size: 0.9rem;
		color: #64748b;
	}

	.item-total {
		font-weight: 700;
		color: #0f172a;
		font-size: 1.1rem;
	}

	/* Buttons */
	.add-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		background: #fff;
		border: 1px dashed #cbd5e1;
		color: #64748b;
		padding: 1rem;
		border-radius: 12px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.add-btn:hover {
		border-color: #3b82f6;
		color: #3b82f6;
		background: rgba(59, 130, 246, 0.05);
	}

	.delete-btn {
		background: none;
		border: none;
		color: #94a3b8;
		cursor: pointer;
		padding: 0.5rem;
		border-radius: 8px;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.delete-btn:hover {
		color: #ef4444;
		background: #fef2f2;
	}

	/* Footer Summary */
	.summary-footer {
		background: #0f172a;
		border-radius: 20px;
		padding: 1.5rem;
		color: #fff;
		display: flex;
		justify-content: space-between;
		align-items: center;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
		margin-top: auto;
		position: sticky;
		bottom: 1.5rem;
		z-index: 10;
	}

	.summary-info {
		display: flex;
		flex-direction: column;
	}

	.summary-label {
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #94a3b8;
		font-weight: 600;
	}

	.summary-value {
		font-size: 1.75rem;
		font-weight: 800;
		letter-spacing: -0.025em;
	}

	.save-btn {
		background: #3b82f6;
		color: #fff;
		border: none;
		padding: 0.75rem 1.5rem;
		border-radius: 12px;
		font-weight: 700;
		font-size: 1rem;
		cursor: pointer;
		transition: all 0.2s;
		box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);
	}

	.save-btn:hover:not(:disabled) {
		background: #2563eb;
		transform: translateY(-2px);
		box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.4);
	}

	.save-btn:active:not(:disabled) {
		transform: translateY(0);
	}

	.save-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		filter: grayscale(1);
	}

	/* Responsive Visibility */
	@media (max-width: 639px) {
		.desktop-only {
			display: none;
		}
		
		.container {
			padding: 1rem;
		}

		.summary-footer {
			flex-direction: column;
			gap: 1rem;
			text-align: center;
			bottom: 1rem;
			padding: 1.25rem;
		}

		.save-btn {
			width: 100%;
		}

		.summary-value {
			font-size: 1.5rem;
		}
	}

	@media (min-width: 640px) {
		.mobile-only {
			display: none;
		}
	}
</style>

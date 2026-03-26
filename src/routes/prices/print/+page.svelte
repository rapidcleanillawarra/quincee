<script>
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';

	let tableCount = $state(10);
	let showModal = $state(false);
	let isLoading = $state(true);

	let templateItems = $state([]);

	let modalItems = $state([]);

	function formatPriceFromBuy(buyPrice) {
		const buy = Number(buyPrice) || 0;
		const sell = buy > 0 ? buy + 15 : 0;
		if (sell <= 0) return '—';
		return `₱${Number(sell).toLocaleString('en-PH')} per kilo`;
	}

	function latestPriceRecord(priceRows) {
		const list = priceRows || [];
		return [...list].sort((a, b) => {
			const ta = new Date(a.effective_from || a.created_at || 0).getTime();
			const tb = new Date(b.effective_from || b.created_at || 0).getTime();
			return tb - ta;
		})[0];
	}

	async function fetchProducts() {
		isLoading = true;
		try {
			const { data: productsData, error } = await supabase
				.from('quincees_products')
				.select(`
					id,
					name,
					quincees_prices(buy_price, display_on_print, effective_from, created_at)
				`)
				.order('name');

			if (error) throw error;

			templateItems = (productsData || []).flatMap((p) => {
				const latest = latestPriceRecord(p.quincees_prices);
				if (latest?.display_on_print === false) return [];
				const buy = latest?.buy_price ?? 0;
				return [
					{
						id: p.id,
						name: p.name,
						price: formatPriceFromBuy(buy)
					}
				];
			});
		} catch (e) {
			console.error('Error loading products for prices:', e);
			templateItems = [];
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		fetchProducts();
	});

	function openModal() {
		modalItems = templateItems.map(item => ({ ...item }));
		showModal = true;
	}

	function closeModal() {
		showModal = false;
	}

	function handleKeydown(e) {
		if (e.key === 'Escape' && showModal) {
			closeModal();
		}
	}

	function savePrices() {
		templateItems = modalItems.map(item => ({ ...item }));
		closeModal();
	}

	function handlePrint() {
		window.print();
	}

	let tiles = $derived(Array.from({ length: Math.max(1, tableCount) }));
</script>

<div class="print-options">
	<label for="table-count">Tables to print:</label>
	<input 
		type="number" 
		id="table-count" 
		min="1" 
		bind:value={tableCount} 
		aria-label="Number of tables to print"
	>
	<button type="button" class="edit-prices-btn" onclick={openModal}>Edit prices</button>
	<button type="button" class="print-btn" onclick={handlePrint}>Print</button>
</div>

{#if showModal}
	<div 
		class="modal-overlay" 
		role="button"
		tabindex="-1"
		onclick={(e) => e.target === e.currentTarget && closeModal()}
		onkeydown={handleKeydown}
	>
		<div class="modal">
			<div class="modal-header">
				<h2>Edit prices (per kilo)</h2>
				<button type="button" class="modal-close" onclick={closeModal} aria-label="Close">&times;</button>
			</div>
			<div class="modal-body">
				{#each modalItems as item, i (item.id)}
					<div class="price-row">
						<label for="price-{i}">{item.name}</label>
						<input type="text" id="price-{i}" bind:value={item.price}>
					</div>
				{/each}
			</div>
			<div class="modal-footer">
				<button type="button" class="modal-cancel" onclick={closeModal}>Cancel</button>
				<button type="button" class="modal-save" onclick={savePrices}>Save</button>
			</div>
		</div>
	</div>
{/if}

<div class="page" class:print-multi-page={tableCount > 4}>
	<div class="print-sheet">
		<div 
			class="tables-grid" 
			style:grid-template-rows={tableCount <= 4 ? `repeat(${Math.ceil(tableCount / 2)}, 1fr)` : ''}
		>
			{#each tiles as _, i (i)}
				<div class="tile">
					<header class="header">
						<img class="logo" src="/logo.png" alt="Quincee's logo">
						<h1>Quincee's - 09456895039 Globe</h1>
					</header>
					<div class="card">
						<table>
							<thead>
								<tr>
									<th>utan</th>
									<th>presyo</th>
								</tr>
							</thead>
							<tbody>
								{#if isLoading}
									<tr>
										<td colspan="2">Loading…</td>
									</tr>
								{:else if templateItems.length === 0}
									<tr>
										<td colspan="2">No products yet.</td>
									</tr>
								{:else}
									{#each templateItems as item (item.id)}
										<tr>
											<td>{item.name}</td>
											<td>{item.price}</td>
										</tr>
									{/each}
								{/if}
							</tbody>
						</table>
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.page {
		max-width: 210mm;
	}

	.print-sheet {
		display: contents;
	}

	.header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.5rem;
		padding: 0.5rem 0;
		border-bottom: 1px solid #ccc;
	}

	.header .logo {
		width: 40px;
		height: 40px;
		object-fit: contain;
		flex-shrink: 0;
	}

	h1 {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 600;
		color: #222;
	}

	.tables-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	.tile {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.tile .header {
		margin-bottom: 0;
	}

	.card {
		background: #fff;
		border: 1px solid #ccc;
		overflow: hidden;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th,
	td {
		padding: 0.5rem 0.75rem;
		text-align: left;
		border: 1px solid #ddd;
		font-size: 0.95rem;
	}

	thead th {
		background: #e0e0e0;
		font-weight: 600;
	}

	thead th:last-child {
		text-align: right;
	}

	tbody td:last-child {
		text-align: right;
		font-weight: 500;
	}

	tbody tr:nth-child(even) {
		background: #f9f9f9;
	}

	.print-options {
		margin-bottom: 1rem;
		padding: 0.75rem;
		background: #fff;
		border: 1px solid #ccc;
		border-radius: 4px;
	}

	.print-options label {
		margin-right: 0.5rem;
		font-weight: 500;
	}

	.print-options input {
		width: 5rem;
		padding: 0.35rem 0.5rem;
		font-size: 1rem;
		border: 1px solid #ccc;
		border-radius: 4px;
	}

	.edit-prices-btn {
		margin-left: 0.75rem;
		padding: 0.4rem 0.75rem;
		font-size: 0.95rem;
		font-weight: 500;
		color: #222;
		background: #e8e8e8;
		border: 1px solid #bbb;
		border-radius: 4px;
		cursor: pointer;
	}

	.edit-prices-btn:hover {
		background: #ddd;
	}

	.print-btn {
		margin-left: 0.5rem;
		padding: 0.4rem 0.75rem;
		font-size: 0.95rem;
		font-weight: 500;
		color: #222;
		background: #e8e8e8;
		border: 1px solid #bbb;
		border-radius: 4px;
		cursor: pointer;
	}

	.print-btn:hover {
		background: #ddd;
	}

	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 1rem;
	}

	.modal {
		background: #fff;
		border-radius: 8px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
		max-width: 360px;
		width: 100%;
		max-height: 90vh;
		overflow: auto;
	}

	.modal-header {
		padding: 1rem 1.25rem;
		border-bottom: 1px solid #ddd;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 600;
	}

	.modal-close {
		background: none;
		border: none;
		font-size: 1.5rem;
		line-height: 1;
		cursor: pointer;
		color: #666;
		padding: 0 0.25rem;
	}

	.modal-close:hover {
		color: #222;
	}

	.modal-body {
		padding: 1rem 1.25rem;
	}

	.modal-body .price-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.modal-body .price-row label {
		flex: 0 0 100px;
		font-weight: 500;
		margin: 0;
	}

	.modal-body .price-row input {
		flex: 1;
		padding: 0.4rem 0.5rem;
		font-size: 1rem;
		border: 1px solid #ccc;
		border-radius: 4px;
	}

	.modal-footer {
		padding: 0.75rem 1.25rem;
		border-top: 1px solid #ddd;
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.modal-footer button {
		padding: 0.4rem 1rem;
		font-size: 0.95rem;
		font-weight: 500;
		border-radius: 4px;
		cursor: pointer;
	}

	.modal-save {
		background: #333;
		color: #fff;
		border: none;
	}

	.modal-save:hover {
		background: #222;
	}

	.modal-cancel {
		background: #f0f0f0;
		color: #222;
		border: 1px solid #ccc;
	}

	.modal-cancel:hover {
		background: #e0e0e0;
	}

	@media print {
		@page {
			size: A4;
			margin: 10mm;
		}

		:global(html), :global(body) {
			background: #fff;
			margin: 0;
			padding: 0;
			font-size: 10pt;
			height: 297mm;
			width: 210mm;
			overflow: hidden !important;
		}

		.page {
			padding: 0;
			width: 210mm;
			height: 297mm;
			margin: 0;
			position: relative;
			overflow: hidden;
		}

		.print-sheet {
			display: block;
			position: absolute;
			top: 10mm;
			left: 10mm;
			width: 190mm;
			height: 277mm;
			overflow: hidden;
		}

		.tables-grid {
			display: grid;
			grid-template-columns: 1fr 1fr;
			grid-template-rows: 1fr 1fr;
			gap: 4mm;
			width: 190mm;
			height: auto;
			min-height: 0;
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}

		.tile {
			min-height: 0;
			min-width: 0;
			overflow: hidden;
			display: flex;
			flex-direction: column;
			gap: 1mm;
			break-inside: avoid;
			page-break-inside: avoid;
		}

		.tile .card {
			flex: 1;
			min-height: 0;
			overflow: hidden;
			break-inside: avoid;
			page-break-inside: avoid;
		}

		table tbody tr {
			break-inside: avoid;
			page-break-inside: avoid;
		}

		thead {
			display: table-header-group;
		}

		tbody {
			display: table-row-group;
		}

		.tile .header {
			padding: 1mm 2mm;
			border-bottom: 1px solid #000;
			flex-shrink: 0;
		}

		.header .logo {
			width: 24px;
			height: 24px;
		}

		h1 {
			font-size: 7pt;
		}

		.card {
			border: 1px solid #000;
			box-shadow: none;
		}

		table {
			width: 100%;
			table-layout: fixed;
			font-size: 7pt;
		}

		th,
		td {
			padding: 1.5mm 2mm;
			border: 1px solid #333;
			font-size: 7pt;
			line-height: 1.2;
		}

		thead th {
			background: #e0e0e0 !important;
			color: #000 !important;
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
		}

		tbody tr:nth-child(even) {
			background: #f5f5f5 !important;
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
		}

		tbody td:last-child {
			color: #000;
		}

		.print-options {
			display: none !important;
		}

		.edit-prices-btn,
		.print-btn,
		.modal-overlay {
			display: none !important;
		}

		.print-multi-page :global(html),
		.print-multi-page :global(body) {
			height: auto !important;
			overflow: visible !important;
		}

		.print-multi-page .print-sheet {
			position: static;
			width: 190mm;
			max-width: 190mm;
			height: auto;
			overflow: visible;
			margin: 0 auto;
		}

		.print-multi-page .tables-grid {
			grid-template-rows: none !important;
			grid-auto-rows: auto;
		}
	}
</style>

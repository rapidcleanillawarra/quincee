<script>
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { fly, fade } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { formatDate } from '../orders/utils/format';

	let suppliers = $state([]);
	let isLoading = $state(true);
	let searchQuery = $state('');
	let isModalOpen = $state(false);
	let isSaving = $state(false);
	let editingSupplier = $state(null);

	// Form state
	let formData = $state({
		name: '',
		contact_person: '',
		email: '',
		phone: '',
		address: ''
	});

	let filteredSuppliers = $derived(
		suppliers.filter(s => 
			s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			(s.contact_person && s.contact_person.toLowerCase().includes(searchQuery.toLowerCase())) ||
			(s.email && s.email.toLowerCase().includes(searchQuery.toLowerCase()))
		)
	);

	async function fetchSuppliers() {
		isLoading = true;
		try {
			const { data, error } = await supabase
				.from('quincees_suppliers')
				.select('*')
				.order('name', { ascending: true });

			if (error) throw error;
			suppliers = data || [];
		} catch (error) {
			console.error('Error fetching suppliers:', error);
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		fetchSuppliers();
	});

	function openAddModal() {
		editingSupplier = null;
		formData = {
			name: '',
			contact_person: '',
			email: '',
			phone: '',
			address: ''
		};
		isModalOpen = true;
	}

	function openEditModal(supplier) {
		editingSupplier = supplier;
		formData = { ...supplier };
		isModalOpen = true;
	}

	async function handleSave() {
		if (!formData.name) {
			alert('Supplier name is required');
			return;
		}

		isSaving = true;
		try {
			if (editingSupplier) {
				const { error } = await supabase
					.from('quincees_suppliers')
					.update({
						...formData,
						updated_at: new Date().toISOString()
					})
					.eq('id', editingSupplier.id);

				if (error) throw error;
			} else {
				const { error } = await supabase
					.from('quincees_suppliers')
					.insert([formData]);

				if (error) throw error;
			}

			await fetchSuppliers();
			isModalOpen = false;
		} catch (error) {
			console.error('Error saving supplier:', error);
			alert('Failed to save supplier: ' + error.message);
		} finally {
			isSaving = false;
		}
	}

	async function handleDelete(id) {
		if (!confirm('Are you sure you want to delete this supplier?')) {
			return;
		}

		try {
			const { error } = await supabase
				.from('quincees_suppliers')
				.delete()
				.eq('id', id);

			if (error) throw error;
			suppliers = suppliers.filter(s => s.id !== id);
		} catch (error) {
			console.error('Error deleting supplier:', error);
			alert('Failed to delete supplier: ' + error.message);
		}
	}
</script>

<svelte:head>
	<title>Suppliers | Quincee's</title>
</svelte:head>

<div class="container">
	<header class="header" in:fly={{ y: -20, duration: 800, easing: quintOut }}>
		<div class="header-left">
			<h1>Suppliers</h1>
			<p class="subtitle">Manage your product sources and contact info</p>
		</div>
		<button onclick={openAddModal} class="add-btn">
			<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
				<line x1="12" y1="5" x2="12" y2="19" />
				<line x1="5" y1="12" x2="19" y2="12" />
			</svg>
			Add Supplier
		</button>
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
					placeholder="Search suppliers..." 
					bind:value={searchQuery}
					class="search-input"
				/>
			</div>
		</div>

		{#if isLoading}
			<div class="loading-state">
				<div class="spinner"></div>
				<p>Fetching suppliers...</p>
			</div>
		{:else if filteredSuppliers.length === 0}
			<div class="empty-state">
				<div class="empty-icon">🏢</div>
				<h3>No suppliers found</h3>
				<p>{searchQuery ? 'Try matching another name or contact.' : 'Get started by adding your first supplier!'}</p>
				{#if !searchQuery}
					<button onclick={openAddModal} class="btn-primary">Add Your First Supplier</button>
				{/if}
			</div>
		{:else}
			<div class="table-container" in:fly={{ y: 20, duration: 800, delay: 200, easing: quintOut }}>
				<table class="suppliers-table">
					<thead>
						<tr>
							<th>Company Name</th>
							<th>Contact Person</th>
							<th>Email/Phone</th>
							<th>Address</th>
							<th class="text-right">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each filteredSuppliers as supplier (supplier.id)}
							<tr>
								<td class="name-cell" data-label="Company Name">
									<div class="supplier-name">{supplier.name}</div>
									<div class="last-updated">Updated {formatDate(supplier.updated_at)}</div>
								</td>
								<td data-label="Contact Person">{supplier.contact_person || '—'}</td>
								<td data-label="Email/Phone">
									<div class="contact-info">
										{#if supplier.email}
											<span class="email">{supplier.email}</span>
										{/if}
										{#if supplier.phone}
											<span class="phone">{supplier.phone}</span>
										{/if}
										{#if !supplier.email && !supplier.phone}
											<span>—</span>
										{/if}
									</div>
								</td>
								<td data-label="Address" class="address-cell">{supplier.address || '—'}</td>
								<td class="text-right actions-cell" data-label="Actions">
									<button onclick={() => openEditModal(supplier)} class="edit-btn" aria-label="Edit supplier">
										<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
											<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
											<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
										</svg>
									</button>
									<button onclick={() => handleDelete(supplier.id)} class="delete-btn" aria-label="Delete supplier">
										<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
											<polyline points="3 6 5 6 21 6"></polyline>
											<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
										</svg>
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
				<h2>{editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}</h2>
				<button class="close-btn" onclick={() => (isModalOpen = false)}>&times;</button>
			</header>
			
			<div class="modal-body">
				<div class="form-group">
					<label for="name">Company Name *</label>
					<input id="name" type="text" bind:value={formData.name} placeholder="e.g. Acme Supplies Ltd" />
				</div>
				
				<div class="form-row">
					<div class="form-group">
						<label for="contact_person">Contact Person</label>
						<input id="contact_person" type="text" bind:value={formData.contact_person} placeholder="John Doe" />
					</div>
					<div class="form-group">
						<label for="phone">Phone Number</label>
						<input id="phone" type="tel" bind:value={formData.phone} placeholder="+61 ..." />
					</div>
				</div>

				<div class="form-group">
					<label for="email">Email Address</label>
					<input id="email" type="email" bind:value={formData.email} placeholder="supplier@example.com" />
				</div>

				<div class="form-group">
					<label for="address">Postal Address</label>
					<textarea id="address" bind:value={formData.address} placeholder="123 Street, City, State" rows="3"></textarea>
				</div>
			</div>

			<footer class="modal-footer">
				<button class="btn-secondary" onclick={() => (isModalOpen = false)}>Cancel</button>
				<button class="btn-primary" onclick={handleSave} disabled={isSaving}>
					{isSaving ? 'Saving...' : editingSupplier ? 'Update Supplier' : 'Save Supplier'}
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

	.add-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: #3b82f6;
		color: white;
		padding: 0.75rem 1.25rem;
		border-radius: 12px;
		font-weight: 600;
		border: none;
		cursor: pointer;
		transition: all 0.2s;
		box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.2);
	}

	.add-btn:hover {
		background: #2563eb;
		transform: translateY(-1px);
		box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.3);
	}

	.controls-row {
		margin-bottom: 1rem;
	}

	.search-wrapper {
		position: relative;
		display: flex;
		align-items: center;
		max-width: 400px;
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

	.suppliers-table {
		width: 100%;
		border-collapse: collapse;
		text-align: left;
	}

	.suppliers-table th {
		padding: 1.25rem 1.5rem;
		background: #f8fafc;
		font-size: 0.75rem;
		font-weight: 700;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		border-bottom: 1px solid #e2e8f0;
	}

	.suppliers-table td {
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid #f1f5f9;
		color: #334155;
		font-size: 0.95rem;
		vertical-align: middle;
	}

	.suppliers-table tr:hover {
		background: #f8fafc;
	}

	.supplier-name {
		font-weight: 700;
		color: #0f172a;
		font-size: 1.05rem;
	}

	.last-updated {
		font-size: 0.75rem;
		color: #94a3b8;
		margin-top: 0.25rem;
	}

	.contact-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.email {
		font-weight: 500;
		color: #3b82f6;
	}

	.phone {
		color: #64748b;
		font-size: 0.85rem;
	}

	.address-cell {
		max-width: 250px;
	}

	.actions-cell {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.edit-btn, .delete-btn {
		padding: 0.5rem;
		border-radius: 8px;
		border: 1px solid #e2e8f0;
		background: white;
		cursor: pointer;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.edit-btn {
		color: #3b82f6;
	}

	.edit-btn:hover {
		background: #eff6ff;
		border-color: #3b82f6;
	}

	.delete-btn {
		color: #ef4444;
	}

	.delete-btn:hover {
		background: #fef2f2;
		border-color: #ef4444;
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
		max-width: 550px;
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
		gap: 1.25rem;
	}

	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.25rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.form-group label {
		font-size: 0.875rem;
		font-weight: 600;
		color: #475569;
	}

	.form-group input, .form-group textarea {
		padding: 0.75rem 1rem;
		border: 1px solid #e2e8f0;
		border-radius: 10px;
		font-size: 0.95rem;
		transition: all 0.2s;
	}

	.form-group input:focus, .form-group textarea:focus {
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
		.add-btn { width: 100%; justify-content: center; }
		.form-row { grid-template-columns: 1fr; }
		
		.suppliers-table thead { display: none; }
		.suppliers-table td {
			display: block;
			padding: 0.75rem 1.5rem;
			border: none;
		}
		.suppliers-table td:first-child { padding-top: 1.5rem; }
		.suppliers-table td:last-child {
			padding-bottom: 1.5rem;
			border-bottom: 1px solid #f1f5f9;
		}
		.suppliers-table td::before {
			content: attr(data-label);
			display: block;
			font-size: 0.7rem;
			font-weight: 700;
			text-transform: uppercase;
			color: #94a3b8;
			margin-bottom: 0.25rem;
		}
		.actions-cell { justify-content: flex-start; margin-top: 0.5rem; }
	}
</style>

<script>
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import '../app.css';

	let { children } = $props();
	
	let isMobileMenuOpen = $state(false);

	function toggleMenu() {
		isMobileMenuOpen = !isMobileMenuOpen;
	}
	
	// Close menu on navigation
	$effect(() => {
		page.url.pathname;
		isMobileMenuOpen = false;
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
</svelte:head>

<nav class="nav-header">
	<div class="nav-content">
		<a href="/prices" class="nav-brand">
			<img src="/logo.png" alt="Logo" class="nav-logo" />
			<span class="brand-text">Quincee's</span>
		</a>
		
		<button class="mobile-menu-btn" onclick={toggleMenu} aria-label="Toggle menu" aria-expanded={isMobileMenuOpen}>
			{#if isMobileMenuOpen}
				<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
			{:else}
				<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
			{/if}
		</button>

		<div class="nav-links {isMobileMenuOpen ? 'open' : ''}">
			<a href="/prices" class="nav-link" class:active={page.url.pathname === '/prices'}>
				<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-icon"><path d="M12 2v20"></path><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
				Prices
			</a>
			<a href="/orders" class="nav-link" class:active={page.url.pathname.startsWith('/orders')}>
				<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-icon"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
				Orders
			</a>
			<a href="/suppliers" class="nav-link" class:active={page.url.pathname === '/suppliers'}>
				<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-icon"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
				Suppliers
			</a>
			<a href="/purchase-orders" class="nav-link" class:active={page.url.pathname === '/purchase-orders'}>
				<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-icon"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>
				Purchase orders
			</a>
			<a href="/stocks" class="nav-link" class:active={page.url.pathname === '/stocks'}>
				<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-icon"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
				Stocks
			</a>
			<a href="/shopping-list" class="nav-link" class:active={page.url.pathname === '/shopping-list'}>
				<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-icon"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
				Shopping List
			</a>
		</div>
	</div>
</nav>

<!-- Mobile menu overlay -->
<button class="overlay {isMobileMenuOpen ? 'open' : ''}" onclick={toggleMenu} aria-label="Close menu"></button>

<main>
	{@render children()}
</main>

<style>
	:global(body) {
		margin: 0;
		font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		background-color: #f8fafc;
		color: #0f172a;
	}

	.nav-header {
		background: rgba(255, 255, 255, 0.85);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-bottom: 1px solid rgba(226, 232, 240, 0.8);
		position: sticky;
		top: 0;
		z-index: 100;
		padding: 0.75rem 1.5rem;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
	}

	.nav-content {
		max-width: 1200px;
		margin: 0 auto;
		display: flex;
		justify-content: space-between;
		align-items: center;
		position: relative;
	}

	.nav-brand {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		text-decoration: none;
		color: #0f172a;
		font-weight: 800;
		font-size: 1.25rem;
		letter-spacing: -0.025em;
		transition: transform 0.2s ease;
		z-index: 101; /* Stay above dropdown */
	}
	
	.nav-brand:hover {
		transform: translateY(-1px);
	}

	.nav-logo {
		width: 36px;
		height: 36px;
		object-fit: contain;
		filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
	}
	
	.brand-text {
		background: linear-gradient(135deg, #2563eb, #8b5cf6);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.mobile-menu-btn {
		display: none;
		background: none;
		border: none;
		color: #475569;
		cursor: pointer;
		padding: 0.5rem;
		border-radius: 0.5rem;
		transition: all 0.2s;
		z-index: 101; /* Stay above dropdown */
	}
	
	.mobile-menu-btn:hover {
		background: #f1f5f9;
		color: #0f172a;
	}

	.nav-links {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.nav-link {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		text-decoration: none;
		color: #64748b;
		font-size: 0.95rem;
		font-weight: 600;
		padding: 0.5rem 1rem;
		border-radius: 9999px; /* Pill shape */
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		position: relative;
		overflow: hidden;
	}

	.nav-link:hover {
		color: #2563eb;
		background: #eff6ff;
	}

	.nav-link.active {
		color: #fff;
		background: #2563eb;
		box-shadow: 0 4px 14px 0 rgba(37, 99, 235, 0.39);
	}
	
	.nav-icon {
		opacity: 0.7;
		transition: opacity 0.2s;
	}
	
	.nav-link:hover .nav-icon,
	.nav-link.active .nav-icon {
		opacity: 1;
	}
	
	.overlay {
		display: none;
		position: fixed;
		inset: 0;
		background: rgba(15, 23, 42, 0.4);
		backdrop-filter: blur(4px);
		z-index: 90;
		opacity: 0;
		transition: opacity 0.3s ease;
		cursor: default;
		border: none;
		width: 100%;
		height: 100%;
	}

	main {
		min-height: calc(100vh - 72px);
		padding: 2rem 1rem;
		max-width: 1200px;
		margin: 0 auto;
	}

	@media print {
		.nav-header {
			display: none;
		}
		main {
			padding-top: 0;
		}
	}

	/* Mobile styles */
	@media (max-width: 860px) {
		.nav-header {
			padding: 0.75rem 1rem;
		}
		
		.mobile-menu-btn {
			display: flex;
		}
		
		.nav-links {
			position: absolute;
			top: 100%;
			left: 0;
			right: 0;
			background: white;
			flex-direction: column;
			align-items: stretch;
			padding: 0;
			gap: 0.25rem;
			max-height: 0;
			overflow: hidden;
			transition: max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
			opacity: 0;
			border-radius: 0 0 1rem 1rem;
			box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
			margin-top: 0.75rem;
		}
		
		.nav-links.open {
			max-height: 400px; /* Large enough to hold the links */
			opacity: 1;
			padding: 0.5rem 1rem 1rem;
			border-top: 1px solid rgba(226, 232, 240, 1);
		}
		
		.nav-link {
			padding: 0.875rem 1rem;
			border-radius: 0.75rem;
		}
		
		.nav-link.active {
			box-shadow: none;
		}
		
		.overlay.open {
			display: block;
			opacity: 1;
		}
	}
</style>

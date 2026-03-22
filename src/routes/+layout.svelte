<script>
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<nav class="nav-header">
	<div class="nav-content">
		<a href="/prices" class="nav-brand">
			<img src="/logo.png" alt="Logo" class="nav-logo" />
			<span>Quincee's</span>
		</a>
		<div class="nav-links">
			<a href="/prices" class="nav-link" class:active={page.url.pathname === '/prices'}>Prices</a>
			<a href="/new-order" class="nav-link" class:active={page.url.pathname === '/new-order'}>New Order</a>
		</div>
	</div>
</nav>

<main>
	{@render children()}
</main>

<style>
	:global(html), :global(body) {
		margin: 0;
		padding: 0;
		font-family: 'Inter', -apple-system, sans-serif;
	}

	.nav-header {
		background: rgba(255, 255, 255, 0.8);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		border-bottom: 1px solid #e2e8f0;
		position: sticky;
		top: 0;
		z-index: 100;
		padding: 0.75rem 1rem;
	}

	.nav-content {
		max-width: 900px;
		margin: 0 auto;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.nav-brand {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		text-decoration: none;
		color: #0f172a;
		font-weight: 700;
		font-size: 1.1rem;
	}

	.nav-logo {
		width: 32px;
		height: 32px;
		object-fit: contain;
	}

	.nav-links {
		display: flex;
		gap: 1rem;
	}

	.nav-link {
		text-decoration: none;
		color: #64748b;
		font-size: 0.9rem;
		font-weight: 500;
		padding: 0.5rem 0.75rem;
		border-radius: 8px;
		transition: all 0.2s;
	}

	.nav-link:hover {
		background: #f1f5f9;
		color: #0f172a;
	}

	.nav-link.active {
		background: #3b82f6;
		color: #fff;
	}

	main {
		min-height: calc(100vh - 60px);
	}

	@media print {
		.nav-header {
			display: none;
		}
	}
</style>

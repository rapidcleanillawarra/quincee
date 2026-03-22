<script>
    import { onMount } from 'svelte';
    import { supabase } from '$lib/supabase';
    import { fly, fade } from 'svelte/transition';

    let { value = $bindable(), price = $bindable(), placeholder = "Search product..." } = $props();

    let products = $state([]);
    let searchTerm = $state(value || "");
    let showDropdown = $state(false);
    let filteredProducts = $derived(
        products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    let inputElement;

    onMount(async () => {
        const { data, error } = await supabase
            .from('quincees_products')
            .select('id, name, quincees_prices(price)')
            .order('name');
        
        if (data) {
            products = data.map(p => ({
                id: p.id,
                name: p.name,
                price: p.quincees_prices?.[0]?.price || 0
            }));
        }
    });

    function selectProduct(product) {
        searchTerm = product.name;
        value = product.name;
        price = product.price;
        showDropdown = false;
    }

    function handleInput(e) {
        searchTerm = e.target.value;
        value = searchTerm;
        showDropdown = true;
    }

    function handleBlur() {
        // Small delay to allow click on dropdown items
        setTimeout(() => {
            showDropdown = false;
        }, 200);
    }
</script>

<div class="product-search-container">
    <input
        bind:this={inputElement}
        type="text"
        {placeholder}
        value={searchTerm}
        oninput={handleInput}
        onfocus={() => showDropdown = true}
        onblur={handleBlur}
        class="input-field"
    />

    {#if showDropdown && filteredProducts.length > 0}
        <div class="dropdown" transition:fly={{ y: 5, duration: 200 }}>
            <ul>
                {#each filteredProducts as product (product.id)}
                    <li>
                        <button 
                            type="button"
                            onclick={() => selectProduct(product)}
                            onmousedown={(e) => e.preventDefault()}
                        >
                            <span class="product-name">{product.name}</span>
                            <span class="product-price">₱{product.price}</span>
                        </button>
                    </li>
                {/each}
            </ul>
        </div>
    {/if}
</div>

<style>
    .product-search-container {
        position: relative;
        width: 100%;
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

    .dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        margin-top: 0.5rem;
        background: rgba(255, 255, 255, 0.9);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(226, 232, 240, 0.8);
        border-radius: 12px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        max-height: 250px;
        overflow-y: auto;
    }

    ul {
        list-style: none;
        padding: 0.5rem;
        margin: 0;
    }

    li {
        margin-bottom: 2px;
    }

    li:last-child {
        margin-bottom: 0;
    }

    button {
        width: 100%;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem 1rem;
        border: none;
        background: transparent;
        border-radius: 8px;
        cursor: pointer;
        text-align: left;
        transition: all 0.2s;
    }

    button:hover {
        background: rgba(59, 130, 246, 0.1);
        color: #1d4ed8;
    }

    .product-name {
        font-weight: 500;
        font-size: 0.95rem;
    }

    .product-price {
        font-size: 0.85rem;
        color: #64748b;
        font-weight: 600;
        background: #f1f5f9;
        padding: 0.15rem 0.5rem;
        border-radius: 4px;
    }

    button:hover .product-price {
        background: rgba(59, 130, 246, 0.2);
        color: #1d4ed8;
    }

    /* Custom scrollbar */
    .dropdown::-webkit-scrollbar {
        width: 6px;
    }

    .dropdown::-webkit-scrollbar-track {
        background: transparent;
    }

    .dropdown::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 10px;
    }

    .dropdown::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
    }
</style>

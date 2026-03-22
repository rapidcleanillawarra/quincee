<script>
    import { onMount, untrack } from 'svelte';
    import { supabase } from '$lib/supabase';
    import { fly } from 'svelte/transition';

    let { 
        value = $bindable(), 
        customer_id = $bindable(),
        placeholder = "Search or enter customer name..." 
    } = $props();

    let customers = $state([]);
    let searchTerm = $state(value || "");
    let showDropdown = $state(false);
    
    // Keep searchTerm in sync with value prop if it changes from outside
    $effect(() => {
        if (value !== searchTerm) {
            untrack(() => {
                searchTerm = value || "";
            });
        }
    });

    let filteredCustomers = $derived(
        customers.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    let inputElement;

    onMount(async () => {
        const { data, error } = await supabase
            .from('quincees_customers')
            .select('id, name, email')
            .order('name');
        
        if (error) {
            console.error('Error fetching customers:', error);
        }

        if (data) {
            customers = data;
        }
    });

    let isNewCustomer = $derived(
        searchTerm.trim() !== "" && 
        !customers.some(c => c.name.toLowerCase() === searchTerm.toLowerCase())
    );

    function selectCustomer(customer) {
        searchTerm = customer.name;
        value = customer.name;
        customer_id = customer.id;
        showDropdown = false;
    }

    function handleInput(e) {
        searchTerm = e.target.value;
        value = searchTerm;
        // If the user types, they might be entering a new name, so clear customer_id
        // unless it exactly matches a known customer (handled in blur or selection)
        const exactMatch = customers.find(c => c.name.toLowerCase() === searchTerm.toLowerCase());
        if (exactMatch) {
            customer_id = exactMatch.id;
        } else {
            customer_id = null;
        }
        showDropdown = true;
    }

    function handleBlur() {
        setTimeout(() => {
            showDropdown = false;
        }, 200);
    }
</script>

<div class="customer-search-container">
    <div class="input-wrapper" class:is-new={isNewCustomer}>
        <svg class="search-icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
            <path d="M20 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
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
        {#if isNewCustomer}
            <span class="new-badge">New</span>
        {/if}
    </div>

    {#if showDropdown && filteredCustomers.length > 0}
        <div class="dropdown" transition:fly={{ y: 5, duration: 200 }}>
            <ul>
                {#each filteredCustomers as customer (customer.id)}
                    <li>
                        <button 
                            type="button"
                            onclick={() => selectCustomer(customer)}
                            onmousedown={(e) => e.preventDefault()}
                        >
                            <div class="customer-info">
                                <span class="customer-name">{customer.name}</span>
                                {#if customer.email}
                                    <span class="customer-email">{customer.email}</span>
                                {/if}
                            </div>
                        </button>
                    </li>
                {/each}
            </ul>
        </div>
    {/if}
</div>

<style>
    .customer-search-container {
        position: relative;
        width: 100%;
    }

    .input-wrapper {
        position: relative;
        display: flex;
        align-items: center;
        transition: all 0.3s ease;
    }

    .input-wrapper.is-new .input-field {
        border-color: #10b981;
        background: #f0fdf4;
        padding-right: 4rem;
    }

    .new-badge {
        position: absolute;
        right: 0.75rem;
        background: #10b981;
        color: white;
        font-size: 0.7rem;
        font-weight: 800;
        padding: 0.15rem 0.5rem;
        border-radius: 20px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        pointer-events: none;
        box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
    }

    .search-icon {
        position: absolute;
        left: 0.75rem;
        color: #94a3b8;
        pointer-events: none;
    }

    .input-field {
        width: 100%;
        padding: 0.75rem 1rem 0.75rem 2.5rem;
        border-radius: 12px;
        border: 1px solid #e2e8f0;
        background: #fff;
        font-size: 1rem;
        transition: all 0.2s;
        color: #1e293b;
        box-sizing: border-box;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    .input-field:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
    }

    .dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        margin-top: 0.5rem;
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        max-height: 250px;
        overflow-y: auto;
    }

    ul {
        list-style: none;
        padding: 0.5rem;
        margin: 0;
    }

    button {
        width: 100%;
        display: flex;
        flex-direction: column;
        padding: 0.75rem 1rem;
        border: none;
        background: transparent;
        border-radius: 8px;
        cursor: pointer;
        text-align: left;
        transition: all 0.2s;
    }

    button:hover {
        background: #f8fafc;
    }

    .customer-info {
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
    }

    .customer-name {
        font-weight: 600;
        color: #0f172a;
        font-size: 0.95rem;
    }

    .customer-email {
        font-size: 0.8rem;
        color: #64748b;
    }
</style>

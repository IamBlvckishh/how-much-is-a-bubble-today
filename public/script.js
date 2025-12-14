// public/script.js - ADDED LAST POP TIME

/**
 * Helper to format large numbers (Market Cap, Volume) as currency.
 */
const formatCurrency = (numberString) => {
    if (numberString === 'N/A') return 'N/A';
    const num = parseFloat(numberString);
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(num);
};

/**
 * Helper to format the unique holder/supply counts.
 */
const formatCount = (count) => {
    if (isNaN(count)) return 'N/A';
    return count.toLocaleString('en-US');
};


/**
 * Helper to format the price change percentage and apply color class to the element.
 */
const updatePriceChangeDisplay = (elementId, changeString, label) => {
    const changeDisplay = document.getElementById(elementId);
    if (!changeDisplay) return; 

    const changeValue = parseFloat(changeString);
    
    changeDisplay.className = 'price-change-metric';
    
    if (isNaN(changeValue) || changeValue === 0) {
        changeDisplay.textContent = `0.00% (${label})`;
        changeDisplay.classList.add('change-neutral');
        return;
    }
    
    const sign = changeValue > 0 ? '+' : '';
    let colorClass = 'change-neutral';
    
    if (changeValue > 0) { 
        colorClass = 'change-up';
    } else if (changeValue < 0) { 
        colorClass = 'change-down';
    }
    
    changeDisplay.textContent = `${sign}${changeValue.toFixed(2)}% (${label})`;
    changeDisplay.classList.add(colorClass);
};


async function fetchLatestPrice() {
    // Stat Displays
    const usdPriceDisplay = document.getElementById('usd-price');
    const ethPriceDisplay = document.getElementById('eth-price');
    const volume24hDisplay = document.getElementById('volume-24h-display');
    const volumeTotalDisplay = document.getElementById('volume-total-display');
    const marketCapDisplay = document.getElementById('market-cap-display');
    const supplyDisplay = document.getElementById('total-supply-display'); 
    const holdersDisplay = document.getElementById('unique-holders-display'); 
    const poppedDisplay = document.getElementById('popped-bubbles-display'); 
    const lastPopDisplay = document.getElementById('last-pop-display'); // <<< NEW DISPLAY
    const updatedDisplay = document.getElementById('last-updated');

    // 1. Set Loading State
    usdPriceDisplay.textContent = '...';
    ethPriceDisplay.textContent = '...';
    document.getElementById('price-change-24h').textContent = '...';
    volume24hDisplay.textContent = '24H Volume: ...';
    volumeTotalDisplay.textContent = 'Total Volume: ...';
    marketCapDisplay.textContent = 'Market Cap: ...';
    supplyDisplay.textContent = 'Current Supply: ...'; 
    holdersDisplay.textContent = 'Unique Holders: ...'; 
    poppedDisplay.textContent = 'Total Popped: ...'; 
    lastPopDisplay.textContent = 'Last Pop: ...'; // <<< NEW LOADING
    updatedDisplay.textContent = 'Please wait...';

    try {
        const response = await fetch('/api/cron-update', { method: 'GET' });
        
        if (!response.ok) {
            throw new Error('Failed to fetch data from serverless function.');
        }

        const result = await response.json();
        
        if (result.data) {
            const data = result.data;

            // 2. Display: Floor Price
            const formattedUsdPrice = parseFloat(data.usd).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            });
            usdPriceDisplay.textContent = formattedUsdPrice;
            ethPriceDisplay.textContent = `(${data.price} ${data.currency})`;

            // 3. Display: 24h Change
            updatePriceChangeDisplay('price-change-24h', data.price_change_24h, '24h');

            // 4. Display: 24H Volume
            const formattedVolume24h = formatCurrency(data.volume_24h_usd); 
            volume24hDisplay.textContent = 
                `24H Volume: ${data.volume_24h} ${data.currency} (${formattedVolume24h})`;

            // 5. Display: Total Volume
            const formattedVolumeTotal = formatCurrency(data.volume_total_usd); 
            volumeTotalDisplay.textContent = 
                `Total Volume: ${data.volume_total} ${data.currency} (${formattedVolumeTotal})`;
            
            // 6. Display: Market Cap
            const formattedMarketCap = formatCurrency(data.market_cap_usd);
            marketCapDisplay.textContent = 
                `Market Cap: ${data.market_cap_eth} ${data.currency} (${formattedMarketCap})`;
            
            // 7. Display: Supply & Holders
            supplyDisplay.textContent = `Current Supply: ${formatCount(data.supply)}`; 
            holdersDisplay.textContent = `Unique Holders: ${formatCount(data.holders)}`; 
            
            // 8. Display: Popped Bubbles
            poppedDisplay.textContent = `Total Popped: ${formatCount(data.popped)}`; 

            // 9. Display: Last Pop Time
            let popTimeText = 'N/A';
            if (data.last_pop_time && data.last_pop_time !== 'N/A') {
                popTimeText = new Date(data.last_pop_time).toLocaleString();
            }
            lastPopDisplay.textContent = `Last Pop: ${popTimeText}`; // <<< NEW DISPLAY

            // 10. Display: Last Updated Timestamp
            updatedDisplay.textContent = `Last Updated: ${new Date(data.lastUpdated).toLocaleString()}`;
        } else {
             updatedDisplay.textContent = `Data not available.`;
        }

    } catch (error) {
        console.error("Fetch error:", error);
        usdPriceDisplay.textContent = 'ERROR';
        updatedDisplay.textContent = `Error fetching data: ${error.message}`;
    }
}

// Call the function when the page loads
fetchLatestPrice();

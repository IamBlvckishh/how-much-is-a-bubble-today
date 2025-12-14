// public/script.js - UPDATED: Stripped Last Pop & Two-Table Layout

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
    const marketCapDisplay = document.getElementById('market-cap-display');
    const volume24hDisplay = document.getElementById('volume-24h-display');
    const volumeTotalDisplay = document.getElementById('volume-total-display');
    const poppedDisplay = document.getElementById('popped-bubbles-display'); 
    const supplyDisplay = document.getElementById('total-supply-display'); 
    const holdersDisplay = document.getElementById('unique-holders-display'); 
    const updatedDisplay = document.getElementById('last-updated');

    // 1. Set Loading State
    usdPriceDisplay.textContent = '...';
    ethPriceDisplay.textContent = '...';
    document.getElementById('price-change-24h').textContent = '...';
    marketCapDisplay.textContent = '...';
    volume24hDisplay.textContent = '...';
    volumeTotalDisplay.textContent = '...';
    poppedDisplay.textContent = '...';
    supplyDisplay.textContent = '...';
    holdersDisplay.textContent = '...';
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

            // 4. Populate Table 1: Market Data
            const formattedMarketCap = formatCurrency(data.market_cap_usd);
            marketCapDisplay.textContent = 
                `${data.market_cap_eth} ${data.currency} (${formattedMarketCap})`;

            const formattedVolume24h = formatCurrency(data.volume_24h_usd); 
            volume24hDisplay.textContent = 
                `${data.volume_24h} ${data.currency} (${formattedVolume24h})`;

            const formattedVolumeTotal = formatCurrency(data.volume_total_usd); 
            volumeTotalDisplay.textContent = 
                `${data.volume_total} ${data.currency} (${formattedVolumeTotal})`;
            
            // 5. Populate Table 2: Supply Data
            poppedDisplay.textContent = formatCount(data.popped); 
            supplyDisplay.textContent = formatCount(data.supply); 
            holdersDisplay.textContent = formatCount(data.holders); 
            
            // 6. Display: Last Updated Timestamp
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

// public/script.js - FINAL: Optimized for All Advanced Metrics

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
 * @param {string} elementId - The ID of the HTML element to update ('price-change-24h' or 'price-change-7d').
 * @param {string} changeString - The percentage change string from the API.
 * @param {string} label - The label to display (e.g., '24h' or '7d').
 */
const updatePriceChangeDisplay = (elementId, changeString, label) => {
    const changeDisplay = document.getElementById(elementId);
    const changeValue = parseFloat(changeString);
    
    changeDisplay.className = 'price-change-metric';
    
    if (isNaN(changeValue) || changeValue === 0) {
        changeDisplay.textContent = `N/A (${label})`;
        changeDisplay.classList.add('change-neutral');
        return;
    }
    
    const sign = changeValue > 0 ? '+' : '';
    let colorClass = 'change-neutral';
    
    if (changeValue > 0.05) { 
        colorClass = 'change-up';
    } else if (changeValue < -0.05) { 
        colorClass = 'change-down';
    }
    
    changeDisplay.textContent = `${sign}${changeValue.toFixed(2)}% (${label})`;
    changeDisplay.classList.add(colorClass);
};


async function fetchLatestPrice() {
    // Floor Price Displays
    const usdPriceDisplay = document.getElementById('usd-price');
    const ethPriceDisplay = document.getElementById('eth-price');
    const avgPriceDisplay = document.getElementById('avg-price-display'); // <<< NEW AVG PRICE

    // Advanced Stats Displays
    const marketCapDisplay = document.getElementById('market-cap-display').querySelector('.stat-value');
    const volumeDisplay = document.getElementById('total-volume-display').querySelector('.stat-value');
    const supplyDisplay = document.getElementById('total-supply-display').querySelector('.stat-value');
    const holdersDisplay = document.getElementById('unique-holders-display').querySelector('.stat-value');
    const listingRatioDisplay = document.getElementById('listing-ratio-display').querySelector('.stat-value'); // <<< NEW LISTING RATIO
    const mcVolumeRatioDisplay = document.getElementById('mc-volume-ratio-display').querySelector('.stat-value'); // <<< NEW MC/VOL RATIO

    const updatedDisplay = document.getElementById('last-updated');

    // 1. Set Loading State (briefly, as the API is fast)
    usdPriceDisplay.textContent = '...';
    ethPriceDisplay.textContent = '...';
    avgPriceDisplay.textContent = '...';
    document.getElementById('price-change-24h').textContent = '...';
    document.getElementById('price-change-7d').textContent = '...';
    
    marketCapDisplay.textContent = '...';
    volumeDisplay.textContent = '...';
    supplyDisplay.textContent = '...';
    holdersDisplay.textContent = '...';
    listingRatioDisplay.textContent = '...';
    mcVolumeRatioDisplay.textContent = '...';
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

            // 3. Display: Average Price
            const formattedAvgPrice = parseFloat(data.avg_price_usd).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            });
            avgPriceDisplay.textContent = `${formattedAvgPrice} USD (${data.avg_price_24h} ${data.currency})`;


            // 4. Display: 24h & 7d Change
            updatePriceChangeDisplay('price-change-24h', data.price_change_24h, '24h');
            updatePriceChangeDisplay('price-change-7d', data.price_change_7d, '7d'); 

            // 5. Display: Market Cap & Volume
            const formattedMarketCap = formatCurrency(data.market_cap_usd);
            marketCapDisplay.textContent = `${data.market_cap_eth} ${data.currency} (${formattedMarketCap})`;
            
            const formattedVolume = formatCurrency(data.volume_usd); 
            volumeDisplay.textContent = `${data.volume} ${data.currency} (${formattedVolume})`;
            
            // 6. Display: Supply & Holders
            supplyDisplay.textContent = formatCount(data.supply);
            holdersDisplay.textContent = formatCount(data.holders);

            // 7. Display: NEW Calculated Metrics
            listingRatioDisplay.textContent = `${data.listed_count.toLocaleString()} (${data.listing_ratio}%)`;
            mcVolumeRatioDisplay.textContent = data.mc_volume_ratio;
            
            // 8. Display: Last Updated Timestamp
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

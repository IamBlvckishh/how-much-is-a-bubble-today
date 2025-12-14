// public/script.js - FINAL STABLE CORE: Bubble Design & All Metrics

/**
 * Helper to format large numbers (Market Cap, Volume) as compact currency.
 */
const formatCurrency = (numberString) => {
    if (numberString === 'N/A') return 'N/A';
    const num = parseFloat(numberString);
    const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: 'compact',
        compactDisplay: 'short',
        maximumFractionDigits: (num >= 1000000000) ? 1 : 0
    });
    return formatter.format(num);
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
 * @param {string} elementId - The ID of the HTML element to update.
 * @param {string} changeString - The percentage change string from the API.
 * @param {string} label - The label to display (e.g., '24h' or '7d').
 */
const updatePriceChangeDisplay = (elementId, changeString, label) => {
    const changeDisplay = document.getElementById(elementId);
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
    // 1. Get Elements
    // Floor Price Displays
    const usdPriceDisplay = document.getElementById('usd-price');
    const ethPriceDisplay = document.getElementById('eth-price');

    // Advanced Stats Displays (grouped by their new IDs)
    const displays = {
        marketCapUsd: document.getElementById('market-cap-usd-display'),
        marketCapEth: document.getElementById('market-cap-eth-display'),
        volumeUsd: document.getElementById('total-volume-usd-display'),
        volumeEth: document.getElementById('total-volume-eth-display'),
        avgPriceUsd: document.getElementById('avg-price-display'),
        avgPriceEth: document.getElementById('avg-price-eth-display'),
        mcVolumeRatio: document.getElementById('mc-volume-ratio-display'),
        supply: document.getElementById('total-supply-display'),
        holders: document.getElementById('unique-holders-display'),
        listedCount: document.getElementById('listed-count-display'),
        listingRatio: document.getElementById('listing-ratio-display'),
    };
    const updatedDisplay = document.getElementById('last-updated');

    // 2. Set Loading State
    usdPriceDisplay.textContent = '...';
    updatedDisplay.textContent = 'Fetching latest data...';
    // Small loop to quickly set all secondary stats to '...'
    Object.values(displays).forEach(el => el.textContent = '...');

    try {
        const response = await fetch('/api/cron-update', { method: 'GET' });
        
        if (!response.ok) {
            throw new Error('Failed to fetch data from serverless function.');
        }

        const result = await response.json();
        
        if (result.data) {
            const data = result.data;

            // --- PRIMARY METRICS ---
            
            // 2. Floor Price
            const formattedUsdPrice = parseFloat(data.usd).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            });
            usdPriceDisplay.textContent = formattedUsdPrice;
            ethPriceDisplay.textContent = `(${data.price} ${data.currency})`;

            // 3. Price Changes
            updatePriceChangeDisplay('price-change-24h', data.price_change_24h, '24h');
            updatePriceChangeDisplay('price-change-7d', data.price_change_7d, '7d'); 

            // --- SECONDARY METRICS ---

            // 4. Market Cap
            displays.marketCapUsd.textContent = formatCurrency(data.market_cap_usd);
            displays.marketCapEth.textContent = `${data.market_cap_eth} ${data.currency}`;
            
            // 5. Volume
            displays.volumeUsd.textContent = formatCurrency(data.volume_usd); 
            displays.volumeEth.textContent = `${data.volume} ${data.currency}`;
            
            // 6. Average Price
            displays.avgPriceUsd.textContent = formatCurrency(data.avg_price_usd);
            displays.avgPriceEth.textContent = `${data.avg_price_24h} ${data.currency}`;
            
            // 7. Supply & Holders
            displays.supply.textContent = formatCount(data.supply);
            displays.holders.textContent = formatCount(data.holders);

            // 8. Listing Ratio
            displays.listedCount.textContent = `Listed: ${formatCount(data.listed_count)}`;
            displays.listingRatio.textContent = `Ratio: ${data.listing_ratio}%`;

            // 9. MC/Volume Ratio
            displays.mcVolumeRatio.textContent = data.mc_volume_ratio;
            
            // 10. Last Updated Timestamp
            updatedDisplay.textContent = `Last Updated: ${new Date(data.lastUpdated).toLocaleTimeString()} (Data is often delayed by OpenSea)`;
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

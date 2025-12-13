// public/script.js - Optimized for Market Cap, Volume, and 24h Change Display

/**
 * Helper to format large numbers (Market Cap, Volume) as currency (e.g., $1,250,000)
 * @param {string} numberString - The USD value string.
 * @returns {string} Formatted currency string.
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
 * Helper to format the 24h price change and apply color class.
 * @param {string} changeString - The percentage change string from the API.
 */
const updatePriceChangeDisplay = (changeString) => {
    const changeDisplay = document.getElementById('price-change-24h');
    const changeValue = parseFloat(changeString);
    
    // Clear previous classes
    changeDisplay.className = '';
    
    if (isNaN(changeValue)) {
        changeDisplay.textContent = 'N/A';
        changeDisplay.classList.add('change-neutral');
        return;
    }
    
    // Determine the sign and color class
    const sign = changeValue > 0 ? '+' : '';
    let colorClass = 'change-neutral';
    
    if (changeValue > 0.05) { // Threshold for "up"
        colorClass = 'change-up';
    } else if (changeValue < -0.05) { // Threshold for "down"
        colorClass = 'change-down';
    }
    
    changeDisplay.textContent = `${sign}${changeValue.toFixed(2)}% (24h)`;
    changeDisplay.classList.add(colorClass);
};


async function fetchLatestPrice() {
    const usdPriceDisplay = document.getElementById('usd-price');
    const ethPriceDisplay = document.getElementById('eth-price');
    const marketCapDisplay = document.getElementById('market-cap-display');
    const volumeDisplay = document.getElementById('total-volume-display');
    const updatedDisplay = document.getElementById('last-updated');

    // 1. Set Loading State
    usdPriceDisplay.textContent = '...';
    ethPriceDisplay.textContent = '...';
    document.getElementById('price-change-24h').textContent = '...';
    marketCapDisplay.textContent = 'Market Cap: ...';
    volumeDisplay.textContent = 'Total Volume: ...';
    updatedDisplay.textContent = 'Please wait...';

    try {
        const response = await fetch('/api/cron-update', { method: 'GET' });
        
        if (!response.ok) {
            throw new Error('Failed to fetch data from serverless function.');
        }

        const result = await response.json();
        
        if (result.data) {
            const data = result.data;

            // Format USD floor price
            const formattedUsdPrice = parseFloat(data.usd).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            });

            // 2. Display: Floor Price
            usdPriceDisplay.textContent = formattedUsdPrice;
            ethPriceDisplay.textContent = `(${data.price} ${data.currency})`;

            // 3. Display: 24h Change
            updatePriceChangeDisplay(data.price_change_24h);

            // 4. Display: Market Cap
            const formattedMarketCap = formatCurrency(data.market_cap_usd);
            marketCapDisplay.textContent = 
                `Market Cap: ${data.market_cap_eth} ${data.currency} (${formattedMarketCap})`;
            
            // 5. Display: Volume
            const formattedVolume = formatCurrency(data.volume_usd); 
            volumeDisplay.textContent = 
                `Total Volume: ${data.volume} ${data.currency} (${formattedVolume})`;
            
            // 6. Display: Last Updated Timestamp
            updatedDisplay.textContent = `Last Updated: ${new Date(data.lastUpdated).toLocaleString()}`;
        } else {
            usdPriceDisplay.textContent = 'No Data';
            ethPriceDisplay.textContent = 'No Data';
        }

    } catch (error) {
        console.error("Error loading data:", error);
        usdPriceDisplay.textContent = 'ERROR';
        ethPriceDisplay.textContent = '...';
        document.getElementById('price-change-24h').textContent = 'ERROR';
        marketCapDisplay.textContent = 'Market Cap: ERROR';
        volumeDisplay.textContent = 'Total Volume: ERROR';
        updatedDisplay.textContent = 'Error loading data. Try refreshing.';
    }
}

// Call the function when the page loads
fetchLatestPrice();

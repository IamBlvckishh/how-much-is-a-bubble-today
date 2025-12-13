// public/script.js - Optimized for Market Cap and Volume Display

/**
 * Helper to format large numbers (Market Cap, Volume) as currency (e.g., $1,250,000)
 * @param {string} numberString - The USD value string.
 * @returns {string} Formatted currency string.
 */
const formatCurrency = (numberString) => {
    if (numberString === 'N/A') return 'N/A';
    const num = parseFloat(numberString);
    // Format as currency, setting max decimal places to 0 for large numbers
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(num);
};

async function fetchLatestPrice() {
    const usdPriceDisplay = document.getElementById('usd-price');
    const ethPriceDisplay = document.getElementById('eth-price');
    const marketCapDisplay = document.getElementById('market-cap-display');
    const volumeDisplay = document.getElementById('total-volume-display'); // <<< NEW ELEMENT
    const updatedDisplay = document.getElementById('last-updated');

    // 1. Set Loading State
    usdPriceDisplay.textContent = '...';
    ethPriceDisplay.textContent = '...';
    marketCapDisplay.textContent = 'Market Cap: ...';
    volumeDisplay.textContent = 'Total Volume: ...'; // <<< NEW LOADING STATE
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

            // 3. Display: Market Cap
            const formattedMarketCap = formatCurrency(data.market_cap_usd);
            marketCapDisplay.textContent = 
                `Market Cap: ${data.market_cap_eth} ${data.currency} (${formattedMarketCap})`;
            
            // 4. Display: Volume
            const formattedVolume = formatCurrency(data.volume_usd); // <<< VOLUME DISPLAY
            volumeDisplay.textContent = 
                `Total Volume: ${data.volume} ${data.currency} (${formattedVolume})`;
            
            // 5. Display: Last Updated Timestamp
            updatedDisplay.textContent = `Last Updated: ${new Date(data.lastUpdated).toLocaleString()}`;
        } else {
            usdPriceDisplay.textContent = 'No Data';
            ethPriceDisplay.textContent = 'No Data';
            marketCapDisplay.textContent = 'Market Cap: No Data';
            volumeDisplay.textContent = 'Total Volume: No Data';
        }

    } catch (error) {
        console.error("Error loading data:", error);
        usdPriceDisplay.textContent = 'ERROR';
        ethPriceDisplay.textContent = '...';
        marketCapDisplay.textContent = 'Market Cap: ERROR';
        volumeDisplay.textContent = 'Total Volume: ERROR';
        updatedDisplay.textContent = 'Error loading data. Try refreshing.';
    }
}

// Call the function when the page loads
fetchLatestPrice();

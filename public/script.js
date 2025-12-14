// public/script.js - REMOVED UNRELIABLE DYNAMIC HEADER, ADDED CLICKER GAME

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
    if (!changeDisplay) return 0; // Return 0 if element not found

    const changeValue = parseFloat(changeString);
    
    // Reset classes first
    changeDisplay.className = 'price-change-metric';
    
    if (isNaN(changeValue) || changeValue === 0) {
        changeDisplay.textContent = `0.00% (${label})`;
        changeDisplay.classList.add('change-neutral');
        return 0; // Return 0 for neutral status
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

    // Return the numeric change value for use in the Pulse Effect
    return changeValue; 
};

// =========================================================
// MINI-GAME LOGIC (New)
// =========================================================

let userPops = 0;
const popButton = document.getElementById('mini-bubble-btn');
const popCountDisplay = document.getElementById('game-pop-count');

if (popButton) {
    popButton.addEventListener('click', () => {
        // 1. Increment Count
        userPops++;
        popCountDisplay.textContent = userPops;

        // 2. Play Pop Animation (CSS handles the shrink/fade)
        // Optionally, play a sound effect here for maximum fun!
        
        // 3. Optional: Reset button visual state after a tiny delay
        setTimeout(() => {
             // You can add a subtle visual effect or sound here if desired
        }, 100);
    });
}
// =========================================================
// END MINI-GAME LOGIC
// =========================================================


async function fetchLatestPrice() {
    // Get the main bubble element for animation
    const bubbleElement = document.getElementById('price-bubble');
    
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
    const refreshButton = document.querySelector('.refresh-btn');
    const dynamicTitle = document.getElementById('dynamic-title');

    // Reset Title (Since dynamic message is gone, use static beauty title)
    if (dynamicTitle) {
        dynamicTitle.textContent = "how much is a bubble today?";
    }

    // 1. START ANIMATION: Bubble Pop Refresh
    bubbleElement.style.transform = 'scale(0.9)'; // Shrink
    refreshButton.disabled = true;
    updatedDisplay.textContent = 'Refreshing data...';

    // 2. Set Loading State (briefly, while waiting for fetch)
    bubbleElement.style.opacity = '0.5';

    try {
        const response = await fetch('/api/cron-update', { method: 'GET' });
        
        if (!response.ok) {
            throw new Error('Failed to fetch data from serverless function.');
        }

        const result = await response.json();
        
        if (result.data) {
            const data = result.data;

            // 3. Display: Floor Price
            const formattedUsdPrice = parseFloat(data.usd).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            });
            usdPriceDisplay.textContent = formattedUsdPrice;
            ethPriceDisplay.textContent = `(${data.price} ${data.currency})`;

            // 4. Display: 24h Change & Get Value for Pulse (This will likely return 0.00%)
            const changeValue = updatePriceChangeDisplay('price-change-24h', data.price_change_24h, '24h');
            
            // 5. Apply Pulse Effect
            bubbleElement.classList.remove('pulse-up', 'pulse-down', 'pulse-neutral');
            if (changeValue > 0.1) { // Up trend
                bubbleElement.classList.add('pulse-up');
            } else if (changeValue < -0.1) { // Down trend
                bubbleElement.classList.add('pulse-down');
            } else { // Neutral/Flat
                bubbleElement.classList.add('pulse-neutral');
            }
            
            // 6. Populate Table 1: Market Data
            const formattedMarketCap = formatCurrency(data.market_cap_usd);
            marketCapDisplay.textContent = 
                `${data.market_cap_eth} ${data.currency} (${formattedMarketCap})`;

            const formattedVolume24h = formatCurrency(data.volume_24h_usd); 
            volume24hDisplay.textContent = 
                `${data.volume_24h} ${data.currency} (${formattedVolume24h})`;

            const formattedVolumeTotal = formatCurrency(data.volume_total_usd); 
            volumeTotalDisplay.textContent = 
                `${data.volume_total} ${data.currency} (${formattedVolumeTotal})`;
            
            // 7. Populate Table 2: Supply Data
            poppedDisplay.textContent = formatCount(data.popped); 
            supplyDisplay.textContent = formatCount(data.supply); 
            holdersDisplay.textContent = formatCount(data.holders); 
            
            // 8. Display: Last Updated Timestamp
            updatedDisplay.textContent = `Last Updated: ${new Date(data.lastUpdated).toLocaleString()}`;
        } else {
             updatedDisplay.textContent = `Data not available.`;
        }

    } catch (error) {
        console.error("Fetch error:", error);
        usdPriceDisplay.textContent = 'ERROR';
        updatedDisplay.textContent = `Error fetching data: ${error.message}`;
        bubbleElement.classList.add('pulse-down'); 
    } finally {
        // 9. END ANIMATION: Restore and enable button
        bubbleElement.style.transform = 'scale(1)'; 
        bubbleElement.style.opacity = '1';
        refreshButton.disabled = false;
    }
}

// Call the function when the page loads
fetchLatestPrice();

// public/script.js - ROBUST DATA POPULATION TO PREVENT CRASHES

// =========================================================
// STATS HELPER FUNCTIONS
// =========================================================

const formatCurrency = (numberString) => {
    if (numberString === 'N/A') return 'N/A';
    const num = parseFloat(numberString);
    // Use try/catch for formatting just in case the input is extremely malformed
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(num);
    } catch {
        return 'N/A';
    }
};

const formatCount = (count) => {
    if (isNaN(count)) return 'N/A';
    return count.toLocaleString('en-US');
};

const updatePriceChangeDisplay = (elementId, changeString, label) => {
    const changeDisplay = document.getElementById(elementId);
    if (!changeDisplay) return 0;

    // Use try-catch here to ensure changeValue parsing doesn't crash the script
    let changeValue;
    try {
        changeValue = parseFloat(changeString);
    } catch {
        changeValue = 0;
    }
    
    changeDisplay.className = 'price-change-metric';
    
    if (isNaN(changeValue) || changeValue === 0) {
        changeDisplay.textContent = `0.00% (${label})`;
        changeDisplay.classList.add('change-neutral');
        return 0;
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

    return changeValue; 
};


// =========================================================
// ADDICTIVE MINI-GAME LOGIC (No change in functionality)
// =========================================================

const POP_STORAGE_KEY = 'bubblePopCount';
const MILESTONE = 100;
const INITIAL_SIZE = 120;
const SIZE_DECREMENT = 0.5;

let userPops = 0;
const popButton = document.getElementById('mini-bubble-btn');
const popCountDisplay = document.getElementById('game-pop-count');
const milestoneMessage = document.getElementById('milestone-message');


function updateButtonSize() {
    if (!popButton) return;
    
    const newSize = Math.max(60, INITIAL_SIZE - (userPops % MILESTONE) * SIZE_DECREMENT);
    
    popButton.style.width = `${newSize}px`;
    popButton.style.height = `${newSize}px`;
    popButton.textContent = 'POP IT';
}


function resetGame(keepPopping) {
    if (keepPopping) {
        updateButtonSize();
        milestoneMessage.style.display = 'none';
        popButton.disabled = false;
        
    } else {
        userPops = 0;
        localStorage.setItem(POP_STORAGE_KEY, userPops);
        popCountDisplay.textContent = formatCount(userPops);
        
        milestoneMessage.style.display = 'none';
        popButton.disabled = false;
        
        popButton.style.width = `${INITIAL_SIZE}px`;
        popButton.style.height = `${INITIAL_SIZE}px`;
    }
}


function initializeGame() {
    const storedPops = localStorage.getItem(POP_STORAGE_KEY);
    userPops = storedPops ? parseInt(storedPops) : 0;
    popCountDisplay.textContent = formatCount(userPops);
    updateButtonSize();
}


function handlePop() {
    if (popButton.disabled) return;

    userPops++;
    localStorage.setItem(POP_STORAGE_KEY, userPops);
    popCountDisplay.textContent = formatCount(userPops);

    updateButtonSize();
    popButton.classList.add('energy-field');
    setTimeout(() => {
        popButton.classList.remove('energy-field');
    }, 200);

    if (userPops > 0 && userPops % MILESTONE === 0) {
        popButton.disabled = true; 
        showMilestoneMessage();
    }
}


function showMilestoneMessage() {
    milestoneMessage.innerHTML = `
        <p>You hit ${userPops} pops! Do you want to keep poppin'?</p>
        <button id="milestone-yes">YES (Keep Score & Start Over)</button>
        <button id="milestone-no">NO (Stop Here)</button>
    `;
    milestoneMessage.style.display = 'block';

    document.getElementById('milestone-yes').onclick = () => resetGame(true);
    document.getElementById('milestone-no').onclick = () => resetGame(false);
}


if (popButton) {
    popButton.addEventListener('click', handlePop);
    initializeGame();
}
// =========================================================
// END ADDICTIVE MINI-GAME LOGIC
// =========================================================


async function fetchLatestPrice() {
    // Stat Displays (Ensure these IDs match your HTML exactly)
    const bubbleElement = document.getElementById('price-bubble');
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

    // Display 'Loading' state visually
    if (dynamicTitle) dynamicTitle.textContent = "how much is a bubble today?";
    bubbleElement.style.transform = 'scale(0.9)'; 
    refreshButton.disabled = true;
    updatedDisplay.textContent = 'Refreshing data...';
    bubbleElement.style.opacity = '0.5';

    try {
        const response = await fetch('/api/cron-update', { method: 'GET' });
        
        if (!response.ok) {
            throw new Error(`API returned status ${response.status}. Check your serverless function.`);
        }

        const result = await response.json();
        
        if (result.data) {
            const data = result.data;
            
            // --- DATA POPULATION START ---
            
            // 1. USD Price (WORKING)
            const formattedUsdPrice = parseFloat(data.usd || 0).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            });
            usdPriceDisplay.textContent = formattedUsdPrice;
            
            // 2. ETH Price (LIKELY WHERE THE CRASH HAPPENED)
            // Use logical OR (|| 'N/A') to prevent crashing if data properties are missing.
            ethPriceDisplay.textContent = `(${data.price || 'N/A'} ${data.currency || 'ETH'})`;

            // 3. 24H Change
            const changeValue = updatePriceChangeDisplay(
                'price-change-24h', 
                data.price_change_24h || 0, // Default to 0 if null/missing
                '24h'
            );
            
            // 4. Pulse Effect Logic
            bubbleElement.classList.remove('pulse-up', 'pulse-down', 'pulse-neutral');
            if (changeValue > 0.1) {
                bubbleElement.classList.add('pulse-up');
            } else if (changeValue < -0.1) {
                bubbleElement.classList.add('pulse-down');
            } else {
                bubbleElement.classList.add('pulse-neutral');
            }
            
            // 5. Populate Table 1: Market Data
            const formattedMarketCap = formatCurrency(data.market_cap_usd || 0);
            marketCapDisplay.textContent = 
                `${data.market_cap_eth || 'N/A'} ${data.currency || 'ETH'} (${formattedMarketCap})`;

            const formattedVolume24h = formatCurrency(data.volume_24h_usd || 0); 
            volume24hDisplay.textContent = 
                `${data.volume_24h || 'N/A'} ${data.currency || 'ETH'} (${formattedVolume24h})`;

            const formattedVolumeTotal = formatCurrency(data.volume_total_usd || 0); 
            volumeTotalDisplay.textContent = 
                `${data.volume_total || 'N/A'} ${data.currency || 'ETH'} (${formattedVolumeTotal})`;
            
            // 6. Populate Table 2: Supply Data
            poppedDisplay.textContent = formatCount(data.popped); 
            supplyDisplay.textContent = formatCount(data.supply); 
            holdersDisplay.textContent = formatCount(data.holders); 
            
            // 7. Last Updated Timestamp
            updatedDisplay.textContent = `Last Updated: ${new Date(data.lastUpdated).toLocaleString()}`;
            
            // --- DATA POPULATION END ---
            
        } else {
             updatedDisplay.textContent = `Data format error or empty data.`;
        }

    } catch (error) {
        console.error("Fetch error:", error);
        usdPriceDisplay.textContent = 'FETCH ERROR';
        updatedDisplay.textContent = `Critical Fetch Error: ${error.message}`;
        bubbleElement.classList.add('pulse-down'); 
    } finally {
        // Restore elements
        bubbleElement.style.transform = 'scale(1)'; 
        bubbleElement.style.opacity = '1';
        refreshButton.disabled = false;
    }
}

// *** EXPLICITLY CALL THE FETCH FUNCTION ON LOAD ***
fetchLatestPrice();

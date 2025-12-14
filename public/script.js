// public/script.js - FINAL GAME LOGIC WITH RESET AND CUSTOM MESSAGE BOX

// =========================================================
// STATS HELPER FUNCTIONS (No Functional Change)
// =========================================================

const formatCurrency = (numberString) => {
    if (numberString === 'N/A') return 'N/A';
    const num = parseFloat(numberString);
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
// ADDICTIVE MINI-GAME LOGIC
// =========================================================

const POP_STORAGE_KEY = 'bubblePopCount';
const MILESTONE = 100;
const INITIAL_SIZE = 150; // UPDATED to 150px
const MINIMUM_SIZE = 70;
const SIZE_DECREMENT = 0.8; // Increased decrement slightly for the bigger size

let userPops = 0;
const popButton = document.getElementById('mini-bubble-btn');
const popCountDisplay = document.getElementById('game-pop-count');
const milestoneMessage = document.getElementById('milestone-message');
const resetButton = document.getElementById('game-reset-btn');


/**
 * Sets the button size based on pops, clamping at a minimum of MINIMUM_SIZE.
 */
function updateButtonSize() {
    if (!popButton) return;
    
    // Calculate new size based on pops relative to the current milestone loop
    const newSize = Math.max(MINIMUM_SIZE, INITIAL_SIZE - (userPops % MILESTONE) * SIZE_DECREMENT);
    
    popButton.style.width = `${newSize}px`;
    popButton.style.height = `${newSize}px`;
    popButton.textContent = 'POP IT';
}


/**
 * Resets the game or prepares for the next round after a milestone choice.
 * @param {boolean} keepPopping - If true, keeps score and resets size; if false, resets score to 0.
 */
function resetGame(keepPopping) {
    if (keepPopping) {
        // YES: Keep total score, reset size for next round
        updateButtonSize(); // This call uses the remaining pops, which effectively resets the size
        milestoneMessage.style.display = 'none';
        popButton.disabled = false;
        
    } else {
        // NO: Reset everything (score and size)
        userPops = 0;
        localStorage.setItem(POP_STORAGE_KEY, userPops);
        popCountDisplay.textContent = formatCount(userPops);
        
        milestoneMessage.style.display = 'none';
        popButton.disabled = false;
        
        popButton.style.width = `${INITIAL_SIZE}px`;
        popButton.style.height = `${INITIAL_SIZE}px`;
    }
}

/**
 * Handles the manual full game reset via the dedicated button.
 */
function handleFullReset() {
    if (confirm("Are you sure you want to reset your pop count to 0?")) {
        userPops = 0;
        localStorage.setItem(POP_STORAGE_KEY, userPops);
        popCountDisplay.textContent = formatCount(userPops);
        
        milestoneMessage.style.display = 'none';
        popButton.disabled = false;
        popButton.style.width = `${INITIAL_SIZE}px`;
        popButton.style.height = `${INITIAL_SIZE}px`;
        alert("Pop counter reset!");
    }
}


/**
 * Initializes the game state from local storage.
 */
function initializeGame() {
    const storedPops = localStorage.getItem(POP_STORAGE_KEY);
    userPops = storedPops ? parseInt(storedPops) : 0;
    popCountDisplay.textContent = formatCount(userPops);
    updateButtonSize();
}


/**
 * Handles the click event, updating state and providing visual feedback.
 */
function handlePop() {
    if (popButton.disabled) return;

    userPops++;
    localStorage.setItem(POP_STORAGE_KEY, userPops);
    popCountDisplay.textContent = formatCount(userPops);

    // Shrink and Energy Field Animation
    updateButtonSize();
    popButton.classList.add('energy-field');
    setTimeout(() => {
        popButton.classList.remove('energy-field');
    }, 200);

    // Milestone Check
    if (userPops > 0 && userPops % MILESTONE === 0) {
        popButton.disabled = true; 
        showMilestoneMessage();
    }
}


/**
 * Displays the "Keep Poppin?" choice with a customizable message box.
 */
function showMilestoneMessage() {
    // Retrieve custom message from input, or use default
    const customMessage = document.getElementById('milestone-text-input')?.value || `You hit ${userPops} pops! Do you want to keep poppin'?`;

    milestoneMessage.innerHTML = `
        <input type="text" id="milestone-text-input" placeholder="Edit the milestone message here..." value="You hit ${userPops} pops! Do you want to keep poppin'?" style="width: 90%; margin: 5px auto;"/>
        <p>${customMessage}</p>
        <div class="milestone-buttons">
            <button id="milestone-yes">YES (Continue)</button>
            <button id="milestone-no">NO (Stop/Reset)</button>
        </div>
    `;
    milestoneMessage.style.display = 'flex';

    document.getElementById('milestone-yes').onclick = () => resetGame(true);
    document.getElementById('milestone-no').onclick = () => resetGame(false);
}


// Attach Handlers
if (popButton) {
    popButton.addEventListener('click', handlePop);
}
if (resetButton) {
    resetButton.addEventListener('click', handleFullReset);
}
initializeGame(); // Call initialize on page load
// =========================================================
// END ADDICTIVE MINI-GAME LOGIC
// =========================================================


async function fetchLatestPrice() {
    // ... (Your fetch logic remains the same as the previous step)
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
            
            // 1. USD Price (WORKING)
            const formattedUsdPrice = parseFloat(data.usd || 0).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            });
            usdPriceDisplay.textContent = formattedUsdPrice;
            
            // 2. ETH Price 
            ethPriceDisplay.textContent = `(${data.price || 'N/A'} ${data.currency || 'ETH'})`;

            // 3. 24H Change
            const changeValue = updatePriceChangeDisplay(
                'price-change-24h', 
                data.price_change_24h || 0,
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

fetchLatestPrice();

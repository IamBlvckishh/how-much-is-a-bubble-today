// public/script.js - ADDICTIVE GAME LOOP WITH MILESTONE RESET

// =========================================================
// STATS HELPER FUNCTIONS
// =========================================================

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

const formatCount = (count) => {
    if (isNaN(count)) return 'N/A';
    return count.toLocaleString('en-US');
};

const updatePriceChangeDisplay = (elementId, changeString, label) => {
    const changeDisplay = document.getElementById(elementId);
    if (!changeDisplay) return 0;

    const changeValue = parseFloat(changeString);
    
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
const INITIAL_SIZE = 120; // Matches CSS
const SIZE_DECREMENT = 0.5; // Size reduction per click (in pixels)

let userPops = 0;
const popButton = document.getElementById('mini-bubble-btn');
const popCountDisplay = document.getElementById('game-pop-count');
const milestoneMessage = document.getElementById('milestone-message');


/**
 * Sets the button size based on pops, clamping at a minimum of 60px.
 */
function updateButtonSize() {
    if (!popButton) return;
    
    // Calculate new size based on pops
    const newSize = Math.max(60, INITIAL_SIZE - (userPops % MILESTONE) * SIZE_DECREMENT);
    
    popButton.style.width = `${newSize}px`;
    popButton.style.height = `${newSize}px`;
    popButton.textContent = 'POP IT';
}


/**
 * Resets the game or prepares for the next round.
 * @param {boolean} keepPopping - If true, continues; if false, resets total score.
 */
function resetGame(keepPopping) {
    if (keepPopping) {
        // Option YES: Keep the total score, but visually reset the loop
        updateButtonSize(); // Resets size back to INITIAL_SIZE
        milestoneMessage.style.display = 'none';
        popButton.disabled = false;
        
    } else {
        // Option NO: Reset everything
        userPops = Math.floor(userPops / MILESTONE) * MILESTONE; // Reset pops to the last milestone
        localStorage.setItem(POP_STORAGE_KEY, userPops);
        popCountDisplay.textContent = formatCount(userPops);
        
        milestoneMessage.style.display = 'none';
        popButton.disabled = false;
        
        // Final reset logic for the button's appearance
        popButton.style.width = `${INITIAL_SIZE}px`;
        popButton.style.height = `${INITIAL_SIZE}px`;
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

    // 1. Increment Count & Persist
    userPops++;
    localStorage.setItem(POP_STORAGE_KEY, userPops);
    popCountDisplay.textContent = formatCount(userPops);

    // 2. Shrink and Energy Field Animation
    updateButtonSize();
    popButton.classList.add('energy-field');
    setTimeout(() => {
        popButton.classList.remove('energy-field');
    }, 200);

    // 3. Milestone Check
    if (userPops > 0 && userPops % MILESTONE === 0) {
        popButton.disabled = true; // Disable clicking during the choice
        showMilestoneMessage();
    }
}


/**
 * Displays the "Keep Poppin?" choice.
 */
function showMilestoneMessage() {
    milestoneMessage.innerHTML = `
        <p>You hit ${userPops} pops! Do you want to keep poppin'?</p>
        <button id="milestone-yes">YES (Keep Score & Start Over)</button>
        <button id="milestone-no">NO (Stop Here)</button>
    `;
    milestoneMessage.style.display = 'block';

    // Attach event listeners for the choices
    document.getElementById('milestone-yes').onclick = () => resetGame(true);
    document.getElementById('milestone-no').onclick = () => resetGame(false);
}


// Attach the main handler
if (popButton) {
    popButton.addEventListener('click', handlePop);
    initializeGame();
}
// =========================================================
// END ADDICTIVE MINI-GAME LOGIC
// =========================================================


async function fetchLatestPrice() {
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

    if (dynamicTitle) {
        dynamicTitle.textContent = "how much is a bubble today?";
    }

    bubbleElement.style.transform = 'scale(0.9)'; 
    refreshButton.disabled = true;
    updatedDisplay.textContent = 'Refreshing data...';
    bubbleElement.style.opacity = '0.5';

    try {
        const response = await fetch('/api/cron-update', { method: 'GET' });
        
        if (!response.ok) {
            throw new Error('Failed to fetch data from serverless function.');
        }

        const result = await response.json();
        
        if (result.data) {
            const data = result.data;

            // Stats Update (Unchanged)
            const formattedUsdPrice = parseFloat(data.usd).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            });
            usdPriceDisplay.textContent = formattedUsdPrice;
            ethPriceDisplay.textContent = `(${data.price} ${data.currency})`;

            const changeValue = updatePriceChangeDisplay('price-change-24h', data.price_change_24h, '24h');
            
            bubbleElement.classList.remove('pulse-up', 'pulse-down', 'pulse-neutral');
            if (changeValue > 0.1) {
                bubbleElement.classList.add('pulse-up');
            } else if (changeValue < -0.1) {
                bubbleElement.classList.add('pulse-down');
            } else {
                bubbleElement.classList.add('pulse-neutral');
            }
            
            const formattedMarketCap = formatCurrency(data.market_cap_usd);
            marketCapDisplay.textContent = 
                `${data.market_cap_eth} ${data.currency} (${formattedMarketCap})`;
            const formattedVolume24h = formatCurrency(data.volume_24h_usd); 
            volume24hDisplay.textContent = 
                `${data.volume_24h} ${data.currency} (${formattedVolume24h})`;
            const formattedVolumeTotal = formatCurrency(data.volume_total_usd); 
            volumeTotalDisplay.textContent = 
                `${data.volume_total} ${data.currency} (${formattedVolumeTotal})`;
            
            poppedDisplay.textContent = formatCount(data.popped); 
            supplyDisplay.textContent = formatCount(data.supply); 
            holdersDisplay.textContent = formatCount(data.holders); 
            
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
        bubbleElement.style.transform = 'scale(1)'; 
        bubbleElement.style.opacity = '1';
        refreshButton.disabled = false;
    }
}

// Ensure the game is initialized on load
// fetchLatestPrice(); // Already called below

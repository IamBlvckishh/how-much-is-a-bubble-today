// public/script.js - MINI-BILLBOARD ACTIVATED ON MILESTONE

// =========================================================
// STATS HELPER FUNCTIONS (Unchanged)
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
const INITIAL_SIZE = 150;
const MINIMUM_SIZE = 70;
const SIZE_DECREMENT = 0.8;

let userPops = 0;

const popButton = document.getElementById('mini-bubble-btn');
const popCountDisplay = document.getElementById('game-pop-count');
const milestoneMessageDiv = document.getElementById('milestone-message');
const resetButton = document.getElementById('game-reset-btn');

// NEW/REASSIGNED ELEMENTS for the popup
const billboardButton = document.getElementById('copy-billboard-btn');
const billboardMessage = document.getElementById('billboard-message');
const copyStatus = document.getElementById('copy-status');


function updateButtonSize() {
    if (!popButton) return;
    
    const newSize = Math.max(MINIMUM_SIZE, INITIAL_SIZE - (userPops % MILESTONE) * SIZE_DECREMENT);
    
    popButton.style.width = `${newSize}px`;
    popButton.style.height = `${newSize}px`;
    popButton.textContent = 'POP IT';
}


function resetGame(keepPopping) {
    if (keepPopping) {
        updateButtonSize();
        milestoneMessageDiv.style.display = 'none';
        popButton.disabled = false;
        
    } else {
        userPops = 0;
        localStorage.setItem(POP_STORAGE_KEY, userPops);
        popCountDisplay.textContent = formatCount(userPops);
        
        milestoneMessageDiv.style.display = 'none';
        popButton.disabled = false;
        
        popButton.style.width = `${INITIAL_SIZE}px`;
        popButton.style.height = `${INITIAL_SIZE}px`;
    }
}

function handleFullReset() {
    if (confirm("Are you sure you want to reset your pop count to 0?")) {
        userPops = 0;
        localStorage.setItem(POP_STORAGE_KEY, userPops);
        popCountDisplay.textContent = formatCount(userPops);
        
        milestoneMessageDiv.style.display = 'none';
        popButton.disabled = false;
        popButton.style.width = `${INITIAL_SIZE}px`;
        popButton.style.height = `${INITIAL_SIZE}px`;
        alert("Pop counter reset!");
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


/**
 * Displays the Mini-Billboard pop-up on milestone.
 */
function showMilestoneMessage() {
    milestoneMessageDiv.style.display = 'flex';

    // Ensure click handlers are attached to the buttons within the popup
    document.getElementById('milestone-yes').onclick = () => resetGame(true);
    document.getElementById('milestone-no').onclick = () => resetGame(false);
}


// =========================================================
// BILLBOARD COPY LOGIC
// =========================================================

/**
 * Copies the billboard message to the user's clipboard.
 */
async function copyBillboardMessage() {
    if (!billboardMessage || !copyStatus) return;

    const messageText = billboardMessage.textContent.trim();

    try {
        await navigator.clipboard.writeText(messageText);
        copyStatus.textContent = 'Copied!';
    } catch (err) {
        console.error('Could not copy text: ', err);
        copyStatus.textContent = 'Copy failed.';
    }

    // Clear the status message after a short delay
    setTimeout(() => {
        copyStatus.textContent = '';
    }, 2000);
}

// --- ATTACH HANDLERS ---
if (popButton) {
    popButton.addEventListener('click', handlePop);
}
if (resetButton) {
    resetButton.addEventListener('click', handleFullReset);
}
// Attach the copy handler to the billboard button inside the milestone div
if (billboardButton) {
    billboardButton.addEventListener('click', copyBillboardMessage);
}

// Initialize everything on load
initializeGame();

// ... (fetchLatestPrice function remains the same) ...
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
            
            const formattedUsdPrice = parseFloat(data.usd || 0).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            });
            usdPriceDisplay.textContent = formattedUsdPrice;
            
            ethPriceDisplay.textContent = `(${data.price || 'N/A'} ${data.currency || 'ETH'})`;

            const changeValue = updatePriceChangeDisplay(
                'price-change-24h', 
                data.price_change_24h || 0,
                '24h'
            );
            
            bubbleElement.classList.remove('pulse-up', 'pulse-down', 'pulse-neutral');
            if (changeValue > 0.1) {
                bubbleElement.classList.add('pulse-up');
            } else if (changeValue < -0.1) {
                bubbleElement.classList.add('pulse-down');
            } else {
                bubbleElement.classList.add('pulse-neutral');
            }
            
            const formattedMarketCap = formatCurrency(data.market_cap_usd || 0);
            marketCapDisplay.textContent = 
                `${data.market_cap_eth || 'N/A'} ${data.currency || 'ETH'} (${formattedMarketCap})`;

            const formattedVolume24h = formatCurrency(data.volume_24h_usd || 0); 
            volume24hDisplay.textContent = 
                `${data.volume_24h || 'N/A'} ${data.currency || 'ETH'} (${formattedVolume24h})`;

            const formattedVolumeTotal = formatCurrency(data.volume_total_usd || 0); 
            volumeTotalDisplay.textContent = 
                `${data.volume_total || 'N/A'} ${data.currency || 'ETH'} (${formattedVolumeTotal})`;
            
            poppedDisplay.textContent = formatCount(data.popped); 
            supplyDisplay.textContent = formatCount(data.supply); 
            holdersDisplay.textContent = formatCount(data.holders); 
            
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
        bubbleElement.style.transform = 'scale(1)'; 
        bubbleElement.style.opacity = '1';
        refreshButton.disabled = false;
    }
}

fetchLatestPrice();

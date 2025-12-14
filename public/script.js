// public/script.js - ADMIN MILESTONE EDITING LOGIC (Simplified Visibility)

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
const CUSTOM_MESSAGE_KEY = 'milestoneCustomMessage';
const MILESTONE = 100;
const INITIAL_SIZE = 150;
const MINIMUM_SIZE = 70;
const SIZE_DECREMENT = 0.8;
const ADMIN_CODE = 'admin';

let userPops = 0;
let isAdminMode = false;

const popButton = document.getElementById('mini-bubble-btn');
const popCountDisplay = document.getElementById('game-pop-count');
const milestoneMessageDiv = document.getElementById('milestone-message');
const resetButton = document.getElementById('game-reset-btn');
const adminToggle = document.getElementById('admin-toggle');
const customInput = document.getElementById('milestone-text-input');


/**
 * Saves the custom message to Local Storage.
 */
function saveCustomMessage() {
    if (customInput) {
        const message = customInput.value.trim();
        localStorage.setItem(CUSTOM_MESSAGE_KEY, message);
    }
}

/**
 * Toggles the admin editing mode for the custom input.
 */
function toggleAdminMode() {
    isAdminMode = !isAdminMode;

    if (isAdminMode) {
        adminToggle.textContent = 'Admin Mode: ON';
        adminToggle.style.borderColor = '#00C853';
        adminToggle.style.color = '#00C853';
        customInput.classList.remove('admin-hidden'); // SHOWS INPUT
        alert("Admin Edit Mode Enabled. The custom message input is now visible.");
    } else {
        adminToggle.textContent = 'Admin Mode: OFF';
        adminToggle.style.borderColor = '#D50000';
        adminToggle.style.color = '#D50000';
        customInput.classList.add('admin-hidden'); // HIDES INPUT
    }
}


function updateButtonSize() {
    if (!popButton) return;
    
    const newSize = Math.max(MINIMUM_SIZE, INITIAL_SIZE - (userPops % MILESTONE) * SIZE_DECREMENT);
    
    popButton.style.width = `${newSize}px`;
    popButton.style.height = `${newSize}px`;
    popButton.textContent = 'POP IT';
}


function resetGame(keepPopping) {
    // If admin mode is on and they hit YES/NO, save the latest custom message from the input
    if (isAdminMode) {
         saveCustomMessage();
    }
    
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
    // 1. Load Pop Count
    const storedPops = localStorage.getItem(POP_STORAGE_KEY);
    userPops = storedPops ? parseInt(storedPops) : 0;
    popCountDisplay.textContent = formatCount(userPops);
    updateButtonSize();
    
    // 2. Load Custom Message (for initial input placeholder)
    const storedMessage = localStorage.getItem(CUSTOM_MESSAGE_KEY);
    if (customInput && storedMessage) {
        customInput.value = storedMessage;
    } else if (customInput) {
        customInput.value = `You hit a milestone! Do you want to keep popping?`;
    }
    
    // 3. Add Admin Activation Listener (listens for the 'admin' code)
    let buffer = '';
    document.addEventListener('keydown', (e) => {
        buffer += e.key;
        if (buffer.length > ADMIN_CODE.length) {
            buffer = buffer.slice(buffer.length - ADMIN_CODE.length);
        }
        if (buffer === ADMIN_CODE) {
            if (adminToggle.style.display === 'none') {
                adminToggle.style.display = 'block';
                alert("Admin Toggle activated! Click the box to enable edit mode.");
            }
            buffer = '';
        }
    });
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
 * Displays the "Keep Poppin?" choice using the stored custom message.
 * This is what all users see.
 */
function showMilestoneMessage() {
    // 1. Get the current message from Local Storage (or the input field if it was just changed)
    const savedMessage = localStorage.getItem(CUSTOM_MESSAGE_KEY);
    // If a message is stored, use it. Otherwise, use the input value (which has a default).
    const displayedMessage = savedMessage || customInput?.value || `You hit a milestone! Do you want to keep popping?`;

    // 2. Render the message and buttons
    milestoneMessageDiv.innerHTML = `
        <p>${displayedMessage}</p>
        <div class="milestone-buttons">
            <button id="milestone-yes">YES (Continue)</button>
            <button id="milestone-no">NO (Stop/Reset)</button>
        </div>
    `;
    milestoneMessageDiv.style.display = 'flex';

    // 3. Attach handlers
    document.getElementById('milestone-yes').onclick = () => resetGame(true);
    document.getElementById('milestone-no').onclick = () => resetGame(false);
}


// --- ATTACH HANDLERS ---
if (popButton) {
    popButton.addEventListener('click', handlePop);
}
if (resetButton) {
    resetButton.addEventListener('click', handleFullReset);
}
if (adminToggle) {
    adminToggle.addEventListener('click', toggleAdminMode);
}

// Save message on keyup when admin mode is active (and only when active)
if (customInput) {
    customInput.addEventListener('keyup', () => {
        if (isAdminMode) {
            saveCustomMessage();
        }
    });
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

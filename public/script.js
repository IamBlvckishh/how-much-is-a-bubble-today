// public/script.js - SIMPLIFIED INITIALIZATION TO ENSURE DATA FETCH

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


function updateButtonSize() {
    if (!popButton) return;
    
    const newSize = Math.max(60, INITIAL_SIZE - (userPops % MILESTONE) * SIZE_DECREMENT);
    
    popButton.style.width = `${newSize}px`;
    popButton.style.height = `${newSize}px`;
    popButton.textContent = 'POP IT';
}


function resetGame(keepPopping) {
    if (keepPopping) {
        // YES: Keep total score, reset size for next round
        updateButtonSize(); // Resets size back to INITIAL_SIZE
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


// Attach the main handler
if (popButton) {
    popButton.addEventListener('click', handlePop);
    initializeGame(); // Call initialize on page load
}
// =========================================================
// END ADDICTIVE MINI-GAME LOGIC
// =========================================================


async function fetchLatestPrice() {
    const bubbleElement = document.getElementById('price-bubble');
    const usdPriceDisplay = document.getElementById('usd-price');
    // ... (other displays)
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
        // *** THE CRITICAL CALL TO YOUR API ENDPOINT ***
        const response = await fetch('/api/cron-update', { method: 'GET' });
        
        if (!response.ok) {
            // Throw a specific error if the API endpoint returns a non-200 status
            throw new Error(`API returned status ${response.status}. Check your serverless function code.`);
        }

        const result = await response.json();
        
        if (result.data) {
            // Success: Populate the data displays
            const data = result.data;
            
            // ... (Your successful data population logic here, omitted for brevity)
            usdPriceDisplay.textContent = parseFloat(data.usd).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            });
            // ... (rest of the stat updates)
            
            updatedDisplay.textContent = `Last Updated: ${new Date(data.lastUpdated).toLocaleString()}`;
        } else {
             updatedDisplay.textContent = `Data format error or empty data.`;
        }

    } catch (error) {
        console.error("Fetch error:", error);
        usdPriceDisplay.textContent = 'ERROR';
        updatedDisplay.textContent = `Error fetching data: ${error.message}`;
        bubbleElement.classList.add('pulse-down'); 
    } finally {
        // Restore elements
        bubbleElement.style.transform = 'scale(1)'; 
        bubbleElement.style.opacity = '1';
        refreshButton.disabled = false;
    }
}

// *** EXPLICITLY CALL THE FETCH FUNCTION ON LOAD ***
// This is the core instruction to load the data.
fetchLatestPrice();

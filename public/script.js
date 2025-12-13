// public/script.js

async function fetchLatestPrice() {
    const usdPriceDisplay = document.getElementById('usd-price');
    const ethPriceDisplay = document.getElementById('eth-price');
    const updatedDisplay = document.getElementById('last-updated');

    usdPriceDisplay.textContent = '...';
    ethPriceDisplay.textContent = '...';
    updatedDisplay.textContent = 'Please wait...';

    try {
        // Calls the secure Vercel Serverless Function
        const response = await fetch('/api/cron-update', { method: 'GET' });
        
        if (!response.ok) {
            throw new Error('Failed to fetch price from serverless function.');
        }

        const result = await response.json();
        
        if (result.data) {
            const data = result.data;
            
            // Display: USD Price (Bigger and main focus)
            usdPriceDisplay.textContent = `$${data.usd}`;
            
            // Display: ETH Price (Bold, denoted with currency)
            ethPriceDisplay.textContent = `${data.price} ${data.currency}`;
            
            // Display: Last Updated Timestamp
            updatedDisplay.textContent = `Last Updated: ${new Date(data.lastUpdated).toLocaleString()}`;
        } else {
             usdPriceDisplay.textContent = 'No Data';
             ethPriceDisplay.textContent = 'No Data';
        }


    } catch (error) {
        console.error("Error loading floor price:", error);
        usdPriceDisplay.textContent = 'ERROR';
        ethPriceDisplay.textContent = '...';
        updatedDisplay.textContent = 'Try again later.';
    }
}

// Call the function when the page loads
fetchLatestPrice();

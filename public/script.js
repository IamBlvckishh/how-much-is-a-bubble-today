// public/script.js - Updated to handle potential N/A for USD

async function fetchLatestPrice() {
    // ... (unchanged)
    // ...
    try {
        // ... (unchanged fetch call)
        
        const result = await response.json();
        
        if (result.data) {
            const data = result.data;
            
            // USD Price: Will display 'N/A' unless you add a second API call for conversion
            const usdValue = data.usd !== 'N/A' ? `$${data.usd}` : 'USD N/A';
            usdPriceDisplay.textContent = usdValue;
            
            // ETH Price
            ethPriceDisplay.textContent = `${data.price} ${data.currency}`;
            
            // Last Updated Timestamp
            updatedDisplay.textContent = `Last Updated: ${new Date(data.lastUpdated).toLocaleString()}`;
        } else {
             usdPriceDisplay.textContent = 'No Data';
             ethPriceDisplay.textContent = 'No Data';
        }

    } catch (error) {
        // ... (unchanged)
    }
}

// Call the function when the page loads
fetchLatestPrice();

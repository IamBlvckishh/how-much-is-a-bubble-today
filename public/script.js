// public/script.js - Single Fetch Function (Floor Price Only)

// Function to fetch data and update the display
async function fetchAndUpdatePrice() {
    try {
        const response = await fetch('/api/cron-update');
        const json = await response.json();
        const data = json.data;

        // --- Update the Main Bubble/Price ---
        document.getElementById('floor-price-eth').textContent = `${data.price} ${data.currency}`;
        document.getElementById('floor-price-usd').textContent = `~${data.usd}`;
        
        // Hide any other elements (Volume, Market Cap, Supply) if they exist in the HTML
        const clearElements = ['market-cap-display', 'total-volume-display', 'total-supply-display'];
        clearElements.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

        console.log(`Initial data loaded at ${new Date().toLocaleTimeString()}`);

    } catch (error) {
        console.error('Error fetching initial data:', error);
        document.getElementById('floor-price-eth').textContent = 'Error';
        document.getElementById('floor-price-usd').textContent = 'N/A';
    }
}

// 1. Initial call to load data immediately
fetchAndUpdatePrice();

// No polling is set up here.

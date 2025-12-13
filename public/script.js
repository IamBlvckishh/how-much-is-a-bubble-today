// public/script.js - Polling function for near real-time updates

// Helper to format large numbers as currency (e.g., $1,250,000)
const formatCurrency = (number) => {
    if (number === 'N/A') return 'N/A';
    const num = parseFloat(number);
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: num >= 1000 ? 0 : 2
    }).format(num);
};

// Function to fetch data and update the display
async function fetchAndUpdatePrice() {
    try {
        const response = await fetch('/api/cron-update');
        const json = await response.json();
        const data = json.data;

        // --- Update the Main Bubble/Price ---
        document.getElementById('floor-price-eth').textContent = `${data.price} ${data.currency}`;
        document.getElementById('floor-price-usd').textContent = `~${data.usd}`;
        
        // --- Update the New Bubble Economy Metrics ---
        
        // Market Cap (Using native OpenSea data)
        document.getElementById('market-cap-display').textContent = 
            `Market Cap: ${data.market_cap_eth} ${data.currency} (${formatCurrency(data.market_cap_usd)})`;
        
        // Volume
        document.getElementById('total-volume-display').textContent = 
            `Total Volume: ${data.volume} ${data.currency} (${formatCurrency(data.volume_usd)})`;
        
        // Supply
        document.getElementById('total-supply-display').textContent = 
            `Total Supply: ${data.supply.toLocaleString()}`;

        console.log(`Updated price at ${new Date().toLocaleTimeString()}`);

    } catch (error) {
        console.error('Error fetching real-time data:', error);
        document.getElementById('floor-price-eth').textContent = 'Error';
        document.getElementById('floor-price-usd').textContent = 'N/A';
    }
}

// ----------------------------------------------------
// THE REAL-TIME POLLING LOOP
// ----------------------------------------------------
// 1. Initial call to load data immediately
fetchAndUpdatePrice();

// 2. Set up the interval for "Near Real-Time" updates (e.g., every 10 seconds)
const updateIntervalSeconds = 10; 
setInterval(fetchAndUpdatePrice, updateIntervalSeconds * 1000);

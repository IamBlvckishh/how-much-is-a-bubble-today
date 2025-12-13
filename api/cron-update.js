// api/cron-update.js - FINAL CORE: Smart Contract Supply + Concurrent Fetching

// ----------------------------------------------------
// ENVIRONMENT VARIABLES & CONFIGURATION
// ----------------------------------------------------
const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY; 
const COLLECTION_SLUG = "bubbles-by-xcopy"; 
// !!! CRITICAL: REPLACE THIS WITH THE ACTUAL SMART CONTRACT ADDRESS !!!
const CONTRACT_ADDRESS = "0x45025cd9587206f7225f2f5f8a5b146350faf0a8"; // PLACEHOLDER

// Public Ethereum Node Endpoint (Highly reliable but rate-limited)
const ETH_NODE_URL = 'https://eth.public-rpc.com'; 
// If the above fails frequently, replace with your Alchemy or Infura URL:
// const ETH_NODE_URL = `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;

const OPEN_SEA_STATS_URL = `https://api.opensea.io/api/v2/collections/${COLLECTION_SLUG}/stats`;
const ETH_USD_CONVERSION_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'; 

// --- JSON-RPC Payload to call ERC-721 totalSupply() ---
const TOTAL_SUPPLY_PAYLOAD = {
    jsonrpc: "2.0",
    id: 1,
    method: "eth_call",
    params: [{
        to: CONTRACT_ADDRESS,
        // The data field is the keccak256 hash of "totalSupply()"
        data: "0x18160ddd" 
    }, "latest"]
};

/**
 * Helper function to fetch total supply from the smart contract via RPC endpoint.
 */
async function fetchContractSupply() {
    try {
        const response = await fetch(ETH_NODE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(TOTAL_SUPPLY_PAYLOAD)
        });
        
        if (!response.ok) return 0;
        
        const json = await response.json();
        
        // The result is a hex string (e.g., '0x2710' for 10000). Convert it to an integer.
        // We use || '0x0' to prevent errors if result is missing
        return parseInt(json.result || '0x0', 16); 
    } catch (error) {
        console.error("Failed to fetch supply from Smart Contract:", error);
        return 0;
    }
}


// --- Main Handler Function ---
export default async function handler(req, res) {
  // ... (Method checks remain the same)
  
  try {
    if (!OPENSEA_API_KEY) {
        throw new Error("OpenSea API Key is missing or blank.");
    }

    // 1. INITIATE THREE CONCURRENT API CALLS (Promise.all() for max speed)
    const [openSeaResponse, coinGeckoResponse, contractSupply] = await Promise.all([
        fetch(OPEN_SEA_STATS_URL, {
            method: 'GET',
            headers: { 'accept': 'application/json', 'X-API-Key': OPENSEA_API_KEY }
        }),
        fetch(ETH_USD_CONVERSION_URL),
        fetchContractSupply() // <<< NEW CONCURRENT CALL
    ]);

    // 2. PROCESS OPENSEA RESPONSE (for Floor Price)
    if (!openSeaResponse.ok) {
        throw new Error(`OpenSea API error: ${openSeaResponse.status}.`);
    }
    const data = await openSeaResponse.json();
    const stats = data.total;
    
    const floorPriceValue = parseFloat(stats.floor_price) || 0;
    const currency = stats.floor_price_symbol || 'ETH';
    
    // 3. GET TOTAL SUPPLY
    const totalSupply = contractSupply; // <<< USE RELIABLE CONTRACT VALUE


    // 4. CALCULATE MARKET CAP MANUALLY: Market Cap = Floor Price * Total Supply
    const marketCapETH = floorPriceValue * totalSupply; 


    // 5. PROCESS COINGECKO RESPONSE & CALCULATE USD Metrics
    let ethUsdRate = null;
    let floorPriceUSD = 'N/A';
    let marketCapUSD = 'N/A'; 

    if (coinGeckoResponse.ok) {
        const cgData = await coinGeckoResponse.json();
        ethUsdRate = cgData.ethereum.usd;
    }
    
    if (ethUsdRate) {
        if (floorPriceValue > 0) {
            floorPriceUSD = (floorPriceValue * ethUsdRate).toFixed(2);
        }
        if (marketCapETH > 0) {
            marketCapUSD = (marketCapETH * ethUsdRate).toFixed(0); 
        }
    }
    
    // 6. CONSTRUCT FINAL RESPONSE
    const finalData = {
      price: floorPriceValue.toFixed(4), 
      currency: currency,
      usd: floorPriceUSD, 
      market_cap_eth: marketCapETH.toFixed(2), 
      market_cap_usd: marketCapUSD,           
      lastUpdated: new Date().toISOString(),
      supply: totalSupply // For reference
    };

    return res.status(200).json({ 
        message: 'Accurate Market Cap using Smart Contract Supply.',
        data: finalData
    });

  } catch (error) {
    // ... (Error handling remains the same)
    console.error("Critical Error during data job:", error);
    return res.status(500).json({ message: `Failed to fetch data: ${error.message}` });
  }
}

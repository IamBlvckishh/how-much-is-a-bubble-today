// api/cron-update.js - FINAL CORE: Floor Price, Market Cap, and Volume

// ----------------------------------------------------
// ENVIRONMENT VARIABLES & CONFIGURATION
// ----------------------------------------------------
const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY; 
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY; 

const COLLECTION_SLUG = "bubbles-by-xcopy"; 
const CONTRACT_ADDRESS = "0x45025cd9587206f7225f2f5f8a5b146350faf0a8"; 

const ETH_NODE_URL = `https://shape-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`; 

const OPEN_SEA_STATS_URL = `https://api.opensea.io/api/v2/collections/${COLLECTION_SLUG}/stats`;
const ETH_USD_CONVERSION_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'; 

// JSON-RPC Payload to call ERC-721 totalSupply()
const TOTAL_SUPPLY_PAYLOAD = {
    jsonrpc: "2.0",
    id: 1,
    method: "eth_call",
    params: [{
        to: CONTRACT_ADDRESS,
        data: "0x18160ddd" 
    }, "latest"]
};

/**
 * Helper function to fetch total supply from the smart contract via the dedicated Alchemy node.
 */
async function fetchContractSupply(nodeUrl) {
    if (!ALCHEMY_API_KEY) return 0;
    
    try {
        const response = await fetch(nodeUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(TOTAL_SUPPLY_PAYLOAD)
        });
        
        if (!response.ok) return 0;
        
        const json = await response.json();
        
        return parseInt(json.result || '0x0', 16); 
    } catch (error) {
        console.error("Failed to fetch supply from Smart Contract:", error.message);
        return 0;
    }
}


// --- Main Handler Function ---
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).send({ message: 'Only GET or POST requests allowed' });
  }
  
  try {
    if (!OPENSEA_API_KEY) {
        throw new Error("OpenSea API Key is missing or blank.");
    }

    // 1. INITIATE THREE CONCURRENT API CALLS 
    const [openSeaResponse, coinGeckoResponse, contractSupply] = await Promise.all([
        fetch(OPEN_SEA_STATS_URL, {
            method: 'GET',
            headers: { 'accept': 'application/json', 'X-API-Key': OPENSEA_API_KEY }
        }),
        fetch(ETH_USD_CONVERSION_URL),
        fetchContractSupply(ETH_NODE_URL)
    ]);

    // 2. PROCESS OPENSEA RESPONSE 
    if (!openSeaResponse.ok) {
        throw new Error(`OpenSea API error: ${openSeaResponse.status}.`);
    }
    const data = await openSeaResponse.json();
    const stats = data.total;
    
    // Extract Floor Price and Volume
    const floorPriceValue = parseFloat(stats.floor_price) || 0;
    const totalVolumeValue = parseFloat(stats.volume) || 0; // <<< VOLUME ADDED
    const currency = stats.floor_price_symbol || 'ETH';
    
    // 3. DETERMINE TOTAL SUPPLY 
    let totalSupply = contractSupply;
    if (totalSupply === 0) {
        // Fallback: Use OpenSea's supply data
        totalSupply = parseInt(stats.total_supply || stats.num_owners) || 0;
    }


    // 4. CALCULATE MARKET CAP
    const marketCapETH = floorPriceValue * totalSupply; 


    // 5. PROCESS COINGECKO RESPONSE & CALCULATE USD Metrics
    let ethUsdRate = null;
    let floorPriceUSD = 'N/A';
    let marketCapUSD = 'N/A'; 
    let totalVolumeUSD = 'N/A'; // <<< VOLUME USD ADDED

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
        if (totalVolumeValue > 0) { // <<< VOLUME USD CALCULATION
            totalVolumeUSD = (totalVolumeValue * ethUsdRate).toFixed(0); 
        }
    }
    
    // 6. CONSTRUCT FINAL RESPONSE
    const finalData = {
      price: floorPriceValue.toFixed(4), 
      currency: currency,
      usd: floorPriceUSD, 
      market_cap_eth: marketCapETH.toFixed(2), 
      market_cap_usd: marketCapUSD,           
      volume: totalVolumeValue.toFixed(2), // <<< VOLUME ETH RETURNED
      volume_usd: totalVolumeUSD,          // <<< VOLUME USD RETURNED
      lastUpdated: new Date().toISOString(),
      supply: totalSupply 
    };

    return res.status(200).json({ 
        message: 'Data fetch successful (Floor, MC, Volume).',
        data: finalData
    });

  } catch (error) {
    console.error("Critical Error during data job:", error);
    return res.status(500).json({ message: `Failed to fetch data: ${error.message}` });
  }
}

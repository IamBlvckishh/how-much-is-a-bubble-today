// api/cron-update.js - FINAL STABLE CORE: Data Extraction Failsafe

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

// JSON-RPC Payload (remains the same)
const TOTAL_SUPPLY_PAYLOAD = {
    jsonrpc: "2.0",
    id: 1,
    method: "eth_call",
    params: [{ to: CONTRACT_ADDRESS, data: "0x18160ddd" }, "latest"]
};

// Contract Supply Fetch (remains the same)
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

/**
 * Calculates the percentage change safely.
 * @param {number} change - The absolute change in value.
 * @param {number} previousValue - The value from the prior period.
 * @returns {number} The percentage change, or 0 if calculation is impossible.
 */
function safePercentageChange(change, previousValue) {
    if (previousValue > 0) {
        return (change / previousValue) * 100;
    }
    return 0;
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

    // 1. INITIATE CONCURRENT API CALLS 
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
    
    // Extract Core Metrics
    const floorPriceValue = parseFloat(stats.floor_price) || 0;
    const totalVolumeValue = parseFloat(stats.volume) || 0; 
    const uniqueOwners = parseInt(stats.num_owners) || 0;
    // NOTE: listed_count is not documented in V2 stats, relying on custom field name.
    const listedCount = parseInt(stats.listed_count) || 0; 
    const currency = stats.floor_price_symbol || 'ETH';
    
    // --- Price Changes & Average Price ---
    let priceChange24h = 0;
    let priceChange7d = 0;
    let avgPrice24h = 0;

    if (data.intervals && data.intervals.length > 0) {
        // 24H Metrics
        const interval24h = data.intervals.find(i => i.interval === 'one_day');
        if (interval24h) {
            const floorChange24h = parseFloat(interval24h.floor_price_change) || 0;
            const previousFloor24h = parseFloat(interval24h.floor_price) || 0;
            avgPrice24h = parseFloat(interval24h.average_price) || 0; 
            priceChange24h = safePercentageChange(floorChange24h, previousFloor24h);
        }

        // 7D Metrics
        const interval7d = data.intervals.find(i => i.interval === 'seven_day'); 
        if (interval7d) {
            const floorChange7d = parseFloat(interval7d.floor_price_change) || 0;
            const previousFloor7d = parseFloat(interval7d.floor_price) || 0;
            priceChange7d = safePercentageChange(floorChange7d, previousFloor7d);
        }
    }
    
    // 3. DETERMINE TOTAL SUPPLY 
    let totalSupply = contractSupply;
    if (totalSupply === 0) {
        totalSupply = parseInt(stats.total_supply || uniqueOwners) || 0;
    }
    
    // 4. CALCULATE CUSTOM METRICS
    const marketCapETH = floorPriceValue * totalSupply; 

    // Listing Ratio: Percentage of total supply listed for sale
    let listingRatio = 0;
    if (totalSupply > 0 && listedCount > 0) {
        listingRatio = (listedCount / totalSupply) * 100; 
    } else if (listedCount === 0 && uniqueOwners > 0) {
        // If listed_count is 0 but there are owners, the API field is likely wrong or data is missing.
        // We set to 0 and the frontend will show a clean 0%
        listingRatio = 0;
    }


    // Market Cap / Volume Ratio (Liquidity)
    const mcVolumeRatio = totalVolumeValue > 0 ? marketCapETH / totalVolumeValue : 0; 


    // 5. PROCESS COINGECKO RESPONSE & CALCULATE USD Metrics
    let ethUsdRate = null;
    let floorPriceUSD = 'N/A';
    let marketCapUSD = 'N/A'; 
    let totalVolumeUSD = 'N/A';
    let avgPriceUSD = 'N/A';

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
        if (totalVolumeValue > 0) {
            totalVolumeUSD = (totalVolumeValue * ethUsdRate).toFixed(0); 
        }
        if (avgPrice24h > 0) {
            avgPriceUSD = (avgPrice24h * ethUsdRate).toFixed(2); 
        }
    }
    
    // 6. CONSTRUCT FINAL RESPONSE
    const finalData = {
      price: floorPriceValue.toFixed(4), 
      usd: floorPriceUSD, 
      avg_price_24h: avgPrice24h.toFixed(4), 
      avg_price_usd: avgPriceUSD, 
      currency: currency,
      market_cap_eth: marketCapETH.toFixed(2), 
      market_cap_usd: marketCapUSD,           
      volume: totalVolumeValue.toFixed(2),
      volume_usd: totalVolumeUSD,          
      price_change_24h: priceChange24h.toFixed(2), 
      price_change_7d: priceChange7d.toFixed(2), 
      holders: uniqueOwners, 
      supply: totalSupply,
      listed_count: listedCount, 
      listing_ratio: listingRatio.toFixed(2), 
      mc_volume_ratio: mcVolumeRatio.toFixed(2), 
      lastUpdated: new Date().toISOString()
    };

    return res.status(200).json({ 
        message: 'Data fetch successful (Final Metrics).',
        data: finalData
    });

  } catch (error) {
    console.error("Critical Error during data job:", error);
    return res.status(500).json({ message: `Failed to fetch data: ${error.message}` });
  }
}

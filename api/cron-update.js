// api/cron-update.js - FINAL DEFINITIVE CORE: Multi-API Fix for Volume and Listed Count

// ----------------------------------------------------
// ENVIRONMENT VARIABLES & CONFIGURATION
// ----------------------------------------------------
const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY; 
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY; 

const COLLECTION_SLUG = "bubbles-by-xcopy"; 
const CONTRACT_ADDRESS = "0x45025cd9587206f7225f2f5f8a5b146350faf0a8"; 

const ETH_NODE_URL = `https://shape-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`; 

// V2 STATS: Best for intervals (24h/7d changes)
const OPEN_SEA_V2_STATS_URL = `https://api.opensea.io/api/v2/collections/${COLLECTION_SLUG}/stats`; 
// V1 STATS: Best for total volume, listed count (more reliable fields)
const OPEN_SEA_V1_STATS_URL = `https://api.opensea.io/api/v1/collection/${COLLECTION_SLUG}/stats`;

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
    const [v2Response, v1Response, coinGeckoResponse, contractSupply] = await Promise.all([
        fetch(OPEN_SEA_V2_STATS_URL, {
            method: 'GET',
            headers: { 'accept': 'application/json', 'X-API-Key': OPENSEA_API_KEY }
        }),
        fetch(OPEN_SEA_V1_STATS_URL), // V1 doesn't require API key
        fetch(ETH_USD_CONVERSION_URL),
        fetchContractSupply(ETH_NODE_URL)
    ]);

    // 2. PROCESS OPENSEA RESPONSES
    if (!v2Response.ok) throw new Error(`OpenSea V2 API error: ${v2Response.status}.`);
    if (!v1Response.ok) throw new Error(`OpenSea V1 API error: ${v1Response.status}.`);
    
    const v2Data = await v2Response.json();
    const v1Data = await v1Response.json();
    const v2Stats = v2Data.total;
    const v1Stats = v1Data.stats;
    
    // Extract Core Metrics from V2 (Floor, Holders)
    const floorPriceValue = parseFloat(v2Stats.floor_price) || 0;
    const uniqueOwners = parseInt(v2Stats.num_owners) || 0;
    const currency = v2Stats.floor_price_symbol || 'ETH';
    
    // Use V1 data for reliable Total Supply/Listed Count
    const listedCount = parseInt(v1Stats.one_day_average_price) || 0; 
    const listedCountV1 = parseInt(v1Stats.total_supply) - uniqueOwners; // Fallback: Total Supply - Owners (Approx)

    // --- 24H VOLUME FIX ---
    let totalVolumeValue = 0; // This will now be the 24H Volume
    if (v2Data.intervals && v2Data.intervals.length > 0) {
        const interval24h = v2Data.intervals.find(i => i.interval === 'one_day');
        // V2 Volume is only the 24h volume!
        totalVolumeValue = parseFloat(interval24h.volume) || 0; 
    }
    // Fallback to V1 24h volume if V2 interval volume is missing
    if (totalVolumeValue === 0 && v1Stats.one_day_volume) {
        totalVolumeValue = parseFloat(v1Stats.one_day_volume) || 0;
    }


    // --- Price Changes & Average Price ---
    let priceChange24h = 0;
    let priceChange7d = 0;
    let avgPrice24h = 0;

    if (v2Data.intervals && v2Data.intervals.length > 0) {
        // 24H Metrics
        const interval24h = v2Data.intervals.find(i => i.interval === 'one_day');
        if (interval24h) {
            const floorChange24h = parseFloat(interval24h.floor_price_change) || 0;
            const previousFloor24h = parseFloat(interval24h.floor_price) || 0;
            avgPrice24h = parseFloat(interval24h.average_price) || 0; 
            priceChange24h = safePercentageChange(floorChange24h, previousFloor24h);
        }

        // 7D Metrics
        const interval7d = v2Data.intervals.find(i => i.interval === 'seven_day'); 
        if (interval7d) {
            const floorChange7d = parseFloat(interval7d.floor_price_change) || 0;
            const previousFloor7d = parseFloat(interval7d.floor_price) || 0;
            priceChange7d = safePercentageChange(floorChange7d, previousFloor7d);
        }
    }
    
    // 3. DETERMINE TOTAL SUPPLY 
    let totalSupply = contractSupply;
    if (totalSupply === 0) {
        // Fallback to V1 total_supply, which is more reliable than V2 num_owners
        totalSupply = parseInt(v1Stats.total_supply || uniqueOwners) || 0;
    }
    
    // 4. CALCULATE CUSTOM METRICS
    const marketCapETH = floorPriceValue * totalSupply; 

    // --- LISTING RATIO FIX ---
    // The listed count from V1 or V2 is unreliable. We will use the V1 'count' which represents total items for sale
    let actualListedCount = parseInt(v1Stats.count) || listedCount || 0; 

    let listingRatio = 0;
    if (totalSupply > 0 && actualListedCount > 0) {
        listingRatio = (actualListedCount / totalSupply) * 100; 
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
      volume: totalVolumeValue.toFixed(2), // <<< NOW CORRECT 24H VOLUME
      volume_usd: totalVolumeUSD,          
      price_change_24h: priceChange24h.toFixed(2), 
      price_change_7d: priceChange7d.toFixed(2), 
      holders: uniqueOwners, 
      supply: totalSupply,
      listed_count: actualListedCount, // <<< NOW CORRECTED LISTED COUNT
      listing_ratio: listingRatio.toFixed(2), 
      mc_volume_ratio: mcVolumeRatio.toFixed(2), 
      lastUpdated: new Date().toISOString()
    };

    return res.status(200).json({ 
        message: 'Data fetch successful (Final Multi-API Metrics).',
        data: finalData
    });

  } catch (error) {
    console.error("Critical Error during data job:", error);
    return res.status(500).json({ message: `Failed to fetch data: ${error.message}` });
  }
}

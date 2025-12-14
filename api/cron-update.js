// api/cron-update.js - FINAL DEFINITIVE CORE: Multi-API for Reliable Price Change

// ----------------------------------------------------
// Caching Variables
// ----------------------------------------------------
let dataCache = null;
let lastFetchTime = 0;
const CACHE_DURATION_MS = 60000; // 60 seconds cache duration

// ----------------------------------------------------
// ENVIRONMENT VARIABLES & CONFIGURATION
// ----------------------------------------------------
const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY; 
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY; 

const COLLECTION_SLUG = "bubbles-by-xcopy"; 
const CONTRACT_ADDRESS = "0x45025cd9587206f7225f2f5f8a5b146350faf0a8"; 

const ETH_NODE_URL = `https://shape-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`; 

const OPEN_SEA_V1_STATS_URL = `https://api.opensea.io/api/v1/collection/${COLLECTION_SLUG}/stats`; // For reliable change %
const OPEN_SEA_V2_STATS_URL = `https://api.opensea.io/api/v2/collections/${COLLECTION_SLUG}/stats`; // For current floor and 24h volume
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


// --- Main Handler Function ---
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).send({ message: 'Only GET or POST requests allowed' });
  }

  // >>> 1. CHECK CACHE (SPEED BOOSTER)
  const now = Date.now();
  if (dataCache && (now - lastFetchTime < CACHE_DURATION_MS)) {
      return res.status(200).json({ 
          message: 'Data served from cache.',
          data: dataCache
      });
  }

  // If cache expired or empty, proceed with fetching data
  try {
    if (!OPENSEA_API_KEY) {
        throw new Error("OpenSea API Key is missing or blank.");
    }

    // 2. INITIATE CONCURRENT API CALLS 
    const [v1Response, v2Response, coinGeckoResponse, contractSupply] = await Promise.all([
        fetch(OPEN_SEA_V1_STATS_URL), // V1 for reliable change %
        fetch(OPEN_SEA_V2_STATS_URL, { // V2 for current floor and 24h volume interval
            method: 'GET',
            headers: { 'accept': 'application/json', 'X-API-Key': OPENSEA_API_KEY }
        }),
        fetch(ETH_USD_CONVERSION_URL),
        fetchContractSupply(ETH_NODE_URL)
    ]);

    // 3. PROCESS RESPONSES 
    if (!v1Response.ok) throw new Error(`OpenSea V1 API error: ${v1Response.status}.`);
    if (!v2Response.ok) throw new Error(`OpenSea V2 API error: ${v2Response.status}.`);
    
    const v1Data = await v1Response.json();
    const v2Data = await v2Response.json();
    
    const v1Stats = v1Data.stats || {};
    const v2Stats = v2Data.total || {};
    
    // Core Metrics - Pull the most accurate or necessary data from each source
    const floorPriceValue = parseFloat(v2Stats.floor_price) || parseFloat(v1Stats.floor_price) || 0; // V2 is more current
    const uniqueOwners = parseInt(v2Stats.num_owners) || parseInt(v1Stats.num_owners) || 0; 
    const currency = v2Stats.floor_price_symbol || 'ETH';
    
    // --- PRICE CHANGE FIX (V1 is RELIABLE) ---
    const priceChange24h = (parseFloat(v1Stats.one_day_change) * 100) || 0;
    const priceChange7d = (parseFloat(v1Stats.seven_day_change) * 100) || 0;
    
    // --- VOLUME METRICS ---
    const allTimeVolumeValue = parseFloat(v2Stats.volume) || parseFloat(v1Stats.total_volume) || 0; // V2 is usually up-to-date
    let volume24h = 0; // 24H VOLUME

    if (v2Data.intervals && v2Data.intervals.length > 0) {
        const interval24h = v2Data.intervals.find(i => i.interval === 'one_day') || v2Data.intervals[0];
        if (interval24h) {
            volume24h = parseFloat(interval24h.volume) || 0; // 24H Volume from V2 interval
        }
    }
    // Fallback for 24H Volume if V2 interval is missing
    if (volume24h === 0 && v1Stats.one_day_volume) {
        volume24h = parseFloat(v1Stats.one_day_volume) || 0;
    }
    
    // 4. DETERMINE TOTAL SUPPLY 
    let totalSupply = contractSupply;
    if (totalSupply === 0) {
        totalSupply = parseInt(v1Stats.total_supply) || uniqueOwners;
    }

    // 5. CALCULATE MARKET CAP
    const marketCapETH = floorPriceValue * totalSupply; 

    // 6. PROCESS COINGECKO RESPONSE & CALCULATE USD Metrics
    let ethUsdRate = null;
    let floorPriceUSD = 'N/A';
    let marketCapUSD = 'N/A'; 
    let volume24hUSD = 'N/A';
    let allTimeVolumeUSD = 'N/A';

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
        if (volume24h > 0) {
            volume24hUSD = (volume24h * ethUsdRate).toFixed(0); 
        }
        if (allTimeVolumeValue > 0) {
            allTimeVolumeUSD = (allTimeVolumeValue * ethUsdRate).toFixed(0); 
        }
    }
    
    // 7. CONSTRUCT FINAL RESPONSE
    const finalData = {
      price: floorPriceValue.toFixed(4), 
      currency: currency,
      usd: floorPriceUSD, 
      market_cap_eth: marketCapETH.toFixed(2), 
      market_cap_usd: marketCapUSD,           
      volume_24h: volume24h.toFixed(2),
      volume_24h_usd: volume24hUSD,          
      volume_total: allTimeVolumeValue.toFixed(2),
      volume_total_usd: allTimeVolumeUSD,
      price_change_24h: priceChange24h.toFixed(2), // <<< FIXED VIA V1 API
      price_change_7d: priceChange7d.toFixed(2),   // <<< FIXED VIA V1 API
      holders: uniqueOwners, 
      lastUpdated: new Date().toISOString(),
      supply: totalSupply 
    };

    // 8. UPDATE CACHE
    dataCache = finalData;
    lastFetchTime = now;

    return res.status(200).json({ 
        message: 'Data fetch successful (New Data).',
        data: finalData
    });

  } catch (error) {
    console.error("Critical Error during data job:", error);
    if (dataCache) {
        return res.status(200).json({ 
            message: `API fetch failed, serving stale cache.`,
            data: dataCache
        });
    }

    return res.status(500).json({ message: `Failed to fetch data: ${error.message}` });
  }
}

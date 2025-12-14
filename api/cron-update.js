// api/cron-update.js - FINAL STABLE CORE: Caching for Maximum Speed

// ----------------------------------------------------
// Caching Variables (Defined outside the handler for persistence)
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

  // >>> 1. CHECK CACHE (THE SPEED BOOSTER)
  const now = Date.now();
  if (dataCache && (now - lastFetchTime < CACHE_DURATION_MS)) {
      // Serve cached data INSTANTLY
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
    const [openSeaResponse, coinGeckoResponse, contractSupply] = await Promise.all([
        fetch(OPEN_SEA_STATS_URL, {
            method: 'GET',
            headers: { 'accept': 'application/json', 'X-API-Key': OPENSEA_API_KEY }
        }),
        fetch(ETH_USD_CONVERSION_URL),
        fetchContractSupply(ETH_NODE_URL)
    ]);

    // 3. PROCESS OPENSEA RESPONSE 
    if (!openSeaResponse.ok) {
        throw new Error(`OpenSea API error: ${openSeaResponse.status}.`);
    }
    const data = await openSeaResponse.json();
    const stats = data.total;
    
    // Extract Metrics
    const floorPriceValue = parseFloat(stats.floor_price) || 0;
    const totalVolumeValue = parseFloat(stats.volume) || 0; 
    const uniqueOwners = parseInt(stats.num_owners) || 0; 
    const currency = stats.floor_price_symbol || 'ETH';
    
    // --- 24H & 7D PRICE CHANGE LOGIC ---
    let priceChange24h = 0;
    let priceChange7d = 0; 
    
    if (data.intervals && data.intervals.length > 0) {
        const interval24h = data.intervals.find(i => i.interval === 'one_day') || data.intervals[0];
        const floorChange24h = parseFloat(interval24h.floor_price_change) || 0;
        const previousFloor24h = parseFloat(interval24h.floor_price) || 0;
        priceChange24h = safePercentageChange(floorChange24h, previousFloor24h);

        const interval7d = data.intervals.find(i => i.interval === 'seven_day'); 
        if (interval7d) {
            const floorChange7d = parseFloat(interval7d.floor_price_change) || 0;
            const previousFloor7d = parseFloat(interval7d.floor_price) || 0;
            priceChange7d = safePercentageChange(floorChange7d, previousFloor7d);
        }
    }
    
    // 4. DETERMINE TOTAL SUPPLY 
    let totalSupply = contractSupply;
    if (totalSupply === 0) {
        totalSupply = uniqueOwners;
    }

    // 5. CALCULATE MARKET CAP
    const marketCapETH = floorPriceValue * totalSupply; 

    // 6. PROCESS COINGECKO RESPONSE & CALCULATE USD Metrics
    let ethUsdRate = null;
    let floorPriceUSD = 'N/A';
    let marketCapUSD = 'N/A'; 
    let totalVolumeUSD = 'N/A';

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
    }
    
    // 7. CONSTRUCT FINAL RESPONSE
    const finalData = {
      price: floorPriceValue.toFixed(4), 
      currency: currency,
      usd: floorPriceUSD, 
      market_cap_eth: marketCapETH.toFixed(2), 
      market_cap_usd: marketCapUSD,           
      volume: totalVolumeValue.toFixed(2),
      volume_usd: totalVolumeUSD,          
      price_change_24h: priceChange24h.toFixed(2), 
      price_change_7d: priceChange7d.toFixed(2), 
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
    // If a fetch fails, try to return the old cache as a fallback
    if (dataCache) {
        return res.status(200).json({ 
            message: `API fetch failed, serving stale cache.`,
            data: dataCache
        });
    }

    return res.status(500).json({ message: `Failed to fetch data: ${error.message}` });
  }
}

// api/cron-update.js - FINAL STABLE CORE: Sequential Fetching with Robust Fallbacks

// ----------------------------------------------------
// ENVIRONMENT VARIABLES & CONFIGURATION
// ----------------------------------------------------
const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY; 
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY; 

const COLLECTION_SLUG = "bubbles-by-xcopy"; 
const CONTRACT_ADDRESS = "0x45025cd9587206f7225f2f5f8a5b146350faf0a8"; 

const ETH_NODE_URL = `https://shape-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`; 

const OPEN_SEA_V2_STATS_URL = `https://api.opensea.io/api/v2/collections/${COLLECTION_SLUG}/stats`; 
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
  
  if (!OPENSEA_API_KEY) {
      return res.status(500).json({ message: "OpenSea API Key is missing. Check your Vercel Environment Variables." });
  }

  let finalData = {};
  let ethUsdRate = 0;
  let totalSupply = 0;
  let v2Data = null;
  let v1Data = null;


  // STEP 1: Fetch ETH/USD Rate (Highest Priority)
  try {
      const cgResponse = await fetch(ETH_USD_CONVERSION_URL);
      const cgData = await cgResponse.json();
      ethUsdRate = cgData.ethereum.usd;
  } catch (error) {
      console.error("Failed to fetch CoinGecko USD rate. All USD values will be N/A.");
  }


  // STEP 2: Fetch Contract Supply
  totalSupply = await fetchContractSupply(ETH_NODE_URL);


  // STEP 3: Fetch OpenSea V2 Data (24h/7d Changes)
  try {
      const v2Response = await fetch(OPEN_SEA_V2_STATS_URL, {
          method: 'GET',
          headers: { 'accept': 'application/json', 'X-API-Key': OPENSEA_API_KEY }
      });
      if (v2Response.ok) {
          v2Data = await v2Response.json();
      } else {
          console.error(`V2 API failed with status: ${v2Response.status}`);
      }
  } catch (error) {
      console.error("Failed to fetch OpenSea V2 data:", error.message);
  }


  // STEP 4: Fetch OpenSea V1 Data (Total Supply, Listed Count Fallback)
  try {
      const v1Response = await fetch(OPEN_SEA_V1_STATS_URL); 
      if (v1Response.ok) {
          v1Data = await v1Response.json();
      } else {
          console.error(`V1 API failed with status: ${v1Response.status}`);
      }
  } catch (error) {
      console.error("Failed to fetch OpenSea V1 data:", error.message);
  }


  // STEP 5: Aggregate and Calculate Metrics
  try {
    const v2Stats = v2Data?.total || {};
    const v1Stats = v1Data?.stats || {};
    
    // Core Metrics
    const floorPriceValue = parseFloat(v2Stats.floor_price || v1Stats.floor_price) || 0;
    const uniqueOwners = parseInt(v2Stats.num_owners || v1Stats.num_owners) || 0;
    const currency = v2Stats.floor_price_symbol || 'ETH';
    
    // Fallback Supply
    if (totalSupply === 0) {
        totalSupply = parseInt(v1Stats.total_supply || uniqueOwners) || 0;
    }
    
    // Price Changes & Average Price (from V2 intervals)
    let priceChange24h = 0;
    let priceChange7d = 0;
    let avgPrice24h = 0;
    let totalVolumeValue = 0;

    if (v2Data?.intervals && v2Data.intervals.length > 0) {
        const interval24h = v2Data.intervals.find(i => i.interval === 'one_day');
        if (interval24h) {
            const floorChange24h = parseFloat(interval24h.floor_price_change) || 0;
            const previousFloor24h = parseFloat(interval24h.floor_price) || 0;
            avgPrice24h = parseFloat(interval24h.average_price) || 0; 
            priceChange24h = safePercentageChange(floorChange24h, previousFloor24h);
            totalVolumeValue = parseFloat(interval24h.volume) || 0; // V2 Interval Volume is 24H
        }

        const interval7d = v2Data.intervals.find(i => i.interval === 'seven_day'); 
        if (interval7d) {
            const floorChange7d = parseFloat(interval7d.floor_price_change) || 0;
            const previousFloor7d = parseFloat(interval7d.floor_price) || 0;
            priceChange7d = safePercentageChange(floorChange7d, previousFloor7d);
        }
    }
    
    // Volume Fallback (V1 24H volume)
    if (totalVolumeValue === 0) {
        totalVolumeValue = parseFloat(v1Stats.one_day_volume) || 0;
    }

    // Listed Count Fix
    const actualListedCount = parseInt(v1Stats.count) || 0; 

    // CALCULATIONS
    const marketCapETH = floorPriceValue * totalSupply; 
    let listingRatio = (totalSupply > 0 && actualListedCount > 0) ? (actualListedCount / totalSupply) * 100 : 0; 
    const mcVolumeRatio = totalVolumeValue > 0 ? marketCapETH / totalVolumeValue : 0; 

    // USD Conversions
    let floorPriceUSD = 'N/A';
    let marketCapUSD = 'N/A'; 
    let totalVolumeUSD = 'N/A';
    let avgPriceUSD = 'N/A';

    if (ethUsdRate > 0) {
        if (floorPriceValue > 0) floorPriceUSD = (floorPriceValue * ethUsdRate).toFixed(2);
        if (marketCapETH > 0) marketCapUSD = (marketCapETH * ethUsdRate).toFixed(0); 
        if (totalVolumeValue > 0) totalVolumeUSD = (totalVolumeValue * ethUsdRate).toFixed(0); 
        if (avgPrice24h > 0) avgPriceUSD = (avgPrice24h * ethUsdRate).toFixed(2); 
    }
    
    // Final Data Construction
    finalData = {
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
      listed_count: actualListedCount, 
      listing_ratio: listingRatio.toFixed(2), 
      mc_volume_ratio: mcVolumeRatio.toFixed(2), 
      lastUpdated: new Date().toISOString()
    };

    // If floor price is 0, something is seriously wrong
    if (floorPriceValue === 0) {
        return res.status(500).json({ message: "Failed to load core metrics (Floor Price is zero). Check OpenSea API Keys and rate limits.", data: finalData });
    }

    return res.status(200).json({ 
        message: 'Data fetch successful (Highly Stable Version).',
        data: finalData
    });

  } catch (error) {
    console.error("CRITICAL AGGREGATION ERROR:", error);
    // Return a 200 status with an error message in the data structure
    return res.status(500).json({ message: `A critical internal error occurred during data processing: ${error.message}`, data: {} });
  }
}

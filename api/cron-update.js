// api/cron-update.js - FIXED: LAST POP/BURN TRIGGER using ALCHEMY

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
const INITIAL_SUPPLY = 1000; // The fixed maximum supply of the collection

const ETH_NODE_URL = `https://shape-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`; 

const OPEN_SEA_STATS_URL = `https://api.opensea.io/api/v2/collections/${COLLECTION_SLUG}/stats`;
const ETH_USD_CONVERSION_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'; 

// --- ETH/ERC-721 Event Signatures and Addresses ---
// Signature for Transfer(address,address,uint256) is: 0xddf252ad1be2c89b69c2b068fc378aa952ba7be494488d0d161a87693006649f
const TRANSFER_EVENT_TOPIC = "0xddf252ad1be2c89b69c2b068fc378aa952ba7be494488d0d161a87693006649f";
// The zero address, used as the 'to' address in the Transfer event for a burn
const BURN_ADDRESS_TOPIC = "0x0000000000000000000000000000000000000000000000000000000000000000"; 
// Topic 2 is the 'to' address (index 2 of the Transfer signature)


// JSON-RPC Payload (for total supply, remains the same)
const TOTAL_SUPPLY_PAYLOAD = {
    jsonrpc: "2.0",
    id: 1,
    method: "eth_call",
    params: [{ to: CONTRACT_ADDRESS, data: "0x18160ddd" }, "latest"]
};


// ----------------------------------------------------
// NEW FUNCTION: Fetch Last Burn Event (Pop Time)
// ----------------------------------------------------
async function fetchLastBurnEvent(nodeUrl) {
    if (!ALCHEMY_API_KEY) return 'N/A';

    // Alchemy payload to search the log for the latest burn event
    const BURN_LOG_PAYLOAD = {
        jsonrpc: "2.0",
        id: 2,
        method: "eth_getLogs",
        params: [{
            address: CONTRACT_ADDRESS,
            // Search from a reasonably recent block back to the start
            fromBlock: "0x" + (await fetchBlockNumber(nodeUrl) - 50000).toString(16), 
            toBlock: "latest",
            topics: [
                TRANSFER_EVENT_TOPIC, // Topic 0: The Transfer event signature
                null, // Topic 1: The 'from' address (can be anything)
                BURN_ADDRESS_TOPIC // Topic 2: The 'to' address (MUST be the zero address for a burn)
            ]
        }]
    };
    
    try {
        const response = await fetch(nodeUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(BURN_LOG_PAYLOAD)
        });
        
        if (!response.ok) return 'N/A';
        
        const json = await response.json();
        
        if (json.result && json.result.length > 0) {
            // Find the log entry with the highest blockNumber (most recent)
            const latestLog = json.result.reduce((prev, current) => 
                (parseInt(prev.blockNumber, 16) > parseInt(current.blockNumber, 16)) ? prev : current);

            // Fetch the timestamp of the block that contains the latest burn transaction
            const blockTimestamp = await fetchBlockTimestamp(nodeUrl, latestLog.blockHash);
            return blockTimestamp; // Returns an ISO string like '2025-12-14T...'
        }
        return 'N/A';
    } catch (error) {
        console.error("Failed to fetch burn log:", error.message);
        return 'N/A';
    }
}

// Helper to get the current block number
async function fetchBlockNumber(nodeUrl) {
    const response = await fetch(nodeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "eth_blockNumber", params: [] })
    });
    const json = await response.json();
    return parseInt(json.result || '0x0', 16);
}

// Helper to get the block timestamp from its hash
async function fetchBlockTimestamp(nodeUrl, blockHash) {
    const response = await fetch(nodeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: "2.0", id: 4, method: "eth_getBlockByHash", params: [blockHash, false] })
    });
    const json = await response.json();
    if (json.result && json.result.timestamp) {
        const timestampSeconds = parseInt(json.result.timestamp, 16);
        return new Date(timestampSeconds * 1000).toISOString();
    }
    return 'N/A';
}


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

// Helper for safe percentage change (remains the same)
function safePercentageChange(currentPrice, previousPrice) {
    if (previousPrice > 0) {
        return ((currentPrice - previousPrice) / previousPrice) * 100;
    }
    return 0;
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
    if (!OPENSEA_API_KEY || !ALCHEMY_API_KEY) {
        throw new Error("API Key(s) are missing or blank.");
    }

    // 2. INITIATE CONCURRENT API CALLS 
    const [openSeaStatsResponse, coinGeckoResponse, contractSupply, lastPopTime] = await Promise.all([
        fetch(OPEN_SEA_STATS_URL, {
            method: 'GET',
            headers: { 'accept': 'application/json', 'X-API-Key': OPENSEA_API_KEY }
        }),
        fetch(ETH_USD_CONVERSION_URL),
        fetchContractSupply(ETH_NODE_URL),
        // FIXED CALL: Fetch last burn time from Alchemy
        fetchLastBurnEvent(ETH_NODE_URL) 
    ]);

    // 3. PROCESS OPENSEA STATS RESPONSE 
    if (!openSeaStatsResponse.ok) {
        throw new Error(`OpenSea Stats API error: ${openSeaStatsResponse.status}.`);
    }
    const statsData = await openSeaStatsResponse.json();
    const stats = statsData.total;
    
    // Extract Core Metrics
    const floorPriceValue = parseFloat(stats.floor_price) || 0;
    const allTimeVolumeValue = parseFloat(stats.volume) || 0; 
    const uniqueOwners = parseInt(stats.num_owners) || 0; 
    const currency = stats.floor_price_symbol || 'ETH';
    
    // --- 24H CHANGE AND VOLUME LOGIC ---
    let priceChange24h = 0;
    let volume24h = 0; 

    if (statsData.intervals && statsData.intervals.length > 0) {
        const interval24h = statsData.intervals.find(i => i.interval === 'one_day') || statsData.intervals[0];
        if (interval24h) {
            const previousFloor24h = parseFloat(interval24h.floor_price) || 0;
            volume24h = parseFloat(interval24h.volume) || 0; 
            priceChange24h = safePercentageChange(floorPriceValue, previousFloor24h);
        }
    }
    
    // 4. DETERMINE TOTAL SUPPLY 
    let totalSupply = contractSupply;
    if (totalSupply === 0) {
        totalSupply = uniqueOwners;
    }
    
    // --- CALCULATE POPPED BUBBLES ---
    const poppedBubbles = INITIAL_SUPPLY - totalSupply;

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
      price_change_24h: priceChange24h.toFixed(2), 
      holders: uniqueOwners, 
      lastUpdated: new Date().toISOString(),
      supply: totalSupply,
      popped: poppedBubbles,
      last_pop_time: lastPopTime // Now correctly sourced from the contract burn event
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

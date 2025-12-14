// api/cron-update.js - FINAL ATTEMPT: Chunked Alchemy Log Search for Custom 'Pop' Event

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
const BUBBLES_CONTRACT_ADDRESS = "0x45025cd9587206f7225f2f5f8a5b146350faf0a8"; 
const INITIAL_SUPPLY = 2394770; // Corrected supply value

const ETH_NODE_URL = `https://shape-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`; 

const OPEN_SEA_STATS_URL = `https://api.opensea.io/api/v2/collections/${COLLECTION_SLUG}/stats`;
const ETH_USD_CONVERSION_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'; 

// --- CUSTOM POP EVENT SIGNATURE (Topic 0 for Pop(uint256, address)) ---
const POP_EVENT_TOPIC = "0x1809090623f9976378e9b049d115e87a276188e7d8d217983050942d992982d6"; 

// JSON-RPC Payload (for total supply, remains the same)
const TOTAL_SUPPLY_PAYLOAD = {
    jsonrpc: "2.0",
    id: 1,
    method: "eth_call",
    params: [{ to: BUBBLES_CONTRACT_ADDRESS, data: "0x18160ddd" }, "latest"]
};


// ----------------------------------------------------
// FUNCTION: Helper to get the current block number
// ----------------------------------------------------
async function fetchBlockNumber(nodeUrl) {
    const response = await fetch(nodeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "eth_blockNumber", params: [] })
    });
    const json = await response.json();
    return parseInt(json.result || '0x0', 16);
}

// ----------------------------------------------------
// FUNCTION: Helper to get the block timestamp from its hash
// ----------------------------------------------------
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

// ----------------------------------------------------
// FUNCTION: Chunked Log Search (Targeting Pop Event)
// ----------------------------------------------------
async function fetchLastPopEvent(nodeUrl) {
    if (!ALCHEMY_API_KEY) return 'N/A';
    
    // Limits: Max total search range and the size of each chunk
    const MAX_TOTAL_SEARCH_BLOCKS = 500000; // Search up to ~2 months back
    const CHUNK_SIZE = 50000; // Safe chunk size for API limits

    try {
        const currentBlock = await fetchBlockNumber(nodeUrl);
        let latestLog = null;

        // Loop backwards in chunks
        for (let i = 0; i < MAX_TOTAL_SEARCH_BLOCKS; i += CHUNK_SIZE) {
            const endBlock = currentBlock - i;
            const startBlock = Math.max(0, currentBlock - (i + CHUNK_SIZE)); 
            
            // Format block numbers to hex
            const fromBlockHex = "0x" + startBlock.toString(16);
            const toBlockHex = "0x" + endBlock.toString(16);

            const POP_LOG_PAYLOAD = {
                jsonrpc: "2.0",
                id: 2,
                method: "eth_getLogs",
                params: [{
                    address: BUBBLES_CONTRACT_ADDRESS,
                    fromBlock: fromBlockHex, 
                    toBlock: toBlockHex,
                    topics: [
                        POP_EVENT_TOPIC 
                    ]
                }]
            };

            const response = await fetch(nodeUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(POP_LOG_PAYLOAD)
            });

            if (!response.ok) {
                // If a chunk fails due to a status error, stop and report
                return `N/A (Alchemy Status Error on block ${startBlock} to ${endBlock})`;
            }

            const json = await response.json();
            
            if (json.error) {
                // If a chunk fails due to an RPC error, stop and report
                return `N/A (Alchemy RPC Error: ${json.error.message})`;
            }

            if (json.result && json.result.length > 0) {
                // If logs are found, take the most recent one in this chunk
                const foundLog = json.result.reduce((prev, current) => 
                    (parseInt(prev.blockNumber, 16) > parseInt(current.blockNumber, 16)) ? prev : current);

                if (!latestLog || parseInt(foundLog.blockNumber, 16) > parseInt(latestLog.blockNumber, 16)) {
                    latestLog = foundLog;
                }
                
                // Since we are searching backwards, the first log found in the FIRST successful chunk 
                // is likely the absolute latest. We can stop here for efficiency.
                break;
            }
        } // End of loop

        if (latestLog) {
            // If a log was found, fetch its timestamp
            const blockTimestamp = await fetchBlockTimestamp(nodeUrl, latestLog.blockHash);
            return blockTimestamp; 
        }

        return 'N/A (No Pop Event Found in Range)';

    } catch (error) {
        console.error("Critical error in fetchLastPopEvent:", error.message);
        return 'N/A (Critical Error)';
    }
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
        throw new Error("API Key(s) are missing or blank (requires OpenSea and Alchemy keys).");
    }

    // 2. INITIATE CONCURRENT API CALLS 
    const [openSeaStatsResponse, coinGeckoResponse, contractSupply, lastPopTime] = await Promise.all([
        fetch(OPEN_SEA_STATS_URL, {
            method: 'GET',
            headers: { 'accept': 'application/json', 'X-API-Key': OPENSEA_API_KEY }
        }),
        fetch(ETH_USD_CONVERSION_URL),
        fetchContractSupply(ETH_NODE_URL),
        fetchLastPopEvent(ETH_NODE_URL) // FIXED: Chunked log search
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
    const poppedBubbles = Math.max(0, INITIAL_SUPPLY - totalSupply);

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
      last_pop_time: lastPopTime 
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

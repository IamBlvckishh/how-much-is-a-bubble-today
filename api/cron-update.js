// api/cron-update.js - FINAL OPTIMIZED CORE: Floor Price + Market Cap

// ----------------------------------------------------
// ENVIRONMENT VARIABLES & CONFIGURATION
// ----------------------------------------------------
const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY; 
const COLLECTION_SLUG = "bubbles-by-xcopy"; 

const OPEN_SEA_STATS_URL = `https://api.opensea.io/api/v2/collections/${COLLECTION_SLUG}/stats`;
const ETH_USD_CONVERSION_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'; 


// --- Main Handler Function ---
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).send({ message: 'Only GET or POST requests allowed' });
  }
  
  console.log(`Starting concurrent data update for ${COLLECTION_SLUG}...`);

  try {
    if (!OPENSEA_API_KEY) {
        throw new Error("OpenSea API Key is missing or blank. Check Vercel settings.");
    }

    // 1. INITIATE CONCURRENT API CALLS (Promise.all() for maximum speed)
    const [openSeaResponse, coinGeckoResponse] = await Promise.all([
        // OpenSea Fetch
        fetch(OPEN_SEA_STATS_URL, {
            method: 'GET',
            headers: { 
                'accept': 'application/json',
                'X-API-Key': OPENSEA_API_KEY 
            }
        }),
        // CoinGecko Fetch
        fetch(ETH_USD_CONVERSION_URL)
    ]);

    // 2. PROCESS OPENSEA RESPONSE
    if (!openSeaResponse.ok) {
        const errorText = await openSeaResponse.text();
        throw new Error(`OpenSea API error: ${openSeaResponse.status}. Response: ${errorText}`);
    }
    const data = await openSeaResponse.json();
    const stats = data.total;
    
    // Parse core metrics including Market Cap
    const floorPriceValue = parseFloat(stats.floor_price) || 0;
    const marketCapETH = parseFloat(stats.market_cap) || 0; // <<< MARKET CAP ADDED
    const currency = stats.floor_price_symbol || 'ETH';


    // 3. PROCESS COINGECKO RESPONSE
    let ethUsdRate = null;
    if (coinGeckoResponse.ok) {
        const cgData = await coinGeckoResponse.json();
        ethUsdRate = cgData.ethereum.usd;
    } else {
        console.warn("CoinGecko fetch failed. Proceeding without live USD conversion.");
    }
    
    // 4. CALCULATE USD Metrics
    let floorPriceUSD = 'N/A';
    let marketCapUSD = 'N/A'; // <<< MARKET CAP USD ADDED

    if (ethUsdRate) {
        if (floorPriceValue > 0) {
            floorPriceUSD = (floorPriceValue * ethUsdRate).toFixed(2);
        }
        if (marketCapETH > 0) {
            // Convert to integer (no cents for large market cap numbers)
            marketCapUSD = (marketCapETH * ethUsdRate).toFixed(0); 
        }
    }
    
    // 5. CONSTRUCT FINAL RESPONSE
    const finalData = {
      price: floorPriceValue.toFixed(4), 
      currency: currency,
      usd: floorPriceUSD, 
      market_cap_eth: marketCapETH.toFixed(2), // <<< MARKET CAP ETH ADDED
      market_cap_usd: marketCapUSD,           // <<< MARKET CAP USD ADDED
      lastUpdated: new Date().toISOString(),
    };

    return res.status(200).json({ 
        message: 'Concurrent fetch successful with Market Cap.',
        data: finalData
    });

  } catch (error) {
    console.error("Critical Error during data job:", error);
    return res.status(500).json({ message: `Failed to fetch data: ${error.message}` });
  }
}

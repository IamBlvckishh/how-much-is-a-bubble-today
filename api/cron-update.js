// api/cron-update.js - FINAL CLEAN CORE: OpenSea Floor Price Only

// ----------------------------------------------------
// ENVIRONMENT VARIABLES & CONFIGURATION
// ----------------------------------------------------
const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY; 

// CONFIRMED SLUG
const COLLECTION_SLUG = "bubbles-by-xcopy"; 

const OPEN_SEA_STATS_URL = `https://api.opensea.io/api/v2/collections/${COLLECTION_SLUG}/stats`;
const ETH_USD_CONVERSION_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'; 


// --- Main Handler Function ---
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).send({ message: 'Only GET or POST requests allowed' });
  }
  
  console.log(`Starting core floor price update for ${COLLECTION_SLUG}...`);

  try {
    if (!OPENSEA_API_KEY) {
        throw new Error("OpenSea API Key is missing or blank. Check Vercel settings.");
    }

    // 1. INITIATE CONCURRENT API CALLS (Promise.all() for speed)
    const [openSeaResponse, coinGeckoResponse] = await Promise.all([
        fetch(OPEN_SEA_STATS_URL, {
            method: 'GET',
            headers: { 
                'accept': 'application/json',
                'X-API-Key': OPENSEA_API_KEY 
            }
        }),
        fetch(ETH_USD_CONVERSION_URL)
    ]);


    // 2. PROCESS OPENSEA RESPONSE
    if (!openSeaResponse.ok) {
        const errorText = await openSeaResponse.text();
        console.error(`OpenSea API Error: ${openSeaResponse.status} - ${errorText}`);
        throw new Error(`OpenSea API error: ${openSeaResponse.status}. Check SLUG or API Key.`);
    }

    const data = await openSeaResponse.json();
    const stats = data.total;
    
    // Parse core metric
    const floorPriceValue = parseFloat(stats.floor_price) || 0;
    const currency = stats.floor_price_symbol || 'ETH';


    // 3. PROCESS COINGECKO RESPONSE
    let ethUsdRate = null;
    if (coinGeckoResponse.ok) {
        const cgData = await coinGeckoResponse.json();
        ethUsdRate = cgData.ethereum.usd;
    } else {
        console.warn("CoinGecko fetch failed. Proceeding without live USD conversion.");
    }
    
    // 4. CALCULATE USD Metric
    let floorPriceUSD = 'N/A';

    if (ethUsdRate && floorPriceValue > 0) {
        floorPriceUSD = (floorPriceValue * ethUsdRate).toFixed(2);
    }
    
    // 5. CONSTRUCT FINAL RESPONSE
    const finalData = {
      price: floorPriceValue.toFixed(4), 
      currency: currency,
      usd: floorPriceUSD, 
      lastUpdated: new Date().toISOString(),
    };

    return res.status(200).json({ 
        message: 'Floor price via OpenSea. USD via CoinGecko.',
        data: finalData
    });

  } catch (error) {
    console.error("Error during floor price job:", error);
    return res.status(500).json({ message: `Failed to fetch price: ${error.message}` });
  }
}

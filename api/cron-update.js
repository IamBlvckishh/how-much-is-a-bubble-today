// api/cron-update.js - FINAL OPTIMIZED CODE: OpenSea Floor Price, Volume, Supply, and Market Cap

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
  
  console.log(`Starting floor price update using OpenSea for ${COLLECTION_SLUG}...`);

  try {
    // Check for API Key
    if (!OPENSEA_API_KEY) {
        throw new Error("OpenSea API Key is missing or blank. Check Vercel settings.");
    }

    // 1. INITIATE CONCURRENT API CALLS using Promise.all()
    // This executes the OpenSea and CoinGecko fetches simultaneously to reduce latency.
    const [openSeaResponse, coinGeckoResponse] = await Promise.all([
        // OpenSea Fetch (Authenticated)
        fetch(OPEN_SEA_STATS_URL, {
            method: 'GET',
            headers: { 
                'accept': 'application/json',
                'X-API-Key': OPENSEA_API_KEY 
            }
        }),
        // CoinGecko Fetch (Unauthenticated)
        fetch(ETH_USD_CONVERSION_URL)
    ]);


    // 2. PROCESS OPENSEA RESPONSE
    if (!openSeaResponse.ok) {
        const errorText = await openSeaResponse.text();
        console.error(`OpenSea API Error: ${openSeaResponse.status} - ${errorText}`);
        throw new Error(`OpenSea API error: ${openSeaResponse.status}. Check SLUG or API Key. Response: ${errorText}`);
    }

    const data = await openSeaResponse.json();
    const stats = data.total;
    
    // Parse core metrics
    const floorPriceValue = parseFloat(stats.floor_price) || 0;
    const totalVolumeValue = parseFloat(stats.volume) || 0;
    const totalSupplyValue = parseInt(stats.total_supply || stats.num_owners) || 0;
    const currency = stats.floor_price_symbol || 'ETH';


    // 3. PROCESS COINGECKO RESPONSE
    let ethUsdRate = null;
    if (coinGeckoResponse.ok) {
        const cgData = await coinGeckoResponse.json();
        ethUsdRate = cgData.ethereum.usd;
    } else {
        console.warn("CoinGecko fetch failed. Proceeding without live USD conversion.");
    }
    
    // 4. CALCULATE MARKET CAP and USD Metrics
    let floorPriceUSD = 'N/A';
    let totalVolumeUSD = 'N/A';
    let marketCapETH = 0;
    let marketCapUSD = 'N/A';

    if (floorPriceValue > 0) {
        marketCapETH = floorPriceValue * totalSupplyValue;
    }

    if (ethUsdRate) {
        if (floorPriceValue > 0) {
            floorPriceUSD = (floorPriceValue * ethUsdRate).toFixed(2);
        }
        if (totalVolumeValue > 0) {
            totalVolumeUSD = (totalVolumeValue * ethUsdRate).toFixed(0);
        }
        if (marketCapETH > 0) {
            marketCapUSD = (marketCapETH * ethUsdRate).toFixed(0);
        }
    }
    
    // 5. CONSTRUCT FINAL RESPONSE
    const finalData = {
      price: floorPriceValue.toFixed(4), 
      currency: currency,
      usd: floorPriceUSD, 
      volume: totalVolumeValue.toFixed(2),
      volume_usd: totalVolumeUSD,
      supply: totalSupplyValue,
      market_cap_eth: marketCapETH.toFixed(2),
      market_cap_usd: marketCapUSD,
      lastUpdated: new Date().toISOString()
    };

    return res.status(200).json({ 
        message: 'Floor price and stats via OpenSea. USD via CoinGecko.',
        data: finalData
    });

  } catch (error) {
    console.error("Error during floor price job:", error);
    return res.status(500).json({ message: `Failed to fetch price: ${error.message}` });
  }
}

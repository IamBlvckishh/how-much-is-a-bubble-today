// api/cron-update.js - OpenSea Floor Price + CoinGecko USD Conversion

// ----------------------------------------------------
// ENVIRONMENT VARIABLES: Ensure these are set in Vercel
// ----------------------------------------------------
const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY; 

// ----------------------------------------------------
// CONFIGURATION: Set the Collection Slug
// ----------------------------------------------------
// !!! CRITICAL: YOU MUST REPLACE 'YOUR-OPENSEA-SLUG' with the actual slug
// Example: 'boredapeyachtclub' 
const COLLECTION_SLUG = "BUBBLES-BY-XCOPY"; 

const OPEN_SEA_STATS_URL = `https://api.opensea.io/api/v2/collections/${COLLECTION_SLUG}/stats`;
const ETH_USD_CONVERSION_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'; 

/**
 * Helper function to fetch ETH/USD price from CoinGecko (No API Key required).
 */
async function fetchEthUsdPrice() {
    try {
        const response = await fetch(ETH_USD_CONVERSION_URL);
        if (!response.ok) return null;
        const data = await response.json();
        return data.ethereum.usd;
    } catch (error) {
        console.error("Failed to fetch ETH/USD conversion from CoinGecko:", error);
        return null;
    }
}


// --- Main Handler Function ---
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).send({ message: 'Only GET or POST requests allowed' });
  }
  
  console.log(`Starting floor price update using OpenSea for ${COLLECTION_SLUG}...`);

  try {
    // 1. Fetch Floor Price (from OpenSea, Authenticated)
    const openSeaResponse = await fetch(OPEN_SEA_STATS_URL, {
        method: 'GET',
        headers: { 
            'accept': 'application/json',
            // OpenSea uses the custom header for V2 API calls
            'X-API-Key': OPENSEA_API_KEY 
        }
    });

    if (!openSeaResponse.ok) {
        const errorText = await openSeaResponse.text();
        console.error(`OpenSea API Error: ${openSeaResponse.status} - ${errorText}`);
        throw new Error(`OpenSea API error: ${openSeaResponse.status}. Check SLUG or API Key.`);
    }

    const data = await openSeaResponse.json();
    
    // OpenSea V2 returns stats within a 'total' object
    const stats = data.total;
    
    const floorPriceValue = parseFloat(stats.floor_price) || 0;
    const currency = stats.floor_price_symbol || 'ETH';
    
    // 2. Fetch ETH/USD Conversion Rate (from CoinGecko)
    const ethUsdRate = await fetchEthUsdPrice();

    // 3. Calculate Final Prices
    let floorPriceUSD = 'N/A';
    
    if (floorPriceValue > 0 && ethUsdRate) {
        floorPriceUSD = (floorPriceValue * ethUsdRate).toFixed(2);
    }
    
    const finalFloorData = {
      price: floorPriceValue.toFixed(4), 
      currency: currency,
      usd: floorPriceUSD, 
      lastUpdated: new Date().toISOString()
    };

    return res.status(200).json({ 
        message: 'Floor price via OpenSea. USD via CoinGecko.',
        data: finalFloorData
    });

  } catch (error) {
    console.error("Error during floor price job (OpenSea):", error);
    return res.status(500).json({ message: `Failed to fetch price: ${error.message}` });
  }
}

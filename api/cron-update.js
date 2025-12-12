// api/cron-update.js - Rarible Floor Price (SHAPE L2) + CoinGecko USD Conversion

const RARIBLE_API_KEY = process.env.RARIBLE_API_KEY; 
const CONTRACT_ADDRESS = "0x45025cd9587206f7225f2f5f8a5b146350faf0a8"; 
const BLOCKCHAIN_GROUP = "SHAPE";
const COLLECTION_ID = `${BLOCKCHAIN_GROUP}:${CONTRACT_ADDRESS}`;

const FLOOR_PRICE_URL = `https://api.rarible.org/v0.1/data/collections/${COLLECTION_ID}/floorPrice`;
const ETH_USD_CONVERSION_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'; // New, reliable endpoint

/**
 * Helper function to make an authenticated Rarible fetch for Floor Price.
 */
async function fetchRaribleFloor(url) {
    if (!RARIBLE_API_KEY) {
        throw new Error("API Key configuration error: RARIBLE_API_KEY is missing.");
    }
    
    const response = await fetch(url, {
        method: 'GET',
        headers: { 
            'accept': 'application/json',
            'X-API-KEY': RARIBLE_API_KEY // Authenticated
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Rarible API error: ${response.status}. Full response: ${errorText}`);
    }
    return response.json();
}

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
        console.error("Failed to fetch ETH/USD conversion:", error);
        return null;
    }
}


// --- Main Handler Function ---
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).send({ message: 'Only GET or POST requests allowed' });
  }
  
  console.log(`Starting floor price update for ${COLLECTION_ID}...`);

  try {
    // 1. Fetch Floor Price (from Rarible, Authenticated)
    const floorData = await fetchRaribleFloor(FLOOR_PRICE_URL);
    const floorPriceValue = parseFloat(floorData.value);
    const currency = floorData.currency?.symbol || 'ETH';
    
    // 2. Fetch ETH/USD Conversion Rate (from CoinGecko, Unauthenticated)
    const ethUsdRate = await fetchEthUsdPrice();

    // 3. Calculate Final Prices
    let floorPriceUSD = 'N/A';
    
    if (isNaN(floorPriceValue) || floorPriceValue <= 0) {
        // If price is 0, we set a default USD N/A but confirm the ETH price is known.
        console.log("Rarible returned floor price of 0. Collection may have no active listings.");
    } else if (ethUsdRate) {
        floorPriceUSD = (floorPriceValue * ethUsdRate).toFixed(2);
    }
    
    const finalFloorData = {
      price: floorPriceValue.toFixed(4), 
      currency: currency,
      usd: floorPriceUSD, 
      lastUpdated: new Date().toISOString()
    };

    return res.status(200).json({ 
        message: 'Floor price via Rarible. USD via CoinGecko.',
        data: finalFloorData
    });

  } catch (error) {
    console.error("Error during floor price job:", error);
    return res.status(500).json({ message: `Failed to fetch price: ${error.message}` });
  }
}

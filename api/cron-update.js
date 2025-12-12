// api/cron-update.js - Final Code using Rarible API for Shape L2 Floor Price

// ----------------------------------------------------
// ENVIRONMENT VARIABLES: Ensure these are set in Vercel
// ----------------------------------------------------
const RARIBLE_API_KEY = process.env.RARIBLE_API_KEY; 

// ----------------------------------------------------
// CONFIGURATION: Set the Chain Slug and Contract Address
// ----------------------------------------------------
const CONTRACT_ADDRESS = "0x45025cd9587206f7225f2f5f8a5b146350faf0a8"; 
const BLOCKCHAIN_GROUP = "SHAPE"; // Confirmed Slug for Shape L2
const COLLECTION_ID = `${BLOCKCHAIN_GROUP}:${CONTRACT_ADDRESS}`;

// Rarible Endpoint URLs
const FLOOR_PRICE_URL = `https://api.rarible.org/v0.1/data/collections/${COLLECTION_ID}/floorPrice`;
const USD_RATE_BASE_URL = `https://api.rarible.org/v0.1/data/currencies/${BLOCKCHAIN_GROUP}`;


/**
 * Helper function to make an authenticated Rarible fetch.
 * This is used for BOTH the floor price and the USD rate,
 * as the 403 error confirmed the USD rate also needs the key.
 */
async function fetchRarible(url) {
    // Crucial check: If the API key is not loaded from Vercel, throw an error
    if (!RARIBLE_API_KEY) {
        throw new Error("API Key configuration error: RARIBLE_API_KEY is missing or blank.");
    }
    
    const response = await fetch(url, {
        method: 'GET',
        headers: { 
            'accept': 'application/json',
            // FIX: Using the required custom header for API keys
            'X-API-KEY': RARIBLE_API_KEY 
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`Rarible API Error: ${response.status} - ${errorText}`);
        throw new Error(`Rarible API error: ${response.status}. Please check Vercel logs and API key permissions.`);
    }

    return response.json();
}


// --- Main Handler Function ---
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).send({ message: 'Only GET or POST requests allowed' });
  }
  
  console.log(`Starting floor price update using Rarible for ${COLLECTION_ID}...`);

  try {
    // 1. Fetch Floor Price (Authenticated)
    const floorData = await fetchRarible(FLOOR_PRICE_URL);

    const floorPriceValue = parseFloat(floorData.value);
    const currency = floorData.currency?.symbol || 'ETH';
    
    // Check if a valid floor price was returned
    if (isNaN(floorPriceValue) || floorPriceValue <= 0) {
        throw new Error("Floor price returned as invalid or zero. Collection may be unlisted or inactive.");
    }


    // 2. Fetch USD Conversion Rate (Authenticated - FIX for 403 on rate endpoint)
    const usdRateURL = `${USD_RATE_BASE_URL}:${currency}/rates`;
    
    const rateData = await fetchRarible(usdRateURL); // <<< Using the authenticated helper!
    
    const ethUsdRate = parseFloat(rateData.rate) || null; 

    // 3. Calculate Final Prices
    let floorPriceUSD = 'N/A';

    if (ethUsdRate) {
        floorPriceUSD = (floorPriceValue * ethUsdRate).toFixed(2);
    }
    
    const finalFloorData = {
      price: floorPriceValue.toFixed(4), 
      currency: currency,
      usd: floorPriceUSD, 
      lastUpdated: new Date().toISOString()
    };

    return res.status(200).json({ 
        message: 'Floor price and USD rate fetched successfully via Rarible.',
        data: finalFloorData
    });

  } catch (error) {
    console.error("Error during floor price job (Rarible):", error);
    return res.status(500).json({ message: `Failed to fetch price: ${error.message}` });
  }
}

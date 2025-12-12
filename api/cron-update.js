// api/cron-update.js - Using Rarible API for Shape L2 Floor Price

// ----------------------------------------------------
// ENVIRONMENT VARIABLES: Ensure these are set in Vercel
// ----------------------------------------------------
const RARIBLE_API_KEY = process.env.RARIBLE_API_KEY; 

// ----------------------------------------------------
// CONFIGURATION: Set the Chain Slug and Contract Address
// ----------------------------------------------------
const CONTRACT_ADDRESS = "0x45025cd9587206f7225f2f5f8a5b146350faf0a8"; 
const BLOCKCHAIN_GROUP = "SHAPE"; // CONFIRMED SLUG FOR SHAPE L2
const COLLECTION_ID = `${BLOCKCHAIN_GROUP}:${CONTRACT_ADDRESS}`;

// Rarible Endpoint to get collection floor price
const FLOOR_PRICE_URL = `https://api.rarible.org/v0.1/data/collections/${COLLECTION_ID}/floorPrice`;
// Rarible Endpoint to get USD rate (uses same blockchain group and symbol)
const USD_RATE_BASE_URL = `https://api.rarible.org/v0.1/data/currencies/${BLOCKCHAIN_GROUP}`;


// --- Helper function to make an authenticated Rarible fetch ---
async function fetchRarible(url) {
    const response = await fetch(url, {
        method: 'GET',
        headers: { 
            'accept': 'application/json',
            // FIX for 403 Error: Using the recommended custom header for API keys
            'X-API-KEY': RARIBLE_API_KEY 
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`Rarible API Error: ${response.status} - ${errorText}`);
        throw new Error(`Rarible API error: ${response.status}. Check BLOCKCHAIN_GROUP, API Key, or contract.`);
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
    // 1. Fetch Floor Price
    const floorData = await fetchRarible(FLOOR_PRICE_URL);

    const floorPriceETH = parseFloat(floorData.value);
    const currency = floorData.currency?.symbol || 'ETH';
    
    // 2. Fetch USD Conversion Rate using Rarible's dedicated endpoint
    const usdRateURL = `${USD_RATE_BASE_URL}:${currency}/rates`;
    
    // NOTE: USD rate endpoint often does NOT require the API key. We will use a regular fetch.
    const rateResponse = await fetch(usdRateURL);
    
    if (!rateResponse.ok) {
         console.warn(`Could not fetch USD rate: ${rateResponse.status}`);
         // Proceed without USD if the rate fetch fails
         return res.status(200).json({ 
            message: 'Floor price fetched successfully, but USD rate failed.',
            data: {
                price: floorPriceETH.toFixed(4), 
                currency: currency,
                usd: 'N/A', 
                lastUpdated: new Date().toISOString()
            }
        });
    }

    const rateData = await rateResponse.json();
    const ethUsdRate = parseFloat(rateData.rate) || null; 

    // 3. Calculate Final Prices
    let floorPriceUSD = 'N/A';

    if (ethUsdRate && floorPriceETH) {
        floorPriceUSD = (floorPriceETH * ethUsdRate).toFixed(2);
    }
    
    const finalFloorData = {
      price: floorPriceETH.toFixed(4), 
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

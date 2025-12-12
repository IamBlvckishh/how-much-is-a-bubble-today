// api/cron-update.js - Using Rarible API for NFT Floor Price (Best Fit for Multi-Chain)

// Securely load the Rarible Key from Vercel Environment Variables
const RARIBLE_API_KEY = process.env.RARIBLE_API_KEY; 

// Contract Address
const CONTRACT_ADDRESS = "0x45025cd9587206f7225f2f5f8a5b146350faf0a8"; 
// **CRITICAL:** Rarible uses a Union format: ${blockchainGroup}:${contractAddress}
// You must confirm the exact 'blockchainGroup' for Shape L2 (e.g., 'ETHEREUM', 'POLYGON', 'ARBITRUM', etc.)
const BLOCKCHAIN_GROUP = "SHAPE"; // Placeholder - Change this to the correct Shape L2 group if known
const COLLECTION_ID = `${BLOCKCHAIN_GROUP}:${CONTRACT_ADDRESS}`;

// Rarible Endpoint to get collection floor price
const RARIBLE_URL = `https://api.rarible.org/v0.1/data/collections/${COLLECTION_ID}/floorPrice`;


export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).send({ message: 'Only GET or POST requests allowed' });
  }
  
  console.log(`Starting floor price update using Rarible for ${COLLECTION_ID}...`);

  try {
    const raribleResponse = await fetch(RARIBLE_URL, {
        method: 'GET',
        headers: { 
            'accept': 'application/json',
            // Rarible uses the API Key in a custom header, check their specific documentation for format
            // Often, it's passed as a Bearer token or directly in the URL query.
            // For general API usage, we'll assume a standard Bearer token for now:
            'Authorization': `Bearer ${RARIBLE_API_KEY}` 
        }
    });

    if (!raribleResponse.ok) {
        const errorText = await raribleResponse.text();
        console.error(`Rarible API error response: ${raribleResponse.status} - ${errorText}`);
        throw new Error(`Rarible API error: ${raribleResponse.status}. Check BLOCKCHAIN_GROUP, API Key, or contract.`);
    }

    const data = await raribleResponse.json();

    // --- Parsing Rarible Response Structure ---
    // Rarible's floorPrice endpoint returns a simple object: { value: "...", currency: { symbol: "ETH" } }
    
    const floorPriceETH = parseFloat(data.value);
    const currency = data.currency?.symbol || 'ETH';
    
    // IMPORTANT: Rarible also has a separate endpoint to get USD rates. 
    // To keep this simple and in one call, we will fetch the USD price 
    // using the Rarible endpoint designed for currency conversion.

    // 1. Fetch USD Conversion Rate using Rarible's dedicated endpoint
    const usdRateURL = `https://api.rarible.org/v0.1/data/currencies/${BLOCKCHAIN_GROUP}:${currency}/rates`;
    const rateResponse = await fetch(usdRateURL);
    const rateData = await rateResponse.json();
    
    const ethUsdRate = parseFloat(rateData.rate) || null; 

    // 2. Calculate Final Prices
    let floorPriceUSD = 'N/A';

    if (ethUsdRate && floorPriceETH) {
        floorPriceUSD = (floorPriceETH * ethUsdRate).toFixed(2);
    }
    
    const floorData = {
      price: floorPriceETH.toFixed(4), 
      currency: currency,
      usd: floorPriceUSD, 
      lastUpdated: new Date().toISOString()
    };

    return res.status(200).json({ 
        message: 'Floor price fetched successfully via Rarible.',
        data: floorData
    });

  } catch (error) {
    console.error("Error during floor price job (Rarible):", error);
    return res.status(500).json({ message: `Failed to fetch price: ${error.message}` });
  }
}

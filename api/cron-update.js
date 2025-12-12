// api/cron-update.js

const fs = require('fs');
const path = require('path');
const MORALIS_API_KEY = process.env.MORALIS_API_KEY; // The API key is securely loaded from Vercel

// Contract Address for the collection you provided: 0x45025cd9587206f7225f2f5f8a5b146350faf0a8
const CONTRACT_ADDRESS = "0x45025cd9587206f7225f2f5f8a5b146350faf0a8"; 
const CHAIN = "eth"; // Assuming Ethereum mainnet

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).send({ message: 'Only GET or POST requests allowed' });
  }
  
  // Vercel Cron Jobs will send a POST request, but we also allow GET for testing
  // You might want to add a security check here to ensure the request comes from Vercel
  
  console.log("Starting daily floor price update...");

  try {
    const moralisResponse = await fetch(
      `https://deep-index.moralis.io/api/v2.2/nft/${CONTRACT_ADDRESS}/floorprice?chain=${CHAIN}`,
      {
        method: 'GET',
        headers: {
          'X-API-Key': MORALIS_API_KEY,
          'accept': 'application/json'
        }
      }
    );

    if (!moralisResponse.ok) {
      const errorText = await moralisResponse.text();
      throw new Error(`Moralis API error: ${moralisResponse.status} - ${errorText}`);
    }

    const data = await moralisResponse.json();
    
    // Moralis response structure:
    // { "nativePrice": { "value": "...", "decimals": 18, "name": "ETH" }, "usdPrice": "..." }

    const floorPriceETH = parseFloat(data.nativePrice.value) / (10**data.nativePrice.decimals);
    const floorPriceUSD = parseFloat(data.usdPrice).toFixed(2);
    const currency = data.nativePrice.name;

    const floorData = {
      price: floorPriceETH.toFixed(4), // Floor price in ETH, rounded to 4 decimals
      currency: currency,
      usd: floorPriceUSD, // Floor price in USD
      lastUpdated: new Date().toISOString()
    };

    // Vercel Serverless functions can write to the temporary filesystem (/tmp),
    // but cannot directly write back to the public/ folder of the deployed static site.
    // The most robust way to share data with a static frontend on Vercel is using Vercel KV (Redis).
    // For this simple example, we will save it to a JSON endpoint that the frontend will call.

    // A better approach: Use Vercel KV or another simple database.
    // Since we're keeping it simple, the frontend will call a separate Vercel function to get the data.
    
    // In a production environment, you would save this 'floorData' to a public storage.
    // Since this setup is basic, we will make a GET endpoint to return this data.
    
    return res.status(200).json({ 
        message: 'Floor price fetched successfully.',
        data: floorData
    });

  } catch (error) {
    console.error("Error during cron job:", error);
    return res.status(500).json({ message: 'Failed to fetch floor price.', error: error.message });
  }
}

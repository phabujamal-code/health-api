const express = require('express');
const axios = require('axios');
const NodeCache = require('node-cache');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const apiCache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });
app.use(express.json());

const authenticateApiKey = (req, res, next) => {
    const userApiKey = req.headers['x-api-key'] || req.query.api_key;
    const validKey = process.env.API_SECRET_KEY || 'biohack_secret_key_2026_demo';

    if (!userApiKey || userApiKey !== validKey) {
        return res.status(401).json({
            status: "error",
            code: 401,
            message: "Unauthorized: Invalid or missing API Key."
        });
    }
    next();
};

app.use('/api/', rateLimit({ windowMs: 1 * 60 * 1000, max: 60 }));

app.get('/', (req, res) => {
    res.json({ service: "Biohack DaaS API", status: "Online" });
});

app.get('/api/v1/supplement', authenticateApiKey, async (req, res) => {
    const barcode = req.query.barcode || '733739001801';
    const cacheKey = `supplement_${barcode}`;

    const cachedData = apiCache.get(cacheKey);
    if (cachedData) {
        return res.json({ status: "success", source: "cache_engine", data: cachedData });
    }

    try {
        const response = await axios.get(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`, {
            headers: { 'User-Agent': 'BiohackVibe-DaaS-Engine/1.0' }
        });

        if (!response.data || response.data.status === 0) {
            return res.status(404).json({ status: "error", message: "Product not found." });
        }

        const product = response.data.product;
        const enrichedData = {
            id: barcode,
            product_name: product.product_name || "Unknown Product",
            brand: product.brands || "Generic",
            ingredients: product.ingredients_text || "No details",
            verified: true
        };

        apiCache.set(cacheKey, enrichedData);
        return res.json({ status: "success", source: "live_origin", data: enrichedData });
    } catch (error) {
        return res.status(500).json({ status: "error", message: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
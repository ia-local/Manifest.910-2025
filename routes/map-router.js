const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs/promises');

// Assuming database.json is at the root of the project
const DATABASE_FILE_PATH = path.join(__dirname, '..', 'database.json');
const SATELLITES_DATA_FILE = path.join(__dirname, '..', 'data', 'satellites.json');

router.get('/api/map-data', async (req, res) => {
    try {
        const [allData, satellitesData] = await Promise.all([
            fs.readFile(DATABASE_FILE_PATH, 'utf8').then(JSON.parse),
            fs.readFile(SATELLITES_DATA_FILE, 'utf8').then(JSON.parse)
        ]);

        const combinedData = {
            ...allData,
            satellites: satellitesData
        };

        res.json(combinedData);
    } catch (error) {
        console.error('Failed to process map data:', error);
        res.status(500).json({ error: 'Failed to retrieve map data' });
    }
});

module.exports = router;
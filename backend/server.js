const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Support large payloads for sync

// Database Connection
const pool = new Pool({
    user: process.env.POSTGRES_USER || 'kemal',
    host: process.env.POSTGRES_HOST || 'postgres',
    database: process.env.POSTGRES_DB || 'youstream',
    password: process.env.POSTGRES_PASSWORD || 'kemal',
    port: 5432,
});

// Init DB
const initDb = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS subscriptions (
                author_id VARCHAR(255) PRIMARY KEY,
                author_name VARCHAR(255) NOT NULL,
                author_thumbnails JSONB,
                sub_count INT,
                last_updated TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('Database initialized successfully');
    } catch (err) {
        console.error('Error initializing database:', err);
    }
};

// Routes

// GET /api/subscriptions
app.get('/api/subscriptions', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM subscriptions ORDER BY author_name ASC');
        // Mapper pour correspondre au format frontend
        const subs = result.rows.map(row => ({
            authorId: row.author_id,
            author: row.author_name,
            authorThumbnails: row.author_thumbnails,
            subCount: row.sub_count
        }));
        res.json(subs);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// POST /api/subscriptions/sync
app.post('/api/subscriptions/sync', async (req, res) => {
    const { subscriptions } = req.body; // Array of { authorId, author }
    if (!Array.isArray(subscriptions)) return res.status(400).json({ error: 'Invalid data' });

    try {
        // Upsert subscriptions
        // Pour éviter de spammer la DB, on peut utiliser un batch ou une boucle
        // Ici on fait simple pour le prototype
        let newCount = 0;

        for (const sub of subscriptions) {
            // Check if exists
            const exists = await pool.query('SELECT 1 FROM subscriptions WHERE author_id = $1', [sub.authorId]);
            if (exists.rowCount === 0) {
                // Fetch thumbnail via Invidious logic from backend? Or expect frontend to send it?
                // Frontend sends only simple data. Backend should enrich.
                // We'll insert basic data first.
                await pool.query(
                    'INSERT INTO subscriptions (author_id, author_name, last_updated) VALUES ($1, $2, NOW())',
                    [sub.authorId, sub.author]
                );
                newCount++;
            }
        }

        // Trigger background thumbnail fetch (fire and forget)
        fetchMissingThumbnails();

        res.json({ message: 'Sync successful', newCount });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Sync failed' });
    }
});

// Background Worker for Thumbnails
const fetchMissingThumbnails = async () => {
    console.log('Starting background thumbnail fetch...');
    try {
        const missing = await pool.query("SELECT author_id FROM subscriptions WHERE author_thumbnails IS NULL LIMIT 20");
        for (const row of missing.rows) {
            try {
                // Call Invidious API
                // We assume Invidious is reachable as 'invidious' hostname in docker network
                const invidiousUrl = process.env.INVIDIOUS_URL || 'http://invidious:3000';
                const response = await axios.get(`${invidiousUrl}/api/v1/channels/${row.author_id}`);
                const data = response.data;

                if (data.authorThumbnails) {
                    await pool.query(
                        'UPDATE subscriptions SET author_thumbnails = $1, sub_count = $2 WHERE author_id = $3',
                        [JSON.stringify(data.authorThumbnails), data.subCount, row.author_id]
                    );
                    console.log(`Updated thumbnail for ${row.author_id}`);
                }
            } catch (e) {
                console.error(`Failed to fetch for ${row.author_id}`, e.message);
            }
            // Polite delay
            await new Promise(r => setTimeout(r, 1000));
        }
    } catch (err) {
        console.error('Worker error:', err);
    }
};

// Start server
app.listen(port, () => {
    console.log(`YouStream API listening on port ${port}`);
    // Wait for DB to be potentially ready (docker-compose handles startup order but usually safe to retry)
    setTimeout(initDb, 5000);
});

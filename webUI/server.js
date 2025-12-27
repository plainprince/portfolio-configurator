import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join, resolve, extname } from 'path';
import { readdir, stat, readFile, writeFile } from 'fs/promises';
import { bundleVariation, readBundledHTML, cleanupBundle } from './bundler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const PORT = 3000;

// Get parent directory (portfolio-page root)
const parentDir = resolve(__dirname, '..');

// Middleware
app.use(express.json());

// Serve static files from public folder
app.use(express.static(join(__dirname, 'public')));

// Serve index.html for variation root
app.get('/variation/:variationName', async (req, res) => {
    const { variationName } = req.params;
    const indexPath = join(parentDir, variationName, 'index.html');
    res.sendFile(indexPath);
});

// Serve static files from each variation directory
app.get('/variation/:variationName/*', async (req, res, next) => {
    const { variationName } = req.params;
    const filePath = req.params[0];
    const variationPath = join(parentDir, variationName, filePath);
    
    try {
        const stats = await stat(variationPath);
        if (stats.isFile()) {
            res.sendFile(variationPath);
        } else {
            res.status(404).send('File not found');
        }
    } catch (error) {
        res.status(404).send('File not found');
    }
});

// API endpoint to get list of variations
app.get('/api/variations', async (req, res) => {
    try {
        const entries = await readdir(parentDir, { withFileTypes: true });
        const variations = entries
            .filter(entry => entry.isDirectory() && /^variation\d+$/.test(entry.name))
            .map(entry => entry.name)
            .sort();
        res.json(variations);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read variations' });
    }
});

// API endpoint to get config for a variation
app.get('/api/config/:variationName', async (req, res) => {
    const { variationName } = req.params;
    const configPath = join(parentDir, variationName, 'data', 'config.json');
    
    try {
        const content = await readFile(configPath, 'utf-8');
        res.json(JSON.parse(content));
    } catch (error) {
        res.status(404).json({ error: 'Config not found' });
    }
});

// API endpoint to save config for a variation
app.post('/api/config/:variationName', async (req, res) => {
    const { variationName } = req.params;
    const configPath = join(parentDir, variationName, 'data', 'config.json');
    
    try {
        await writeFile(configPath, JSON.stringify(req.body, null, 4), 'utf-8');
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save config' });
    }
});

// API endpoint to download bundled variation as single HTML file
app.get('/api/download/:variationName', async (req, res) => {
    const { variationName } = req.params;
    console.log(`[DOWNLOAD] Starting download for: ${variationName}`);
    
    let bundlePath = null;
    
    try {
        // Bundle variation into single HTML file
        bundlePath = await bundleVariation(variationName);
        
        // Read the bundled HTML
        const htmlContent = await readBundledHTML(bundlePath);
        
        // Set response headers for HTML download
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${variationName}.html"`);
        
        // Send the HTML content
        res.send(htmlContent);
        
        console.log(`[DOWNLOAD] Successfully sent ${variationName}.html`);
        
    } catch (error) {
        console.error(`[DOWNLOAD] Error for ${variationName}:`, error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to bundle variation', details: error.message });
        }
    } finally {
        // Cleanup bundle
        if (bundlePath) {
            try {
                await cleanupBundle(bundlePath);
            } catch (error) {
                console.error(`[DOWNLOAD] Failed to cleanup bundle:`, error);
            }
        }
    }
});

app.listen(PORT, () => {
    console.log(`WebUI server running at http://localhost:${PORT}`);
});


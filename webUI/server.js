import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join, resolve, extname } from 'path';
import { readdir, stat, readFile, writeFile, rm, mkdtemp, cp } from 'fs/promises';
import { tmpdir } from 'os';
import archiver from 'archiver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const PORT = 3000;

// Get parent directory (portfolio-page root)
const parentDir = resolve(__dirname, '..');

async function bundleVariation(variationName) {
    const variationPath = join(parentDir, variationName);
    const tempDir = await mkdtemp(join(tmpdir(), 'portfolio-source-'));
    
    console.log(`[ZIP] Preparing source files for ${variationName}`);
    
    try {
        await cp(variationPath, tempDir, { recursive: true });
        return tempDir;
    } catch (error) {
        console.error(`[ZIP] Error preparing source:`, error);
        throw error;
    }
}

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
            .filter(entry => entry.isDirectory() && entry.name.startsWith('variation'))
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

// API endpoint to zip and download variation
app.get('/api/download/:variationName', async (req, res) => {
    const { variationName } = req.params;
    console.log(`[ZIP] Starting zip process for: ${variationName}`);
    
    let buildDir = null;
    
    try {
        // Build variation
        buildDir = await bundleVariation(variationName);
        
        // Set response headers for zip download
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename="portfolio.zip"');
        
        // Create archiver instance
        const archive = archiver('zip', {
            zlib: { level: 9 } // Maximum compression
        });
        
        // Handle archive errors
        archive.on('error', (err) => {
            console.error(`[ZIP] Archive error for ${variationName}:`, err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to create zip archive', details: err.message });
            }
        });
        
        // Pipe archive data to response
        archive.pipe(res);
        
        // Add built variation directory to archive
        archive.glob('**/*', {
            cwd: buildDir,
            ignore: ['.git/**']
        });
        
        // Finalize the archive
        await archive.finalize();
        
        console.log(`[ZIP] Zip process completed successfully for: ${variationName}`);
        
    } catch (error) {
        console.error(`[ZIP] Zip error for ${variationName}:`, error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to create zip archive', details: error.message });
        }
    } finally {
        // Cleanup build folder
        if (buildDir) {
            try {
                await rm(buildDir, { recursive: true, force: true });
                console.log(`[ZIP] Cleaned up build folder: ${buildDir}`);
            } catch (error) {
                console.error(`[ZIP] Failed to cleanup build folder:`, error);
            }
        }
    }
});

app.listen(PORT, () => {
    console.log(`WebUI server running at http://localhost:${PORT}`);
});


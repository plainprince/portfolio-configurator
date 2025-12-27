import { build } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdtemp, rm, readFile, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { minify } from 'terser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const parentDir = resolve(__dirname, '..');

/**
 * Custom Vite plugin to inline config.json and convert non-module scripts
 * @param {string} variationPath - Path to the variation directory
 */
function inlineConfigAndScripts(variationPath) {
    return {
        name: 'inline-config-and-scripts',
        enforce: 'post',
        async transformIndexHtml(html) {
            try {
                // Read the config.json file
                const configPath = join(variationPath, 'data', 'config.json');
                const configContent = await readFile(configPath, 'utf-8');
                const configJson = JSON.parse(configContent);
                
                console.log(`[BUNDLE]   → Inlining config.json (${(configContent.length / 1024).toFixed(2)} KB)`);
                
                // Inject a script that intercepts fetch calls to config.json
                const configScript = `
<script>
(function() {
    const originalFetch = window.fetch;
    const configData = ${JSON.stringify(configJson)};
    window.fetch = function(url, options) {
        if (typeof url === 'string' && url.includes('config.json')) {
            return Promise.resolve(new Response(JSON.stringify(configData), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            }));
        }
        return originalFetch.apply(this, arguments);
    };
})();
</script>`;

                // Find all script tags and inline them
                const scriptRegex = /<script\s+src="([^"]+)"><\/script>/g;
                const scripts = [];
                let match;
                
                while ((match = scriptRegex.exec(html)) !== null) {
                    const scriptSrc = match[1];
                    const scriptPath = join(variationPath, scriptSrc);
                    try {
                        const scriptContent = await readFile(scriptPath, 'utf-8');
                        scripts.push({ src: scriptSrc, content: scriptContent });
                    } catch (error) {
                        console.warn(`[BUNDLE]   ⚠ Could not read script: ${scriptSrc}`);
                    }
                }
                
                if (scripts.length > 0) {
                    console.log(`[BUNDLE]   → Inlining ${scripts.length} script(s)`);
                    
                    // Remove all script tags
                    let processedHtml = html;
                    scripts.forEach(script => {
                        const scriptTag = `<script src="${script.src}"></script>`;
                        processedHtml = processedHtml.replace(scriptTag, '');
                    });
                    
                    // Combine all scripts with newlines between them
                    let combinedScript = scripts.map(s => s.content).join('\n\n');
                    
                    // Minify/uglify the combined script
                    try {
                        console.log(`[BUNDLE]   → Minifying JavaScript...`);
                        const minified = await minify(combinedScript, {
                            compress: {
                                dead_code: true,
                                drop_console: false,
                                drop_debugger: true,
                                keep_classnames: false,
                                keep_fnames: false,
                            },
                            mangle: {
                                toplevel: true,
                            },
                            format: {
                                comments: false,
                            },
                        });
                        
                        if (minified.code) {
                            const originalSize = (combinedScript.length / 1024).toFixed(2);
                            const minifiedSize = (minified.code.length / 1024).toFixed(2);
                            const savings = ((1 - minified.code.length / combinedScript.length) * 100).toFixed(1);
                            console.log(`[BUNDLE]   → Minified: ${originalSize} KB → ${minifiedSize} KB (${savings}% reduction)`);
                            combinedScript = minified.code;
                        }
                    } catch (error) {
                        console.warn(`[BUNDLE]   ⚠ Minification failed, using unminified code:`, error.message);
                    }
                    
                    // Insert config script and inlined scripts before </body>
                    const bodyEnd = processedHtml.lastIndexOf('</body>');
                    if (bodyEnd !== -1) {
                        const beforeBody = processedHtml.substring(0, bodyEnd);
                        const afterBody = processedHtml.substring(bodyEnd);
                        
                        processedHtml = beforeBody + 
                            configScript + '\n' +
                            '<script>' + combinedScript + '</script>\n' +
                            afterBody;
                    }
                    
                    return processedHtml;
                }
                
                // If no scripts to inline, just add config script
                const insertPosition = html.indexOf('<script');
                if (insertPosition !== -1) {
                    return html.slice(0, insertPosition) + configScript + html.slice(insertPosition);
                } else {
                    return html.replace('</head>', configScript + '</head>');
                }
            } catch (error) {
                console.warn('[BUNDLE]   ✗ Could not process config/scripts:', error.message);
                return html;
            }
        }
    };
}

/**
 * Bundle a variation into a single HTML file using Vite
 * @param {string} variationName - Name of the variation to bundle (e.g., 'variation1')
 * @returns {Promise<string>} - Path to the bundled HTML file
 */
export async function bundleVariation(variationName) {
    const variationPath = join(parentDir, variationName);
    const tempOutDir = await mkdtemp(join(tmpdir(), 'portfolio-bundle-'));
    
    console.log(`[BUNDLE] Starting bundle for ${variationName}`);
    
    try {
        const startTime = Date.now();
        
        // Build with Vite using vite-plugin-singlefile
        await build({
            root: variationPath,
            plugins: [
                inlineConfigAndScripts(variationPath),
                viteSingleFile()
            ],
            build: {
                outDir: tempOutDir,
                emptyOutDir: true,
                assetsInlineLimit: Number.MAX_SAFE_INTEGER, // Inline all assets
                cssCodeSplit: false,
                rollupOptions: {
                    output: {
                        inlineDynamicImports: true,
                    },
                },
            },
            logLevel: 'silent',
        });
        
        const duration = Date.now() - startTime;
        const bundlePath = join(tempOutDir, 'index.html');
        const bundleContent = await readFile(bundlePath, 'utf-8');
        const sizeKB = (bundleContent.length / 1024).toFixed(2);
        
        console.log(`[BUNDLE] ✓ Successfully bundled ${variationName} (${duration}ms, ${sizeKB} KB)`);
        
        // Return path to the bundled index.html
        return bundlePath;
    } catch (error) {
        console.error(`[BUNDLE] Error bundling ${variationName}:`, error);
        // Cleanup on error
        await rm(tempOutDir, { recursive: true, force: true }).catch(() => {});
        throw error;
    }
}

/**
 * Read the bundled HTML file content
 * @param {string} bundlePath - Path to the bundled HTML file
 * @returns {Promise<string>} - HTML file content
 */
export async function readBundledHTML(bundlePath) {
    return await readFile(bundlePath, 'utf-8');
}

/**
 * Cleanup temporary bundle directory
 * @param {string} bundlePath - Path to the bundled HTML file
 */
export async function cleanupBundle(bundlePath) {
    const bundleDir = dirname(bundlePath);
    await rm(bundleDir, { recursive: true, force: true });
    console.log(`[BUNDLE] Cleaned up: ${bundleDir}`);
}


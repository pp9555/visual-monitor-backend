// import { Worker } from 'bullmq';
// import mongoose from 'mongoose';
// import puppeteer from 'puppeteer-extra';
// import StealthPlugin from 'puppeteer-extra-plugin-stealth';
// import fs from 'fs';
// import { PNG } from 'pngjs';
// import pixelmatch from 'pixelmatch';

// puppeteer.use(StealthPlugin());

// const MONGODB_URI = 'mongodb://127.0.0.1:27017/visual-saas';

// const MonitorSchema = new mongoose.Schema({
//     userId: String,
//     targetName: String,
//     baseUrl: String,
//     urlsToMonitor: [String],
//     localStorageTokens: Object,
//     alertThreshold: Number
// }, { strict: false });

// const Monitor = mongoose.models.Monitor || mongoose.model('Monitor', MonitorSchema);

// async function startWorker() {
//     console.log('Connecting to MongoDB...');
//     await mongoose.connect(MONGODB_URI);
//     console.log('✅ Connected. Worker is ready and listening for jobs...');

//     const workerOptions = {
//         connection: {
//             host: '127.0.0.1',
//             port: 6379,
//             maxRetriesPerRequest: null
//         }
//     };

//     const worker = new Worker('visual-scans', async job => {
//         const { userId } = job.data;
//         console.log(`\n📥 Received job to scan SaaS for user: ${userId}`);

//         const config = await Monitor.findOne({ userId });
//         if (!config) throw new Error('Configuration not found in DB');

//         console.log(`Launching isolated stealth browser for ${config.targetName}...`);
        
//         const browser = await puppeteer.launch({ 
//             headless: false, // Keep false while testing to watch it work
//             args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
//         });

//         try {
//             const page = await browser.newPage();
//             await page.setViewport({ width: 1280, height: 800 });

//             const safeBaseUrl = config.baseUrl.startsWith('http') ? config.baseUrl : `https://${config.baseUrl}`;

//             console.log(`Establishing domain context at ${safeBaseUrl}...`);
//             await page.goto(safeBaseUrl, { waitUntil: 'domcontentloaded' });

//             console.log('Injecting auth tokens...');
//             if (config.localStorageTokens) {
//                 await page.evaluate((tokens) => {
//                     for (const [key, value] of Object.entries(tokens)) {
//                         if (value) localStorage.setItem(key, value);
//                     }
//                 }, config.localStorageTokens);
//             }

//             for (const url of config.urlsToMonitor) {
//                 if (!url) continue;
                
//                 const safeUrl = url.startsWith('http') ? url : `https://${url}`;
//                 const pageName = safeUrl.split('/').filter(Boolean).pop().replace(/[^a-zA-Z0-9]/g, '-') || 'home';
                
//                 const baselinePath = `./baseline-${pageName}.png`;
//                 const currentPath = `./current-${pageName}.png`;
//                 const diffPath = `./diff-${pageName}.png`;

//                 console.log(`\n🔍 Scanning page: ${safeUrl}`);
//                 await page.goto(safeUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                
//                 console.log('Watching DOM structure (waiting for skeleton loaders to finish)...');
//                 await page.waitForFunction(() => {
//                     return new Promise((resolve) => {
//                         let lastElementCount = 0;
//                         let stableSeconds = 0;
                        
//                         const checkInterval = setInterval(() => {
//                             const currentElementCount = document.querySelectorAll('*').length;
//                             if (currentElementCount === lastElementCount && currentElementCount > 50) { 
//                                 stableSeconds++;
//                                 if (stableSeconds >= 4) {
//                                     clearInterval(checkInterval);
//                                     resolve(true);
//                                 }
//                             } else {
//                                 stableSeconds = 0;
//                                 lastElementCount = currentElementCount;
//                             }
//                         }, 1000);
//                     });
//                 }, { timeout: 45000 });

//                 console.log('✅ DOM is completely stable. React has finished rendering.');

//                 console.log('Masking dynamic elements (images, videos, ads)...');
//                 await page.evaluate(() => {
//                     const selectors = ['img', 'video', 'iframe', 'canvas', '[data-dynamic="true"]'];
//                     selectors.forEach(sel => {
//                         document.querySelectorAll(sel).forEach(el => {
//                             el.style.visibility = 'hidden';
//                         });
//                     });
//                 });

//                 if (!fs.existsSync(baselinePath)) {
//                     console.log(`📸 Creating initial baseline screenshot for ${pageName}...`);
//                     await page.screenshot({ path: baselinePath, fullPage: true });
//                     console.log('✅ Baseline saved. Run again to compare.');
//                     continue; 
//                 }

//                 console.log(`📸 Capturing current state...`);
//                 await page.screenshot({ path: currentPath, fullPage: true });

//                 console.log('🔍 Analyzing pixel differences...');
//                 const changePercentage = compareImages(baselinePath, currentPath, diffPath);
                
//                 console.log(`📊 Visual Change Detected: ${changePercentage}%`);

//             }

//         } catch (error) {
//             console.error(`❌ Job failed:`, error.message);
//             throw error; 
//         } finally {
//             await browser.close();
//             console.log(`🛑 Browser closed. Awaiting next job...`);
//         }
//     }, workerOptions); 

//     worker.on('completed', job => console.log(`🎉 Job ${job.id} completed successfully!`));
//     worker.on('failed', (job, err) => console.log(`💥 Job ${job.id} failed: ${err.message}`));
// }

// function compareImages(baselinePath, currentPath, diffPath) {
//     const img1 = PNG.sync.read(fs.readFileSync(baselinePath));
//     const img2 = PNG.sync.read(fs.readFileSync(currentPath));
    
//     const { width, height } = img1;
//     const diff = new PNG({ width, height });
    
//     const mismatchedPixels = pixelmatch(
//         img1.data, 
//         img2.data, 
//         diff.data, 
//         width, 
//         height, 
//         { threshold: 0.1 } 
//     );
    
//     fs.writeFileSync(diffPath, PNG.sync.write(diff));
    
//     return ((mismatchedPixels / (width * height)) * 100).toFixed(2);
// }

// startWorker();




import { Worker } from 'bullmq';
import mongoose from 'mongoose';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
dotenv.config();

puppeteer.use(StealthPlugin());

// --- CONFIGURATION ---
const MONGODB_URI = 'mongodb://127.0.0.1:27017/visual-saas';

// Cloudinary Setup - REPLACE THESE WITH YOUR KEYS!
cloudinary.config({ 
  cloud_name: 'doitoisrp', 
  api_key: '928779835413764', 
  api_secret: 'hXln7eYbdOdNA6RcuOayiFaYhOI' 
});

// --- HELPER FUNCTIONS ---
async function uploadToCloudinary(filePath) {
    try {
        const result = await cloudinary.uploader.upload(filePath, { folder: 'visual-saas' });
        return result.secure_url;
    } catch (error) {
        console.error(`Failed to upload ${filePath}:`, error.message);
        return null;
    }
}

async function sendWebhookAlert(webhookUrl, pageName, changePercentage, diffImageUrl) {
    if (!webhookUrl) return; // If they didn't provide a webhook, skip it
    
    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: `🚨 **Visual QA Alert!** 🚨\nYour page **${pageName}** changed by **${changePercentage}%**!\nSee the difference here: ${diffImageUrl}`
            })
        });
        console.log('🔔 Webhook alert successfully sent to user!');
    } catch (error) {
        console.error('Failed to send webhook:', error.message);
    }
}

// THE NEW HELPER: Downloads an image from a URL to the local hard drive
async function downloadImage(url, destPath) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch baseline image from Cloudinary`);
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(destPath, Buffer.from(buffer));
}

function compareImages(baselinePath, currentPath, diffPath) {
    const img1 = PNG.sync.read(fs.readFileSync(baselinePath));
    const img2 = PNG.sync.read(fs.readFileSync(currentPath));
    
    const { width, height } = img1;
    const diff = new PNG({ width, height });
    
    const mismatchedPixels = pixelmatch(
        img1.data, 
        img2.data, 
        diff.data, 
        width, 
        height, 
        { threshold: 0.1 } 
    );
    
    fs.writeFileSync(diffPath, PNG.sync.write(diff));
    
    return ((mismatchedPixels / (width * height)) * 100).toFixed(2);
}

// --- DATABASE SCHEMA ---
const MonitorSchema = new mongoose.Schema({
    userId: String,
    targetName: String,
    baseUrl: String,
    urlsToMonitor: [String],
    localStorageTokens: Object,
    alertThreshold: Number,
    webhookUrl: String, // <-- ADD THIS LINE
    lastScanResults: [{
        pageUrl: String,
        changePercentage: Number,
        status: String,
        baselineImageUrl: String, 
        currentImageUrl: String,  
        diffImageUrl: String,     
        scannedAt: { type: Date, default: Date.now }
    }]
}, { strict: false });

const Monitor = mongoose.models.Monitor || mongoose.model('Monitor', MonitorSchema);

// --- THE MAIN WORKER PROCESS ---
async function startWorker() {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected. Worker is ready and listening for jobs...');

    const workerOptions = {
        connection: {
            host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        tls: {}, // CRITICAL: Upstash requires this for secure connections
        maxRetriesPerRequest: null
        }
    };

    const worker = new Worker('visual-scans', async job => {
        // --- CHANGE THESE TWO LINES ---
        const { projectId } = job.data;
        console.log(`\n📥 Received job to scan SaaS for project: ${projectId}`);

        const config = await Monitor.findById(projectId); // Use findById instead of findOne
        // ------------------------------
        if (!config) throw new Error('Configuration not found in DB');

        console.log(`Launching isolated stealth browser for ${config.targetName}...`);
        
        const browser = await puppeteer.launch({ 
            headless: false, 
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
        });

        try {
            const page = await browser.newPage();
            await page.setViewport({ width: 1280, height: 800 });

            const safeBaseUrl = config.baseUrl.startsWith('http') ? config.baseUrl : `https://${config.baseUrl}`;

            console.log(`Establishing domain context at ${safeBaseUrl}...`);
            await page.goto(safeBaseUrl, { waitUntil: 'domcontentloaded' });

            if (config.localStorageTokens) {
                console.log('Injecting auth tokens...');
                await page.evaluate((tokens) => {
                    for (const [key, value] of Object.entries(tokens)) {
                        if (value) localStorage.setItem(key, value);
                    }
                }, config.localStorageTokens);
            }

            // We fetch existing results to see if we have cloud baselines already
            const existingResults = config.lastScanResults || [];
            const jobResults = [];

            for (const url of config.urlsToMonitor) {
                if (!url) continue;
                
                const safeUrl = url.startsWith('http') ? url : `https://${url}`;
                const pageName = safeUrl.split('/').filter(Boolean).pop().replace(/[^a-zA-Z0-9]/g, '-') || 'home';
                
                const baselinePath = `./baseline-${pageName}.png`;
                const currentPath = `./current-${pageName}.png`;
                const diffPath = `./diff-${pageName}.png`;

                console.log(`\n🔍 Scanning page: ${safeUrl}`);
                await page.goto(safeUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                
                console.log('Watching DOM structure (waiting for skeleton loaders to finish)...');
                await page.waitForFunction(() => {
                    return new Promise((resolve) => {
                        let lastElementCount = 0;
                        let stableSeconds = 0;
                        const checkInterval = setInterval(() => {
                            const currentElementCount = document.querySelectorAll('*').length;
                            if (currentElementCount === lastElementCount && currentElementCount > 50) { 
                                stableSeconds++;
                                if (stableSeconds >= 4) {
                                    clearInterval(checkInterval);
                                    resolve(true);
                                }
                            } else {
                                stableSeconds = 0;
                                lastElementCount = currentElementCount;
                            }
                        }, 1000);
                    });
                }, { timeout: 45000 });

                console.log('✅ DOM is completely stable. React has finished rendering.');

                console.log('Masking dynamic elements (images, videos, ads)...');
                await page.evaluate(() => {
                    const selectors = ['img', 'video', 'iframe', 'canvas', '[data-dynamic="true"]'];
                    selectors.forEach(sel => {
                        document.querySelectorAll(sel).forEach(el => { el.style.visibility = 'hidden'; });
                    });
                });

                // THE CLOUD LOGIC: Find the most recent scan for this specific URL
                const pastScansForThisPage = existingResults.filter(r => r.pageUrl === safeUrl);
                pastScansForThisPage.sort((a, b) => new Date(b.scannedAt) - new Date(a.scannedAt));
                const latestScan = pastScansForThisPage[0];
                const existingBaselineCloudUrl = latestScan?.baselineImageUrl;

                // IF NO BASELINE EXISTS (First time ever running this URL)
                if (!existingBaselineCloudUrl) {
                    console.log(`📸 No cloud baseline found. Creating initial baseline for ${pageName}...`);
                    await page.screenshot({ path: baselinePath, fullPage: true });
                    
                    console.log('☁️ Uploading new baseline to Cloudinary...');
                    const newBaselineCloudUrl = await uploadToCloudinary(baselinePath);

                    jobResults.push({
                        pageUrl: safeUrl,
                        changePercentage: 0,
                        status: 'Baseline Created',
                        baselineImageUrl: newBaselineCloudUrl,
                        currentImageUrl: newBaselineCloudUrl, // Same image
                        diffImageUrl: null,
                        scannedAt: new Date()
                    });

                    // Cleanup the single file
                    if (fs.existsSync(baselinePath)) fs.unlinkSync(baselinePath);
                    continue; 
                }

                // IF BASELINE EXISTS: Download it, take a new pic, and compare!
                console.log(`📥 Downloading existing baseline from Cloudinary...`);
                await downloadImage(existingBaselineCloudUrl, baselinePath);

                console.log(`📸 Capturing current state...`);
                await page.screenshot({ path: currentPath, fullPage: true });

                console.log('🔍 Analyzing pixel differences...');
                const changePercentage = compareImages(baselinePath, currentPath, diffPath);
                
                console.log('☁️ Uploading current and diff screenshots to Cloudinary...');
                const [currentCloudUrl, diffCloudUrl] = await Promise.all([
                    uploadToCloudinary(currentPath),
                    uploadToCloudinary(diffPath)
                ]);

                console.log(`📊 Visual Change Detected: ${changePercentage}%`);

                // --- TRIGGER THE NOTIFICATION ---
                if (parseFloat(changePercentage) > config.alertThreshold && config.webhookUrl) {
                    await sendWebhookAlert(config.webhookUrl, safeUrl, changePercentage, diffCloudUrl);
                }

                jobResults.push({
                    pageUrl: safeUrl,
                    changePercentage: parseFloat(changePercentage),
                    status: parseFloat(changePercentage) > config.alertThreshold ? 'Failed (Difference Detected)' : 'Passed',
                    baselineImageUrl: existingBaselineCloudUrl, // Keep the old baseline URL!
                    currentImageUrl: currentCloudUrl,
                    diffImageUrl: diffCloudUrl,
                    scannedAt: new Date()
                });

                // TOTAL CLEANUP: Delete ALL local files. We are 100% cloud now.
                try {
                    if (fs.existsSync(baselinePath)) fs.unlinkSync(baselinePath);
                    if (fs.existsSync(currentPath)) fs.unlinkSync(currentPath);
                    if (fs.existsSync(diffPath)) fs.unlinkSync(diffPath);
                } catch (e) {
                    console.log("Error cleaning up files, but continuing...");
                }
            }

            console.log('\n💾 Saving job results to MongoDB...');
            if (jobResults.length > 0) {
               // THE FIX: We use findByIdAndUpdate and pass the projectId
                await Monitor.findByIdAndUpdate(
                    projectId, 
                    { $set: { lastScanResults: jobResults } }
                );
                console.log('✅ Database updated successfully.');
            }

        } catch (error) {
            console.error(`❌ Job failed:`, error.message);
            throw error; 
        } finally {
            await browser.close();
            console.log(`🛑 Browser closed. Awaiting next job...`);
        }
    }, workerOptions); 

    worker.on('completed', job => console.log(`🎉 Job ${job.id} completed successfully!`));
    worker.on('failed', (job, err) => console.log(`💥 Job ${job.id} failed: ${err.message}`));
}

startWorker();
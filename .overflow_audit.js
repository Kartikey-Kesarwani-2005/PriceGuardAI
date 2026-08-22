/* Overflow audit: find elements wider than viewport at laptop widths */
const puppeteer = require('puppeteer-core');

const PAGES = [
    '/index.html', '/products.html', '/product-details.html?id=iphone15',
    '/alerts.html', '/watchlist.html', '/scrapers.html', '/settings.html'
];
const WIDTHS = [1366, 1440, 1536, 1280];
const MOBILE = [390, 768];

(async () => {
    const browser = await puppeteer.launch({
        executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
        headless: 'new',
        args: ['--no-sandbox', '--disable-gpu']
    });

    async function scan(url, width, height, label) {
        const page = await browser.newPage();
        await page.setViewport({ width, height });
        await page.goto('http://localhost:3000' + url, { waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 1200)); // let charts/JS settle

        const res = await page.evaluate(() => {
            const vw = window.innerWidth;
            const docW = document.documentElement.scrollWidth;
            const offenders = [];
            if (docW > vw + 1) {
                const all = document.querySelectorAll('*');
                for (const el of all) {
                    const r = el.getBoundingClientRect();
                    // element extends beyond viewport horizontally & is visible
                    if (r.right > vw + 2 && r.width > 0 && getComputedStyle(el).visibility !== 'hidden') {
                        const inScroller = el.closest('.rail, .compare-body, .scraper-list');
                        if (inScroller) continue; // intentional inner scroll
                        offenders.push({
                            tag: el.tagName.toLowerCase(),
                            cls: (el.className && el.className.baseVal !== undefined ? el.className.baseVal : String(el.className || '')).slice(0, 60),
                            right: Math.round(r.right),
                            w: Math.round(r.width),
                            id: el.id || ''
                        });
                    }
                }
            }
            return { vw, docW, offenders: offenders.slice(0, 12) };
        });

        if (res.docW > res.vw + 1) {
            console.log(`\n[OVERFLOW] ${label} ${width}px: doc=${res.docW} viewport=${res.vw} (+${res.docW - res.vw}px)`);
            const seen = new Set();
            for (const o of res.offenders) {
                const key = o.tag + '.' + o.cls + '#' + o.id;
                if (seen.has(key)) continue;
                seen.add(key);
                console.log(`   <${o.tag}${o.id ? '#' + o.id : ''} class="${o.cls}"> right=${o.right} w=${o.w}`);
            }
        } else {
            console.log(`[ok] ${label} ${width}px (doc=${res.docW})`);
        }
        await page.close();
    }

    for (const p of PAGES) {
        for (const w of WIDTHS) await scan(p, w, 800, p.split('?')[0]);
    }
    const MOBILE_PAGES = [
        '/index.html', '/products.html', '/product-details.html?id=iphone15',
        '/alerts.html', '/watchlist.html', '/scrapers.html', '/settings.html'
    ];
    for (const w of MOBILE) {
        for (const p of MOBILE_PAGES) await scan(p, w, 844, 'm' + w + '-' + p.split('?')[0].replace('.html', ''));
    }

    await browser.close();
    process.exit(0);
})();

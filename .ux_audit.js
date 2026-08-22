/* Production UX & consistency audit */
const puppeteer = require('puppeteer-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PAGES = [
    '/index.html', '/products.html', '/product-details.html?id=iphone15',
    '/alerts.html', '/watchlist.html', '/scrapers.html', '/settings.html'
];

(async () => {
    const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
    const p = await b.newPage();
    const report = {};

    for (const path of PAGES) {
        const errs = [], failed = [];
        p.removeAllListeners('pageerror');
        p.removeAllListeners('requestfailed');
        p.on('pageerror', e => errs.push(e.message.slice(0, 120)));
        p.on('requestfailed', r => failed.push(r.url().split('/').pop().slice(0, 60)));

        await p.setViewport({ width: 1366, height: 900 });
        await p.goto('http://localhost:3000' + path, { waitUntil: 'networkidle2' }).catch(() => {});
        await new Promise(r => setTimeout(r, 2600));

        const data = await p.evaluate(() => {
            /* 1. icon-only interactive elements without accessible name */
            const unnamed = [];
            document.querySelectorAll('button, a').forEach(el => {
                if (!el.offsetParent && el.tagName === 'BUTTON') return;
                const txt = (el.textContent || '').trim();
                const label = el.getAttribute('aria-label') || el.getAttribute('title');
                const hasSvg = !!el.querySelector('svg');
                if (hasSvg && !txt && !label) {
                    unnamed.push((el.className || el.tagName).toString().slice(0, 40));
                }
            });

            /* 2. leftover skeletons = stuck loading state */
            const skels = [...document.querySelectorAll('.skel')].filter(s => s.offsetParent && s.offsetWidth > 0);

            /* 3. generic error text visible */
            const errTexts = [...document.querySelectorAll('.error-state, .error')]
                .filter(e => e.offsetParent).map(e => e.textContent.trim().slice(0, 60));

            /* 4. dead internal links (href to local page) */
            const hrefs = new Set();
            document.querySelectorAll('a[href]').forEach(a => {
                const h = a.getAttribute('href');
                if (h && !h.startsWith('http') && !h.startsWith('#')) hrefs.add(h.split('?')[0]);
            });

            /* 5. headings hierarchy: multiple h1? */
            const h1s = document.querySelectorAll('h1').length;

            /* 6. focus-visible style present? sample one button's outline */
            return { unnamed: [...new Set(unnamed)].slice(0, 8), skelCount: skels.length,
                     errTexts, hrefs: [...hrefs], h1s };
        });

        report[path] = { errs: errs.slice(0, 4), failed: [...new Set(failed)].slice(0, 4), ...data };
    }

    /* keyboard focus test on home */
    await p.setViewport({ width: 1366, height: 900 });
    await p.goto('http://localhost:3000/index.html', { waitUntil: 'networkidle2' }).catch(() => {});
    await new Promise(r => setTimeout(r, 1500));
    await p.keyboard.press('Tab'); await p.keyboard.press('Tab');
    report._focusOutline = await p.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return 'no-focus-target';
        const cs = getComputedStyle(el);
        return { tag: el.tagName, cls: String(el.className).slice(0, 30),
                 outline: cs.outlineStyle !== 'none' ? cs.outlineStyle : 'NONE',
                 boxShadow: cs.boxShadow !== 'none' };
    });

    console.log(JSON.stringify(report, null, 1));
    await b.close();
})().catch(e => { console.error('AUDIT FAILED:', e); process.exit(1); });

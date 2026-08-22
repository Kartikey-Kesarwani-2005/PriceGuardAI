/* Surgical probe: find which descendant stretches .main on the dashboard */
const puppeteer = require('puppeteer-core');

(async () => {
    const browser = await puppeteer.launch({
        executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
        headless: 'new',
        args: ['--no-sandbox', '--disable-gpu']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 800 });
    await page.goto('http://localhost:3000/index.html', { waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 1500));

    const report = await page.evaluate(() => {
        const vw = window.innerWidth;
        const out = { vw, app: null, main: null, content: null, sections: [], deep: [] };

        const info = el => {
            const r = el.getBoundingClientRect();
            return {
                sel: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
                     (el.className && typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : ''),
                w: Math.round(r.width),
                right: Math.round(r.right)
            };
        };

        const app = document.querySelector('.app');
        const main = document.querySelector('.main');
        const content = document.querySelector('.content');
        if (!main || !content) { out.error = 'missing .main/.content'; return out; }

        const cs = getComputedStyle(app);
        out.app = { display: cs.display, flexDirection: cs.flexDirection };
        const ms = getComputedStyle(main);
        out.main = { ...info(main), flex: ms.flex, minWidth: ms.minWidth, marginLeft: ms.marginLeft };
        out.content = { ...info(content), maxWidth: getComputedStyle(content).maxWidth };

        for (const child of content.children) {
            const i = info(child);
            i.scrollW = child.scrollWidth;
            out.sections.push(i);
        }

        // drill into any section whose width > viewport - 264 (main area)
        const limit = vw + 2;
        const walk = (el, depth) => {
            if (depth > 6) return;
            for (const c of el.children) {
                const r = c.getBoundingClientRect();
                if (r.width > 0 && (r.right > limit || r.width > vw)) {
                    out.deep.push({ depth, ...info(c), scrollW: c.scrollWidth });
                    walk(c, depth + 1);
                }
            }
        };
        walk(content, 0);
        out.deep = out.deep.slice(0, 25);
        return out;
    });

    console.log(JSON.stringify(report, null, 1));
    await browser.close();
})();

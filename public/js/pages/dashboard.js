/* ============================================================
   HOME / COMMAND CENTER — Price Intelligence dashboard
   Sections: hero search · stats · best deals · intelligence
   spotlight · buy/wait AI · alerts · stores · data health
   ============================================================ */

const $id = id => document.getElementById(id);

let PRODUCTS = [];
const HIST = {};
const RETRY = {};

function jget(url) {
    return fetch(url).then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
    });
}

function secFail(boxId, msg, loader) {
    const box = $id(boxId);
    if (!box) return;
    const key = 'retry_' + boxId;
    RETRY[key] = loader;
    box.innerHTML = `
        <div class="state-card error-state">
            <p>${Intel.esc(msg || 'Something went wrong while loading this section.')}</p>
            <button class="mini-btn mb-primary" data-retry="${key}">Try again</button>
        </div>`;
}

document.addEventListener('click', e => {
    const btn = e.target.closest('[data-retry]');
    if (!btn) return;
    const fn = RETRY[btn.dataset.retry];
    if (fn) fn();
});

/* ---------- hero ---------- */

function wireHero() {
    const go = () => {
        const q = ($id('heroSearch') || {}).value || '';
        window.location.href = 'products.html' + (q.trim() ? '?search=' + encodeURIComponent(q.trim()) : '');
    };
    const input = $id('heroSearch');
    if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    const btn = $id('heroGo');
    if (btn) btn.addEventListener('click', go);
}

async function loadAIStatus() {
    const el = $id('aiStatus');
    if (!el) return;
    try {
        const mode = await jget('/api/mode');
        const label = mode.demo
            ? 'Demo intelligence active'
            : (mode.refreshing ? 'Live refresh running…' : 'Live tracking active');
        el.innerHTML = `<i class="pulse-dot"></i>${Intel.esc(label)} · ${PRODUCTS.length || '—'} products · watching for drops`;
    } catch (e) {
        el.innerHTML = '<i class="pulse-dot warn"></i>Engine status unknown — retrying soon';
    }
}

async function loadPopular() {
    const host = $id('popularChips');
    if (!host) return;
    try {
        const cats = await jget('/api/categories');
        const names = Object.keys(cats).sort((a, b) => (cats[b] || []).length - (cats[a] || []).length).slice(0, 6);
        host.innerHTML = names.map(c =>
            `<a class="chip" href="products.html?cat=${encodeURIComponent(c)}">${Intel.esc(c)}</a>`
        ).join('');
    } catch (e) {
        host.innerHTML = '';
    }
}

/* ---------- stats strip ---------- */

function fillBaseStats(topScore) {
    const set = (id, v) => { const el = $id(id); if (el) el.textContent = v; };
    set('stProducts', PRODUCTS.length);
    set('stHits', PRODUCTS.filter(p => p.target && p.price && p.price <= p.target).length);
    if (typeof topScore === 'number') set('stScore', topScore);
}

/* ---------- shared intelligence flow ---------- */

async function intelFlow() {
    try {
        PRODUCTS = await jget('/api/products');
    } catch (err) {
        ['dealsGrid', 'buywaitRail', 'storeCompare'].forEach(id =>
            secFail(id, 'Could not reach the tracking engine.', intelFlow));
        fillBaseStats();
        return;
    }

    const scored = PRODUCTS
        .filter(p => p.price > 0)
        .map(p => ({ p, s: Intel.dealScore(p, null) }))
        .sort((a, b) => b.s - a.s);

    fillBaseStats(scored.length ? scored[0].s : undefined);
    loadAIStatus();

    if (!scored.length) {
        $id('dealsGrid').innerHTML = `
            <div class="state-card">
                <h4>No tracked prices yet</h4>
                <p>Add a product and PriceGuard will start scoring deals automatically.</p>
                <a class="mini-btn mb-primary" href="products.html">Add your first product</a>
            </div>`;
        $id('buywaitRail').innerHTML = '';
        $id('storeCompare').innerHTML = '';
        renderHealth();
        return;
    }

    /* enrich top candidates with real 30d history */
    const cand = scored.slice(0, 6).map(x => x.p);
    await Promise.allSettled(cand.map(async p => {
        try {
            HIST[p.id] = await jget('/api/products/' + encodeURIComponent(p.id) + '/history?range=30d');
        } catch (e) { /* card falls back to MRP-based signals */ }
    }));

    const enriched = cand
        .map(p => ({ p, s: Intel.dealScore(p, HIST[p.id]) }))
        .sort((a, b) => b.s - a.s);

    fillBaseStats(enriched[0].s);

    /* 2 · Today's best deals */
    const dealsBox = $id('dealsGrid');
    if (dealsBox) {
        dealsBox.innerHTML = enriched.map(x =>
            buildProductCard(x.p, { history: HIST[x.p.id] })
        ).join('');
    }

    /* 3+4 · spotlight */
    renderSpotlight(enriched[0].p);

    /* 5 · buy/wait rail (rest of catalogue) */
    const rail = $id('buywaitRail');
    if (rail) {
        const rest = scored.filter(x => !enriched.some(e2 => e2.p.id === x.p.id)).slice(0, 8);
        rail.innerHTML = rest.map(x => bwTile(x.p)).join('') ||
            '<div class="state-card slim"><p>Catalogue fully covered above.</p></div>';
    }

    /* 7 · stores */
    loadStores();
    /* 8 · data health */
    renderHealth();
}

function bwTile(p) {
    const vd = Intel.verdict(p, HIST[p.id]);
    const mrp = p.originalPrice && p.originalPrice > p.price ? '<s>' + Intel.fmtCompact(p.originalPrice) + '</s>' : '';
    return `
    <a class="bw-tile" href="product-details.html?id=${encodeURIComponent(p.id)}">
        <div class="bw-head">
            <span class="bw-name">${Intel.esc(p.name)}</span>
            <span class="verdict-pill ${vd.tone || (vd.buy ? 'v-buy' : 'v-wait')}">${Intel.esc(vd.label)}</span>
        </div>
        <div class="bw-price"><strong>${formatPrice(p.price)}</strong> ${mrp}</div>
        <div class="bw-reason">${Intel.esc(vd.reason)}</div>
    </a>`;
}

/* ---------- 3+4 · spotlight & chart ---------- */

function drawSpotChart(p) {
    const host = $id('spotChart');
    if (!host) return;
    const hist = HIST[p.id];
    if (!hist || !hist.points || hist.points.length < 2) {
        host.innerHTML = '<div class="state-card slim"><p>Not enough history yet — check back after the next sync.</p></div>';
        return;
    }

    const wrapW = Math.max((host.clientWidth || 0), 280);
    const W = wrapW, H = 250, P = { t: 16, r: 14, b: 26, l: 52 };
    const pts = hist.points, n = pts.length;
    const iw = W - P.l - P.r, ih = H - P.t - P.b;

    let lo = Infinity, hi = -Infinity;
    pts.forEach(pt => { lo = Math.min(lo, pt.price); hi = Math.max(hi, pt.price); });
    const target = p.target;
    if (target) { lo = Math.min(lo, target); hi = Math.max(hi, target); }
    const padY = (hi - lo) * 0.08 || hi * 0.05 || 1;
    lo -= padY; hi += padY;

    const X = i => P.l + iw * (n > 1 ? i / (n - 1) : 0.5);
    const Y = v => P.t + ih * (1 - (v - lo) / (hi - lo));

    let grid = '';
    for (let g = 0; g <= 3; g++) {
        const v = lo + (hi - lo) * (g / 3);
        const yy = Y(v).toFixed(1);
        grid += `<line x1="${P.l}" y1="${yy}" x2="${W - P.r}" y2="${yy}" class="cg"/>` +
            `<text x="${P.l - 8}" y="${Number(yy) + 3.5}" class="cl" text-anchor="end">${Intel.fmtCompact(v)}</text>`;
    }

    const ticks = Math.min(5, n);
    let xt = '';
    for (let t = 0; t < ticks; t++) {
        const i = ticks === 1 ? n - 1 : Math.round(t * (n - 1) / (ticks - 1));
        const anchor = t === 0 ? 'start' : t === ticks - 1 ? 'end' : 'middle';
        xt += `<text x="${X(i).toFixed(1)}" y="${H - 8}" class="cl" text-anchor="${anchor}">${Intel.esc(fmtTickShort(pts[i].date))}</text>`;
    }

    const lineD = pts.map((pt, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(pt.price).toFixed(1)}`).join('');
    const areaD = `M${X(0).toFixed(1)} ${(P.t + ih).toFixed(1)}` +
        pts.map((pt, i) => `L${X(i).toFixed(1)} ${Y(pt.price).toFixed(1)}`).join('') +
        `L${X(n - 1).toFixed(1)} ${(P.t + ih).toFixed(1)}Z`;

    const prices = pts.map(pt => pt.price);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const avgY = Y(avg);
    let overlays =
        `<line x1="${P.l}" x2="${W - P.r}" y1="${avgY.toFixed(1)}" y2="${avgY.toFixed(1)}" class="avg-line"/>` +
        `<text x="${W - P.r - 4}" y="${(avgY - 5).toFixed(1)}" class="avg-label" text-anchor="end">AVG ${Intel.fmtCompact(avg)}</text>`;
    if (target) {
        const ty = Y(target);
        const close = Math.abs(ty - avgY) < 15;
        overlays += `<line x1="${P.l}" x2="${W - P.r}" y1="${ty.toFixed(1)}" y2="${ty.toFixed(1)}" class="target-line"/>` +
            `<text x="${P.l + 4}" y="${(close ? ty + 13 : ty - 5).toFixed(1)}" class="target-label">TARGET ${Intel.fmtCompact(target)}</text>`;
    }

    host.innerHTML = `
        <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
            <defs><linearGradient id="spFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#6366f1" stop-opacity="0.30"/>
                <stop offset="100%" stop-color="#6366f1" stop-opacity="0"/>
            </linearGradient></defs>
            <g>${grid}${xt}</g>
            <path d="${areaD}" fill="url(#spFill)"/>
            ${overlays}
            <path d="${lineD}" class="price-line"/>
        </svg>`;
}

function fmtTickShort(iso) {
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    return d.getDate() + ' ' + d.toLocaleString('en', { month: 'short' });
}

let spotResizeTimer = null;
window.addEventListener('resize', () => {
    clearTimeout(spotResizeTimer);
    spotResizeTimer = setTimeout(() => {
        if (window.__spotProduct) drawSpotChart(window.__spotProduct);
    }, 180);
});

function renderSpotlight(p) {
    window.__spotProduct = p;
    const left = $id('spotLeft'), right = $id('spotRight');
    if (!left || !right) return;

    const hist = HIST[p.id];
    const q = Intel.quality(p, hist);
    const vd = Intel.verdict(p, hist);
    const disc = Intel.discount(p);
    const detailsHref = 'product-details.html?id=' + encodeURIComponent(p.id);

    let dropAvg = '';
    if (hist && hist.points && hist.points.length > 3) {
        const prices = hist.points.map(x => x.price);
        const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
        const dPct = Math.round((avg - p.price) / avg * 100);
        dropAvg = `<em class="${dPct >= 0 ? 'pd-down' : 'pd-up'}">${dPct >= 0 ? '↓' : '↑'} ${Math.abs(dPct)}% vs 30d avg</em>`;
    }

    const segMap = { 'q-exc': 0, 'q-good': 1, 'q-avg': 2, 'q-high': 3 };
    const activeSeg = segMap[q.cls];

    left.innerHTML = `
        <span class="spot-tag">${Layout.icons.spark}Best deal detected</span>
        <h4 class="spot-name"><a href="${detailsHref}">${Intel.esc(p.name)}</a></h4>
        <div class="spot-price-row">
            <span class="spot-price">${formatPrice(p.price)}</span>
            ${disc > 0 ? `<s class="spot-mrp">${Intel.fmtCompact(p.originalPrice)}</s>` : ''}
            ${dropAvg}
        </div>
        <div class="spot-badges">
            <span class="best-tag">Best price</span>
            <span class="fresh-chip ${Intel.freshness(p).cls}"><i></i>${Intel.esc(Intel.freshness(p).label)}</span>
            <a class="chip chip-sm" href="products.html?cat=${encodeURIComponent(p.category)}&preselect=${encodeURIComponent(p.id)}">Compare</a>
            <a class="chip chip-sm" href="${detailsHref}">${Layout.icons.bell} Set target</a>
        </div>
        <div class="spot-verdict">
            <span class="verdict-pill lg ${vd.tone || (vd.buy ? 'v-buy' : 'v-wait')}">${Intel.esc(vd.label)}</span>
            <span class="vd-reason">${Intel.esc(vd.reason)}</span>
        </div>
        <div class="meter" role="img" aria-label="Current price level: ${Intel.esc(q.label)}">
            ${['Excellent', 'Good', 'Average', 'High'].map((label, i) =>
                `<span class="seg ${i <= activeSeg ? 'on' : ''}${i === activeSeg ? ' hot s' + i : ''}">${label}</span>`
            ).join('')}
        </div>`;

    right.innerHTML = `
        <div class="chart-panel inner">
            <div class="chart-head slim">
                <div><h3 class="chart-title">30-day movement</h3><p class="chart-sub">${Intel.esc(hist && hist.points ? hist.points.length + ' tracked points · ' + p.store : p.store)}</p></div>
                <a class="see-all sm" href="${detailsHref}">Full history ${Layout.icons.arrowRight}</a>
            </div>
            <div class="chart-wrap" id="spotChart"></div>
        </div>`;

    drawSpotChart(p);
}

/* ---------- 6 · alerts preview ---------- */

async function loadAlertsPrev() {
    const box = $id('alertsPreview');
    if (!box) return;
    try {
        const alerts = await jget('/api/alerts');
        const counter = $id('stAlerts');
        if (counter) counter.textContent = alerts.length;

        if (!alerts.length) {
            box.innerHTML = `
                <div class="state-card slim ok-state">
                    <p>All clear — nothing needs your attention right now.</p>
                    <a class="mini-btn" href="alerts.html">Open alert centre</a>
                </div>`;
            return;
        }

        box.innerHTML = alerts.slice(0, 4).map(a => {
            const cls = a.type === 'price' ? 'al-price' : a.type === 'stock' ? 'al-stock' : 'al-error';
            return `
            <a class="alert-mini ${cls}" href="alerts.html">
                <span class="am-icon">${Intel.esc(a.icon || '!')}</span>
                <span class="am-body"><strong>${Intel.esc(a.product)}</strong><small>${Intel.esc(a.title)} — ${Intel.esc(a.message)}</small></span>
                ${a.amount ? `<span class="am-amt">${Intel.esc(a.amount)}</span>` : ''}
            </a>`;
        }).join('');
    } catch (err) {
        secFail('alertsPreview', 'Alerts are unreachable right now.', loadAlertsPrev);
    }
}

/* ---------- 7 · store comparison ---------- */

function loadStores() {
    const box = $id('storeCompare');
    if (!box) return;

    const byStore = {};
    PRODUCTS.forEach(p => {
        if (!byStore[p.store]) byStore[p.store] = { n: 0, discSum: 0, stockOk: 0 };
        const b = byStore[p.store];
        b.n++;
        b.discSum += Intel.discount(p);
        if (getStockStatus(p.availability) !== 'Out of Stock') b.stockOk++;
    });

    const rows = Object.keys(byStore).map(name => {
        const b = byStore[name];
        return {
            name,
            n: b.n,
            avgDisc: Math.round(b.discSum / b.n),
            avail: Math.round(b.stockOk / b.n * 100)
        };
    }).sort((a, b) => b.avgDisc - a.avgDisc);

    if (!rows.length) {
        box.innerHTML = '';
        return;
    }

    const maxDisc = Math.max.apply(null, rows.map(r => r.avgDisc)) || 1;
    box.innerHTML = rows.map(r => `
        <div class="store-tile">
            <div class="st-top"><strong>${Intel.esc(r.name)}</strong><span class="st-count">${r.n} products</span></div>
            <div class="st-bar"><i style="width:${Math.max(6, r.avgDisc / maxDisc * 100)}%"></i></div>
            <div class="st-meta">
                <span>Avg discount <b>${r.avgDisc}%</b></span>
                <span>In stock <b>${r.avail}%</b></span>
            </div>
        </div>`).join('');
}

/* ---------- 8 · data health ---------- */

function renderHealth() {
    const box = $id('dhBody');
    if (!box) return;

    let live = 0, recent = 0, stale = 0, demo = 0;
    PRODUCTS.forEach(p => {
        const f = Intel.freshness(p);
        if (f.cls === 'live') live++;
        else if (f.cls === 'demo') demo++;
        else if (f.cls === 'recent') recent++;
        else stale++;
    });
    recent += demo;

    const tile = (tone, num, label, desc) => `
        <div class="dh-tile ${tone}">
            <i class="dh-dot"></i>
            <div><strong>${num} ${label}</strong><small>${desc}</small></div>
        </div>`;

    box.innerHTML = `
        <div class="dh-grid">
            ${tile('t-live', live, 'live', 'Synced within the last few minutes')}
            ${tile('t-recent', recent, 'recently updated', 'Fresh within the last day' + (demo ? ' (includes demo feed)' : ''))}
            ${tile('t-stale', stale, 'stale', 'Older data - treat prices with care')}
        </div>
        <p class="dh-note">Every price carries its freshness chip. Numbers marked stale may have moved since the last successful check.</p>
        <a class="see-all sm" href="scrapers.html">Advanced scraper monitors ${Layout.icons.arrowRight}</a>`;
}

/* ---------- boot ---------- */

wireHero();
loadPopular();
intelFlow().catch(() => {});
loadAlertsPrev();

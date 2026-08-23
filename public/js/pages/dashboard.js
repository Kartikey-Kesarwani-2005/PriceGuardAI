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
    const stores = [...new Set(PRODUCTS.map(p => p.store).filter(Boolean))];
    const storeTxt = stores.length ? stores.join(' · ') : 'Amazon · Flipkart · Croma';
    try {
        const mode = await jget('/api/mode');
        const label = mode.demo ? 'Demo feed' : (mode.refreshing ? 'Refreshing now' : 'Monitoring prices');
        el.innerHTML = `<span class="hm-live"><i></i>${Intel.esc(label)}</span>` +
            `<span class="hm-stores">${Intel.esc(storeTxt)}</span>` +
            (PRODUCTS.length ? `<span class="hm-stores">${PRODUCTS.length} products</span>` : '');
    } catch (e) {
        el.innerHTML = `<span class="hm-live"><i></i>Status unknown</span>` +
            `<span class="hm-stores">${Intel.esc(storeTxt)}</span>`;
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

function countUp(el, target) {
    if (!el) return;
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !isFinite(target)) { el.textContent = String(target); return; }
    const from = parseFloat((el.textContent || '').replace(/[^\d.-]/g, '')) || 0;
    if (from === target) { el.textContent = target.toLocaleString('en-IN'); return; }
    const start = performance.now(), dur = 850;
    function frame(now) {
        const t = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(from + (target - from) * eased).toLocaleString('en-IN');
        if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

function fillBaseStats(topScore) {
    const hits = PRODUCTS.filter(p => p.target && p.price && p.price <= p.target).length;
    countUp($id('stProducts'), PRODUCTS.length);
    countUp($id('stHits'), hits);
    const roT = $id('roTracked'); if (roT) roT.textContent = PRODUCTS.length + ' products';
    const roH = $id('roHits'); if (roH) roH.textContent = hits;
    if (typeof topScore === 'number') {
        countUp($id('stScore'), Math.round(topScore));
        const roS = $id('roScore'); if (roS) roS.textContent = Math.round(topScore) + ' / 100';
    }
}

/* ---------- ticker tape · real tracked prices ---------- */

function buildTape() {
    const run = $id('priceTape');
    if (!run || !PRODUCTS.length) return;
    const picks = [...PRODUCTS]
        .filter(p => p.price > 0)
        .sort((a, b) => Intel.discount(b) - Intel.discount(a))
        .slice(0, 14);
    if (!picks.length) { run.innerHTML = ''; return; }
    const item = p => {
        const disc = Intel.discount(p);
        const hit = p.target && p.price <= p.target;
        const name = p.name.length > 36 ? p.name.slice(0, 35).trimEnd() + '…' : p.name;
        const note = hit
            ? '<span class="tp-note hit">target hit</span>'
            : disc > 0 ? `<span class="tp-note drop">−${disc}% MRP</span>`
            : `<span class="tp-note">${Intel.esc(p.store)}</span>`;
        return `<span class="tp-item"><strong>${formatPrice(p.price)}</strong> ${Intel.esc(name)} ${note}</span>`;
    };
    /* duplicated once so the translateX(-50%) loop is seamless */
    const seq = picks.map(item).join('');
    run.innerHTML = seq + seq;
}

/* ---------- shared intelligence flow ---------- */

async function intelFlow() {
    try {
        PRODUCTS = await jget('/api/products');
    } catch (err) {
        ['dealsLayout', 'buywaitRail', 'storeCompare'].forEach(id =>
            secFail(id, 'Price verification is temporarily unavailable.', intelFlow));
        fillBaseStats();
        return;
    }

    const scored = PRODUCTS
        .filter(p => p.price > 0)
        .map(p => ({ p, s: Intel.dealScore(p, null) }))
        .sort((a, b) => b.s - a.s);

    fillBaseStats(scored.length ? scored[0].s : undefined);
    buildTape();
    loadAIStatus();

    if (!scored.length) {
        $id('dealsLayout').innerHTML = `
            <div class="state-card">
                <h4>No tracked prices yet</h4>
                <p>Add a product and PriceGuard will start scoring deals automatically.</p>
                <a class="mini-btn mb-primary" href="products.html">Add your first product</a>
            </div>`;
        $id('buywaitRail').innerHTML = '';
        $id('storeCompare').innerHTML = '';
        renderHealth();
        renderPriceMonitor();
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

    /* 2 · Today's best deals — one dominant opportunity, quiet support cards */
    const oppBox = $id('oppSlot');
    const supBox = $id('dealSupport');
    if (oppBox) oppBox.innerHTML = buildOppCard(enriched[0].p, HIST[enriched[0].p.id]);
    if (supBox) {
        supBox.innerHTML = enriched.slice(1, 4).map(x => buildSupportCard(x.p, HIST[x.p.id])).join('') ||
            '<div class="state-card slim"><p>More deals appear as prices are tracked.</p></div>';
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
    /* price monitor (self-healing) */
    renderPriceMonitor();
    /* 8 · data health */
    renderHealth();
}

/* ---------- 2 · dominant opportunity + supporting cards ---------- */

function histStats(hist) {
    if (!hist || !hist.points || hist.points.length < 2) return null;
    const prices = hist.points.map(x => x.price);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const lo = Math.min.apply(null, prices);
    return { avg, lo, belowPct: Math.round((avg - prices[prices.length - 1]) / avg * 100) };
}

function trustLabel(p) {
    const f = Intel.freshness(p);
    return f.label;
}

function buildOppCard(p, hist) {
    const vd = Intel.verdict(p, hist);
    const score = Intel.dealScore(p, hist);
    const st = histStats(hist);
    const detailsHref = 'product-details.html?id=' + encodeURIComponent(p.id);
    const glyph = Layout.icons[Intel.catGlyph(p.category)] || Layout.icons.box;
    const mrp = p.originalPrice && p.originalPrice > p.price ? `<s class="opp-mrp">${Intel.fmtCompact(p.originalPrice)}</s>` : '';

    let drop = '';
    if (st && st.belowPct !== 0) {
        const down = st.belowPct > 0;
        drop = `<em class="opp-drop">${down ? '↓' : '↑'} ${Math.abs(st.belowPct)}% below average</em>`;
    } else if (st) {
        drop = `<em class="opp-drop">at 30-day average</em>`;
    }

    const lowNote = st && p.price && p.price <= st.lo * 1.02
        ? 'Current price is close to the historical low.' : '';
    const reason = [vd.reason.charAt(0).toUpperCase() + vd.reason.slice(1), lowNote]
        .filter(Boolean).join(' ');

    return `
    <article class="opp-card" data-pid="${Intel.esc(p.id)}">
        <div class="opp-head">
            <span class="opp-kicker">Best opportunity</span>
            <span class="opp-trust"><i></i>${Intel.esc(trustLabel(p))}</span>
        </div>
        <div class="opp-body">
            <span class="opp-glyph" aria-hidden="true">${glyph}</span>
            <h3 class="opp-name"><a href="${detailsHref}">${Intel.esc(p.name)}</a></h3>
            <div class="opp-store">${Intel.esc(p.store)}</div>
            <div class="opp-price-row">
                <span class="opp-price">${formatPrice(p.price)}</span>
                ${mrp}
                ${drop}
            </div>
            <div class="opp-verdict">
                ${Intel.scoreRing(score)}
                <span class="opp-vd-txt">
                    <span class="opp-buy">${vd.buy ? Layout.icons.shield.replace('<svg', '<svg aria-hidden="true"') : ''}${vd.buy ? 'Good time to buy' : Intel.esc(vd.label)}</span>
                    <p class="opp-reason">${Intel.esc(reason || vd.reason)}</p>
                </span>
            </div>
            <div class="opp-foot">
                ${Intel.buyCta(p, 'buy-cta opp-buy-cta')}
                <a class="foot-link" href="${detailsHref}">Full history ${Layout.icons.arrowRight}</a>
                <a class="foot-ghost" href="products.html?cat=${encodeURIComponent(p.category)}&preselect=${encodeURIComponent(p.id)}">Compare stores ${Layout.icons.arrowRight}</a>
            </div>
        </div>
    </article>`;
}

function buildSupportCard(p, hist) {
    const vd = Intel.verdict(p, hist);
    const st = histStats(hist);
    const detailsHref = 'product-details.html?id=' + encodeURIComponent(p.id);
    const glyph = Layout.icons[Intel.catGlyph(p.category)] || Layout.icons.box;
    let drop = '';
    if (st && st.belowPct !== 0) {
        const down = st.belowPct > 0;
        drop = `<em class="${down ? 'pd-down' : 'pd-up'}">${down ? '↓' : '↑'} ${Math.abs(st.belowPct)}%</em>`;
    }
    (window.__PGCARDS__ = window.__PGCARDS__ || {})[p.id] = p;
    return `
    <a class="support-card" href="${detailsHref}">
        <span class="sc-glyph g${Intel.gradIndex(p.category || p.id)}" aria-hidden="true">${glyph}</span>
        <span class="sc-main">
            <span class="sc-name">${Intel.esc(p.name)}</span>
            <span class="sc-meta">${Intel.esc(p.store)}${drop ? ` · ${drop}` : ''}</span>
        </span>
        <span class="sc-side">
            <span class="sc-price">${formatPrice(p.price)}</span>
            <span class="verdict-pill sc-pill ${vd.tone || (vd.buy ? 'v-buy' : 'v-wait')}">${Intel.esc(vd.label)}</span>
        </span>
    </a>`;
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
    const lo0 = lo;   /* raw tracked minimum, before axis padding */
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

    /* lowest tracked price marker */
    let lowMark = '';
    const loIdx = prices.indexOf(lo0);
    if (loIdx !== -1) {
        const lx = X(loIdx), ly = Y(lo0);
        const closeToAvg = Math.abs(ly - avgY) < 15;
        lowMark =
            `<line x1="${P.l}" x2="${W - P.r}" y1="${ly.toFixed(1)}" y2="${ly.toFixed(1)}" class="lowest-line"/>` +
            `<text x="${P.l + 4}" y="${(closeToAvg ? ly + 13 : ly - 5).toFixed(1)}" class="lowest-label">LOW ${Intel.fmtCompact(lo0)}</text>` +
            `<circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="4" class="low-dot"/>`;
    }
    /* current price dot */
    const lastPt = pts[n - 1];
    const nowMark = `<circle cx="${X(n - 1).toFixed(1)}" cy="${Y(lastPt.price).toFixed(1)}" r="4.5" class="now-dot"/>`;

    host.innerHTML = `
        <svg viewBox="0 0 ${W} ${H}" class="spot-svg" preserveAspectRatio="none" role="img" aria-label="Price trend chart">
            <defs><linearGradient id="spFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#17221E" stop-opacity="0.10"/>
                <stop offset="100%" stop-color="#17221E" stop-opacity="0"/>
            </linearGradient></defs>
            <g>${grid}${xt}</g>
            <path d="${areaD}" fill="url(#spFill)"/>
            ${overlays}
            ${lowMark}
            <path d="${lineD}" class="price-line animatable" pathLength="1"/>
            ${nowMark}
            <line id="spotHoverX" class="hover-x" y1="${P.t}" y2="${(P.t + ih).toFixed(1)}" opacity="0"/>
            <circle id="spotHoverDot" r="4.5" class="hover-dot" opacity="0"/>
            <rect x="${P.l}" y="${P.t}" width="${iw}" height="${ih}" fill="transparent" id="spotHit"/>
        </svg>
        <div class="chart-tip" id="spotTip"></div>`;

    bindSpotHover(host, pts, n, P, iw, X, Y);
}

function bindSpotHover(wrap, pts, n, P, iw, X, Y) {
    const svg = wrap.querySelector('.spot-svg');
    const hit = document.getElementById('spotHit');
    const tip = document.getElementById('spotTip');
    const dot = document.getElementById('spotHoverDot');
    const crossX = document.getElementById('spotHoverX');
    if (!svg || !hit || !tip || !dot || !crossX) return;

    function show(clientX) {
        const rect = svg.getBoundingClientRect();
        const vbW = svg.viewBox.baseVal.width;
        const vbH = svg.viewBox.baseVal.height;
        const step = n > 1 ? iw / (n - 1) : 1;
        const vx = (clientX - rect.left) * (vbW / rect.width);
        let idx = Math.round((vx - P.l) / step);
        idx = Math.max(0, Math.min(n - 1, idx));
        const pt = pts[idx];
        const px = X(idx), py = Y(pt.price);

        dot.setAttribute('cx', px.toFixed(1));
        dot.setAttribute('cy', py.toFixed(1));
        dot.setAttribute('opacity', 1);
        crossX.setAttribute('x1', px.toFixed(1));
        crossX.setAttribute('x2', px.toFixed(1));
        crossX.setAttribute('opacity', 1);

        tip.innerHTML = `<strong>${formatPrice(pt.price)}</strong><span>${Intel.esc(fmtTickShort(pt.date))}</span>`;
        tip.style.opacity = 1;
        const sx = px * (rect.width / vbW);
        let tx = sx + 14;
        if (tx + tip.offsetWidth > wrap.clientWidth - 4) tx = sx - tip.offsetWidth - 14;
        tip.style.left = tx + 'px';
        tip.style.top = Math.max(4, py * (rect.height / vbH) - 46) + 'px';
    }

    function hide() {
        dot.setAttribute('opacity', 0);
        crossX.setAttribute('opacity', 0);
        tip.style.opacity = 0;
    }

    hit.addEventListener('mousemove', e => show(e.clientX));
    hit.addEventListener('mouseleave', hide);
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
        if (counter) countUp(counter, alerts.length);

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

/* ---------- 7 · store comparison — typographic ledger ---------- */

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
    box.innerHTML = rows.map((r, i) => `
        <div class="sl-row">
            <span class="sl-rank">${String(i + 1).padStart(2, '0')}</span>
            <span class="sl-name">${Intel.esc(r.name)}</span>
            ${i === 0 ? '<span class="sl-best">Best value</span>' : ''}
            <span class="sl-dots"><i class="${i === 0 ? 'best' : ''}" style="width:${Math.max(6, r.avgDisc / maxDisc * 100)}%"></i></span>
            <span class="sl-price ${i === 0 ? 'best' : ''}">−${r.avgDisc}%</span>
            <span class="sl-sub">${r.avail}% in stock</span>
        </div>`).join('');
}

/* ---------- self-healing price monitor ---------- */

async function renderPriceMonitor() {
    const box = $id('priceMonitor');
    if (!box) return;
    try {
        const res = await fetch('/api/health');
        if (!res.ok) throw new Error('unavailable');
        const data = await res.json();

        const stores = Object.keys(data.stores || {}).sort();
        if (!stores.length) {
            box.innerHTML = '<div class="state-card slim"><p>No store activity recorded yet.</p></div>';
            return;
        }

        box.innerHTML = stores.map(name => {
            const s = data.stores[name] || {};
            const rate = typeof s.successRate === 'number' ? s.successRate : null;
            let cls = 'ok', label = 'Healthy', note = '';
            if (rate !== null && rate < 60 && s.heals > 0) {
                cls = 'rec'; label = 'Recovered'; note = 'Recovered automatically';
            } else if (rate !== null && rate < 60) {
                cls = 'warn'; label = 'Attention'; note = 'Repairs are being attempted';
            } else if (s.heals > 0) {
                cls = 'rec'; label = 'Recovered'; note = 'Recovered automatically · now healthy';
            }
            if (data.mode === 'demo') note = note || 'Demo feed';
            return `
            <div class="mon-row ${cls}">
                <span class="mon-store">${Intel.esc(name)}</span>
                <span class="mon-status ${cls}"><i></i>${label}</span>
                <span class="mon-note">${Intel.esc(note || (rate === null ? 'Awaiting first check' : rate + '% checks successful'))}</span>
                <svg class="mon-pulse" viewBox="0 0 240 14" preserveAspectRatio="none" aria-hidden="true"><path d="M0 8 H64 L72 8 78 2 84 12 90 5 96 8 H148 L156 8 162 3 168 11 174 6 180 8 H240"/></svg>
            </div>`;
        }).join('');
    } catch (err) {
        box.innerHTML = `
            <div class="state-card error-state">
                <p>Price verification is temporarily unavailable.</p>
                <button class="mini-btn mb-primary" data-retry="retry_priceMonitor">Try again</button>
            </div>`;
        RETRY.retry_priceMonitor = renderPriceMonitor;
    }
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
            ${tile('t-live', live, 'verified recently', 'Checked within the last hour')}
            ${tile('t-recent', recent, 'verified today', 'Fresh within the last day' + (demo ? ' (includes demo feed)' : ''))}
            ${tile('t-stale', stale, 'stale', 'Older data — last verified price is still available')}
        </div>
        <p class="dh-note">Every number on this page carries its own verification time. When a scraper breaks, PriceGuard repairs it and marks recovered data explicitly.</p>
        <a class="see-all sm" href="scrapers.html">Advanced scraper monitors ${Layout.icons.arrowRight}</a>`;
}

/* ---------- boot ---------- */

/* stat cells are real shortcuts — click through to the page behind the number */
(function makeStatsClickable() {
    document.querySelectorAll('.statband-cell[data-href]').forEach(cell => {
        const label = cell.querySelector('.statband-label');
        cell.setAttribute('role', 'link');
        cell.setAttribute('tabindex', '0');
        cell.setAttribute('aria-label', label ? label.textContent : 'Open');
        const go = () => { window.location.href = cell.dataset.href; };
        cell.addEventListener('click', go);
        cell.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
})();

wireHero();
loadPopular();
intelFlow().catch(() => {});
loadAlertsPrev();

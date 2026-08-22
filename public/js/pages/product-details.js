/* ---------- product details: price history chart ---------- */

const RANGE_LABEL = { '7d': 'last 7 days', '30d': 'last 30 days', '90d': 'last 90 days', '1y': 'last 12 months' };

let productId = null;
let historyData = null;
let productRecord = null;
let currentRange = '30d';

function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function fmtINR(v) {
    return '₹' + Math.round(v).toLocaleString('en-IN');
}

function fmtCompact(v) {
    if (v >= 1e7) return '₹' + (v / 1e7).toFixed(1).replace(/\.0$/, '') + 'Cr';
    if (v >= 1e5) return '₹' + (v / 1e5).toFixed(1).replace(/\.0$/, '') + 'L';
    if (v >= 1000) return '₹' + Math.round(v / 1000) + 'k';
    return '₹' + Math.round(v);
}

function fmtDay(iso) {
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    return d.getDate() + ' ' + d.toLocaleString('en', { month: 'short' });
}

function fmtTick(iso, range) {
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    const mon = d.toLocaleString('en', { month: 'short' });
    if (range === '1y') return mon + (d.getMonth() === 0 ? ' ' + String(d.getFullYear()).slice(2) : '');
    return d.getDate() + ' ' + mon;
}

function fillList(el, rows) {
    if (!el) return;
    el.innerHTML = rows.map(r =>
        `<div class="spec-item"><dt>${esc(r[0])}</dt><dd>${esc(r[1])}</dd></div>`
    ).join('');
}

/* ---------- data loading ---------- */

async function loadHistory(range) {
    currentRange = range;
    const wrap = document.getElementById('chartWrap');
    const sub = document.getElementById('chartSub');

    try {
        const res = await fetch('/api/products/' + encodeURIComponent(productId) + '/history?range=' + range);
        if (!res.ok) throw new Error('Failed to load history');
        historyData = await res.json();
    } catch (err) {
        if (wrap) wrap.innerHTML = '<div class="error">Could not load price history</div>';
        const ip = document.getElementById('intelPanel');
        if (ip) ip.innerHTML = '<div class="state-card slim"><p>Deal intelligence unavailable for this product right now.</p></div>';
        return;
    }

    renderHeader(historyData);
    renderStats(historyData);
    renderFacts(historyData);
    renderIntel(historyData);
    drawChart();

    if (sub) {
        sub.textContent = historyData.store + ' · ' + RANGE_LABEL[range] +
            (historyData.target ? ' · Target ' + fmtINR(historyData.target) : '');
    }
}

/* ---------- rendering ---------- */

function renderHeader(d) {
    const cat = document.getElementById('pdCategory');
    const name = document.getElementById('pdName');
    const meta = document.getElementById('pdMeta');
    const cur = document.getElementById('pdCurrent');
    const trend = document.getElementById('pdTrend');

    if (cat) cat.textContent = d.category;
    if (name) name.textContent = d.name;
    if (meta) {
        meta.innerHTML = [esc(d.store), d.availability && d.availability !== 'Unknown' ? esc(d.availability) : null]
            .filter(Boolean).join(' · ');
    }
    if (cur) cur.textContent = fmtINR(d.summary.current);

    if (trend) {
        const avg = d.summary.average;
        if (avg > 0) {
            const pct = Math.round(Math.abs(d.summary.current - avg) / avg * 100);
            const below = d.summary.current <= avg;
            trend.textContent = (below ? '↓ ' : '↑ ') + pct + '% ' + (below ? 'below' : 'above') + ' average';
            trend.className = 'detail-trend ' + (below ? 'trend-good' : 'trend-bad');
        } else {
            trend.textContent = '';
        }
    }
}

function renderStats(d) {
    const s = d.summary;
    const el = id => document.getElementById(id);

    if (el('statCurrent')) el('statCurrent').textContent = fmtINR(s.current);
    if (el('statCurrentDesc')) el('statCurrentDesc').textContent = 'Latest price from ' + d.store;

    if (el('statLowest')) el('statLowest').textContent = fmtINR(s.lowest);
    let lowDate = '';
    d.points.forEach(pt => { if (pt.price === s.lowest && !lowDate) lowDate = pt.date; });
    if (el('statLowestDesc')) el('statLowestDesc').textContent = lowDate ? 'Lowest on ' + fmtDay(lowDate) : 'In ' + RANGE_LABEL[currentRange];

    if (el('statAverage')) el('statAverage').textContent = fmtINR(s.average);
    if (el('statAvgDesc')) el('statAvgDesc').textContent = 'Across ' + RANGE_LABEL[currentRange];
}

function renderFacts(d) {
    fillList(document.getElementById('pdSpecs'),
        Object.keys(d.specs || {}).length
            ? Object.entries(d.specs)
            : [['Info', 'No specifications listed']]);

    fillList(document.getElementById('pdFacts'), [
        ['Store', d.store],
        ['Availability', d.availability || '—'],
        ['Rating', d.rating ? '★ ' + d.rating : '—'],
        ['Reviews', d.reviews ? Number(d.reviews).toLocaleString('en-IN') : '—'],
        ['MRP', d.originalPrice ? fmtINR(d.originalPrice) : '—'],
        ['Your target', d.target ? fmtINR(d.target) : 'Not set']
    ]);
}

/* ---------- deal intelligence (explainable score + recommendation) ---------- */

function renderIntel(d) {
    const host = document.getElementById('intelPanel');
    if (!host || !d || !d.summary) return;

    /* shape the /history payload into the product format Intel expects */
    const p = {
        id: d.id,
        name: d.name,
        category: d.category,
        store: d.store,
        price: d.summary.current,
        originalPrice: d.originalPrice,
        target: d.target,
        availability: d.availability,
        rating: d.rating,
        reviews: d.reviews,
        lastChecked: productRecord ? productRecord.lastChecked : null,
        stale: productRecord ? productRecord.stale : false,
        error: productRecord ? productRecord.error : undefined,
        _source: productRecord ? productRecord._source : undefined
    };
    const hist = { points: d.points, range: d.range };

    const factors = Intel.factors(p, hist);
    const score = Intel.dealScore(p, hist);
    const vd = Intel.verdict(p, hist);
    const q = Intel.quality(p, hist);
    const fresh = Intel.freshness(p);

    const factorRows = factors.map(f => `
        <div class="if-row">
            <div class="if-info">
                <strong>${esc(f.label)}</strong>
                <small>${esc(f.note)}</small>
            </div>
            <div class="if-bar"><i style="width:${Math.max(3, Math.round(f.pts / f.max * 100))}%"></i></div>
            <span class="if-pts">${f.pts}<em>/${f.max}</em></span>
        </div>`).join('');

    const segOrder = ['Excellent', 'Good', 'Average', 'High'];
    const hotIdx = segOrder.indexOf(q.label);
    const meter = `<div class="meter intel-meter">` + segOrder.map((lbl, i) =>
        `<span class="seg${i === hotIdx ? ` on hot s${i}` : ''}">${lbl}</span>`
    ).join('') + `</div>`;

    const avg = d.summary.average;
    const vsAvgPct = Math.round((avg - p.price) / avg * 100);
    const disc = Intel.discount(p);

    const chips = [
        vsAvgPct !== 0 ? `${vsAvgPct > 0 ? '↓' : '↑'} ${Math.abs(vsAvgPct)}% vs ${d.range.toUpperCase()} avg` : null,
        d.summary.lowest ? `${d.range.toUpperCase()} low ${fmtCompact(d.summary.lowest)}` : null,
        disc > 0 ? `${disc}% off MRP` : null,
        p.rating ? `★ ${p.rating}` : null
    ].filter(Boolean).map(c => `<span class="chip chip-sm">${esc(c)}</span>`).join('');

    host.innerHTML = `
        <div class="intel-main">
            <div class="intel-score">
                ${Intel.scoreRing(score)}
                <div class="intel-verdict">
                    <span class="verdict-pill lg ${vd.tone}">${esc(vd.label)}</span>
                    <p>${esc(vd.reason)}</p>
                </div>
            </div>
            <div class="intel-side">
                <span class="fresh-chip ${fresh.cls}"><i></i>${esc(fresh.label)}</span>
                <span class="chip chip-sm">${esc(q.label)} time to buy</span>
            </div>
        </div>
        <div class="intel-factors">
            <h4>Why this score</h4>
            ${factorRows}
        </div>
        <div class="intel-foot">
            <div class="chip-row mini">${chips}</div>
            ${meter}
        </div>`;
}

/* ---------- chart engine ---------- */

function drawChart() {
    const wrap = document.getElementById('chartWrap');
    if (!wrap || !historyData || !historyData.points || !historyData.points.length) return;

    const W = Math.max(wrap.clientWidth || 0, 280);
    const H = window.innerWidth <= 650 ? 230 : 300;
    const P = { t: 18, r: 16, b: 30, l: 58 };
    const pts = historyData.points;
    const n = pts.length;
    const iw = W - P.l - P.r;
    const ih = H - P.t - P.b;

    let lo = Infinity, hi = -Infinity;
    pts.forEach(pt => {
        if (pt.price < lo) lo = pt.price;
        if (pt.price > hi) hi = pt.price;
    });
    const target = historyData.target;
    if (target) { lo = Math.min(lo, target); hi = Math.max(hi, target); }
    const padY = (hi - lo) * 0.08 || hi * 0.05 || 1;
    lo -= padY; hi += padY;

    const X = i => P.l + iw * (n > 1 ? i / (n - 1) : 0.5);
    const Y = v => P.t + ih * (1 - (v - lo) / (hi - lo));

    /* gridlines + y labels */
    let grid = '';
    for (let g = 0; g <= 3; g++) {
        const v = lo + (hi - lo) * (g / 3);
        const yy = Y(v).toFixed(1);
        grid += `<line x1="${P.l}" y1="${yy}" x2="${W - P.r}" y2="${yy}" class="cg"/>` +
            `<text x="${P.l - 9}" y="${Number(yy) + 3.5}" class="cl" text-anchor="end">${fmtCompact(v)}</text>`;
    }

    /* x tick labels */
    const tickCount = Math.min(6, n);
    let xticks = '';
    for (let t = 0; t < tickCount; t++) {
        const i = tickCount === 1 ? n - 1 : Math.round(t * (n - 1) / (tickCount - 1));
        const anchor = t === 0 ? 'start' : (t === tickCount - 1 ? 'end' : 'middle');
        xticks += `<text x="${X(i).toFixed(1)}" y="${H - 9}" class="cl xt-${anchor}" text-anchor="${anchor}">${esc(fmtTick(pts[i].date, currentRange))}</text>`;
    }

    /* paths */
    const lineD = pts.map((pt, i) =>
        `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(pt.price).toFixed(1)}`
    ).join('');
    const areaD = `M${X(0).toFixed(1)} ${(P.t + ih).toFixed(1)}` +
        pts.map((pt, i) => `L${X(i).toFixed(1)} ${Y(pt.price).toFixed(1)}`).join('') +
        `L${X(n - 1).toFixed(1)} ${(P.t + ih).toFixed(1)}Z`;

    /* average + target overlays */
    const avg = historyData.summary.average;
    const avgY = Y(avg);
    let overlays =
        `<line x1="${P.l}" x2="${W - P.r}" y1="${avgY.toFixed(1)}" y2="${avgY.toFixed(1)}" class="avg-line"/>` +
        `<text x="${W - P.r - 4}" y="${(avgY - 5).toFixed(1)}" class="avg-label" text-anchor="end">AVG ${fmtCompact(avg)}</text>`;

    if (target) {
        const ty = Y(target);
        const close = Math.abs(ty - avgY) < 15;
        const ly = close ? ty + 14 : ty - 5;
        overlays +=
            `<line x1="${P.l}" x2="${W - P.r}" y1="${ty.toFixed(1)}" y2="${ty.toFixed(1)}" class="target-line"/>` +
            `<text x="${P.l + 4}" y="${ly.toFixed(1)}" class="target-label">TARGET ${fmtCompact(target)}</text>`;
    }

    wrap.innerHTML = `
        <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" id="histSvg">
            <defs>
                <linearGradient id="pgFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#6366f1" stop-opacity="0.32"/>
                    <stop offset="100%" stop-color="#6366f1" stop-opacity="0"/>
                </linearGradient>
            </defs>
            <g>${grid}${xticks}</g>
            <path d="${areaD}" fill="url(#pgFill)"/>
            ${overlays}
            <path d="${lineD}" class="price-line"/>
            <line id="hoverX" class="hover-x" y1="${P.t}" y2="${(P.t + ih).toFixed(1)}" opacity="0"/>
            <circle id="hoverDot" r="4.5" class="hover-dot" opacity="0"/>
            <rect x="${P.l}" y="${P.t}" width="${iw}" height="${ih}" fill="transparent" id="hitArea"/>
        </svg>
        <div class="chart-tip" id="chartTip"></div>`;

    bindHover(wrap, pts, n, P, iw, X, Y);
}

function bindHover(wrap, pts, n, P, iw, X, Y) {
    const svg = document.getElementById('histSvg');
    const hit = document.getElementById('hitArea');
    const tip = document.getElementById('chartTip');
    const dot = document.getElementById('hoverDot');
    const crossX = document.getElementById('hoverX');
    if (!svg || !hit || !tip || !dot || !crossX) return;

    function show(clientX) {
        const rect = svg.getBoundingClientRect();
        const mx = clientX - rect.left;
        let idx = Math.round((mx - P.l) / iw * (n - 1));
        idx = Math.max(0, Math.min(n - 1, idx));
        const pt = pts[idx];
        const px = X(idx), py = Y(pt.price);

        dot.setAttribute('cx', px.toFixed(1));
        dot.setAttribute('cy', py.toFixed(1));
        dot.setAttribute('opacity', 1);
        crossX.setAttribute('x1', px.toFixed(1));
        crossX.setAttribute('x2', px.toFixed(1));
        crossX.setAttribute('opacity', 1);

        tip.innerHTML = `<strong>${fmtINR(pt.price)}</strong><span>${esc(fmtDay(pt.date))}</span>`;
        tip.style.opacity = 1;
        let tx = px + 14;
        if (tx + tip.offsetWidth > wrap.clientWidth - 4) tx = px - tip.offsetWidth - 14;
        tip.style.left = tx + 'px';
        tip.style.top = Math.max(4, py - 46) + 'px';
    }

    function hide() {
        dot.setAttribute('opacity', 0);
        crossX.setAttribute('opacity', 0);
        tip.style.opacity = 0;
    }

    hit.addEventListener('mousemove', e => show(e.clientX));
    hit.addEventListener('mouseleave', hide);
    hit.addEventListener('touchmove', e => { e.preventDefault(); show(e.touches[0].clientX); }, { passive: false });
    hit.addEventListener('touchend', hide);
}

let resizeTimer = null;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (historyData) drawChart(); }, 150);
});

/* ---------- boot ---------- */

document.querySelectorAll('#rangeTabs .cat-tab').forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.dataset.range === currentRange) return;
        document.querySelectorAll('#rangeTabs .cat-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadHistory(btn.dataset.range);
    });
});

(async function init() {
    const loading = document.getElementById('pdLoading');
    const errorBox = document.getElementById('pdError');
    const content = document.getElementById('pdContent');

    productId = new URLSearchParams(location.search).get('id');
    if (!productId) {
        if (loading) loading.classList.add('hidden');
        if (errorBox) errorBox.classList.remove('hidden');
        return;
    }

    try {
        const res = await fetch('/api/products/' + encodeURIComponent(productId));
        if (!res.ok) throw new Error('Product not found');
        productRecord = await res.json();
        await loadHistory(currentRange);
        if (loading) loading.classList.add('hidden');
        if (content) content.classList.remove('hidden');
    } catch (err) {
        if (loading) loading.classList.add('hidden');
        if (errorBox) errorBox.classList.remove('hidden');
    }
})();

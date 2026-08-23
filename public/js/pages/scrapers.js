const scraperList = document.getElementById('scraperList');
const scraperCategoryTabs = document.getElementById('scraperCategoryTabs');
let allScraperProducts = [];
let activeScraperCategory = null;

/* ---------- store reliability (from /api/health) ---------- */

async function loadStoreHealth() {
    const box = document.getElementById('storeHealth');
    if (!box) return;
    try {
        const res = await fetch('/api/health');
        if (!res.ok) throw new Error('unavailable');
        const data = await res.json();

        const rows = Object.keys(data.stores || {}).map(name => ({
            name,
            ...data.stores[name]
        })).sort((a, b) => (b.successRate || 0) - (a.successRate || 0));

        if (!rows.length) {
            box.innerHTML = '<div class="state-card slim"><p>No store activity recorded yet.</p></div>';
            return;
        }

        box.innerHTML = rows.map(s => {
            const rate = typeof s.successRate === 'number' ? s.successRate : null;
            return `
            <div class="store-tile">
                <div class="st-top"><strong>${Intel.esc(s.name)}</strong><span class="st-count">${rate === null ? '—' : rate + '%'} success</span></div>
                <div class="st-bar"><i style="width:${rate === null ? 4 : Math.max(4, rate)}%" class="${rate !== null && rate < 60 ? 'low' : ''}"></i></div>
                <div class="st-meta">
                    <span>Checks <b>${s.attempts}</b></span>
                    <span>Self-heals <b>${s.heals}</b></span>
                    ${data.mode === 'demo' ? '<span class="muted-note">demo feed</span>' : ''}
                </div>
            </div>`;
        }).join('');
    } catch (err) {
        box.innerHTML = `
            <div class="state-card error-state">
                <p>Store health is unavailable right now.</p>
                <button class="mini-btn mb-primary" onclick="loadStoreHealth()">Try again</button>
            </div>`;
    }
}

/* ---------- simple freshness summary ---------- */

function renderFreshnessSummary() {
    const box = document.getElementById('dhSummary');
    if (!box) return;

    let live = 0, recent = 0, stale = 0, demo = 0;
    allScraperProducts.forEach(p => {
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
        <p class="dh-note">PriceGuard marks every price with a freshness chip so you always know how much to trust it.</p>`;
}

function renderScraperRow(product) {
    const row = document.createElement('div');
    row.className = 'scraper-row';

    const healthStatus = getHealthStatus(product);
    const statusClass = healthStatus === 'Healthy' ? 'badge-success' :
                      healthStatus === 'Error' ? 'badge-danger' : 'badge-warning';
    const lastChecked = product.lastChecked ? new Date(product.lastChecked).toLocaleString() : 'Never';
    const stats = product.stats || {};
    const successRate = typeof stats.successRate === 'number' ? stats.successRate + '%' : (product._source === 'demo' ? 'demo' : '—');
    const sourceLabel = product.stale ? 'stale cache' : (product._source === 'live-healed' ? 'live (self-healed)' : product._source || '');
    const healBadge = stats.heals > 0 ? `<span title="Scraper Studio auto-repairs applied">Heals: <strong>${stats.heals}</strong></span>` : '';
    const stockStatus = getStockStatus(product.availability);
    const stockClass = stockStatus === 'In Stock' ? 'stock-good' :
                      stockStatus === 'Low Stock' ? 'stock-warning' : 'stock-danger';

    row.innerHTML = `
        <div class="scraper-info">
            <div class="scraper-icon">◉</div>
            <div>
                <strong>${product.name}</strong>
                <span>${product.category} · ${product.store} · Last checked: ${lastChecked}${sourceLabel ? ' · ' + sourceLabel : ''}</span>
            </div>
        </div>
        <div class="scraper-right">
            <span>Price: <strong>${formatPrice(product.price)}</strong></span>
            <span>Stock: <strong class="${stockClass}">${stockStatus}</strong></span>
            <span>Success: <strong>${successRate}</strong></span>
            ${healBadge}
            <span class="status-badge ${statusClass}">${healthStatus}</span>
        </div>`;

    return row;
}

function renderScraperList(products) {
    if (!scraperList) return;
    scraperList.innerHTML = '';

    if (products.length === 0) {
        scraperList.innerHTML = '<div class="state-card slim"><p>No tracked products yet — add one from the Compare page.</p></div>';
        return;
    }

    const grouped = {};
    products.forEach(p => {
        if (!grouped[p.category]) grouped[p.category] = [];
        grouped[p.category].push(p);
    });

    Object.keys(grouped).forEach(cat => {
        const header = document.createElement('div');
        header.className = 'scraper-category-header';
        header.innerHTML = `<strong>${cat}</strong><span>${grouped[cat].length} products</span>`;
        scraperList.appendChild(header);

        grouped[cat].forEach(product => {
            scraperList.appendChild(renderScraperRow(product));
        });
    });

    const healthy = products.filter(p => getHealthStatus(p) === 'Healthy').length;
    const attention = products.filter(p => getHealthStatus(p) !== 'Healthy').length;
    document.getElementById('healthyCount').textContent = healthy;
    document.getElementById('attentionCount').textContent = attention;
    document.getElementById('totalCount').textContent = products.length;

    renderFreshnessSummary();
}

async function loadScraperCategories() {
    const categories = await fetchCategories();
    if (!scraperCategoryTabs) return;

    scraperCategoryTabs.innerHTML = '';
    const allTab = document.createElement('button');
    allTab.className = 'cat-tab active';
    allTab.textContent = 'All';
    allTab.addEventListener('click', () => {
        activeScraperCategory = null;
        document.querySelectorAll('#scraperCategoryTabs .cat-tab').forEach(t => t.classList.remove('active'));
        allTab.classList.add('active');
        renderScraperList(allScraperProducts);
    });
    scraperCategoryTabs.appendChild(allTab);

    Object.keys(categories).forEach(cat => {
        const tab = document.createElement('button');
        tab.className = 'cat-tab';
        tab.textContent = `${cat} (${categories[cat].length})`;
        tab.addEventListener('click', () => {
            activeScraperCategory = cat;
            document.querySelectorAll('#scraperCategoryTabs .cat-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderScraperList(allScraperProducts.filter(p => p.category === cat));
        });
        scraperCategoryTabs.appendChild(tab);
    });
}

async function renderScrapers() {
    try {
        allScraperProducts = await fetchProducts();
        renderScraperList(allScraperProducts);
    } catch (err) {
        scraperList.innerHTML = '<div class="state-card error-state"><p>Scraper monitors are temporarily unreachable.</p><button class="mini-btn mb-primary" onclick="renderScrapers()">Try again</button></div>';
    }
}

/* ---------- price intelligence — real products + /history data only ---------- */

const PI_RANGE = '90d';
let piItems = [];          /* enriched: {p, hist, trend, score, vd, avg, low, high, lowPt} */
let piSelId = null;

async function piLoadHistory(id) {
    const res = await fetch('/api/products/' + encodeURIComponent(id) + '/history?range=' + PI_RANGE);
    if (!res.ok) throw new Error('history failed');
    return res.json();
}

/* direction over the window: compare the latest price to a point ~7+ days back */
function piTrend(hist) {
    const pts = hist && hist.points;
    if (!pts || pts.length < 3 || !pts[pts.length - 1].price) return { dir: 'none', pct: null };
    const last = pts[pts.length - 1];
    let ref = pts[0];
    for (const pt of pts) {
        if ((Date.now() - new Date(pt.date + 'T00:00:00').getTime()) >= 7 * 86400000) ref = pt;
        else break;
    }
    if (!ref.price || ref.date === last.date) return { dir: 'none', pct: null };
    const pct = (last.price - ref.price) / ref.price * 100;
    if (pct <= -2) return { dir: 'down', pct };
    if (pct >= 2) return { dir: 'up', pct };
    return { dir: 'flat', pct };
}

function piLowestPoint(hist) {
    const pts = (hist && hist.points || []).filter(pt => pt.price > 0);
    if (!pts.length) return null;
    return pts.reduce((a, b) => (b.price < a.price ? b : a), pts[0]);
}

function piRelAvg(price, avg) {
    if (!price || !avg) return null;
    const pct = Math.round((price - avg) / avg * 100);
    return { pct, word: pct <= 0 ? 'below' : 'above', abs: Math.abs(pct) };
}

/* short deterministic explanation built only from tracked numbers */
function piInsightText(it) {
    const rangeLbl = String((it.hist && it.hist.range) || PI_RANGE).toUpperCase();
    if (it.trend.dir === 'none' || !it.avg) {
        return 'Not enough tracked history yet — the insight appears as more prices are recorded.';
    }
    const rel = piRelAvg(it.p.price, it.avg);
    const lowTxt = it.lowPt ? `Lowest tracked ${Intel.fmtCompact(it.low)} on ${piDay(it.lowPt.date)}.` : '';
    const avgTxt = rel ? `${rel.abs === 0 ? 'Right at' : rel.abs + '% ' + rel.word}` : '';
    const vsAvg = rel ? `${avgTxt} the ${rangeLbl} average (${Intel.fmtCompact(it.avg)}).` : '';

    if (it.trend.dir === 'down') {
        return `Falling — ${Math.abs(it.trend.pct).toFixed(1)}% cheaper than a week back. ${vsAvg} ${lowTxt}`;
    }
    if (it.trend.dir === 'up') {
        return `Rising — up ${it.trend.pct.toFixed(1)}% recently. ${vsAvg} Historically cheaper near ${Intel.fmtCompact(it.low)}.`;
    }
    return `Stable over the past week. ${vsAvg} ${lowTxt}`;
}

function piDay(iso) {
    const d = new Date(String(iso || '').slice(0, 10) + 'T00:00:00');
    return isNaN(d) ? '' : d.getDate() + ' ' + d.toLocaleString('en', { month: 'short' });
}

function piTrendChip(t) {
    if (t.dir === 'down') return `<span class="pi-trend t-down" title="Price is falling vs a week ago">&#8595; Falling${t.pct !== null ? ' ' + Math.abs(t.pct).toFixed(1) + '%' : ''}</span>`;
    if (t.dir === 'up') return `<span class="pi-trend t-up" title="Price is rising vs a week ago">&#8593; Rising${t.pct !== null ? ' +' + t.pct.toFixed(1) + '%' : ''}</span>`;
    if (t.dir === 'flat') return `<span class="pi-trend t-flat" title="Price is roughly unchanged vs a week ago">&#8594; Stable</span>`;
    return '<span class="pi-trend t-flat">No data</span>';
}

async function renderIntelligence() {
    const listEl = document.getElementById('piList');
    if (!listEl) return;

    try {
        const products = await fetchProducts();
        const results = await Promise.allSettled(products.map(p => piLoadHistory(p.id)));
        piItems = products.map((p, i) => {
            const hist = results[i].status === 'fulfilled' ? results[i].value : null;
            const s = hist && hist.summary || {};
            const lowPt = piLowestPoint(hist);
            return {
                p, hist,
                trend: piTrend(hist),
                score: Intel.dealScore(p, hist),
                vd: Intel.verdict(p, hist),
                avg: s.average, low: s.lowest, high: s.highest,
                lowPt
            };
        }).filter(it => it.p.price > 0);

        /* ranked best-first; rankings need real history */
        const ranked = [...piItems].sort((a, b) => b.score - a.score);
        const dealRanked = ranked.filter(it => it.hist && it.hist.points && it.hist.points.length > 3);

        /* market pulse tiles */
        const statsEl = document.getElementById('piStats');
        if (statsEl) {
            const nDown = piItems.filter(it => it.trend.dir === 'down').length;
            const nFlat = piItems.filter(it => it.trend.dir === 'flat').length;
            const nUp = piItems.filter(it => it.trend.dir === 'up').length;
            const top = dealRanked[0];
            const tile = (tone, num, label, desc) => `
                <div class="dh-tile ${tone}"><i class="dh-dot"></i>
                    <div><strong>${num} ${label}</strong><small>${desc}</small></div>
                </div>`;
            statsEl.innerHTML = `
                <div class="dh-grid">
                    ${tile('t-live', nDown, 'falling', 'Cheaper than a week ago — worth a closer look')}
                    ${tile('t-recent', nFlat, 'stable', 'Moving less than 2% week-over-week')}
                    ${tile('t-stale', nUp, 'rising', 'Climbing prices — patience may pay')}
                    ${top ? tile('t-live', top.score + '/100', 'best score', Intel.esc(top.p.name)) : ''}
                </div>`;
        }

        /* best current deals — premium cards reuse Deal Score, Buy/Wait, sparkline */
        const dealsEl = document.getElementById('piDeals');
        if (dealsEl) {
            dealsEl.innerHTML = dealRanked.slice(0, 4).map(it =>
                buildProductCard(it.p, { history: it.hist })
            ).join('') || '<div class="state-card slim"><p>No complete price histories yet.</p></div>';
        }

        /* per-product intelligence rows */
        piSelId = (dealRanked[0] || ranked[0] || {}).p && (dealRanked[0] || ranked[0]).p.id;
        listEl.innerHTML = ranked.map(it => `
            <div class="pi-row${it.p.id === piSelId ? ' sel' : ''}" data-pi-id="${Intel.esc(it.p.id)}" role="button" tabindex="0">
                <div class="pi-main">
                    <strong>${Intel.esc(it.p.name)}</strong>
                    <span>${Intel.esc(it.p.category)} · ${Intel.esc(it.p.store)}</span>
                </div>
                <div class="pi-num"><small>Now</small><b>${formatPrice(it.p.price)}</b></div>
                <div class="pi-num"><small>Avg ${PI_RANGE.toUpperCase()}</small><b>${it.avg ? formatPrice(it.avg) : '—'}</b></div>
                <div class="pi-num"><small>Lowest</small><b>${it.low ? formatPrice(it.low) : '—'}</b><em>${it.lowPt ? piDay(it.lowPt.date) : ''}</em></div>
                <div class="pi-side">
                    ${piTrendChip(it.trend)}
                    <span class="verdict-pill ${it.vd.tone || (it.vd.buy ? 'v-buy' : 'v-wait')}">${Intel.esc(it.vd.label)}</span>
                </div>
                <p class="pi-insight">${Intel.esc(piInsightText(it))}</p>
            </div>`).join('');

        renderPiFeature();
    } catch (err) {
        document.getElementById('piStats').innerHTML = `
            <div class="state-card error-state"><p>Couldn't load price intelligence.</p>
            <button class="mini-btn mb-primary" onclick="renderIntelligence()">Try again</button></div>`;
        listEl.innerHTML = '';
    }
}

/* big trend panel for the selected product — same sparkline component used on cards */
function renderPiFeature() {
    const box = document.getElementById('piFeature');
    if (!box) return;
    const it = piItems.find(x => x.p.id === piSelId);
    if (!it) { box.innerHTML = '<div class="state-card slim"><p>Select a product to see its trend.</p></div>'; return; }

    const hasChart = it.hist && it.hist.points && it.hist.points.length > 1;
    box.innerHTML = `
        <div class="pi-feat-head">
            <div class="pi-feat-id">
                <span class="eyebrow">Featured trend · ${PI_RANGE.toUpperCase()}</span>
                <h3>${Intel.esc(it.p.name)}</h3>
                <span class="pi-feat-meta">${Intel.esc(it.p.category)} · ${Intel.esc(it.p.store)}</span>
            </div>
            <div class="pi-feat-stats">
                <div><small>Now</small><b>${formatPrice(it.p.price)}</b></div>
                <div><small>Avg</small><b>${it.avg ? Intel.fmtCompact(it.avg) : '—'}</b></div>
                <div><small>Low</small><b>${it.low ? Intel.fmtCompact(it.low) : '—'}</b></div>
                <div><small>High</small><b>${it.high ? Intel.fmtCompact(it.high) : '—'}</b></div>
                ${piTrendChip(it.trend)}
                <span class="verdict-pill ${it.vd.tone || (it.vd.buy ? 'v-buy' : 'v-wait')}">${Intel.esc(it.vd.label)}</span>
            </div>
        </div>
        ${hasChart ? `<div class="pi-feat-chart">${Intel.sparkline(it.hist.points, 620, 130)}</div>`
                   : '<div class="state-card slim"><p>No tracked history yet.</p></div>'}
        <p class="pi-insight big">${Intel.esc(piInsightText(it))}</p>
        <a class="mini-btn mb-primary" href="product-details.html?id=${encodeURIComponent(it.p.id)}">Open full price history graph ${Layout.icons.arrowRight}</a>`;
}

/* clicking a row features that product's chart */
document.addEventListener('click', e => {
    const row = e.target.closest('.pi-row');
    if (!row || e.target.closest('a')) return;
    piSelId = row.dataset.piId;
    document.querySelectorAll('.pi-row.sel').forEach(r => r.classList.remove('sel'));
    row.classList.add('sel');
    renderPiFeature();
});

loadStoreHealth();
loadScraperCategories();
renderScrapers();
renderIntelligence();

const API_BASE = '';

async function fetchProducts(category) {
    try {
        const url = category ? `${API_BASE}/api/products?category=${encodeURIComponent(category)}` : `${API_BASE}/api/products`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch products');
        return await response.json();
    } catch (err) {
        console.error('Error fetching products:', err);
        return [];
    }
}

async function fetchCategories() {
    try {
        const response = await fetch(`${API_BASE}/api/categories`);
        if (!response.ok) throw new Error('Failed to fetch categories');
        return await response.json();
    } catch (err) {
        console.error('Error fetching categories:', err);
        return {};
    }
}

async function fetchAlerts() {
    try {
        const response = await fetch(`${API_BASE}/api/alerts`);
        if (!response.ok) throw new Error('Failed to fetch alerts');
        return await response.json();
    } catch (err) {
        console.error('Error fetching alerts:', err);
        return [];
    }
}

async function fetchCompare(ids) {
    try {
        const response = await fetch(`${API_BASE}/api/compare?ids=${ids.join(',')}`);
        if (!response.ok) throw new Error('Failed to compare products');
        return await response.json();
    } catch (err) {
        console.error('Error comparing products:', err);
        return null;
    }
}

function formatPrice(price) {
    return price ? `₹${price.toLocaleString('en-IN')}` : '₹N/A';
}

function getStockStatus(availability) {
    if (!availability || availability === 'Unknown') return 'Unknown';
    if (availability.toLowerCase().includes('unavailable') || availability.toLowerCase().includes('out of stock')) {
        return 'Out of Stock';
    }
    if (availability.toLowerCase().includes('low stock')) {
        return 'Low Stock';
    }
    return 'In Stock';
}

function getHealthStatus(product) {
    if (product.error) return 'Error';
    if (product.stale) return 'Needs attention';
    if (!product.price || product.price === 0) return 'Needs attention';
    return 'Healthy';
}

function renderProductRow(product, showCheckbox) {
    const stockStatus = getStockStatus(product.availability);
    const stockClass = stockStatus === 'In Stock' ? 'stock-good' :
                      stockStatus === 'Low Stock' ? 'stock-warning' : 'stock-danger';

    const healthStatus = getHealthStatus(product);
    const statusClass = healthStatus === 'Healthy' ? 'badge-success' :
                      healthStatus === 'Error' ? 'badge-danger' : 'badge-warning';

    const price = formatPrice(product.price);
    const target = formatPrice(product.target);
    const checkbox = showCheckbox ? `<td><input type="checkbox" class="compare-check" data-id="${product.id}" data-category="${product.category}"></td>` : '';
    const discount = product.price && product.originalPrice && product.originalPrice > product.price
        ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
        : 0;

    return `
        ${checkbox}
        <td><a class="row-link" href="product-details.html?id=${encodeURIComponent(product.id)}"><strong>${product.name}</strong><span class="cell-sub">${product.category}</span></a></td>
        <td class="muted">${product.store}</td>
        <td><strong>${price}</strong>${discount > 0 ? `<span class="discount-tag">${discount}% off</span>` : ''}</td>
        <td class="muted">${target}</td>
        <td><span class="${stockClass}">${stockStatus}</span></td>
        <td><span class="status-badge ${statusClass}">${healthStatus}</span></td>`;
}


/* ============================================================
   PRICE INTELLIGENCE LAYER
   Deterministic scoring derived ONLY from live API fields
   (price, originalPrice, target, availability, rating,
   lastChecked, _source and the /history endpoint). No fake data.
   ============================================================ */

const Intel = {
    esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    },

    fmtCompact(v) {
        if (v == null || isNaN(v)) return '—';
        if (v >= 1e7) return '₹' + (v / 1e7).toFixed(1).replace(/\.0$/, '') + 'Cr';
        if (v >= 1e5) return '₹' + (v / 1e5).toFixed(1).replace(/\.0$/, '') + 'L';
        if (v >= 1000) return '₹' + Math.round(v / 1000) + 'k';
        return '₹' + Math.round(v);
    },

    /* % off MRP */
    discount(p) {
        if (!p.price || !p.originalPrice || p.originalPrice <= p.price) return 0;
        return Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100);
    },

    /* data freshness from real tracking fields */
    freshness(p) {
        if (p.error || p.stale) return { label: 'Stale feed', cls: 'stale' };
        if (!p.lastChecked) return { label: 'Never synced', cls: 'stale' };
        if (p._source === 'demo') return { label: 'Demo feed', cls: 'demo' };
        const ageMin = (Date.now() - new Date(p.lastChecked).getTime()) / 60000;
        if (ageMin < 15) return { label: 'Live', cls: 'live' };
        if (ageMin < 1440) return { label: 'Recently updated', cls: 'recent' };
        return { label: 'Stale feed', cls: 'stale' };
    },

    /* where the current price sits inside its recent range / vs MRP */
    quality(p, hist) {
        if (hist && hist.points && hist.points.length > 3) {
            const prices = hist.points.map(pt => pt.price);
            const lo = Math.min.apply(null, prices);
            const hi = Math.max.apply(null, prices);
            if (hi > lo && p.price) {
                const pos = (hi - p.price) / (hi - lo);   // 1 = at the bottom of range
                if (pos >= 0.82) return { label: 'Excellent', cls: 'q-exc' };
                if (pos >= 0.58) return { label: 'Good', cls: 'q-good' };
                if (pos >= 0.28) return { label: 'Average', cls: 'q-avg' };
                return { label: 'High', cls: 'q-high' };
            }
        }
        const d = this.discount(p);
        if (d >= 25) return { label: 'Excellent', cls: 'q-exc' };
        if (d >= 12) return { label: 'Good', cls: 'q-good' };
        if (d > 0) return { label: 'Average', cls: 'q-avg' };
        return { label: 'High', cls: 'q-high' };
    },

    /* transparent scoring buckets — the Deal Score is literally the sum of these */
    factors(p, hist) {
        const price = p.price || 0;
        const out = [];

        /* 0-35: proximity to your target */
        let tPts = 0, tNote = 'Set a target to unlock this signal';
        if (p.target && price) {
            if (price <= p.target) {
                tPts = 35;
                tNote = 'At or below your ' + formatPrice(p.target) + ' target';
            } else {
                const overPct = ((price - p.target) / p.target * 100);
                tPts = Math.max(0, 35 - overPct * 2.2);
                tNote = Math.round(overPct) + '% above your ' + formatPrice(p.target) + ' target';
            }
        }
        out.push({ key: 'target', label: 'Target fit', pts: tPts, max: 35, note: tNote });

        /* 0-30: below typical price (history average when available, else MRP gap) */
        let tpPts = 0, tpNote = '';
        if (hist && hist.points && hist.points.length > 3) {
            const prices = hist.points.map(pt => pt.price);
            const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
            const diffPct = avg ? (avg - price) / avg * 100 : 0;
            tpPts = diffPct >= 0 ? Math.min(30, diffPct * 3) : Math.max(0, 30 + diffPct * 1.5);
            tpNote = (diffPct >= 0 ? Math.round(diffPct) + '% below' : Math.round(-diffPct) + '% above') +
                ' ' + String(hist.range).toUpperCase() + ' average (' + this.fmtCompact(avg) + ')';
        } else {
            const d = this.discount(p);
            tpPts = Math.min(30, d * 1.2);
            tpNote = d > 0 ? d + '% off list price' : 'Trading at full list price';
        }
        out.push({ key: 'typical', label: 'Vs typical price', pts: tpPts, max: 30, note: tpNote });

        /* 0-20: MRP discount depth */
        const dsc = this.discount(p);
        out.push({
            key: 'mrp', label: 'MRP discount',
            pts: Math.min(20, dsc * 0.8), max: 20,
            note: dsc > 0
                ? dsc + '% off MRP' + (p.originalPrice ? ' (' + this.fmtCompact(p.originalPrice) + ')' : '')
                : 'No discount vs MRP'
        });

        /* 0-10: availability */
        const stock = getStockStatus(p.availability);
        out.push({
            key: 'stock', label: 'Availability',
            pts: stock === 'In Stock' ? 10 : stock === 'Low Stock' ? 5 : 0, max: 10,
            note: stock === 'In Stock' ? 'In stock - ready to order'
                : stock === 'Low Stock' ? 'Low stock' : 'Stock unknown'
        });

        /* 0-5: data freshness */
        const fr = this.freshness(p);
        out.push({
            key: 'fresh', label: 'Data freshness',
            pts: fr.cls === 'live' ? 5 : fr.cls === 'recent' || fr.cls === 'demo' ? 3 : 0, max: 5,
            note: fr.label
        });

        out.forEach(f => { f.pts = Math.round(f.pts); });
        return out;
    },

    /* composite 0-100 deal score = sum of the explainable factor buckets */
    dealScore(p, hist) {
        const raw = this.factors(p, hist).reduce((a, f) => a + f.pts, 0);
        return Math.max(1, Math.min(100, raw));
    },

    /* three-tier recommendation with an honest, data-backed reason */
    verdict(p, hist) {
        const stock = getStockStatus(p.availability);
        if (stock === 'Out of Stock') {
            return { buy: false, tier: 'na', tone: 'v-wait', label: 'Wait', reason: 'Out of stock right now - check back later' };
        }

        if (p.target && p.price && p.price <= p.target) {
            return {
                buy: true, tier: 'buy', tone: 'v-buy', label: 'Buy now',
                reason: 'At or below your ' + formatPrice(p.target) + ' target price'
            };
        }

        if (hist && hist.points && hist.points.length > 3) {
            const prices = hist.points.map(pt => pt.price);
            const lo = Math.min.apply(null, prices);
            const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
            const rng = String(hist.range).toUpperCase();

            if (p.price <= lo * 1.02) {
                return { buy: true, tier: 'buy', tone: 'v-buy', label: 'Buy now', reason: 'Near the ' + rng + ' low of ' + this.fmtCompact(lo) };
            }
            const belowAvg = Math.round((avg - p.price) / avg * 100);   /* >0 means cheaper than average */
            if (belowAvg >= 8) {
                return { buy: true, tier: 'buy', tone: 'v-buy', label: 'Buy now', reason: belowAvg + '% below ' + rng + ' average (' + this.fmtCompact(avg) + ')' };
            }
            if (belowAvg >= 2) {
                return { buy: true, tier: 'good', tone: 'v-mid', label: 'Good deal', reason: 'Only ' + belowAvg + '% below ' + rng + ' average - fair, not a steal' };
            }
            if (belowAvg >= -3) {
                return { buy: false, tier: 'good', tone: 'v-mid', label: 'Good deal', reason: 'Roughly at the ' + rng + ' average - reasonable time to buy' };
            }
            return { buy: false, tier: 'wait', tone: 'v-wait', label: 'Wait', reason: Math.round(-belowAvg) + '% above ' + rng + ' average - historically cheaper' };
        }

        const d = this.discount(p);
        if (d >= 18) return { buy: true, tier: 'buy', tone: 'v-buy', label: 'Buy now', reason: d + '% off MRP - deep discount' };
        if (d >= 8) return { buy: true, tier: 'good', tone: 'v-mid', label: 'Good deal', reason: d + '% below list price - fair deal' };
        return { buy: false, tier: 'wait', tone: 'v-wait', label: 'Wait', reason: 'Price close to MRP - wait for a dip' };
    },

    scoreTone(score) {
        return score >= 70 ? 'tone-green' : score >= 45 ? 'tone-indigo' : 'tone-amber';
    },

    /* category -> glyph + deterministic gradient */
    catGlyph(cat) {
        const c = (cat || '').toLowerCase();
        if (c.includes('smartphone')) return 'phone';
        if (c.includes('laptop')) return 'laptop';
        if (c.includes('headphone')) return 'headphones';
        if (c.includes('watch')) return 'watch';
        if (c.includes('tablet')) return 'tablet';
        if (c.includes('television') || c.includes('tv')) return 'tv';
        if (c.includes('gaming') || c.includes('console')) return 'gamepad';
        if (c.includes('air') || c.includes('conditioner')) return 'snow';
        return 'box';
    },

    gradIndex(str) {
        let h = 0;
        const s = String(str || '');
        for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
        return h % 6;
    },

    scoreRing(score) {
        const C = 94.25;               /* circumference for r=15 */
        const filled = (Math.max(0, Math.min(100, score)) / 100 * C).toFixed(1);
        return `
        <span class="score-ring ${this.scoreTone(score)}">
            <svg viewBox="0 0 36 36" width="38" height="38" aria-hidden="true">
                <circle cx="18" cy="18" r="15" fill="none" stroke-width="3.4" class="ring-track"/>
                <circle cx="18" cy="18" r="15" fill="none" stroke-width="3.4" stroke-linecap="round"
                    class="ring-fill" stroke-dasharray="${filled} ${C.toFixed(2)}"
                    transform="rotate(-90 18 18)"/>
            </svg>
            <b>${score}</b>
        </span>`;
    },

    /* tiny inline chart used on cards (no axes, no deps) */
    sparkline(points, w, h) {
        w = w || 230; h = h || 46;
        if (!points || points.length < 2) return '';
        const step = Math.max(1, Math.floor(points.length / 40));
        const pts = points.filter((_, i) => i % step === 0 || i === points.length - 1);
        const prices = pts.map(pt => pt.price);
        const lo = Math.min.apply(null, prices);
        const hi = Math.max.apply(null, prices);
        const span = (hi - lo) || 1;
        const X = i => (w - 4) * (i / (pts.length - 1)) + 2;
        const Y = v => 4 + (h - 10) * (1 - (v - lo) / span);
        const line = pts.map((pt, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(pt.price).toFixed(1)}`).join('');
        const area = line + `L${X(pts.length - 1).toFixed(1)} ${(h - 2).toFixed(1)}L${X(0).toFixed(1)} ${(h - 2).toFixed(1)}Z`;
        const lx = X(pts.length - 1).toFixed(1);
        const ly = Y(pts[pts.length - 1].price).toFixed(1);
        return `
        <svg class="spark" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none" aria-hidden="true">
            <path d="${area}" class="spark-area"/>
            <path d="${line}" class="spark-line"/>
            <circle cx="${lx}" cy="${ly}" r="3" class="spark-dot"/>
        </svg>`;
    }
};


/* ---------- watchlist (device-local, additive feature) ---------- */

const PGWatch = {
    KEY: 'pg_watchlist',
    META_KEY: 'pg_watch_meta',   /* id -> {addedAt, priceAtAdd} so the list can show movement since starring */
    get() {
        try {
            const raw = JSON.parse(localStorage.getItem(this.KEY));
            return Array.isArray(raw) ? raw.filter(x => typeof x === 'string') : [];
        } catch (e) { return []; }
    },
    has(id) { return this.get().indexOf(id) !== -1; },
    toggle(id, priceAtAdd) {
        const list = this.get();
        const i = list.indexOf(id);
        if (i === -1) {
            list.push(id);
            this._meta(m => { m[id] = {
                addedAt: new Date().toISOString(),
                priceAtAdd: Number(priceAtAdd) > 0 ? Math.round(Number(priceAtAdd)) : null
            }; });
        } else {
            list.splice(i, 1);
            this._meta(m => { delete m[id]; });
        }
        try { localStorage.setItem(this.KEY, JSON.stringify(list)); } catch (e) { /* ignore */ }
        return i === -1;
    },
    remove(id) {
        const list = this.get();
        const i = list.indexOf(id);
        if (i === -1) return false;
        list.splice(i, 1);
        try { localStorage.setItem(this.KEY, JSON.stringify(list)); } catch (e) { /* ignore */ }
        this._meta(m => { delete m[id]; });
        return true;
    },
    meta(id) {
        try { return JSON.parse(localStorage.getItem(this.META_KEY))[id] || null; } catch (e) { return null; }
    },
    _meta(fn) {
        let m = {};
        try { m = JSON.parse(localStorage.getItem(this.META_KEY)) || {}; } catch (e) { /* ignore */ }
        fn(m);
        try { localStorage.setItem(this.META_KEY, JSON.stringify(m)); } catch (e) { /* ignore */ }
    },
    count() { return this.get().length; }
};


/* ---------- device-local price alerts (additive layer over server targets) ---------- */

const PGAlerts = {
    KEY: 'pg_alerts',
    all() {
        try { return JSON.parse(localStorage.getItem(this.KEY)) || {}; } catch (e) { return {}; }
    },
    get(id) {
        const a = this.all()[id];
        return a && Number(a.target) > 0 ? a : null;
    },
    has(id) { return !!this.get(id); },
    set(id, target) {
        const all = this.all();
        all[id] = { target: Math.round(Number(target)), createdAt: new Date().toISOString() };
        try { localStorage.setItem(this.KEY, JSON.stringify(all)); } catch (e) { /* ignore */ }
        return all[id];
    },
    remove(id) {
        const all = this.all();
        delete all[id];
        try { localStorage.setItem(this.KEY, JSON.stringify(all)); } catch (e) { /* ignore */ }
    }
};


/* ---------- premium product card builder ---------- */

/*
 * opts.selectable  -> include compare checkbox (keeps products-page logic intact)
 * opts.history     -> {points:[{date,price}], range} from /api/products/:id/history
 * opts.compact     -> slimmer card for rails
 */
function buildProductCard(product, opts) {
    opts = opts || {};
    const p = product;
    const intel = Intel;

    const fresh = intel.freshness(p);
    const disc = intel.discount(p);
    const quality = intel.quality(p, opts.history);
    const score = intel.dealScore(p, opts.history);
    const vd = intel.verdict(p, opts.history);

    const detailsHref = 'product-details.html?id=' + encodeURIComponent(p.id);
    const compareHref = 'products.html?cat=' + encodeURIComponent(p.category) + '&preselect=' + encodeURIComponent(p.id);
    const watched = typeof PGWatch !== 'undefined' && PGWatch.has(p.id);
    const alert = typeof PGAlerts !== 'undefined' ? PGAlerts.get(p.id) : null;
    (window.__PGCARDS__ = window.__PGCARDS__ || {})[p.id] = p;

    /* target editor state: prefer local alert, fall back to tracker's built-in target */
    const effTarget = alert ? alert.target : (p.target && p.target > 0 ? p.target : '');
    const suggest = p.price ? Math.round(p.price * 0.9 / 100) * 100 : '';

    const select = opts.selectable ? `
        <label class="pcard-select" title="Select to compare">
            <input type="checkbox" class="compare-check" data-id="${intel.esc(p.id)}" data-category="${intel.esc(p.category)}">
            <span class="sel-box">${Layout.icons.shield.replace('<svg', '<svg class="sel-tick"')}</span>
        </label>` : '';

    const watchBtn = `
        <button type="button" class="pcard-watch${watched ? ' on' : ''}" data-watch-id="${intel.esc(p.id)}"
            aria-pressed="${watched}" title="${watched ? 'Remove from watchlist' : 'Add to watchlist'}">
            ${Layout.icons.watchlist}
        </button>`;

    const mrp = p.originalPrice && p.originalPrice > p.price
        ? `<s>${intel.fmtCompact(p.originalPrice)}</s>` : '';

    const drop = opts.history && opts.history.points && opts.history.points.length > 3
        ? (() => {
            const prices = opts.history.points.map(x => x.price);
            const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
            const d = Math.round((avg - p.price) / avg * 100);
            return `<em class="${d >= 0 ? 'pd-down' : 'pd-up'}">${d >= 0 ? '↓' : '↑'} ${Math.abs(d)}% vs avg</em>`;
          })()
        : (disc > 0 ? `<em class="pd-down">↓ ${disc}%</em>` : '');

    const spark = opts.history ? `<div class="pcard-spark">${intel.sparkline(opts.history.points)}
        <span class="spark-note">${intel.esc(String(opts.history.range).toUpperCase())} trend</span></div>` : '';

    const alertZone = pgAlertZone(p, alert);

    /* movement since the product was starred — real captured/tracked prices only */
    let wlMove = '';
    if (opts.watch && opts.watch.base > 0 && p.price > 0) {
        const diff = p.price - opts.watch.base;
        const pct = diff / opts.watch.base * 100;
        const flat = Math.abs(diff) < 1;
        const cls = flat ? 'wl-flat' : diff < 0 ? 'wl-down' : 'wl-up';
        const arrow = flat ? '→' : diff < 0 ? '↓' : '↑';
        const pctTxt = flat ? 'no change'
            : (Math.abs(pct) >= 10 ? Math.round(Math.abs(pct)) : Math.abs(pct).toFixed(1)) + '%';
        wlMove = `
        <div class="wl-move ${cls}" title="Price movement since you starred this product">
            <span class="wl-since">${intel.esc(opts.watch.sinceLabel || 'Since added')}</span>
            <s>${formatPrice(opts.watch.base)}</s>
            <b class="wl-badge">${arrow} ${pctTxt}</b>
            ${opts.watch.prev && opts.watch.prev !== p.price
                ? `<em class="wl-prev" title="Last tracked price before now">prev ${formatPrice(opts.watch.prev)}</em>` : ''}
        </div>`;
    }

    const targetPop = `
        <div class="tp-pop" hidden>
            <div class="tp-row"><small>Current price</small><strong>${formatPrice(p.price)}</strong></div>
            <label class="tp-label">Your target price</label>
            <div class="tp-input"><span>₹</span>
                <input type="number" min="1" step="1" inputmode="numeric" class="tp-field"
                    value="${effTarget || ''}" placeholder="${suggest ? String(suggest) : 'Enter amount'}">
            </div>
            <p class="tp-savings">${alert ? pgSavingsText(p, alert.target) : ''}</p>
            <div class="tp-actions">
                <button type="button" class="mini-btn mb-primary tp-save">Set alert</button>
                <button type="button" class="mini-btn tp-del${alert ? '' : ' hidden'}">Remove</button>
            </div>
        </div>`;

    return `
    <article class="pcard${opts.compact ? ' compact' : ''}" data-pid="${intel.esc(p.id)}">
        ${select}
        ${watchBtn}
        <a class="pcard-media g${intel.gradIndex(p.category || p.id)}" href="${detailsHref}" aria-hidden="true" tabindex="-1">
            ${Layout.icons[intel.catGlyph(p.category)] || Layout.icons.box}
        </a>
        ${disc > 0 ? `<span class="pcard-off">-${disc}%</span>` : ''}
        <div class="pcard-body">
            <div class="pcard-toprow">
                <span class="pcard-store"><i class="store-dot"></i>${intel.esc(p.store)}</span>
                <span class="fresh-chip ${fresh.cls}"><i></i>${intel.esc(fresh.label)}</span>
            </div>
            <a class="pcard-name" href="${detailsHref}">${intel.esc(p.name)}</a>
            <div class="pcard-priceline">
                <strong>${formatPrice(p.price)}</strong>
                ${mrp}
                ${drop}
            </div>
            ${alert ? `<div class="pa-zone">${alertZone}</div>` : ''}
            ${wlMove}
            <div class="pcard-quality ${quality.cls}"><i></i>${intel.esc(quality.label)} time to buy</div>
            ${spark}
            <div class="pcard-verdict">
                ${intel.scoreRing(score)}
                <span class="score-cap">Deal<br>score</span>
                <span class="verdict-pill ${vd.tone || (vd.buy ? 'v-buy' : 'v-wait')}">${intel.esc(vd.label)}</span>
            </div>
            <div class="vd-reason">${intel.esc(vd.reason)}</div>
            <div class="pcard-actions">
                <a class="mini-btn mb-primary" href="${detailsHref}">Details ${Layout.icons.arrowRight}</a>
                <button type="button" class="mini-btn mb-bell pcard-bell${alert ? ' active' : ''}"
                    data-pid="${intel.esc(p.id)}" title="${alert ? 'Alert active - tap to edit' : 'Set target price'}"
                    aria-expanded="false">${Layout.icons.bell}</button>
                ${opts.removeBtn
                    ? `<button type="button" class="mini-btn mb-remove pcard-drop"
                        data-drop-id="${intel.esc(p.id)}" title="Remove from watchlist">Remove</button>`
                    : `<a class="mini-btn" href="${compareHref}" title="Compare within ${intel.esc(p.category)}">Compare</a>`}
            </div>
            ${targetPop}
        </div>
    </article>`;
}

/* progress from MRP down to the user's target, using real prices only */
function pgAlertZone(p, alert) {
    if (!alert) return '';
    const price = p.price || 0;
    let pct = 0, cap = 'Waiting for price data';

    if (price > 0 && price <= alert.target) {
        pct = 100; cap = 'Target reached';
    } else if (price > 0) {
        const gap = price - alert.target;
        const base = p.originalPrice && p.originalPrice > price ? p.originalPrice : 0;
        pct = base > alert.target
            ? Math.round((base - price) / (base - alert.target) * 100)
            : Math.round(Math.max(0, 100 - gap / price * 100 * 4));
        pct = Math.max(4, Math.min(99, pct));
        cap = formatPrice(gap) + ' more to drop';
    }

    const bellIcon = typeof Layout !== 'undefined' && Layout.icons && Layout.icons.bell
        ? Layout.icons.bell
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';

    return `
    <span class="pa-chip">${bellIcon}<b>Alert active</b></span>
    <div class="pa-track">
        <div class="pa-bar"><i class="${pct === 100 ? 'hit' : ''}" style="width:${pct}%"></i></div>
        <div class="pa-cap"><span>Target ${formatPrice(alert.target)}</span><b class="${pct === 100 ? 'hit' : ''}">${cap}</b></div>
    </div>`;
}

/* "You'd save X vs current" preview used in the target editor */
function pgSavingsText(p, target) {
    if (!p.price || !target || target <= 0) return '';
    if (target >= p.price) return 'Target is at or above the current price';
    const save = p.price - target;
    const pct = Math.round(save / p.price * 100);
    return `You'd pay ${formatPrice(save)} less (${pct}% below current)`;
}

/* watch-star clicks work on every page via delegation */
document.addEventListener('click', e => {
    const btn = e.target.closest('.pcard-watch');
    if (!btn) return;
    e.preventDefault();
    const id = btn.dataset.watchId;
    const prod = window.__PGCARDS__ && window.__PGCARDS__[id];
    const added = PGWatch.toggle(id, prod && prod.price > 0 ? prod.price : undefined);
    btn.classList.toggle('on', added);
    btn.setAttribute('aria-pressed', added);
});

/* ---------- target-price editor: open / preview / save / remove ---------- */

function pgToast(msg) {
    const t = document.createElement('div');
    t.className = 'pg-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
        t.classList.remove('show');
        setTimeout(() => t.remove(), 350);
    }, 2200);
}

function pgClosePops(except) {
    document.querySelectorAll('.tp-pop').forEach(pop => {
        if (pop !== except) {
            pop.hidden = true;
            const bell = pop.closest('.pcard') && pop.closest('.pcard').querySelector('.pcard-bell');
            if (bell) bell.setAttribute('aria-expanded', 'false');
        }
    });
}

document.addEventListener('click', e => {
    /* open/close the editor */
    const bell = e.target.closest('.pcard-bell');
    if (bell) {
        e.preventDefault();
        const card = bell.closest('.pcard');
        const pop = card && card.querySelector('.tp-pop');
        if (!pop) return;
        const willOpen = pop.hidden;
        pgClosePops(willOpen ? pop : null);
        pop.hidden = !willOpen;
        bell.setAttribute('aria-expanded', String(willOpen));
        if (willOpen) {
            const field = pop.querySelector('.tp-field');
            if (field) { field.focus(); field.select(); }
        }
        return;
    }

    if (!e.target.closest('.tp-pop')) pgClosePops(null);
});

document.addEventListener('input', e => {
    const field = e.target.closest('.tp-field');
    if (!field) return;
    const card = field.closest('.pcard');
    const product = window.__PGCARDS__ && window.__PGCARDS__[card.dataset.pid];
    if (!product) return;
    const v = Number(field.value);
    field.closest('.tp-pop').querySelector('.tp-savings').textContent =
        field.value === '' ? '' : pgSavingsText(product, v);
});

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') pgClosePops(null);
});

function pgZoneEl(card) {
    let zone = card.querySelector('.pa-zone');
    if (!zone) {
        zone = document.createElement('div');
        zone.className = 'pa-zone';
        card.querySelector('.pcard-priceline').after(zone);
    }
    return zone;
}

/* save + remove via delegation so every page behaves identically */
document.addEventListener('click', e => {
    const saveBtn = e.target.closest('.tp-save');
    const delBtn = e.target.closest('.tp-del');

    if (!saveBtn && !delBtn) return;
    e.preventDefault();

    const pop = saveBtn ? saveBtn.closest('.tp-pop') : delBtn.closest('.tp-pop');
    const card = pop.closest('.pcard');
    const pid = card.dataset.pid;
    const product = window.__PGCARDS__ && window.__PGCARDS__[pid];
    const bell = card.querySelector('.pcard-bell');

    if (saveBtn) {
        const field = pop.querySelector('.tp-field');
        const target = Math.round(Number(field.value));
        if (!target || target <= 0) {
            pgToast('Enter a valid target price');
            field.focus();
            return;
        }
        PGAlerts.set(pid, target);
        const entry = PGAlerts.get(pid);
        pgZoneEl(card).innerHTML = pgAlertZone(product || { price: 0 }, entry);
        bell.classList.add('active');
        bell.title = 'Alert active - tap to edit';
        pop.querySelector('.tp-del').classList.remove('hidden');
        pop.hidden = true;
        bell.setAttribute('aria-expanded', 'false');
        pgToast('Alert active at ' + formatPrice(target));
    } else {
        PGAlerts.remove(pid);
        const zone = card.querySelector('.pa-zone');
        if (zone) zone.remove();
        bell.classList.remove('active');
        bell.title = 'Set target price';
        pop.querySelector('.tp-del').classList.add('hidden');
        pop.querySelector('.tp-savings').textContent = '';
        pop.hidden = true;
        bell.setAttribute('aria-expanded', 'false');
        pgToast('Alert removed');
    }
});

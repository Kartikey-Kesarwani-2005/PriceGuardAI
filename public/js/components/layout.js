const Layout = {
    /* meaningful loading state — rotating human phrases instead of skeletons */
    loadphrase(...msgs) {
        const list = Array.isArray(msgs[0]) ? msgs[0] : msgs;
        return `<div class="loadphrase" role="status" aria-live="polite" data-phrases="${Layout.esc(list.join('|'))}"><span class="lp-msg">${Layout.esc(list[0])}</span><div class="lp-bar"><i></i></div></div>`;
    },

    esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    },

    icons: {
        home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 21V12h6v9"/></svg>',
        compare: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/></svg>',
        alerts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
        watchlist: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 17.75-6.172 3.245 1.179-6.873-4.994-4.867 6.9-1.002L12 2l3.087 6.253 6.9 1.002-4.994 4.867 1.179 6.873z"/></svg>',
        insights: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m7 13 3-3 3 2 5-6"/></svg>',
        settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
        search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
        bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
        shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>',
        menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/></svg>',
        spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.2 2.2M16.2 16.2l2.2 2.2M18.4 5.6l-2.2 2.2M7.8 16.2l-2.2 2.2"/><circle cx="12" cy="12" r="3.2"/></svg>',
        arrowRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>',
        externalLink: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>',
        bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
        /* product category glyphs */
        phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18.5h2"/></svg>',
        laptop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="11" rx="1.8"/><path d="M2 19h20"/></svg>',
        headphones: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.6"/><rect x="17" y="14" width="4" height="6" rx="1.6"/></svg>',
        watch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="6"/><path d="M9 6.2 9.6 2h4.8L15 6.2M9 17.8 9.6 22h4.8L15 17.8"/></svg>',
        tablet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2.4"/><path d="M11 18.5h2"/></svg>',
        tv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="12.5" rx="2"/><path d="M8 20.5h8M12 16.5v4"/></svg>',
        gamepad: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 7h11A4.5 4.5 0 0 1 22 11.5c0 2.6-1 5.5-3 5.5-1.4 0-2-1-2.6-2H7.6C7 16 6.4 17 5 17c-2 0-3-2.9-3-5.5A4.5 4.5 0 0 1 6.5 7Z"/><path d="M8 11v3M6.5 12.5h3M15.5 11.5h.01M17.5 13.5h.01"/></svg>',
        snow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M4 6l16 12M20 6 4 18M12 2l-2 2.5L12 7l2-2.5zM12 22l-2-2.5 2-2.5 2 2.5z"/></svg>',
        box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>'
    },

    navItems: [
        { href: 'index.html', icon: 'home', label: 'Home', id: 'home' },
        { href: 'products.html', icon: 'compare', label: 'Compare', id: 'compare' },
        { href: 'alerts.html', icon: 'alerts', label: 'Alerts', id: 'alerts' },
        { href: 'watchlist.html', icon: 'watchlist', label: 'Watchlist', id: 'watchlist' },
        { href: 'scrapers.html', icon: 'insights', label: 'Insights', id: 'insights' }
    ],

    renderSidebar(activePage) {
        const nav = this.navItems.map(item => {
            const cls = item.id === activePage ? 'nav-item active' : 'nav-item';
            return `<a href="${item.href}" class="${cls}">${this.icons[item.icon]}<span>${item.label}</span></a>`;
        }).join('\n');

        return `
        <aside class="sidebar" id="sidebar">
            <div class="sidebar-logo">
                <div class="logo-icon">${this.icons.shield}</div>
                <div><span class="logo-word">PriceGuard</span><p>Price Intelligence</p></div>
                <button class="mobile-close" id="closeSidebar" aria-label="Close menu">&times;</button>
            </div>
            <nav class="sidebar-nav">${nav}</nav>
            <div class="sidebar-bottom">
                <a href="settings.html" class="nav-item nav-settings">${this.icons.settings}<span>Settings</span></a>
                <div class="system-status">
                    <div class="status-title"><span class="status-dot"></span>Monitoring prices</div>
                    <p>Amazon, Flipkart &amp; Croma are checked on a fixed rhythm — around the clock.</p>
                </div>
            </div>
        </aside>`;
    },

    getUsers() {
        let users;
        try {
            const raw = localStorage.getItem('pg_users');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length) users = parsed;
            }
        } catch (e) { /* ignore */ }

        if (!users) return [{ name: 'Dev X', role: 'Admin' }];

        if (!users.some(u => u.role === 'Admin')) {
            users[0] = { ...users[0], role: 'Admin' };
            try { localStorage.setItem('pg_users', JSON.stringify(users)); } catch (e) { /* ignore */ }
        }
        return users;
    },

    getCurrentUser() {
        try {
            const name = localStorage.getItem('pg_currentUser');
            const users = this.getUsers();
            if (name === null) {
                localStorage.setItem('pg_currentUser', users[0].name);
                return users[0];
            }
            return users.find(u => u.name === name) || null;
        } catch (e) { /* ignore */ }
        return this.getUsers()[0];
    },

    initials(name) {
        return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    },

    crumb() {
        const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
        const map = {
            'index.html': ['01', 'Signal Desk'],
            'products.html': ['02', 'Compare'],
            'product-details.html': ['02', 'Product Intel'],
            'alerts.html': ['03', 'Alerts'],
            'watchlist.html': ['04', 'Watchlist'],
            'scrapers.html': ['05', 'Insights'],
            'settings.html': ['06', 'Settings']
        };
        const hit = map[file] || map['index.html'];
        return `<div class="crumb" aria-hidden="true"><span class="crumb-num">${hit[0]}</span><span class="crumb-name">${hit[1]}</span></div>`;
    },

    renderHeader() {
        const user = this.getCurrentUser();
        const name = user ? user.name : 'Guest';
        const role = user ? user.role : 'Not signed in';
        const avatarText = user ? this.initials(user.name) : '?';
        return `
        <header class="header">
            <button class="mobile-menu" id="openSidebar" aria-label="Open menu">${this.icons.menu}</button>
            <button class="icon-btn sidebar-toggle" id="sidebarToggle" title="Toggle menu" aria-label="Toggle menu" aria-expanded="true">${this.icons.menu}</button>
            ${this.crumb()}
            <div class="header-right">
                <a class="icon-btn" href="settings.html" title="Settings" aria-label="Settings">${this.icons.settings}</a>
                <button class="notification-button" id="notificationBtn" title="Alerts" aria-label="Alerts">${this.icons.bell}<span class="notification-dot"></span></button>
                <div class="profile ${user ? '' : 'profile-guest'}" id="profileBtn" title="${user ? 'Switch user' : 'Sign in'}">
                    <div class="avatar">${avatarText}</div>
                    <div class="profile-info"><strong>${name}</strong><span class="profile-role"><span class="role-dot"></span>${role}</span></div>
                </div>
                <div class="profile-menu hidden" id="profileMenu">
                    <div class="profile-menu-title">Switch account</div>
                    <div id="profileMenuList"></div>
                    <div class="pm-auth hidden" id="pmAuth"></div>
                    <div class="profile-menu-add">
                        <input type="text" id="newUserName" maxlength="24" placeholder="New user name...">
                        <button id="addUserBtn">Add</button>
                    </div>
                </div>
            </div>
        </header>`;
    },

    renderPage(activePage, pageTitle, pageDescription, contentHtml) {
        /* NOTE: returns a FRAGMENT (sidebar + main) — NOT an .app wrapper.
           The page's <div class="app" id="app"> host IS the .app shell.
           Nesting another .app inside it makes the inner one a flex item
           whose min-width:auto stretches to max-content and overflows
           the viewport on laptops. */
        return `
        ${this.renderSidebar(activePage)}
        <div class="main">
            ${this.renderHeader()}
            <main class="content">
                <section class="page">
                    ${pageTitle ? `<div class="page-heading">
                        <h1>${pageTitle}</h1>
                        <p id="pageSub">${pageDescription}</p>
                    </div>` : ''}
                    ${contentHtml}
                </section>
            </main>
        </div>`;
    }
};

/* keep every .loadphrase rotating its human phrases until real content replaces it */
(function () {
    function wire(root) {
        (root || document).querySelectorAll('.loadphrase:not([data-wired])').forEach(el => {
            el.setAttribute('data-wired', '1');
            const list = (el.dataset.phrases || '').split('|').filter(Boolean);
            if (list.length < 2) return;
            const msg = el.querySelector('.lp-msg');
            let i = 0;
            const t = setInterval(() => {
                if (!document.contains(el)) { clearInterval(t); return; }
                i = (i + 1) % list.length;
                if (msg) msg.textContent = list[i];
            }, 1900);
        });
    }
    wire();
    new MutationObserver(muts => {
        for (const m of muts) if (m.addedNodes && m.addedNodes.length) { wire(document); break; }
    }).observe(document.documentElement, { childList: true, subtree: true });
})();

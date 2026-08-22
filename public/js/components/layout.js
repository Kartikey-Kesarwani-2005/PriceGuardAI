const Layout = {
    icons: {
        dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
        products: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>',
        scrapers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
        alerts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
        settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
        search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
        bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
        shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>',
        menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/></svg>'
    },

    navItems: [
        { href: 'index.html', icon: 'dashboard', label: 'Dashboard', id: 'dashboard' },
        { href: 'products.html', icon: 'products', label: 'Products', id: 'products' },
        { href: 'scrapers.html', icon: 'scrapers', label: 'Scraper Health', id: 'scrapers' },
        { href: 'alerts.html', icon: 'alerts', label: 'Alerts', id: 'alerts' },
        { href: 'settings.html', icon: 'settings', label: 'Settings', id: 'settings' }
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
                <div><h1>PriceGuard</h1><p>AI Intelligence</p></div>
                <button class="mobile-close" id="closeSidebar">&times;</button>
            </div>
            <nav class="sidebar-nav">${nav}</nav>
            <div class="sidebar-bottom">
                <div class="system-status">
                    <div class="status-title"><span class="status-dot"></span>System operational</div>
                    <p>All monitoring services are running normally.</p>
                </div>
            </div>
        </aside>`;
    },

    getUsers() {
        try {
            const raw = localStorage.getItem('pg_users');
            if (raw) {
                const users = JSON.parse(raw);
                if (Array.isArray(users) && users.length) return users;
            }
        } catch (e) { /* ignore */ }
        return [{ name: 'Dev X', role: 'Pro Account' }];
    },

    getCurrentUser() {
        try {
            const name = localStorage.getItem('pg_currentUser');
            const found = this.getUsers().find(u => u.name === name);
            if (found) return found;
        } catch (e) { /* ignore */ }
        return this.getUsers()[0];
    },

    initials(name) {
        return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    },

    renderHeader() {
        const user = this.getCurrentUser();
        return `
        <header class="header">
            <button class="mobile-menu" id="openSidebar" aria-label="Open menu">${this.icons.menu}</button>
            <div class="search-box">${this.icons.search}<input type="text" id="globalSearch" placeholder="Search products..." autocomplete="off"><span class="kbd">/</span></div>
            <div class="header-right">
                <button class="notification-button" id="notificationBtn" title="Alerts" aria-label="Alerts">${this.icons.bell}<span class="notification-dot"></span></button>
                <div class="profile" id="profileBtn" title="Switch user">
                    <div class="avatar">${this.initials(user.name)}</div>
                    <div class="profile-info"><strong>${user.name}</strong><span class="profile-role"><span class="role-dot"></span>${user.role}</span></div>
                </div>
                <div class="profile-menu hidden" id="profileMenu">
                    <div class="profile-menu-title">Switch account</div>
                    <div id="profileMenuList"></div>
                    <div class="profile-menu-add">
                        <input type="text" id="newUserName" maxlength="24" placeholder="New user name...">
                        <button id="addUserBtn">Add</button>
                    </div>
                </div>
            </div>
        </header>`;
    },

    renderPage(activePage, pageTitle, pageDescription, contentHtml) {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="PriceGuard AI - Price and inventory intelligence">
    <title>${pageTitle} - PriceGuard AI</title>
</head>
<body>
    <div class="app">
        ${this.renderSidebar(activePage)}
        <div class="main">
            ${this.renderHeader()}
            <main class="content">
                <section class="page">
                    <div class="page-heading">
                        <h1>${pageTitle}</h1>
                        <p>${pageDescription}</p>
                    </div>
                    ${contentHtml}
                </section>
            </main>
        </div>
    </div>`;
    }
};

const Layout = {
    navItems: [
        { href: 'index.html', icon: '▦', label: 'Dashboard', id: 'dashboard' },
        { href: 'products.html', icon: '□', label: 'Products', id: 'products' },
        { href: 'scrapers.html', icon: '◉', label: 'Scraper Health', id: 'scrapers' },
        { href: 'alerts.html', icon: '♢', label: 'Alerts', id: 'alerts' },
        { href: 'settings.html', icon: '⚙', label: 'Settings', id: 'settings' }
    ],

    renderSidebar(activePage) {
        const nav = this.navItems.map(item => {
            const cls = item.id === activePage ? 'nav-item active' : 'nav-item';
            return `<a href="${item.href}" class="${cls}"><span>${item.icon}</span>${item.label}</a>`;
        }).join('\n');

        return `
        <aside class="sidebar" id="sidebar">
            <div class="sidebar-logo">
                <div class="logo-icon">✓</div>
                <div><h1>PriceGuard</h1><p>AI Intelligence</p></div>
                <button class="mobile-close" id="closeSidebar">×</button>
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

    renderHeader() {
        return `
        <header class="header">
            <button class="mobile-menu" id="openSidebar">☰</button>
            <div class="search-box"><span>⌕</span><input type="text" placeholder="Search products..."></div>
            <div class="header-right">
                <button class="notification-button">♢<span class="notification-dot"></span></button>
                <div class="profile">
                    <div class="avatar">K</div>
                    <div class="profile-info"><strong>Kartikey</strong><span>Administrator</span></div>
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
    <link rel="stylesheet" href="css/style.css">
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

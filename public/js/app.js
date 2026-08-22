const sidebar = document.getElementById('sidebar');
const openSidebar = document.getElementById('openSidebar');
const closeSidebar = document.getElementById('closeSidebar');

if (openSidebar) {
    openSidebar.addEventListener('click', () => {
        sidebar.classList.add('sidebar-open');
    });
}

if (closeSidebar) {
    closeSidebar.addEventListener('click', () => {
        sidebar.classList.remove('sidebar-open');
    });
}

const notificationBtn = document.getElementById('notificationBtn');
if (notificationBtn) {
    notificationBtn.addEventListener('click', () => {
        window.location.href = 'alerts.html';
    });
    if (typeof fetchAlerts === 'function') {
        fetchAlerts().then(alerts => {
            const dot = notificationBtn.querySelector('.notification-dot');
            if (dot && (!alerts || !alerts.length)) dot.style.display = 'none';
        }).catch(() => {});
    }
}

const profileBtn = document.getElementById('profileBtn');
const profileMenu = document.getElementById('profileMenu');
const profileMenuList = document.getElementById('profileMenuList');

function saveUsers(users) {
    try { localStorage.setItem('pg_users', JSON.stringify(users)); } catch (e) { /* ignore */ }
}

function setCurrentUser(name) {
    try { localStorage.setItem('pg_currentUser', name); } catch (e) { /* ignore */ }
}

function renderProfileMenu() {
    if (!profileMenuList) return;
    const users = Layout.getUsers();
    const current = Layout.getCurrentUser();
    profileMenuList.innerHTML = users.map(u => `
        <div class="profile-menu-item ${u.name === current.name ? 'active' : ''}" data-name="${u.name}">
            <span class="avatar avatar-sm">${Layout.initials(u.name)}</span>
            <span class="pm-info"><strong>${u.name}</strong><small>${u.role}</small></span>
            ${u.name === current.name ? '<span class="pm-check">✓</span>' : ''}
        </div>
    `).join('');

    profileMenuList.querySelectorAll('.profile-menu-item').forEach(item => {
        item.addEventListener('click', () => {
            setCurrentUser(item.dataset.name);
            location.reload();
        });
    });
}

if (profileBtn && profileMenu) {
    profileBtn.addEventListener('click', e => {
        e.stopPropagation();
        renderProfileMenu();
        profileMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', e => {
        if (!profileMenu.classList.contains('hidden') && !profileMenu.contains(e.target)) {
            profileMenu.classList.add('hidden');
        }
    });

    const addUserBtn = document.getElementById('addUserBtn');
    const newUserName = document.getElementById('newUserName');
    if (addUserBtn && newUserName) {
        const addUser = () => {
            const name = newUserName.value.trim();
            if (!name) return;
            const users = Layout.getUsers();
            if (users.some(u => u.name.toLowerCase() === name.toLowerCase())) {
                setCurrentUser(name);
                location.reload();
                return;
            }
            users.push({ name, role: 'Standard Account' });
            saveUsers(users);
            setCurrentUser(name);
            location.reload();
        };
        addUserBtn.addEventListener('click', addUser);
        newUserName.addEventListener('keydown', e => { if (e.key === 'Enter') addUser(); });
    }
}

const globalSearch = document.getElementById('globalSearch');
const pageSearch = document.getElementById('productSearch');

function applyGlobalSearch(value) {
    const query = value.trim();
    if (pageSearch) {
        pageSearch.value = query;
        pageSearch.dispatchEvent(new Event('input'));
    } else if (query) {
        window.location.href = 'products.html?search=' + encodeURIComponent(query);
    }
}

if (globalSearch) {
    globalSearch.addEventListener('keydown', e => {
        if (e.key === 'Enter') applyGlobalSearch(globalSearch.value);
    });
    if (pageSearch) {
        let debounce;
        globalSearch.addEventListener('input', () => {
            clearTimeout(debounce);
            debounce = setTimeout(() => applyGlobalSearch(globalSearch.value), 300);
        });
    }
}

document.addEventListener('keydown', e => {
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);

    if (e.key === '/' && !typing && globalSearch) {
        e.preventDefault();
        globalSearch.focus();
        return;
    }

    if (e.key === 'Escape') {
        if (profileMenu && !profileMenu.classList.contains('hidden')) profileMenu.classList.add('hidden');
        if (sidebar && sidebar.classList.contains('sidebar-open')) sidebar.classList.remove('sidebar-open');
        const compareModal = document.getElementById('compareModal');
        if (compareModal && !compareModal.classList.contains('hidden')) compareModal.classList.add('hidden');
        if (globalSearch === document.activeElement) globalSearch.blur();
    }
});

(async function applyNotificationPreference() {
    try {
        const res = await fetch('/api/settings');
        const settings = await res.json();
        const dot = notificationBtn && notificationBtn.querySelector('.notification-dot');
        if (dot && settings.notifications === false) dot.style.display = 'none';
    } catch (e) { /* ignore */ }
})();

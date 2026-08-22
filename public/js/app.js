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
const pmAuth = document.getElementById('pmAuth');

function saveUsers(users) {
    try { localStorage.setItem('pg_users', JSON.stringify(users)); } catch (e) { /* ignore */ }
}

function setCurrentUser(name) {
    try { localStorage.setItem('pg_currentUser', name); } catch (e) { /* ignore */ }
}

function ensureAdminUser() {
    const users = Layout.getUsers();
    if (users.some(u => u.role === 'Admin')) return;
    users[0] = { ...users[0], role: 'Admin' };
    saveUsers(users);
}

ensureAdminUser();

function isAdminUser() {
    const user = Layout.getCurrentUser();
    return !!user && user.role === 'Admin';
}

function hashPin(pin) {
    let h = 5381;
    const salted = 'pguard::' + pin;
    for (let i = 0; i < salted.length; i++) h = ((h << 5) + h + salted.charCodeAt(i)) >>> 0;
    return h.toString(36);
}

function getPins() {
    try { return JSON.parse(localStorage.getItem('pg_pins')) || {}; } catch (e) { return {}; }
}

function savePins(pins) {
    try { localStorage.setItem('pg_pins', JSON.stringify(pins)); } catch (e) { /* ignore */ }
}

let authMode = null;
let authUser = '';

function openAuth(name, mode, notice) {
    if (!pmAuth) return;
    authMode = mode;
    authUser = name;

    pmAuth.innerHTML = `
        ${notice ? `<div class="pm-auth-notice">${notice}</div>` : ''}
        <div class="pm-auth-title">${mode === 'login' ? `Sign in as <strong>${name}</strong>` : `Create account <strong>${name}</strong>`}</div>
        <div class="pm-auth-row">
            <input type="password" id="pmPinInput" maxlength="16" autocomplete="off"
                placeholder="${mode === 'login' ? 'Enter PIN' : 'Create PIN (min 4 characters)'}">
            <button id="pmPinSubmit">${mode === 'login' ? 'Sign in' : 'Sign up'}</button>
        </div>
        <div class="pm-auth-error hidden" id="pmAuthError"></div>
        <button class="pm-auth-cancel" id="pmAuthCancel">Cancel</button>
    `;
    pmAuth.classList.remove('hidden');

    const pinInput = document.getElementById('pmPinInput');
    setTimeout(() => pinInput && pinInput.focus(), 30);
    document.getElementById('pmPinSubmit').addEventListener('click', submitAuth);
    pinInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitAuth(); });
    document.getElementById('pmAuthCancel').addEventListener('click', closeAuth);
}

function closeAuth() {
    if (!pmAuth) return;
    authMode = null;
    authUser = '';
    pmAuth.classList.add('hidden');
    pmAuth.innerHTML = '';
}

function showAuthError(msg) {
    const el = document.getElementById('pmAuthError');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
}

function submitAuth() {
    const input = document.getElementById('pmPinInput');
    const pin = input ? input.value : '';
    if (!pin || pin.length < 4) { showAuthError('PIN must be at least 4 characters.'); return; }

    const pins = getPins();

    if (authMode === 'login') {
        if (pins[authUser] !== undefined && pins[authUser] !== hashPin(pin)) {
            showAuthError('Incorrect PIN. Try again.');
            if (input) { input.value = ''; input.focus(); }
            return;
        }
        pins[authUser] = hashPin(pin);
        savePins(pins);
        setCurrentUser(authUser);
        location.reload();
        return;
    }

    const users = Layout.getUsers();
    if (!users.some(u => u.name.toLowerCase() === authUser.toLowerCase())) {
        users.push({ name: authUser, role: 'Standard Account' });
        saveUsers(users);
    }
    pins[authUser] = hashPin(pin);
    savePins(pins);

    closeAuth();
    renderProfileMenu();
    openAuth(authUser, 'login', 'Account ready. Now sign in with your PIN.');
}

function renderProfileMenu() {
    if (!profileMenuList) return;
    closeAuth();
    const users = Layout.getUsers();
    const current = Layout.getCurrentUser();
    profileMenuList.innerHTML = users.map(u => `
        <div class="profile-menu-item ${current && u.name === current.name ? 'active' : ''}" data-name="${u.name}">
            <span class="avatar avatar-sm">${Layout.initials(u.name)}</span>
            <span class="pm-info"><strong>${u.name}</strong><small>${u.role}</small></span>
            ${current && u.name === current.name ? '<span class="pm-check">✓</span>' : ''}
        </div>
    `).join('');

    profileMenuList.querySelectorAll('.profile-menu-item').forEach(item => {
        item.addEventListener('click', () => {
            const name = item.dataset.name;
            if (current && name === current.name) {
                profileMenu.classList.add('hidden');
                return;
            }
            openAuth(name, getPins()[name] !== undefined ? 'login' : 'signup');
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
            const existing = users.find(u => u.name.toLowerCase() === name.toLowerCase());
            openAuth(existing ? existing.name : name, existing ? 'login' : 'signup');
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

(function promptSigninForStaleSession() {
    let stored = null;
    try { stored = localStorage.getItem('pg_currentUser'); } catch (e) { /* ignore */ }
    if (stored === null) return;

    const current = Layout.getCurrentUser();
    if (current || !profileMenu) return;

    setTimeout(() => {
        renderProfileMenu();
        profileMenu.classList.remove('hidden');
        profileMenuList.insertAdjacentHTML('beforebegin',
            '<div class="pm-auth-notice">Your account was removed. Please sign in to continue.</div>');
    }, 250);
})();

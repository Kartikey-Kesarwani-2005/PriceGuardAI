const demoToggle = document.getElementById('toggleDemo');
const settingToggles = document.querySelectorAll('.toggle:not(#toggleDemo)');
const interval = document.getElementById('interval');

let pendingDelete = null;

async function apiGet(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        return null;
    }
}

async function apiPost(url, body) {
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    } catch (e) { /* keep UI state regardless */ }
}

function applyToggleState(toggle, enabled) {
    if (!toggle) return;
    toggle.classList.toggle('toggle-on', !!enabled);
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

/* ---------- sensitive settings are admin-only; page stays visible ---------- */

const currentUser = Layout.getCurrentUser();
if (!isAdminUser()) {
    const page = document.querySelector('.page');

    document.querySelectorAll('.toggle, #interval').forEach(el => { el.disabled = true; });
    document.querySelectorAll('.settings-card, .interval-card').forEach(c => c.classList.add('locked'));

    if (page) {
        page.insertAdjacentHTML('afterbegin', `
            <div class="admin-banner">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Sensitive settings are restricted to Admin. You are signed in as <strong>${currentUser ? currentUser.name : 'Guest'}</strong> (${currentUser ? currentUser.role : 'No role'}). Account management below is available to everyone.
            </div>
        `);
    }
} else {

    /* ---------- admin-only wiring ---------- */

    async function hydrate() {
        const [mode, settings] = await Promise.all([apiGet('/api/mode'), apiGet('/api/settings')]);

        applyToggleState(demoToggle, mode && mode.demo);

        if (settings) {
            settingToggles.forEach(t => applyToggleState(t, settings[t.dataset.setting]));
            if (interval && settings.intervalMinutes) interval.value = String(settings.intervalMinutes);
        }
    }

    if (demoToggle) {
        demoToggle.addEventListener('click', () => {
            const enabled = !demoToggle.classList.contains('toggle-on');
            applyToggleState(demoToggle, enabled);
            apiPost('/api/mode', { demo: enabled });
        });
    }

    settingToggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            const enabled = !toggle.classList.contains('toggle-on');
            applyToggleState(toggle, enabled);
            apiPost('/api/settings', { [toggle.dataset.setting]: enabled });
        });
    });

    if (interval) {
        interval.addEventListener('change', () => {
            apiPost('/api/settings', { intervalMinutes: parseInt(interval.value, 10) });
        });
    }

    hydrate();
}

/* ---------- account management (all users, delete needs PIN) ---------- */

function getDeleteConfirmHtml(name, isSelf) {
    return `
        <div class="pm-auth acct-confirm">
            <div class="pm-auth-title">Confirm PIN of <strong>${name}</strong> to remove this account${isSelf ? ' - you will be signed out' : ''}</div>
            <div class="pm-auth-row">
                <input type="password" id="delPinInput" maxlength="16" autocomplete="off" placeholder="Enter PIN">
                <button id="delPinSubmit">Delete forever</button>
            </div>
            <div class="pm-auth-error hidden" id="delAuthError"></div>
            <button class="pm-auth-cancel" id="delAuthCancel">Cancel</button>
        </div>
    `;
}

function bindDeleteConfirm(name) {
    const input = document.getElementById('delPinInput');
    const submit = document.getElementById('delPinSubmit');
    const cancel = document.getElementById('delAuthCancel');
    if (!input || !submit || !cancel) return;

    const doDelete = () => {
        const pin = input.value;
        const pins = getPins();
        if (!pin || pins[name] === undefined || pins[name] !== hashPin(pin)) {
            const err = document.getElementById('delAuthError');
            err.textContent = pins[name] === undefined
                ? `No PIN found for "${name}". This account cannot be verified for deletion.`
                : 'Incorrect PIN. Try again.';
            err.classList.remove('hidden');
            input.value = '';
            input.focus();
            return;
        }

        const users = Layout.getUsers().filter(u => u.name !== name);
        localStorage.setItem('pg_users', JSON.stringify(users));
        delete pins[name];
        localStorage.setItem('pg_pins', JSON.stringify(pins));

        const wasSelf = currentUser && currentUser.name === name;
        if (wasSelf) {
            localStorage.removeItem('pg_currentUser');
            location.reload();
            return;
        }

        pendingDelete = null;
        renderAccounts();
    };

    submit.addEventListener('click', doDelete);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') doDelete(); });
    cancel.addEventListener('click', () => { pendingDelete = null; renderAccounts(); });
    setTimeout(() => input.focus(), 30);
}

function renderAccounts() {
    const wrap = document.getElementById('accountList');
    if (!wrap) return;

    const users = Layout.getUsers();
    const isAdmin = isAdminUser();

    wrap.innerHTML = users.map(u => {
        const isSelf = currentUser && u.name === currentUser.name;
        const canDelete = users.length > 1 && (isSelf || isAdmin);
        return `
        <div class="acct-row">
            <span class="avatar avatar-sm">${Layout.initials(u.name)}</span>
            <span class="pm-info"><strong>${u.name}</strong><small>${isSelf ? u.role + ' · signed in now' : u.role}</small></span>
            ${u.role === 'Admin' ? '<span class="acct-role role-admin">Admin</span>' : ''}
            ${canDelete ? `<button class="acct-delete" data-name="${u.name}">Delete</button>` : ''}
        </div>
        ${pendingDelete === u.name ? getDeleteConfirmHtml(u.name, isSelf) : ''}
        `;
    }).join('');

    wrap.querySelectorAll('.acct-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            pendingDelete = btn.dataset.name;
            renderAccounts();
        });
    });

    if (pendingDelete) bindDeleteConfirm(pendingDelete);
}

renderAccounts();

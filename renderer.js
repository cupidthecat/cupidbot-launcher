const NORMAL_IDENTITY = 'none';
const DEFAULT_CLIENT_RAM = '1g';
const ACCOUNT_POLL_INTERVAL_MS = 1000;
const UPDATE_POLL_INTERVAL_MS = 5 * 60 * 1000;

const launcherState = {
    accounts: [],
    jars: [],
    profiles: [],
    clientVersion: '0.0.0',
    launcherVersion: '',
    launchBusy: false,
    launcherInitialized: false,
    authUiReady: false,
    mockAuthEnabled: false,
    currentSessionEmail: '',
    accountsPollHandle: null,
    accountsPollBusy: false,
    updatePollHandle: null,
    accountActionBusy: false,
    selectionEpoch: 0,
    lastAccountsReadError: null,
    cleanupAccountsDropdownListeners: null
};

function $(id) {
    return document.getElementById(id);
}

function toggleClass(element, className, shouldAdd) {
    if (!element) return;
    element.classList.toggle(className, Boolean(shouldAdd));
}

function asErrorMessage(error, fallback = 'Something went wrong.') {
    if (typeof error === 'string' && error.trim()) {
        return error;
    }
    if (error?.message) {
        return error.message;
    }
    if (error?.error) {
        return error.error;
    }
    return fallback;
}

function logError(error) {
    const message = asErrorMessage(error);
    window.electron?.logError?.(message);
}

function showToast(message, type = 'info') {
    const region = $('toast-region');
    if (!region || !message) return;

    const toast = document.createElement('div');
    toast.className = `toast is-${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.textContent = message;
    region.appendChild(toast);

    const removeToast = () => {
        toast.classList.add('is-leaving');
        setTimeout(() => toast.remove(), 240);
    };

    setTimeout(removeToast, type === 'error' ? 6200 : 4200);
}

function setLaunchMessage(message = '', type = '') {
    const element = $('launch-status');
    if (!element) return;
    element.textContent = message;
    element.classList.toggle('is-error', type === 'error');
    element.classList.toggle('is-success', type === 'success');
}

async function showBlockingError(error, fallback) {
    const message = asErrorMessage(error, fallback);
    setLaunchMessage(message, 'error');
    logError(message);
    await window.electron?.errorAlert?.(message);
}

function setButtonBusy(button, isBusy) {
    if (!button) return;

    if (isBusy) {
        button.dataset.wasDisabled = button.disabled ? 'true' : 'false';
        button.disabled = true;
        button.classList.add('is-loading');
    } else {
        button.classList.remove('is-loading');
        button.disabled = button.dataset.wasDisabled === 'true';
        delete button.dataset.wasDisabled;
    }
}

function setAuthError(message, elementId = 'auth-error', isSuccess = false) {
    const element = $(elementId);
    if (!element) return;
    element.textContent = message || '';
    toggleClass(element, 'success', Boolean(isSuccess && message));
}

function setActiveAuthTab(target) {
    const signinTab = $('auth-tab-signin');
    const signupTab = $('auth-tab-signup');
    const signinForm = $('signin-form');
    const signupForm = $('signup-form');
    const isSignin = target === 'signin';

    toggleClass(signinTab, 'active', isSignin);
    toggleClass(signupTab, 'active', !isSignin);
    signinTab?.setAttribute('aria-selected', isSignin ? 'true' : 'false');
    signupTab?.setAttribute('aria-selected', isSignin ? 'false' : 'true');
    toggleClass(signinForm, 'auth-hidden', !isSignin);
    toggleClass(signupForm, 'auth-hidden', isSignin);
    setAuthError('');
}

function showAuthModal() {
    const modal = $('auth-modal');
    if (!modal) return;
    modal.classList.remove('auth-hidden');
    $('signin-form')?.reset();
    $('signup-form')?.reset();
    setActiveAuthTab('signin');
    setTimeout(() => $('signin-email')?.focus(), 0);
}

function hideAuthModal() {
    $('auth-modal')?.classList.add('auth-hidden');
    setAuthError('');
}

function showChangePasswordModal() {
    if (!launcherState.mockAuthEnabled) return;
    $('change-password-form')?.reset();
    setAuthError('', 'change-password-error');
    $('change-password-modal')?.classList.remove('auth-hidden');
    setTimeout(() => $('current-password-input')?.focus(), 0);
}

function hideChangePasswordModal() {
    $('change-password-modal')?.classList.add('auth-hidden');
    setAuthError('', 'change-password-error');
}

function updateSessionEmail(email) {
    launcherState.currentSessionEmail = email || '';
    const container = $('user-session');
    const emailLabel = $('session-email');
    if (!container || !emailLabel) return;

    const shouldShow = Boolean(
        launcherState.mockAuthEnabled && launcherState.currentSessionEmail
    );
    container.classList.toggle('hidden', !shouldShow);
    emailLabel.textContent = shouldShow ? launcherState.currentSessionEmail : '';
}

async function handleSignIn(event) {
    event.preventDefault();
    if (!launcherState.mockAuthEnabled) {
        hideAuthModal();
        await ensureLauncherInitialized();
        return;
    }

    const email = $('signin-email')?.value?.trim();
    const password = $('signin-password')?.value || '';
    if (!email || !password) {
        setAuthError('Email and password are required.');
        return;
    }

    const button = $('signin-submit');
    setAuthError('');
    setButtonBusy(button, true);
    try {
        const result = await window.electron.auth.signin({ email, password });
        if (!result?.success) {
            throw new Error(result?.error || 'Unable to sign in.');
        }
        await refreshAuthStatus();
    } catch (error) {
        setAuthError(asErrorMessage(error, 'Unable to sign in.'));
    } finally {
        setButtonBusy(button, false);
    }
}

async function handleSignUp(event) {
    event.preventDefault();
    if (!launcherState.mockAuthEnabled) {
        hideAuthModal();
        await ensureLauncherInitialized();
        return;
    }

    const email = $('signup-email')?.value?.trim();
    const password = $('signup-password')?.value || '';
    if (!email || !password) {
        setAuthError('Email and password are required.');
        return;
    }
    if (password.length < 8) {
        setAuthError('Password must be at least 8 characters.');
        return;
    }

    const button = $('signup-submit');
    setAuthError('');
    setButtonBusy(button, true);
    try {
        const result = await window.electron.auth.signup({ email, password });
        if (!result?.success) {
            throw new Error(result?.error || 'Unable to create account.');
        }
        await refreshAuthStatus();
    } catch (error) {
        setAuthError(asErrorMessage(error, 'Unable to create account.'));
    } finally {
        setButtonBusy(button, false);
    }
}

async function handleSignOut() {
    if (!launcherState.mockAuthEnabled) return;
    const button = $('signout-btn');
    setButtonBusy(button, true);
    try {
        const result = await window.electron.auth.signout();
        if (!result?.success) {
            throw new Error(result?.error || 'Unable to sign out.');
        }
        await refreshAuthStatus();
    } catch (error) {
        await showBlockingError(error, 'Unable to sign out.');
    } finally {
        setButtonBusy(button, false);
        hideChangePasswordModal();
    }
}

async function handleChangePassword(event) {
    event.preventDefault();
    if (!launcherState.mockAuthEnabled) return;

    const currentPassword = $('current-password-input')?.value || '';
    const newPassword = $('change-password-input')?.value || '';
    if (!currentPassword) {
        setAuthError('Current password is required.', 'change-password-error');
        return;
    }
    if (newPassword.length < 8) {
        setAuthError(
            'New password must be at least 8 characters.',
            'change-password-error'
        );
        return;
    }

    const button = $('change-password-submit');
    setAuthError('', 'change-password-error');
    setButtonBusy(button, true);
    try {
        const result = await window.electron.auth.changePassword({
            currentPassword,
            newPassword
        });
        if (!result?.success) {
            throw new Error(result?.error || 'Unable to change password.');
        }
        $('change-password-form')?.reset();
        setAuthError(
            'Password updated successfully.',
            'change-password-error',
            true
        );
        showToast('Password updated successfully.', 'success');
        setTimeout(hideChangePasswordModal, 1100);
    } catch (error) {
        setAuthError(
            asErrorMessage(error, 'Unable to change password.'),
            'change-password-error'
        );
    } finally {
        setButtonBusy(button, false);
    }
}

function setupAuthUI() {
    if (launcherState.authUiReady) return;
    launcherState.authUiReady = true;

    $('signin-form')?.addEventListener('submit', handleSignIn);
    $('signup-form')?.addEventListener('submit', handleSignUp);
    $('auth-tab-signin')?.addEventListener('click', () => setActiveAuthTab('signin'));
    $('auth-tab-signup')?.addEventListener('click', () => setActiveAuthTab('signup'));
    $('signout-btn')?.addEventListener('click', handleSignOut);
    $('change-password-btn')?.addEventListener('click', showChangePasswordModal);
    $('change-password-cancel')?.addEventListener('click', hideChangePasswordModal);
    $('change-password-form')?.addEventListener('submit', handleChangePassword);
    setActiveAuthTab('signin');
}

async function refreshAuthStatus() {
    let status;
    try {
        status = await window.electron.auth.status();
    } catch (error) {
        status = { authenticated: true, mock: false };
    }

    launcherState.mockAuthEnabled = Boolean(status?.mock);
    if (!launcherState.mockAuthEnabled) {
        hideAuthModal();
        hideChangePasswordModal();
        updateSessionEmail(status?.user?.email || '');
        await ensureLauncherInitialized();
        return;
    }

    if (status?.authenticated) {
        hideAuthModal();
        updateSessionEmail(status?.user?.email || '');
        await ensureLauncherInitialized();
    } else {
        showAuthModal();
        updateSessionEmail('');
    }
}

function showProgress(status = 'Checking local files…') {
    const overlay = $('loader-container');
    if (!overlay) return;
    updateProgress(0, status);
    overlay.classList.add('is-visible');
}

function hideProgress() {
    $('loader-container')?.classList.remove('is-visible');
}

function updateProgress(percent, status) {
    const progressBar = $('progress-bar');
    const statusText = $('status');
    const normalized = Math.max(0, Math.min(100, Number(percent) || 0));
    if (progressBar) {
        progressBar.style.width = `${normalized}%`;
        progressBar.textContent = `${normalized}%`;
    }
    if (statusText && status) {
        statusText.textContent = status;
    }
}

window.electron.ipcRenderer.receive('progress', (_event, data) => {
    if (data) {
        updateProgress(data.percent, data.status);
    }
});

function setTextContent(elementId, value) {
    const element = $(elementId);
    if (element) {
        element.textContent = value;
    }
}

function formatInstalledClientStatus(jars) {
    if (!Array.isArray(jars) || jars.length === 0) {
        return 'No local clients found';
    }
    if (jars.length === 1) {
        return jars[0];
    }
    return `${jars.length} versions available`;
}

function syncReadiness() {
    const hasClient = launcherState.jars.length > 0;
    const header = $('header-readiness');
    const badge = $('readiness-state');
    const card = document.querySelector('.readiness-card');

    if (header) {
        header.classList.remove('is-checking', 'is-ready', 'is-attention', 'is-error');
        header.classList.add(hasClient ? 'is-ready' : 'is-attention');
    }
    if (badge) {
        badge.classList.remove('is-checking', 'is-ready', 'is-attention', 'is-error');
        badge.classList.add(hasClient ? 'is-ready' : 'is-attention');
        badge.textContent = hasClient ? 'Ready' : 'Client needed';
    }
    card?.classList.toggle('has-no-client', !hasClient);

    setTextContent(
        'header-readiness-label',
        hasClient ? 'Local client ready' : 'Local client required'
    );
    setTextContent(
        'launcher-version-status',
        launcherState.launcherVersion
            ? `v${launcherState.launcherVersion}`
            : 'Version unavailable'
    );
    setTextContent(
        'client-version-status',
        launcherState.clientVersion && launcherState.clientVersion !== '0.0.0'
            ? `v${launcherState.clientVersion}`
            : 'Not configured'
    );
    setTextContent(
        'installed-client-status',
        formatInstalledClientStatus(launcherState.jars)
    );
}

function getSelectedIdentity() {
    return $('character')?.value || NORMAL_IDENTITY;
}

function getSelectedAccount() {
    const identityId = getSelectedIdentity();
    return (
        launcherState.accounts.find(
            (account) => account?.accountId === identityId
        ) || null
    );
}

function getSelectedClientFile() {
    return $('client')?.value || '';
}

function getSelectedClientVersion() {
    return extractVersion(getSelectedClientFile());
}

function getIdentityLabel() {
    const account = getSelectedAccount();
    return account ? getAccountLabel(account) : 'Normal account';
}

function syncLaunchSummary() {
    const profile = $('profile')?.value || 'default';
    const version = getSelectedClientVersion();
    const memory = formatRamLabel(getClientRamPreference());
    const summary = [
        getIdentityLabel(),
        profile === 'default' ? 'Default profile' : profile,
        version ? `v${version}` : 'No client',
        memory
    ].join(' · ');
    setTextContent('launch-summary', summary);
}

function syncAdvancedSettingsSummary() {
    const memory = formatRamLabel(getClientRamPreference());
    const hasProxy = Boolean($('proxy-ip')?.value?.trim());
    setTextContent(
        'advanced-settings-summary',
        `${memory} memory · ${hasProxy ? 'SOCKS proxy set' : 'No proxy'}`
    );
}

function syncLaunchState() {
    const button = $('launch-client');
    if (!button || !window.CupidLauncherUI) return;

    const view = window.CupidLauncherUI.deriveLaunchState({
        accounts: launcherState.accounts,
        identityId: getSelectedIdentity(),
        jars: launcherState.jars,
        busy: launcherState.launchBusy
    });
    const label = button.querySelector('span');
    if (label) {
        label.textContent = view.label;
    }
    button.disabled = !view.enabled;
    button.classList.toggle('is-loading', launcherState.launchBusy);

    if (view.reason) {
        setLaunchMessage(view.reason, 'error');
    }
    syncLaunchSummary();
}

function formatUpdateEntryMeta(entry) {
    return [entry.date, entry.area, entry.commit].filter(Boolean).join(' · ');
}

function renderRecentUpdates(entries = []) {
    const list = $('recent-updates-list');
    if (!list) return;

    const validEntries = Array.isArray(entries)
        ? entries.filter((entry) => entry?.summary).slice(0, 3)
        : [];
    list.innerHTML = '';

    if (validEntries.length === 0) {
        const item = document.createElement('li');
        const title = document.createElement('strong');
        const meta = document.createElement('span');
        title.textContent = 'No update entries yet.';
        meta.textContent = 'Committed launcher updates will appear here.';
        item.append(title, meta);
        list.appendChild(item);
        return;
    }

    validEntries.forEach((entry) => {
        const item = document.createElement('li');
        const title = document.createElement('strong');
        const meta = document.createElement('span');
        title.textContent = entry.summary;
        meta.textContent = formatUpdateEntryMeta(entry);
        item.append(title, meta);
        list.appendChild(item);
    });
}

async function loadRecentUpdates() {
    try {
        const result = await window.electron.readUpdateLog();
        if (result?.success) {
            renderRecentUpdates(result.entries);
        } else if (result?.error) {
            logError(result.error);
        }
    } catch (error) {
        logError(error);
    }
}

function sortAccounts(accounts) {
    if (!Array.isArray(accounts)) return [];
    return [...accounts].sort((a, b) => {
        const nameA = getAccountLabel(a).toLowerCase();
        const nameB = getAccountLabel(b).toLowerCase();
        return nameA.localeCompare(nameB);
    });
}

function getAccountLabel(account) {
    const displayName = account?.displayName?.toString().trim();
    return displayName || account?.accountId?.toString() || 'Unnamed character';
}

async function safeReadAccounts({ quiet = false } = {}) {
    try {
        const result = await window.electron.readAccounts();
        if (result?.error) {
            throw new Error(result.error);
        }
        if (!Array.isArray(result)) {
            throw new Error('Accounts data is in an unexpected format.');
        }
        launcherState.lastAccountsReadError = null;
        return sortAccounts(result);
    } catch (error) {
        const message = `Unable to read Jagex accounts: ${asErrorMessage(error)}`;
        if (launcherState.lastAccountsReadError !== message) {
            launcherState.lastAccountsReadError = message;
            logError(message);
            if (!quiet) {
                showToast(message, 'error');
            }
        }
        return null;
    }
}

function populateAccountSelector(selectedIdentity = NORMAL_IDENTITY) {
    const select = $('character');
    if (!select) return;
    select.innerHTML = '';

    const normalOption = document.createElement('option');
    normalOption.value = NORMAL_IDENTITY;
    normalOption.textContent = 'Normal account';
    select.appendChild(normalOption);

    launcherState.accounts.forEach((account) => {
        if (!account?.accountId) return;
        const option = document.createElement('option');
        option.value = account.accountId;
        option.textContent = getAccountLabel(account);
        select.appendChild(option);
    });

    select.value = window.CupidLauncherUI.resolveIdentity(
        launcherState.accounts,
        selectedIdentity
    );
}

function ensureProfileOption(profile) {
    const select = $('profile');
    if (!select || !profile) return;
    const exists = Array.from(select.options).some(
        (option) => option.value === profile
    );
    if (!exists) {
        const option = document.createElement('option');
        option.value = profile;
        option.textContent = profile;
        select.appendChild(option);
    }
}

async function readProfileForIdentity(identityId) {
    if (identityId !== NORMAL_IDENTITY) {
        const account = launcherState.accounts.find(
            (item) => item.accountId === identityId
        );
        return account?.profile || 'default';
    }

    try {
        const result = await window.electron.readNonJagexProfile();
        return typeof result === 'string' && result ? result : 'default';
    } catch (error) {
        logError(error);
        return 'default';
    }
}

async function persistSelectedIdentity(identityId) {
    try {
        const properties = (await window.electron.readProperties()) || {};
        if (properties.selected_account !== identityId) {
            properties.selected_account = identityId;
            await window.electron.writeProperties(properties);
        }
    } catch (error) {
        logError(`Unable to remember selected identity: ${asErrorMessage(error)}`);
    }
}

async function selectIdentity(
    requestedIdentity,
    { persist = true, announce = false } = {}
) {
    const epoch = ++launcherState.selectionEpoch;
    const identityId = window.CupidLauncherUI.resolveIdentity(
        launcherState.accounts,
        requestedIdentity
    );

    if ($('character')) {
        $('character').value = identityId;
    }
    const profile = await readProfileForIdentity(identityId);
    if (epoch !== launcherState.selectionEpoch) return identityId;

    ensureProfileOption(profile);
    if ($('profile')) {
        $('profile').value = profile;
    }
    if (persist) {
        await persistSelectedIdentity(identityId);
    }

    if (!launcherState.launchBusy) {
        setLaunchMessage('');
    }
    renderAccountsList();
    syncAccountActions();
    syncLaunchState();
    if (announce) {
        showToast(`${getIdentityLabel()} selected.`, 'success');
    }
    return identityId;
}

function syncAccountActions() {
    const hasAccounts = launcherState.accounts.length > 0;
    const refresh = $('refresh-accounts');
    const removeAll = $('logout');
    if (refresh) {
        refresh.disabled = !hasAccounts || launcherState.accountActionBusy;
    }
    if (removeAll) {
        removeAll.style.display = hasAccounts ? 'inline-flex' : 'none';
        removeAll.disabled = launcherState.accountActionBusy;
    }
}

function renderAccountsList() {
    const container = $('accounts-dropdown-container');
    if (!container) return;

    launcherState.cleanupAccountsDropdownListeners?.();
    launcherState.cleanupAccountsDropdownListeners = null;
    container.innerHTML = '';

    const selectedId = getSelectedIdentity();
    const selectedAccount = launcherState.accounts.find(
        (account) => account.accountId === selectedId
    );

    const dropdown = document.createElement('div');
    dropdown.className = 'accounts-dropdown';

    const toggleButton = document.createElement('button');
    toggleButton.type = 'button';
    toggleButton.className = 'accounts-dropdown-toggle';
    toggleButton.setAttribute('aria-haspopup', 'listbox');
    toggleButton.setAttribute('aria-expanded', 'false');

    const toggleText = document.createElement('span');
    toggleText.className = 'accounts-dropdown-text';
    const toggleMeta = document.createElement('span');
    toggleMeta.className = 'accounts-dropdown-meta';
    toggleMeta.textContent = selectedAccount
        ? 'Selected Jagex character'
        : 'Selected identity';
    const toggleLabel = document.createElement('span');
    toggleLabel.className = 'accounts-dropdown-label';
    toggleLabel.textContent = selectedAccount
        ? getAccountLabel(selectedAccount)
        : 'Normal account';
    toggleText.append(toggleMeta, toggleLabel);

    const count = document.createElement('span');
    count.className = 'accounts-dropdown-count';
    count.textContent = String(launcherState.accounts.length);
    count.title = `${launcherState.accounts.length} saved Jagex character${
        launcherState.accounts.length === 1 ? '' : 's'
    }`;

    const icon = document.createElement('span');
    icon.className = 'accounts-dropdown-icon';
    icon.textContent = '\u25be';
    icon.setAttribute('aria-hidden', 'true');
    toggleButton.append(toggleText, count, icon);

    const panel = document.createElement('div');
    panel.className = 'accounts-dropdown-panel';

    let searchInput = null;
    if (launcherState.accounts.length > 0) {
        const searchWrapper = document.createElement('div');
        searchWrapper.className = 'accounts-search-wrapper';
        searchInput = document.createElement('input');
        searchInput.className = 'accounts-search-input';
        searchInput.type = 'search';
        searchInput.placeholder = 'Search saved characters';
        searchInput.setAttribute('aria-label', 'Search saved Jagex characters');
        searchWrapper.appendChild(searchInput);
        panel.appendChild(searchWrapper);
    }

    const optionsList = document.createElement('div');
    optionsList.className = 'accounts-options';
    optionsList.setAttribute('role', 'listbox');
    optionsList.setAttribute('aria-label', 'Launch identities');
    panel.appendChild(optionsList);

    const closeDropdown = ({ restoreFocus = false } = {}) => {
        dropdown.classList.remove('open');
        toggleButton.setAttribute('aria-expanded', 'false');
        if (restoreFocus) {
            toggleButton.focus();
        }
    };

    const focusOption = (direction) => {
        const options = Array.from(
            optionsList.querySelectorAll('.account-option-select')
        );
        if (options.length === 0) return;
        const currentIndex = options.indexOf(document.activeElement);
        let nextIndex;
        if (direction === 'first') nextIndex = 0;
        else if (direction === 'last') nextIndex = options.length - 1;
        else if (direction === 'next') nextIndex = Math.min(options.length - 1, currentIndex + 1);
        else nextIndex = Math.max(0, currentIndex - 1);
        options[nextIndex].focus();
    };

    const chooseIdentity = async (identityId) => {
        closeDropdown();
        await selectIdentity(identityId, { persist: true });
    };

    const createIdentityOption = (identity) => {
        const isNormal = identity.id === NORMAL_IDENTITY;
        const isSelected = identity.id === selectedId;
        const row = document.createElement('div');
        row.className = `account-option${isSelected ? ' selected' : ''}`;

        const selectButton = document.createElement('button');
        selectButton.type = 'button';
        selectButton.className = 'account-option-select';
        selectButton.setAttribute('role', 'option');
        selectButton.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        selectButton.tabIndex = -1;

        const check = document.createElement('span');
        check.className = 'account-option-check';
        check.textContent = isSelected ? '\u2713' : '';
        check.setAttribute('aria-hidden', 'true');

        const content = document.createElement('span');
        content.className = 'account-option-content';
        const name = document.createElement('span');
        name.className = 'account-option-name';
        name.textContent = identity.label;
        const meta = document.createElement('span');
        meta.className = 'account-option-meta';
        meta.textContent = isNormal
            ? 'Launch without Jagex credentials'
            : 'Saved Jagex character';
        content.append(name, meta);
        selectButton.append(check, content);
        selectButton.addEventListener('click', () => chooseIdentity(identity.id));
        row.appendChild(selectButton);

        if (!isNormal) {
            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.className = 'account-option-delete';
            deleteButton.setAttribute('aria-label', `Remove ${identity.label}`);
            deleteButton.title = `Remove ${identity.label}`;
            deleteButton.textContent = '\u00d7';
            deleteButton.addEventListener('click', (event) => {
                event.stopPropagation();
                handleAccountDelete(identity.id);
            });
            row.appendChild(deleteButton);
        }

        return row;
    };

    const renderOptions = (filterText = '') => {
        const normalizedFilter = filterText.trim().toLowerCase();
        const identities = [
            {
                id: NORMAL_IDENTITY,
                label: 'Normal account',
                search: 'normal account'
            },
            ...launcherState.accounts.map((account) => ({
                id: account.accountId,
                label: getAccountLabel(account),
                search: `${getAccountLabel(account)} ${account.accountId}`.toLowerCase()
            }))
        ].filter((identity) => !normalizedFilter || identity.search.includes(normalizedFilter));

        optionsList.innerHTML = '';
        if (identities.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'accounts-options-empty';
            empty.textContent = 'No saved characters match your search.';
            optionsList.appendChild(empty);
            return;
        }
        identities.forEach((identity) => {
            optionsList.appendChild(createIdentityOption(identity));
        });
    };

    const openDropdown = ({ focusFirst = false } = {}) => {
        dropdown.classList.add('open');
        toggleButton.setAttribute('aria-expanded', 'true');
        setTimeout(() => {
            if (focusFirst || !searchInput) {
                focusOption('first');
            } else {
                searchInput.focus();
            }
        }, 0);
    };

    toggleButton.addEventListener('click', () => {
        if (dropdown.classList.contains('open')) {
            closeDropdown();
        } else {
            openDropdown();
        }
    });
    toggleButton.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            openDropdown({ focusFirst: true });
        }
    });
    searchInput?.addEventListener('input', (event) => {
        renderOptions(event.target.value);
    });
    searchInput?.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            focusOption('first');
        }
    });
    optionsList.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            focusOption('next');
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            focusOption('previous');
        } else if (event.key === 'Home') {
            event.preventDefault();
            focusOption('first');
        } else if (event.key === 'End') {
            event.preventDefault();
            focusOption('last');
        }
    });

    const handleOutsideClick = (event) => {
        if (!dropdown.contains(event.target)) {
            closeDropdown();
        }
    };
    const handleEscape = (event) => {
        if (event.key === 'Escape' && dropdown.classList.contains('open')) {
            event.preventDefault();
            closeDropdown({ restoreFocus: true });
        }
    };
    document.addEventListener('click', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    launcherState.cleanupAccountsDropdownListeners = () => {
        document.removeEventListener('click', handleOutsideClick);
        document.removeEventListener('keydown', handleEscape);
    };

    renderOptions();
    dropdown.append(toggleButton, panel);
    container.appendChild(dropdown);
}

async function applyAccounts(accounts, preferredIdentity, { persist = true } = {}) {
    launcherState.accounts = sortAccounts(accounts);
    const resolved = window.CupidLauncherUI.resolveIdentity(
        launcherState.accounts,
        preferredIdentity
    );
    populateAccountSelector(resolved);
    await selectIdentity(resolved, { persist });
    syncAccountActions();
}

async function handleAddAccounts() {
    if (launcherState.accountActionBusy) return;
    const button = $('add-accounts');
    const previousIdentity = getSelectedIdentity();
    const previousIds = new Set(
        launcherState.accounts.map((account) => account.accountId)
    );

    launcherState.accountActionBusy = true;
    setButtonBusy(button, true);
    syncAccountActions();
    try {
        const result = await window.electron.startAuthFlow();
        if (result?.error) {
            throw new Error(result.error);
        }
        const updated = await safeReadAccounts();
        if (!updated) return;
        const newAccounts = updated.filter(
            (account) => !previousIds.has(account.accountId)
        );
        const nextIdentity = newAccounts[0]?.accountId || previousIdentity;
        await applyAccounts(updated, nextIdentity);
        showToast(
            newAccounts.length > 0
                ? `${getAccountLabel(newAccounts[0])} added and selected.`
                : 'Jagex accounts are already up to date.',
            'success'
        );
    } catch (error) {
        const message = asErrorMessage(error, 'Unable to add a Jagex account.');
        logError(message);
        showToast(message, 'error');
    } finally {
        launcherState.accountActionBusy = false;
        setButtonBusy(button, false);
        syncAccountActions();
    }
}

async function handleRefreshAccounts() {
    if (launcherState.accountActionBusy || launcherState.accounts.length === 0) return;
    const button = $('refresh-accounts');
    const currentIdentity = getSelectedIdentity();

    launcherState.accountActionBusy = true;
    setButtonBusy(button, true);
    syncAccountActions();
    try {
        const result = await window.electron.refreshAccounts();
        if (result?.error) {
            throw new Error(result.error);
        }
        const updated = Array.isArray(result?.accounts)
            ? sortAccounts(result.accounts)
            : await safeReadAccounts();
        if (!updated) return;
        await applyAccounts(updated, currentIdentity);
        showToast('Saved Jagex characters refreshed.', 'success');
    } catch (error) {
        const message = asErrorMessage(error, 'Unable to refresh accounts.');
        logError(message);
        showToast(message, 'error');
    } finally {
        launcherState.accountActionBusy = false;
        setButtonBusy(button, false);
        syncAccountActions();
    }
}

async function handleAccountDelete(accountId) {
    const account = launcherState.accounts.find(
        (item) => item.accountId === accountId
    );
    if (!account) {
        showToast('That Jagex character is no longer available.', 'error');
        return;
    }

    const confirmed = await window.electron.showConfirmationDialog(
        `Remove ${getAccountLabel(account)}?`,
        'This removes the saved character from CupidBot Launcher. You can connect it again later.',
        'Remove Jagex character',
        'Cancel',
        'Remove',
        { defaultId: 0, cancelId: 0, confirmIndex: 1 }
    );
    if (confirmed?.error) {
        await showBlockingError(confirmed.error, 'Unable to confirm account removal.');
        return;
    }
    if (!confirmed) return;

    try {
        const result = await window.electron.deleteAccount(accountId);
        if (result?.error) {
            throw new Error(result.error);
        }
        const updated = (await safeReadAccounts()) || [];
        const preferred = getSelectedIdentity() === accountId
            ? NORMAL_IDENTITY
            : getSelectedIdentity();
        await applyAccounts(updated, preferred);
        showToast(`${getAccountLabel(account)} removed.`, 'success');
    } catch (error) {
        const message = asErrorMessage(error, 'Unable to remove this character.');
        logError(message);
        showToast(message, 'error');
    }
}

async function handleRemoveAllAccounts() {
    if (launcherState.accounts.length === 0) return;
    const confirmed = await window.electron.showConfirmationDialog(
        'Remove all saved Jagex accounts?',
        'Normal account launching remains available. You can reconnect Jagex characters later.',
        'Remove all accounts',
        'Cancel',
        'Remove all',
        { defaultId: 0, cancelId: 0, confirmIndex: 1 }
    );
    if (confirmed?.error) {
        await showBlockingError(confirmed.error, 'Unable to confirm account removal.');
        return;
    }
    if (!confirmed) return;

    launcherState.accountActionBusy = true;
    syncAccountActions();
    try {
        const result = await window.electron.removeAccounts();
        if (result?.error) {
            throw new Error(result.error);
        }
        await applyAccounts([], NORMAL_IDENTITY);
        showToast('All saved Jagex accounts were removed.', 'success');
    } catch (error) {
        const message = asErrorMessage(error, 'Unable to remove accounts.');
        logError(message);
        showToast(message, 'error');
    } finally {
        launcherState.accountActionBusy = false;
        syncAccountActions();
    }
}

function startAccountsPoll() {
    if (launcherState.accountsPollHandle) return;
    launcherState.accountsPollHandle = setInterval(async () => {
        if (launcherState.accountsPollBusy || launcherState.accountActionBusy) return;
        launcherState.accountsPollBusy = true;
        try {
            const changed = await window.electron.checkFileChange();
            if (changed?.error) {
                logError(changed.error);
                return;
            }
            if (!changed) return;
            const currentIdentity = getSelectedIdentity();
            const updated = await safeReadAccounts({ quiet: true });
            if (updated) {
                await applyAccounts(updated, currentIdentity);
            }
        } catch (error) {
            logError(error);
        } finally {
            launcherState.accountsPollBusy = false;
        }
    }, ACCOUNT_POLL_INTERVAL_MS);
}

function extractVersion(versionString) {
    return String(versionString ?? '')
        .replace(/^cupidbot-/, '')
        .replace(/\.jar$/, '');
}

function compareVersionFiles(a, b) {
    const partsA = extractVersion(a).split('.').map(Number);
    const partsB = extractVersion(b).split('.').map(Number);
    const length = Math.max(partsA.length, partsB.length);
    for (let index = 0; index < length; index += 1) {
        const valueA = Number.isFinite(partsA[index]) ? partsA[index] : 0;
        const valueB = Number.isFinite(partsB[index]) ? partsB[index] : 0;
        if (valueA !== valueB) {
            return valueB - valueA;
        }
    }
    return 0;
}

async function readClientJars() {
    try {
        const result = await window.electron.listJars();
        if (!Array.isArray(result)) {
            throw new Error(result?.error || 'Client list is unavailable.');
        }
        return [...result].sort(compareVersionFiles);
    } catch (error) {
        logError(error);
        return [];
    }
}

function populateClientSelector(jars, preferredVersion = '') {
    const select = $('client');
    if (!select) return;
    const currentVersion = preferredVersion || extractVersion(select.value);
    select.innerHTML = '';

    if (!Array.isArray(jars) || jars.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No local client found';
        select.appendChild(option);
        select.disabled = true;
        return;
    }

    jars.forEach((jar) => {
        const option = document.createElement('option');
        option.value = jar;
        option.textContent = `CupidBot ${extractVersion(jar)}`;
        select.appendChild(option);
    });
    select.disabled = false;
    const preferredFile = jars.find(
        (jar) => extractVersion(jar) === extractVersion(currentVersion)
    );
    select.value = preferredFile || jars[0];
}

async function refreshClientInventory(preferredVersion = '') {
    launcherState.jars = await readClientJars();
    populateClientSelector(launcherState.jars, preferredVersion);
    try {
        const latest = await window.electron.fetchClientVersion();
        launcherState.clientVersion =
            typeof latest === 'string' ? latest : '0.0.0';
    } catch (error) {
        launcherState.clientVersion = '0.0.0';
        logError(error);
    }
    if (
        launcherState.jars.length > 0 &&
        $('launch-status')?.textContent === 'No local CupidBot client found.'
    ) {
        setLaunchMessage('');
    }
    syncReadiness();
    syncLaunchState();
}

async function persistVersionPreference(version, { markCurrent = false } = {}) {
    if (!version) return;
    try {
        const properties = (await window.electron.readProperties()) || {};
        properties.version_pref = extractVersion(version);
        if (markCurrent) {
            properties.client = extractVersion(version);
        }
        await window.electron.writeProperties(properties);
    } catch (error) {
        logError(error);
    }
}

async function selectClientVersion(version, { persist = true } = {}) {
    const select = $('client');
    if (!select) return false;
    const target = extractVersion(version);
    const match = launcherState.jars.find(
        (jar) => extractVersion(jar) === target
    );
    if (!match) return false;
    select.value = match;
    if (persist) {
        await persistVersionPreference(target);
    }
    syncLaunchState();
    return true;
}

function populateProfileSelector(profiles, selectedProfile = 'default') {
    const select = $('profile');
    if (!select) return;
    select.innerHTML = '';

    const defaultOption = document.createElement('option');
    defaultOption.value = 'default';
    defaultOption.textContent = 'Default';
    select.appendChild(defaultOption);

    if (Array.isArray(profiles)) {
        profiles
            .filter((profile) => typeof profile === 'string' && profile && profile !== 'default')
            .forEach((profile) => {
                const option = document.createElement('option');
                option.value = profile;
                option.textContent = profile;
                select.appendChild(option);
            });
    }
    ensureProfileOption(selectedProfile);
    select.value = selectedProfile || 'default';
}

async function handleProfileChange(event) {
    const profile = event.target.value || 'default';
    const identityId = getSelectedIdentity();
    try {
        let result;
        if (identityId === NORMAL_IDENTITY) {
            result = await window.electron.setProfileNoJagexAccount(profile);
        } else {
            result = await window.electron.setProfileJagexAccount(
                identityId,
                profile
            );
            const account = getSelectedAccount();
            if (account) {
                account.profile = profile;
            }
        }
        if (result?.error) {
            throw new Error(result.error);
        }
        setLaunchMessage('');
        syncLaunchState();
    } catch (error) {
        const message = asErrorMessage(error, 'Unable to save profile preference.');
        logError(message);
        showToast(message, 'error');
    }
}

function sanitizeRamPreference(value) {
    if (!value || typeof value !== 'string') {
        return DEFAULT_CLIENT_RAM;
    }
    const normalized = value.trim().toLowerCase();
    return /^\d+(?:\.\d+)?[mg]$/.test(normalized)
        ? normalized
        : DEFAULT_CLIENT_RAM;
}

function formatRamLabel(value) {
    const match = String(value || '').match(/^(\d+(?:\.\d+)?)([mg])$/i);
    if (!match) return value || '';
    return `${match[1]} ${match[2].toLowerCase() === 'g' ? 'GB' : 'MB'}`;
}

function ensureRamOption(select, value) {
    if (!select) return;
    const exists = Array.from(select.options).some(
        (option) => option.value === value
    );
    if (!exists) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = formatRamLabel(value);
        select.appendChild(option);
    }
    select.value = value;
}

function getClientRamPreference() {
    return sanitizeRamPreference($('client-ram')?.value || DEFAULT_CLIENT_RAM);
}

function getProxyValues() {
    return { proxyIp: $('proxy-ip')?.value || '' };
}

async function writeProperty(key, value) {
    try {
        const properties = (await window.electron.readProperties()) || {};
        if (properties[key] !== value) {
            properties[key] = value;
            await window.electron.writeProperties(properties);
        }
    } catch (error) {
        logError(error);
    }
}

async function setupAdvancedInputs(properties) {
    const ramSelect = $('client-ram');
    const proxyInput = $('proxy-ip');
    const savedRam = sanitizeRamPreference(properties?.client_ram);
    ensureRamOption(ramSelect, savedRam);
    if (proxyInput) {
        proxyInput.value = properties?.proxyip || '';
    }
    syncAdvancedSettingsSummary();
    syncLaunchSummary();

    ramSelect?.addEventListener('change', async (event) => {
        const value = sanitizeRamPreference(event.target.value);
        ensureRamOption(ramSelect, value);
        syncAdvancedSettingsSummary();
        syncLaunchSummary();
        await writeProperty('client_ram', value);
    });

    let proxyWriteTimer = null;
    const persistProxy = async () => {
        if (proxyWriteTimer) {
            clearTimeout(proxyWriteTimer);
            proxyWriteTimer = null;
        }
        await writeProperty('proxyip', proxyInput?.value || '');
    };
    proxyInput?.addEventListener('input', () => {
        syncAdvancedSettingsSummary();
        clearTimeout(proxyWriteTimer);
        proxyWriteTimer = setTimeout(persistProxy, 300);
    });
    proxyInput?.addEventListener('blur', persistProxy);
}

async function downloadClientIfNotExist(version) {
    const normalized = extractVersion(version);
    if (!normalized) {
        throw new Error('Select a valid local client version.');
    }

    const exists = await window.electron.clientExists(normalized);
    if (exists?.error) {
        throw new Error(exists.error);
    }
    if (exists === true) {
        return true;
    }

    showProgress(`Looking for CupidBot ${normalized} in the local store…`);
    try {
        const result = await window.electron.downloadClient(normalized);
        if (result?.error) {
            throw new Error(result.error);
        }
        await refreshClientInventory(normalized);
        return true;
    } finally {
        hideProgress();
    }
}

async function checkForOutdatedLaunch() {
    const selectedVersion = getSelectedClientVersion();
    const latestVersion = extractVersion(launcherState.clientVersion);
    if (
        !selectedVersion ||
        !latestVersion ||
        latestVersion === '0.0.0' ||
        selectedVersion === latestVersion ||
        sessionStorage.getItem('skippedVersion') === latestVersion
    ) {
        return true;
    }

    const useSelected = await window.electron.showConfirmationDialog(
        `Launch CupidBot ${selectedVersion}?`,
        `CupidBot ${latestVersion} is the newest local version. You can continue with ${selectedVersion} or switch before launching.`,
        'Older client selected',
        `Use ${selectedVersion}`,
        `Use ${latestVersion}`,
        { defaultId: 1, cancelId: 1, confirmIndex: 0 }
    );
    if (useSelected?.error) {
        throw new Error(useSelected.error);
    }
    if (useSelected) {
        sessionStorage.setItem('skippedVersion', latestVersion);
        return true;
    }

    const selected = await selectClientVersion(latestVersion);
    if (!selected) {
        throw new Error(`Local CupidBot ${latestVersion} is not available.`);
    }
    return true;
}

async function launchNormalAccount(version) {
    const profile = $('profile')?.value || 'default';
    const profileResult = await window.electron.setProfileNoJagexAccount(profile);
    if (profileResult?.error) {
        throw new Error(profileResult.error);
    }
    const ttlResult = await window.electron.updateClientJarTTL(version);
    if (ttlResult?.error) {
        logError(ttlResult.error);
    }
    const result = await window.electron.playNoJagexAccount(
        version,
        getProxyValues(),
        getClientRamPreference()
    );
    if (result?.error) {
        throw new Error(result.error);
    }
}

async function launchJagexAccount(version, account) {
    if (!account) {
        throw new Error('Select a valid Jagex character.');
    }
    const profile = $('profile')?.value || 'default';
    account.profile = profile;
    const profileResult = await window.electron.setProfileJagexAccount(
        account.accountId,
        profile
    );
    if (profileResult?.error) {
        throw new Error(profileResult.error);
    }
    const ttlResult = await window.electron.updateClientJarTTL(version);
    if (ttlResult?.error) {
        logError(ttlResult.error);
    }
    const credentialResult = await window.electron.overwriteCredentialProperties(account);
    if (credentialResult?.error) {
        throw new Error(credentialResult.error);
    }
    const result = await window.electron.openClient(
        version,
        getProxyValues(),
        account,
        getClientRamPreference()
    );
    if (result?.error) {
        throw new Error(result.error);
    }
}

async function handleLaunchSubmit(event) {
    event.preventDefault();
    if (launcherState.launchBusy) return;

    const view = window.CupidLauncherUI.deriveLaunchState({
        accounts: launcherState.accounts,
        identityId: getSelectedIdentity(),
        jars: launcherState.jars,
        busy: false
    });
    if (!view.enabled) {
        setLaunchMessage(view.reason, 'error');
        return;
    }

    launcherState.launchBusy = true;
    setLaunchMessage('Preparing CupidBot…');
    syncLaunchState();
    try {
        await checkForOutdatedLaunch();
        const version = getSelectedClientVersion();
        await downloadClientIfNotExist(version);

        setLaunchMessage('Starting CupidBot…');
        syncLaunchState();

        if (view.mode === 'normal') {
            await launchNormalAccount(version);
        } else {
            await launchJagexAccount(version, getSelectedAccount());
        }
        setLaunchMessage('CupidBot launched successfully.', 'success');
        showToast(`CupidBot launched for ${getIdentityLabel()}.`, 'success');
    } catch (error) {
        await showBlockingError(error, 'Unable to launch CupidBot.');
    } finally {
        launcherState.launchBusy = false;
        syncLaunchState();
    }
}

function hideUpdateNotice() {
    $('update-available')?.classList.add('is-hidden');
}

function showUpdateNotice(version) {
    setTextContent(
        'update-description',
        `CupidBot ${version} is already in your local store and ready to use.`
    );
    $('update-available')?.classList.remove('is-hidden');
}

async function checkForClientUpdate() {
    const selectedBeforeRefresh = getSelectedClientVersion();
    await refreshClientInventory(selectedBeforeRefresh);
    const latestVersion = extractVersion(launcherState.clientVersion);
    const selectedVersion = getSelectedClientVersion();

    if (!latestVersion || latestVersion === '0.0.0') {
        hideUpdateNotice();
        return;
    }

    const dismissedVersion = sessionStorage.getItem('dismissedClientUpdate');
    if (
        selectedVersion &&
        selectedVersion !== latestVersion &&
        dismissedVersion !== latestVersion
    ) {
        showUpdateNotice(latestVersion);
    } else {
        hideUpdateNotice();
    }

    try {
        const properties = (await window.electron.readProperties()) || {};
        if (properties.client !== latestVersion) {
            properties.client = latestVersion;
            await window.electron.writeProperties(properties);
        }
    } catch (error) {
        logError(error);
    }
}

async function handleUseLatestVersion() {
    const button = $('update-now-btn');
    setButtonBusy(button, true);
    try {
        const latestVersion = extractVersion(launcherState.clientVersion);
        await downloadClientIfNotExist(latestVersion);
        const selected = await selectClientVersion(latestVersion);
        if (!selected) {
            throw new Error(`Local CupidBot ${latestVersion} is not available.`);
        }
        await persistVersionPreference(latestVersion, { markCurrent: true });
        sessionStorage.removeItem('dismissedClientUpdate');
        hideUpdateNotice();
        showToast(`CupidBot ${latestVersion} selected.`, 'success');
    } catch (error) {
        await showBlockingError(error, 'Unable to use the latest local version.');
    } finally {
        setButtonBusy(button, false);
        syncLaunchState();
    }
}

function handleDismissUpdate() {
    const latestVersion = extractVersion(launcherState.clientVersion);
    if (latestVersion) {
        sessionStorage.setItem('dismissedClientUpdate', latestVersion);
    }
    hideUpdateNotice();
}

function startUpdatePoll() {
    if (launcherState.updatePollHandle) return;
    launcherState.updatePollHandle = setInterval(
        checkForClientUpdate,
        UPDATE_POLL_INTERVAL_MS
    );
}

async function openLocation(locationKey) {
    try {
        const result = await window.electron.openLocation(locationKey);
        if (result?.error) {
            throw new Error(result.error);
        }
    } catch (error) {
        const message = asErrorMessage(error, 'Unable to open this folder.');
        logError(message);
        showToast(message, 'error');
    }
}

function setupAppMenu() {
    const menuButton = $('menu-btn');
    const menu = $('app-menu');
    if (!menuButton || !menu) return;

    const hideMenu = ({ restoreFocus = false } = {}) => {
        menu.classList.add('hidden');
        menu.setAttribute('aria-hidden', 'true');
        menuButton.setAttribute('aria-expanded', 'false');
        if (restoreFocus) {
            menuButton.focus();
        }
    };

    const showMenu = () => {
        menu.classList.remove('hidden');
        menu.setAttribute('aria-hidden', 'false');
        menuButton.setAttribute('aria-expanded', 'true');
        const rect = menuButton.getBoundingClientRect();
        const menuWidth = menu.offsetWidth || 280;
        const left = Math.max(8, Math.min(window.innerWidth - menuWidth - 8, rect.right - menuWidth));
        const top = Math.min(window.innerHeight - menu.offsetHeight - 8, rect.bottom + 7);
        menu.style.left = `${left}px`;
        menu.style.top = `${Math.max(8, top)}px`;
        setTimeout(() => menu.querySelector('.menu-action')?.focus(), 0);
    };

    menuButton.addEventListener('click', (event) => {
        event.stopPropagation();
        if (menu.classList.contains('hidden')) {
            showMenu();
        } else {
            hideMenu();
        }
    });
    document.addEventListener('click', (event) => {
        if (!menu.contains(event.target) && event.target !== menuButton) {
            hideMenu();
        }
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !menu.classList.contains('hidden')) {
            hideMenu({ restoreFocus: true });
        }
    });
    menu.addEventListener('keydown', (event) => {
        const items = Array.from(menu.querySelectorAll('.menu-action'));
        const currentIndex = items.indexOf(document.activeElement);
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            items[(currentIndex + 1 + items.length) % items.length]?.focus();
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            items[(currentIndex - 1 + items.length) % items.length]?.focus();
        }
    });
    menu.querySelectorAll('.menu-action').forEach((item) => {
        item.addEventListener('click', async () => {
            hideMenu();
            await openLocation(item.dataset.location);
        });
    });
}

function setupStaticListeners() {
    $('launch-form')?.addEventListener('submit', handleLaunchSubmit);
    $('add-accounts')?.addEventListener('click', handleAddAccounts);
    $('refresh-accounts')?.addEventListener('click', handleRefreshAccounts);
    $('logout')?.addEventListener('click', handleRemoveAllAccounts);
    $('open-client-folder')?.addEventListener('click', () =>
        openLocation('cupidbot-folder')
    );
    $('update-now-btn')?.addEventListener('click', handleUseLatestVersion);
    $('remind-me-later-btn')?.addEventListener('click', handleDismissUpdate);
    $('profile')?.addEventListener('change', handleProfileChange);
    $('client')?.addEventListener('change', async (event) => {
        await persistVersionPreference(event.target.value);
        sessionStorage.removeItem('skippedVersion');
        setLaunchMessage('');
        syncLaunchState();
        await checkForClientUpdate();
    });
    $('character')?.addEventListener('change', async (event) => {
        await selectIdentity(event.target.value, { persist: true });
    });
    setupAppMenu();
}

async function initializeLauncher() {
    await loadRecentUpdates();
    const propertiesResult = await window.electron.readProperties();
    const properties = propertiesResult?.error ? {} : propertiesResult || {};

    try {
        launcherState.launcherVersion = await window.electron.launcherVersion();
    } catch (error) {
        launcherState.launcherVersion = '';
        logError(error);
    }
    document.title = launcherState.launcherVersion
        ? `CupidBot Launcher - ${launcherState.launcherVersion}`
        : 'CupidBot Launcher';

    setupStaticListeners();
    await setupAdvancedInputs(properties);

    let profiles = [];
    try {
        const result = await window.electron.listProfiles();
        profiles = Array.isArray(result) ? result : [];
        if (result?.error) {
            logError(result.error);
        }
    } catch (error) {
        logError(error);
    }
    launcherState.profiles = profiles;
    populateProfileSelector(profiles);

    const accounts = (await safeReadAccounts()) || [];
    launcherState.accounts = accounts;
    const savedIdentity = window.CupidLauncherUI.resolveIdentity(
        accounts,
        properties.selected_account
    );
    populateAccountSelector(savedIdentity);

    await refreshClientInventory(properties.version_pref);
    await selectIdentity(savedIdentity, { persist: true });

    if (launcherState.clientVersion !== '0.0.0') {
        try {
            const cleanupResult = await window.electron.cleanUnusedClients(
                launcherState.clientVersion
            );
            if (cleanupResult?.error) {
                logError(cleanupResult.error);
            }
            await refreshClientInventory(getSelectedClientVersion());
        } catch (error) {
            logError(error);
        }
    }

    syncAccountActions();
    syncAdvancedSettingsSummary();
    syncLaunchState();
    await checkForClientUpdate();
    startAccountsPoll();
    startUpdatePoll();
}

async function ensureLauncherInitialized() {
    if (launcherState.launcherInitialized) return;
    launcherState.launcherInitialized = true;
    try {
        await initializeLauncher();
    } catch (error) {
        launcherState.launcherInitialized = false;
        await showBlockingError(error, 'CupidBot Launcher could not initialize.');
    }
}

window.addEventListener('error', (event) => {
    const message = asErrorMessage(event.error || event.message, 'Unexpected launcher error.');
    logError(message);
    showToast(message, 'error');
});

window.addEventListener('unhandledrejection', (event) => {
    event.preventDefault();
    const message = asErrorMessage(event.reason, 'Unexpected launcher error.');
    logError(message);
    showToast(message, 'error');
});

window.addEventListener('load', async () => {
    setupAuthUI();
    await refreshAuthStatus();
});

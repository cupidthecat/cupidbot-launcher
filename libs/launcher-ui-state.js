(function (root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        root.CupidLauncherUI = api;
    }
})(typeof window !== 'undefined' ? window : null, function () {
    const NORMAL_IDENTITY = 'none';
    const NO_CLIENT_REASON = 'No local CupidBot client found.';
    const INVALID_ACCOUNT_REASON = 'Select a valid Jagex character.';

    function findAccount(accounts, identityId) {
        if (!Array.isArray(accounts)) {
            return null;
        }

        return (
            accounts.find(
                (account) =>
                    account && account.accountId === identityId
            ) || null
        );
    }

    function resolveIdentity(accounts, savedId) {
        if (savedId === NORMAL_IDENTITY) {
            return NORMAL_IDENTITY;
        }

        return findAccount(accounts, savedId)
            ? savedId
            : NORMAL_IDENTITY;
    }

    function getLaunchMode(identityId) {
        return identityId === NORMAL_IDENTITY ? 'normal' : 'jagex';
    }

    function getAccountLabel(account) {
        if (
            typeof account.displayName === 'string' &&
            account.displayName.trim()
        ) {
            return account.displayName.trim();
        }

        return String(account.accountId);
    }

    function deriveLaunchState({
        accounts = [],
        identityId = NORMAL_IDENTITY,
        jars = [],
        busy = false
    } = {}) {
        const normalizedIdentityId = identityId || NORMAL_IDENTITY;
        const mode = getLaunchMode(normalizedIdentityId);
        const account =
            mode === 'jagex'
                ? findAccount(accounts, normalizedIdentityId)
                : null;

        let label;
        if (busy) {
            label = 'Launching\u2026';
        } else if (mode === 'normal') {
            label = 'Launch normal account';
        } else if (account) {
            label = `Launch ${getAccountLabel(account)}`;
        } else {
            label = 'Launch Jagex character';
        }

        let reason = '';
        if (!busy && (!Array.isArray(jars) || jars.length === 0)) {
            reason = NO_CLIENT_REASON;
        } else if (!busy && mode === 'jagex' && !account) {
            reason = INVALID_ACCOUNT_REASON;
        }

        return {
            identityId: normalizedIdentityId,
            mode,
            enabled: !busy && reason === '',
            label,
            reason
        };
    }

    return {
        resolveIdentity,
        getLaunchMode,
        deriveLaunchState
    };
});

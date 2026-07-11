const fs = require('fs');
const path = require('path');
const vm = require('vm');

const {
    resolveIdentity,
    getLaunchMode,
    deriveLaunchState
} = require('../libs/launcher-ui-state');

const accounts = [
    { accountId: 'account-1', displayName: 'Artemis' },
    { accountId: 'account-2', displayName: '' }
];
const jars = ['cupidbot-3.2.8.jar'];

describe('resolveIdentity', () => {
    test('keeps the explicit Normal account identity', () => {
        expect(resolveIdentity(accounts, 'none')).toBe('none');
    });

    test('restores a saved account that still exists', () => {
        expect(resolveIdentity(accounts, 'account-1')).toBe('account-1');
    });

    test.each([
        ['a deleted account', 'deleted-account'],
        ['a missing saved value', undefined],
        ['an empty saved value', '']
    ])('falls back to Normal for %s', (_description, savedId) => {
        expect(resolveIdentity(accounts, savedId)).toBe('none');
    });

    test('falls back to Normal when accounts are unavailable or malformed', () => {
        expect(resolveIdentity(undefined, 'account-1')).toBe('none');
        expect(resolveIdentity({}, 'account-1')).toBe('none');
        expect(resolveIdentity([null, {}], 'account-1')).toBe('none');
    });
});

describe('getLaunchMode', () => {
    test('maps the explicit Normal identity to normal mode', () => {
        expect(getLaunchMode('none')).toBe('normal');
    });

    test('maps account identities to Jagex mode', () => {
        expect(getLaunchMode('account-1')).toBe('jagex');
    });
});

describe('deriveLaunchState', () => {
    test('enables a Normal launch when a local client exists', () => {
        expect(
            deriveLaunchState({ accounts, identityId: 'none', jars })
        ).toEqual({
            identityId: 'none',
            mode: 'normal',
            enabled: true,
            label: 'Launch normal account',
            reason: ''
        });
    });

    test('enables a valid Jagex launch and uses its display name', () => {
        expect(
            deriveLaunchState({ accounts, identityId: 'account-1', jars })
        ).toEqual({
            identityId: 'account-1',
            mode: 'jagex',
            enabled: true,
            label: 'Launch Artemis',
            reason: ''
        });
    });

    test('falls back to the account ID when no display name is available', () => {
        expect(
            deriveLaunchState({ accounts, identityId: 'account-2', jars })
        ).toEqual({
            identityId: 'account-2',
            mode: 'jagex',
            enabled: true,
            label: 'Launch account-2',
            reason: ''
        });
    });

    test.each([
        ['Normal', 'none'],
        ['Jagex', 'account-1']
    ])('disables a %s launch when no local client exists', (_type, identityId) => {
        expect(
            deriveLaunchState({ accounts, identityId, jars: [] })
        ).toMatchObject({
            identityId,
            enabled: false,
            reason: 'No local CupidBot client found.'
        });
    });

    test('disables a missing Jagex character without silently changing identity', () => {
        expect(
            deriveLaunchState({
                accounts,
                identityId: 'deleted-account',
                jars
            })
        ).toEqual({
            identityId: 'deleted-account',
            mode: 'jagex',
            enabled: false,
            label: 'Launch Jagex character',
            reason: 'Select a valid Jagex character.'
        });
    });

    test('reports the missing client before an invalid Jagex selection', () => {
        expect(
            deriveLaunchState({
                accounts,
                identityId: 'deleted-account',
                jars: []
            }).reason
        ).toBe('No local CupidBot client found.');
    });

    test.each(['none', 'account-1'])('disables %s while a launch is busy', (identityId) => {
        expect(
            deriveLaunchState({ accounts, identityId, jars, busy: true })
        ).toMatchObject({
            identityId,
            enabled: false,
            label: 'Launching\u2026',
            reason: ''
        });
    });

    test('uses safe defaults when called without state', () => {
        expect(deriveLaunchState()).toEqual({
            identityId: 'none',
            mode: 'normal',
            enabled: false,
            label: 'Launch normal account',
            reason: 'No local CupidBot client found.'
        });
    });
});

describe('browser bundle', () => {
    test('exposes the API on window without requiring CommonJS globals', () => {
        const source = fs.readFileSync(
            path.join(__dirname, '..', 'libs', 'launcher-ui-state.js'),
            'utf8'
        );
        const context = { window: {} };

        vm.runInNewContext(source, context);

        expect(Object.keys(context.window.CupidLauncherUI).sort()).toEqual([
            'deriveLaunchState',
            'getLaunchMode',
            'resolveIdentity'
        ]);
        expect(
            context.window.CupidLauncherUI.getLaunchMode('none')
        ).toBe('normal');
    });
});

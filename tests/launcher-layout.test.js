const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const root = path.join(__dirname, '..');

describe('launcher home layout', () => {
    let html;
    let css;
    let renderer;
    let $;

    beforeAll(() => {
        html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
        css = fs.readFileSync(path.join(root, 'css', 'styles.css'), 'utf8');
        renderer = fs.readFileSync(path.join(root, 'renderer.js'), 'utf8');
        $ = cheerio.load(html);
    });

    test('renders the modern launcher shell and a single contextual launch action', () => {
        expect($('.app-shell')).toHaveLength(1);
        expect($('.app-header')).toHaveLength(1);
        expect($('.workspace-grid')).toHaveLength(1);
        expect($('.launch-panel')).toHaveLength(1);
        expect($('.utility-rail')).toHaveLength(1);

        expect($('#launch-form #launch-client')).toHaveLength(1);
        expect($('#launch-client')).toHaveLength(1);
        expect($('#launch-client').attr('type')).toBe('submit');
        expect($('#play')).toHaveLength(0);
        expect($('#play-no-jagex-account')).toHaveLength(0);
    });

    test('keeps essential fields visible and advanced fields in one disclosure', () => {
        expect($('#client').closest('.settings-grid')).toHaveLength(1);
        expect($('#profile').closest('.settings-grid')).toHaveLength(1);
        expect($('#advanced-settings')).toHaveLength(1);
        expect($('#advanced-settings').attr('open')).toBeUndefined();
        expect($('#client-ram').closest('#advanced-settings')).toHaveLength(1);
        expect($('#proxy-ip').closest('#advanced-settings')).toHaveLength(1);
        expect($('#advanced-settings-summary')).toHaveLength(1);
    });

    test('provides Normal account as the safe hidden-selector option', () => {
        const identitySelect = $('#character');
        const normalOption = identitySelect.find('option[value="none"]');

        expect(identitySelect).toHaveLength(1);
        expect(identitySelect.hasClass('account-select-hidden')).toBe(true);
        expect(identitySelect.attr('aria-hidden')).toBe('true');
        expect(identitySelect.attr('tabindex')).toBe('-1');
        expect(normalOption).toHaveLength(1);
        expect(normalOption.text().trim()).toBe('Normal account');
    });

    test('places readiness, updates, and collapsed help in the utility rail', () => {
        const rail = $('.utility-rail');
        const updates = rail.find('.updates-disclosure');
        const help = rail.find('.help-disclosure');

        expect(rail.find('.readiness-card')).toHaveLength(1);
        expect(rail.find('#readiness-state')).toHaveLength(1);
        expect(rail.find('#open-client-folder')).toHaveLength(1);
        expect(rail.find('#update-available')).toHaveLength(1);
        expect(rail.find('#update-now-btn').text()).toContain('Use version');
        expect(rail.find('#remind-me-later-btn').text()).toContain('Dismiss');
        expect(updates).toHaveLength(1);
        expect(help).toHaveLength(1);
        expect(updates.attr('open')).toBeUndefined();
        expect(help.attr('open')).toBeUndefined();
        expect(help.text()).toContain('~/.cupidbot');
        expect(help.text()).toContain('~/.runelite/cupidbot-plugins');
    });

    test('uses one page-level scroller and bounds long account lists internally', () => {
        expect(css).toMatch(/body\s*\{[\s\S]*?overflow:\s*hidden/);
        expect(css).toMatch(
            /\.workspace-scroll\s*\{[\s\S]*?overflow-y:\s*auto/
        );
        expect(css).toMatch(/\.app-shell\s*\{[\s\S]*?height:\s*100vh/);
        expect(css).toMatch(
            /\.accounts-dropdown-panel\s*\{[\s\S]*?position:\s*absolute/
        );
        expect(css).toMatch(
            /\.accounts-options\s*\{[\s\S]*?max-height:\s*min\(250px,\s*36vh\)[\s\S]*?overflow-y:\s*auto/
        );
    });

    test('uses warm-gold tokens and responsive 980px and 700px layouts', () => {
        expect(css).toMatch(/--background:\s*#0d1014/);
        expect(css).toMatch(/--surface:\s*#15191f/);
        expect(css).toMatch(/--surface-raised:\s*#1b2028/);
        expect(css).toMatch(/--border:\s*#2b313a/);
        expect(css).toMatch(/--text-primary:\s*#f5f2ea/);
        expect(css).toMatch(/--text-muted:\s*#9aa3ae/);
        expect(css).toMatch(/--accent:\s*#d5a23f/);
        expect(css).toMatch(/--success:\s*#65ad84/);
        expect(css).toMatch(/--danger:\s*#c85a61/);
        expect(css).toMatch(
            /@media\s*\(max-width:\s*980px\)\s*\{[\s\S]*?\.workspace-grid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/
        );
        expect(css).toMatch(
            /@media\s*\(max-width:\s*700px\)\s*\{[\s\S]*?\.settings-grid,[\s\S]*?\.advanced-settings-content,[\s\S]*?\.utility-rail\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/
        );
        expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    });

    test('exposes direct, accessible local-folder menu actions', () => {
        const menuButton = $('#menu-btn');
        const menu = $('#app-menu');
        const actions = menu.children('.menu-action');

        expect(menuButton.attr('aria-haspopup')).toBe('menu');
        expect(menuButton.attr('aria-controls')).toBe('app-menu');
        expect(menuButton.attr('aria-expanded')).toBe('false');
        expect(menu.attr('role')).toBe('menu');
        expect(menu.attr('aria-hidden')).toBe('true');
        expect(actions).toHaveLength(4);
        expect(menu.find('.submenu')).toHaveLength(0);
        actions.each((_index, action) => {
            expect($(action).attr('role')).toBe('menuitem');
            expect($(action).attr('data-location')).toBeTruthy();
        });

        expect(renderer).toContain("menuButton.setAttribute('aria-expanded', 'true')");
        expect(renderer).toContain("menuButton.setAttribute('aria-expanded', 'false')");
        expect(renderer).toContain("event.key === 'Escape'");
        expect(renderer).toContain("event.key === 'ArrowDown'");
        expect(renderer).toContain("event.key === 'ArrowUp'");
    });

    test('derives launch state, persists every identity, and reflects actual loading', () => {
        expect(html.indexOf('libs/launcher-ui-state.js')).toBeLessThan(
            html.indexOf('renderer.js')
        );
        expect($('meta[http-equiv="Content-Security-Policy"]')).toHaveLength(1);
        expect(renderer).toContain('window.CupidLauncherUI.deriveLaunchState({');
        expect(renderer).toContain('window.CupidLauncherUI.resolveIdentity(');
        expect(renderer).toContain('properties.selected_account = identityId');
        expect(renderer).toContain("const NORMAL_IDENTITY = 'none'");
        expect(renderer).toContain(
            "button.classList.toggle('is-loading', launcherState.launchBusy)"
        );
        expect(renderer).toContain("button.classList.add('is-loading')");
        expect(renderer).toContain("button.classList.remove('is-loading')");
        expect(renderer).not.toMatch(/function\s+startLoading\s*\(/);
        expect(renderer).not.toMatch(/setTimeout\s*\(\s*startLoading/);
    });

    test('builds an ARIA listbox with keyboard and dismissal handling', () => {
        expect(renderer).toContain("toggleButton.setAttribute('aria-haspopup', 'listbox')");
        expect(renderer).toContain("optionsList.setAttribute('role', 'listbox')");
        expect(renderer).toContain("selectButton.setAttribute('role', 'option')");
        expect(renderer).toContain("toggleButton.addEventListener('keydown'");
        expect(renderer).toContain("searchInput?.addEventListener('keydown'");
        expect(renderer).toContain("optionsList.addEventListener('keydown'");
        expect(renderer).toContain("event.key === 'Home'");
        expect(renderer).toContain("event.key === 'End'");
        expect(renderer).toContain("document.addEventListener('click', handleOutsideClick)");
        expect(renderer).toContain("document.addEventListener('keydown', handleEscape)");
    });
});

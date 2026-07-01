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

    test('renders recent updates and how-to content in the left pane', () => {
        expect($('.launcher-home').closest('.content')).toHaveLength(1);
        expect($('.recent-updates-panel')).toHaveLength(1);
        expect($('.how-to-panel')).toHaveLength(1);
        expect($('.recent-updates-panel').text()).toContain('Recent Updates');
        expect($('.how-to-panel').text()).toContain('How To Use CupidBot');
        expect($('.how-to-panel').text()).toContain('Jagex Account');
        expect($('.how-to-panel').text()).toContain('SOCKS proxy');
    });

    test('left pane and right sidebar scroll independently when content overflows', () => {
        expect(css).toMatch(/\.main-content\s*\{[\s\S]*overflow:\s*hidden/);
        expect(css).toMatch(/\.content\s*\{[\s\S]*overflow-y:\s*auto/);
        expect(css).toMatch(/\.sidebar\s*\{[\s\S]*overflow-y:\s*auto/);
        expect(css).toMatch(/\.sidebar\s*\{[\s\S]*max-height:\s*100vh/);
    });

    test('jagex account dropdown scrolls inside the sidebar flow', () => {
        expect(css).toMatch(
            /\.accounts-dropdown-panel\s*\{[\s\S]*position:\s*static/
        );
        expect(css).toMatch(
            /\.accounts-options\s*\{[\s\S]*max-height:\s*min\(240px,\s*35vh\)/
        );
        expect(css).toMatch(/\.accounts-options\s*\{[\s\S]*overflow-y:\s*auto/);
        expect(css).toMatch(
            /\.accounts-dropdown-label\s*\{[\s\S]*text-overflow:\s*ellipsis/
        );
    });

    test('jagex account picker is styled as a grouped account card', () => {
        expect($('.jagex-account-picker')).toHaveLength(1);
        expect($('.jagex-account-picker .accounts-refresh-row')).toHaveLength(1);
        expect(html).toContain('&#10227;');
        expect(renderer).toContain("toggleIcon.textContent = '\\u25be'");
        expect(html).not.toContain('â');
        expect(renderer).not.toContain('â');
        expect(css).toMatch(/\.jagex-account-picker\s*\{[\s\S]*background:\s*linear-gradient/);
        expect(css).toMatch(/\.accounts-dropdown-toggle\s*\{[\s\S]*min-height:\s*64px/);
        expect(css).toMatch(/\.accounts-dropdown-meta\s*\{[\s\S]*text-transform:\s*uppercase/);
        expect(css).toMatch(/\.account-option-check\s*\{[\s\S]*border-radius:\s*999px/);
        expect(css).toMatch(/\.account-option-delete\s*\{[\s\S]*border-radius:\s*8px/);
    });

    test('renderer builds account rows with selected status and checkmark', () => {
        expect(renderer).toContain("toggleMeta.className = 'accounts-dropdown-meta'");
        expect(renderer).toContain("optionCheck.className = 'account-option-check'");
        expect(renderer).toContain("optionContent.className = 'account-option-content'");
        expect(renderer).toContain("optionMeta.className = 'account-option-meta'");
        expect(renderer).toContain("toggleMeta.textContent = 'Selected account'");
    });
});

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const root = path.join(__dirname, '..');

describe('native OS title bar', () => {
    test('launcher does not render an internal title bar', () => {
        const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
        const $ = cheerio.load(html);

        expect($('.titlebar')).toHaveLength(0);
        expect($('.titlebar-title')).toHaveLength(0);
        expect($('.titlebar-controls')).toHaveLength(0);
    });

    test('launcher keeps utility controls outside title bar chrome', () => {
        const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
        const $ = cheerio.load(html);

        expect($('#menu-btn').closest('.sidebar')).toHaveLength(1);
        expect($('#user-session').closest('.sidebar')).toHaveLength(1);
    });

    test('browser window uses the native frame in every mode', () => {
        const source = fs.readFileSync(path.join(root, 'main.js'), 'utf8');

        expect(source).toMatch(/frame:\s*true/);
        expect(source).not.toMatch(/frame:\s*process\.env\.DEBUG/);
        expect(source).not.toMatch(/titleBarStyle:\s*process\.env\.DEBUG/);
    });
});

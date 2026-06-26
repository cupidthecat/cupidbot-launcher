const fs = require('fs');
const path = require('path');

describe('CupidBot launcher network boundary', () => {
    test('workflows do not publish to Microbot cloud or project-owned upload hosts', () => {
        const root = path.join(__dirname, '..');
        const checkedFiles = [
            '.github/FUNDING.yml',
            '.github/workflows/ci.yml',
            '.github/workflows/create-release.yml',
            '.github/workflows/upload-hetzner.yml'
        ];
        const text = checkedFiles
            .map((file) => {
                const fullPath = path.join(root, file);
                return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : '';
            })
            .join('\n');

        expect(text).not.toMatch(/microbot\.cloud/i);
        expect(text).not.toMatch(/138\.201\.81\.246/);
        expect(text).not.toMatch(/paypal\.me\/MicrobotBE/i);
        expect(text).not.toMatch(/PROD_SSH_KEY/);
    });
});

const fs = require('fs');
const os = require('os');
const path = require('path');

describe('CupidBot local launcher state', () => {
    let tempHome;

    beforeEach(() => {
        tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'cupidbot-launcher-'));
        jest.resetModules();
        jest.doMock('os', () => ({
            homedir: () => tempHome
        }));
    });

    afterEach(() => {
        jest.dontMock('os');
        fs.rmSync(tempHome, { recursive: true, force: true });
    });

    test('uses an independent CupidBot state directory', () => {
        const { cupidbotDir } = require('../libs/dir-module');

        expect(cupidbotDir).toBe(path.join(tempHome, '.cupidbot'));
    });

    test('updates TTL for local cupidbot jars', async () => {
        const { cupidbotDir, updateClientJarTTL } = require('../libs/dir-module');
        fs.mkdirSync(cupidbotDir, { recursive: true });
        fs.writeFileSync(path.join(cupidbotDir, 'cupidbot-1.2.3.jar'), 'jar');

        const result = await updateClientJarTTL('1.2.3');

        expect(result).toEqual({ success: true });
        const ttl = JSON.parse(
            fs.readFileSync(path.join(cupidbotDir, 'clients_jar_ttl.json'), 'utf8')
        );
        expect(Object.keys(ttl)).toEqual(['1.2.3']);
    });

    test('does not manage non-CupidBot jars from CupidBot state', async () => {
        const { cupidbotDir, updateClientJarTTL } = require('../libs/dir-module');
        fs.mkdirSync(cupidbotDir, { recursive: true });
        fs.writeFileSync(path.join(cupidbotDir, 'legacy-client-1.2.3.jar'), 'jar');

        const result = await updateClientJarTTL('1.2.3');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Jar not found for version: 1.2.3');
    });
});

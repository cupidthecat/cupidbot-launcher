const fs = require('fs');
const os = require('os');
const path = require('path');

function createDeps(tempDir) {
    const handlers = {};
    return {
        handlers,
        deps: {
            fs,
            path,
            cupidbotDir: tempDir,
            ipcMain: {
                handle: jest.fn((name, handler) => {
                    handlers[name] = handler;
                })
            },
            log: {
                info: jest.fn(),
                error: jest.fn()
            }
        }
    };
}

describe('properties IPC', () => {
    let tempDir;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cupidbot-properties-'));
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('read-properties accepts UTF-8 BOM-prefixed JSON', async () => {
        fs.writeFileSync(
            path.join(tempDir, 'resource_versions.json'),
            '\uFEFF' + JSON.stringify({ client: '2.6.11', version_pref: '2.6.11' }),
            'utf8'
        );
        const { deps, handlers } = createDeps(tempDir);

        await require('../libs/properties')(deps);
        const result = await handlers['read-properties']();

        expect(result).toEqual({
            client: '2.6.11',
            version_pref: '2.6.11'
        });
    });
});

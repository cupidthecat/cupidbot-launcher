const fs = require('fs');
const os = require('os');
const path = require('path');
const EventEmitter = require('events');

function createDeps(tempDir) {
    const handlers = {};
    const ipcMain = {
        handle: jest.fn((name, handler) => {
            handlers[name] = handler;
        })
    };
    const sender = {
        send: jest.fn()
    };
    const log = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    };
    const axios = jest.fn();
    const spawn = jest.fn((command, args) => {
        const child = new EventEmitter();
        child.stdout = new EventEmitter();
        child.stderr = new EventEmitter();
        child.unref = jest.fn();
        if (Array.isArray(args) && args[0] === '-version') {
            process.nextTick(() => child.emit('close', 0));
        }
        return child;
    });

    return {
        deps: {
            ipcMain,
            axios,
            cupidbotDir: tempDir,
            packageJson: { version: '9.9.9' },
            path,
            log,
            dialog: {
                showMessageBox: jest.fn().mockResolvedValue({ response: 1 }),
                showErrorBox: jest.fn()
            },
            fs,
            projectDir: path.join(__dirname, '..'),
            app: {},
            spawn,
            shell: {
                openExternal: jest.fn()
            }
        },
        handlers,
        sender,
        axios,
        spawn
    };
}

describe('CupidBot client IPC', () => {
    let tempDir;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cupidbot-client-ipc-'));
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('download-client returns an existing local CupidBot jar without network access', async () => {
        fs.writeFileSync(path.join(tempDir, 'cupidbot-1.2.3.jar'), 'jar');
        const { deps, handlers, sender, axios } = createDeps(tempDir);

        await require('../libs/ipc-handlers')(deps);
        const result = await handlers['download-client']({ sender }, '1.2.3');

        expect(result).toEqual({
            success: true,
            path: path.join(tempDir, 'cupidbot-1.2.3.jar')
        });
        expect(axios).not.toHaveBeenCalled();
    });

    test('download-client rejects missing local CupidBot jars without network access', async () => {
        const { deps, handlers, sender, axios } = createDeps(tempDir);

        await require('../libs/ipc-handlers')(deps);
        const result = await handlers['download-client']({ sender }, '1.2.3');

        expect(result).toEqual({
            error: 'Local CupidBot jar not found: ' + path.join(tempDir, 'cupidbot-1.2.3.jar')
        });
        expect(axios).not.toHaveBeenCalled();
    });

    test('open-client launches a local CupidBot jar', async () => {
        fs.writeFileSync(path.join(tempDir, 'cupidbot-1.2.3.jar'), 'jar');
        const { deps, handlers, spawn } = createDeps(tempDir);

        await require('../libs/jar-executor')(deps);
        const result = await handlers['open-client'](null, '1.2.3', null, null, '');
        await new Promise((resolve) => setImmediate(resolve));

        expect(result).toEqual({ success: true });
        expect(spawn).toHaveBeenCalledWith(
            expect.stringMatching(/^java/),
            expect.arrayContaining(['-jar', path.join(tempDir, 'cupidbot-1.2.3.jar'), '-disable-telemetry']),
            expect.objectContaining({ detached: true })
        );
        expect(spawn.mock.calls[1][1]).toContain('--enable-native-access=ALL-UNNAMED');
        expect(spawn.mock.calls[1][1].indexOf('--enable-native-access=ALL-UNNAMED')).toBeLessThan(
            spawn.mock.calls[1][1].indexOf('-jar')
        );
        expect(spawn.mock.calls[0][1]).not.toContain('-noupdate');
    });
});

import { spawn, type ChildProcess } from 'node:child_process';

const bun = process.execPath;
const backend = spawn(bun, ['--watch', 'src/server/index.ts'], {
    env: { ...process.env, NODE_ENV: process.env.NODE_ENV ?? 'development' },
    stdio: 'inherit',
    windowsHide: true
});
let frontend: ChildProcess | undefined;
let stopping = false;

const stop = (exitCode: number) => {
    if (stopping) {
        return;
    }
    stopping = true;
    process.exitCode = exitCode;
    frontend?.kill();
    backend.kill();
};

backend.on('error', error => {
    console.error('Could not start the Bun API server.', error);
    stop(1);
});

backend.on('exit', (code, signal) => {
    if (!stopping) {
        console.error(`The Bun API server stopped (${signal ?? code ?? 'unknown'}).`);
        stop(code ?? 1);
    }
});

const waitForApi = async () => {
    for (let attempt = 0; attempt < 60 && !stopping; attempt += 1) {
        if (backend.exitCode !== null || backend.signalCode !== null) {
            throw new Error('The Bun API server exited before it became ready.');
        }
        try {
            const response = await fetch('http://127.0.0.1:3001/api/health', { signal: AbortSignal.timeout(500) });
            if (response.ok) {
                return;
            }
        } catch {
            await Bun.sleep(250);
        }
    }
    throw new Error('The Bun API server did not become ready within 15 seconds.');
};

try {
    await waitForApi();
    if (!stopping) {
        frontend = spawn(bun, ['run', '--bun', 'vite', '--host', '0.0.0.0'], { stdio: 'inherit', windowsHide: true });
        frontend.on('error', error => {
            console.error('Could not start the Vite storefront.', error);
            stop(1);
        });
        frontend.on('exit', (code, signal) => {
            if (!stopping) {
                stop(code ?? (signal ? 1 : 0));
            }
        });
    }
} catch (error) {
    console.error(error);
    stop(1);
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

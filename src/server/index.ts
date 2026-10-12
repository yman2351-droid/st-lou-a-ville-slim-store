import { resolve } from 'node:path';
import { bootstrapAdministrator, createStoreApi, openStoreDatabase } from './storeApi';

if (process.env.APP_ORIGIN) {
    const appOrigin = new URL(process.env.APP_ORIGIN);
    if (!['http:', 'https:'].includes(appOrigin.protocol) || appOrigin.origin !== process.env.APP_ORIGIN.replace(/\/$/, '')) {
        throw new Error('APP_ORIGIN must contain only the application origin, for example https://shop.example.com.');
    }
}

const databasePath = resolve(process.env.STORE_DB_PATH ?? './data/store.sqlite');
const uploadDirectory = resolve('./public/uploads');
const database = openStoreDatabase(databasePath);
const store = createStoreApi({
    database,
    uploadDirectory,
    bootstrapEmail: process.env.BOOTSTRAP_ADMIN_EMAIL
});

const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;
const bootstrapPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;

if (Boolean(bootstrapEmail) !== Boolean(bootstrapPassword)) {
    throw new Error('Set both BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD for first-time administrator setup.');
}

if (bootstrapEmail && bootstrapPassword) {
    if (await bootstrapAdministrator(database, bootstrapEmail, bootstrapPassword)) {
        console.info(`Initial administrator ${bootstrapEmail.trim().toLowerCase()} created.`);
    }
} else if (!database.query('SELECT id FROM users WHERE role = ? LIMIT 1').get('admin')) {
    console.warn('No administrator exists. Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD, restart once, then remove both values.');
}

const production = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT ?? (production ? 3000 : 3001));
if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid TCP port.');
}

const server = Bun.serve({
    hostname: process.env.HOST ?? '127.0.0.1',
    port,
    fetch: store.handler
});

console.info(`Store ${production ? 'server' : 'API'} listening on http://${server.hostname}:${server.port}`);

import { resolve } from 'node:path';
import { bootstrapAdministrator, createStoreApi, openStoreDatabase } from './storeApi';

const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

if (!email || !password) {
    throw new Error('Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD before running the bootstrap command.');
}

const database = openStoreDatabase(resolve(process.env.STORE_DB_PATH ?? './data/store.sqlite'));
try {
    createStoreApi({
        database,
        uploadDirectory: resolve('./public/uploads'),
        bootstrapEmail: email
    });
    const created = await bootstrapAdministrator(database, email, password);
    if (!created) {
        throw new Error('An administrator already exists; bootstrap will not modify existing accounts.');
    }
    console.info(`Initial administrator ${email.trim().toLowerCase()} created.`);
} finally {
    database.close();
}

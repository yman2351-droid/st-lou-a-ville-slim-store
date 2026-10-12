import { Database } from 'bun:sqlite';
import { afterEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { bootstrapAdministrator, createStoreApi } from './storeApi';

const resources: Array<{ database: Database; directory: string }> = [];
const adminPassword = 'First-Admin-Password-483!';

interface ApiPayload extends Record<string, unknown> {
    user?: { id: string; email: string; role: string } | null;
    order?: { id: string; total: number } | null;
    product?: { id: string; description: string; role?: string; audiences: string[]; stockQuantity?: number | null };
    products?: Array<{ id: string; stockQuantity?: number | null; availableForSale?: boolean }>;
    imageUrl?: string;
    logs?: unknown[];
    orders?: unknown[];
}

interface TestEnvironment {
    database: Database;
    directory: string;
    api: ReturnType<typeof createStoreApi>;
}

interface TestClient extends TestEnvironment {
    call: (path: string, options?: {
        method?: string;
        body?: Record<string, unknown> | FormData;
        includeCsrf?: boolean;
        origin?: string;
    }) => Promise<{ response: Response; body: ApiPayload | null }>;
}

const required = <T,>(value: T | null | undefined): T => {
    if (value == null) {
        throw new Error('Expected API response data was missing.');
    }
    return value;
};

afterEach(() => {
    for (const resource of resources.splice(0)) {
        resource.database.close();
        rmSync(resource.directory, { recursive: true, force: true });
    }
});

const createClient = async (shared?: TestEnvironment): Promise<TestClient> => {
    const database = shared?.database ?? new Database(':memory:');
    const directory = shared?.directory ?? mkdtempSync(join(tmpdir(), 'slim-store-api-test-'));
    const api = shared?.api ?? createStoreApi({ database, uploadDirectory: directory, bootstrapEmail: 'owner@example.com' });
    if (!shared) {
        resources.push({ database, directory });
    }
    const cookies = new Map<string, string>();
    let csrfToken = '';

    const call = async (path: string, options: {
        method?: string;
        body?: Record<string, unknown> | FormData;
        includeCsrf?: boolean;
        origin?: string;
    } = {}) => {
        const method = options.method ?? 'GET';
        const headers = new Headers({ Origin: options.origin ?? 'http://localhost' });
        if (cookies.size) {
            headers.set('Cookie', [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join('; '));
        }
        if (options.includeCsrf !== false && method !== 'GET' && method !== 'HEAD') {
            headers.set('X-CSRF-Token', csrfToken);
        }
        let body: BodyInit | undefined;
        if (options.body instanceof FormData) {
            body = options.body;
        } else if (options.body) {
            headers.set('Content-Type', 'application/json');
            body = JSON.stringify(options.body);
        }
        const response = await api.handler(new Request(`http://localhost${path}`, { method, headers, body }));
        const setCookie = response.headers.get('set-cookie') ?? '';
        for (const pair of setCookie.split(/,\s*(?=[^;,]+=)/)) {
            const [nameValue] = pair.split(';');
            const separator = nameValue.indexOf('=');
            if (separator > 0) {
                const name = nameValue.slice(0, separator);
                const value = nameValue.slice(separator + 1);
                if (value) {
                    cookies.set(name, value);
                } else {
                    cookies.delete(name);
                }
            }
        }
        const result = response.status === 204 ? null : await response.json();
        if (result && typeof result === 'object' && 'csrfToken' in result && typeof result.csrfToken === 'string') {
            csrfToken = result.csrfToken;
        }
        return { response, body: result as ApiPayload | null };
    };

    if (!shared) {
        await bootstrapAdministrator(database, 'owner@example.com', adminPassword);
    }
    await call('/api/session');

    return { call, database, directory, api };
};

const login = async (client: TestClient, email: string, password: string) => {
    const result = await client.call('/api/login', { method: 'POST', body: { email, password } });
    expect(result.response.status).toBe(200);
    return result;
};

describe('Bun storefront authorization API', () => {
    it('issues secure session cookies and restricts public account registration to customer role', async () => {
        const client = await createClient();
        const anonymousSession = await client.call('/api/session');
        expect(anonymousSession.body?.user).toBeNull();
        expect(anonymousSession.response.headers.get('set-cookie')).toContain('SameSite=Strict');

        const registered = await client.call('/api/register', {
            method: 'POST',
            body: { email: 'shopper@example.com', password: 'Customer-Password-123!', role: 'admin' }
        });
        expect(registered.response.status).toBe(201);
        expect(registered.body?.user).toMatchObject({ email: 'shopper@example.com', role: 'customer' });
        expect(registered.response.headers.get('set-cookie')).toContain('HttpOnly');

        const dashboard = await client.call('/api/products');
        expect(dashboard.response.status).toBe(403);
        const users = await client.call('/api/users');
        expect(users.response.status).toBe(403);
        const attemptToChangeProduct = await client.call('/api/products/studio-tee', {
            method: 'PATCH',
            body: { description: 'Not authorized' }
        });
        expect(attemptToChangeProduct.response.status).toBe(403);
    });

    it('requires a matching CSRF token and rejects cross-origin writes', async () => {
        const client = await createClient();
        const missingToken = await client.call('/api/register', {
            method: 'POST',
            includeCsrf: false,
            body: { email: 'one@example.com', password: 'Customer-Password-123!' }
        });
        expect(missingToken.response.status).toBe(403);

        const crossOrigin = await client.call('/api/register', {
            method: 'POST',
            origin: 'https://attacker.example',
            body: { email: 'two@example.com', password: 'Customer-Password-123!' }
        });
        expect(crossOrigin.response.status).toBe(403);

        const previousNodeEnv = process.env.NODE_ENV;
        const previousAppOrigin = process.env.APP_ORIGIN;
        try {
            process.env.NODE_ENV = 'development';
            delete process.env.APP_ORIGIN;
            const developmentProxy = await client.call('/api/register', {
                method: 'POST',
                origin: 'http://localhost:5173',
                body: { email: 'proxy@example.com', password: 'Customer-Password-123!' }
            });
            expect(developmentProxy.response.status).toBe(201);

            process.env.NODE_ENV = 'production';
            const productionProxy = await client.call('/api/register', {
                method: 'POST',
                origin: 'http://localhost:5173',
                body: { email: 'production-proxy@example.com', password: 'Customer-Password-123!' }
            });
            expect(productionProxy.response.status).toBe(403);
        } finally {
            if (previousNodeEnv === undefined) {
                delete process.env.NODE_ENV;
            } else {
                process.env.NODE_ENV = previousNodeEnv;
            }
            if (previousAppOrigin === undefined) {
                delete process.env.APP_ORIGIN;
            } else {
                process.env.APP_ORIGIN = previousAppOrigin;
            }
        }
    });

    it('allows managers to manage inventory and images without allowing account or system-file administration', async () => {
        const admin = await createClient();
        await login(admin, 'owner@example.com', adminPassword);
        const createdManager = await admin.call('/api/users', {
            method: 'POST',
            body: { email: 'manager@example.com', password: 'Manager-Password-123!', role: 'manager' }
        });
        expect(createdManager.response.status).toBe(201);

        const manager = await createClient(admin);
        await login(manager, 'manager@example.com', 'Manager-Password-123!');
        const updatedProduct = await manager.call('/api/products/studio-tee', {
            method: 'PATCH',
            body: { description: 'Updated product description', price: 39 }
        });
        expect(updatedProduct.response.status).toBe(200);
        expect(required(updatedProduct.body?.product).description).toBe('Updated product description');

        const inventory = await manager.call('/api/products/studio-tee/inventory', {
            method: 'PATCH',
            body: { quantity: 4 }
        });
        expect(inventory.response.status).toBe(200);
        const publicStore = await manager.call('/api/store');
        const publicProduct = required(required(publicStore.body?.products).find(product => product.id === 'studio-tee'));
        expect(publicProduct.availableForSale).toBe(true);
        expect(publicProduct.stockQuantity).toBeUndefined();

        const accountList = await manager.call('/api/users');
        expect(accountList.response.status).toBe(403);
        const deleteProduct = await manager.call('/api/products/studio-tee', { method: 'DELETE' });
        expect(deleteProduct.response.status).toBe(403);

        const image = new FormData();
        image.set('image', new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0])], 'logo.png', { type: 'image/png' }));
        const upload = await manager.call('/api/uploads', { method: 'POST', body: image });
        expect(upload.response.status).toBe(201);
        const imageUrl = required(upload.body?.imageUrl);
        expect(imageUrl).toMatch(/^\/uploads\/[a-f0-9-]+\.png$/);

        const deleteImage = await manager.call(`/api/uploads/${imageUrl.split('/').pop()}`, { method: 'DELETE' });
        expect(deleteImage.response.status).toBe(403);
        const adminDeleteImage = await admin.call(`/api/uploads/${imageUrl.split('/').pop()}`, { method: 'DELETE' });
        expect(adminDeleteImage.response.status).toBe(200);
    });

    it('isolates customer orders and reserves then restores inventory through authorized order transitions', async () => {
        const admin = await createClient();
        await login(admin, 'owner@example.com', adminPassword);
        const createManager = await admin.call('/api/users', {
            method: 'POST',
            body: { email: 'ops@example.com', password: 'Manager-Password-123!', role: 'manager' }
        });
        expect(createManager.response.status).toBe(201);

        const customer = await createClient(admin);
        const register = await customer.call('/api/register', {
            method: 'POST',
            body: { email: 'buyer@example.com', password: 'Customer-Password-123!' }
        });
        expect(register.response.status).toBe(201);

        const manager = await createClient(admin);
        await login(manager, 'ops@example.com', 'Manager-Password-123!');
        await manager.call('/api/products/studio-tee/inventory', { method: 'PATCH', body: { quantity: 2 } });

        const order = await customer.call('/api/orders', {
            method: 'POST',
            body: { items: [{ productId: 'studio-tee', size: 'M', quantity: 2 }] }
        });
        expect(order.response.status).toBe(201);
        const orderData = required(order.body?.order);
        expect(orderData.total).toBe(76);

        const otherCustomer = await createClient(admin);
        await otherCustomer.call('/api/register', { method: 'POST', body: { email: 'other@example.com', password: 'Customer-Password-123!' } });
        const privateOrders = await otherCustomer.call('/api/orders');
        expect(privateOrders.body?.orders).toHaveLength(0);

        const invalidTransition = await manager.call(`/api/orders/${orderData.id}`, {
            method: 'PATCH',
            body: { status: 'completed' }
        });
        expect(invalidTransition.response.status).toBe(409);

        const processing = await manager.call(`/api/orders/${orderData.id}`, {
            method: 'PATCH',
            body: { status: 'processing' }
        });
        expect(processing.response.status).toBe(200);
        const outOfStockStore = await customer.call('/api/store');
        expect(required(outOfStockStore.body?.products).some(product => product.id === 'studio-tee')).toBe(false);

        const cancel = await manager.call(`/api/orders/${orderData.id}`, {
            method: 'PATCH',
            body: { status: 'cancelled' }
        });
        expect(cancel.response.status).toBe(200);
        const inventory = await admin.call('/api/products');
        const managedShirt = required(inventory.body?.products).find(product => product.id === 'studio-tee');
        expect(managedShirt?.stockQuantity).toBe(2);

        const audit = await admin.call('/api/audit');
        expect(audit.response.status).toBe(200);
        expect(required(audit.body?.logs).length).toBeGreaterThan(0);
        const managerAudit = await manager.call('/api/audit');
        expect(managerAudit.response.status).toBe(403);
    });

    it('prevents managers from changing store roles and protects the final administrator account', async () => {
        const admin = await createClient();
        await login(admin, 'owner@example.com', adminPassword);
        const managerRecord = await admin.call('/api/users', {
            method: 'POST',
            body: { email: 'role-manager@example.com', password: 'Manager-Password-123!', role: 'manager' }
        });
        const manager = await createClient(admin);
        await login(manager, 'role-manager@example.com', 'Manager-Password-123!');

        const managerId = required(managerRecord.body?.user).id;
        const promoteCustomer = await manager.call(`/api/users/${managerId}`, {
            method: 'PATCH',
            body: { role: 'admin' }
        });
        expect(promoteCustomer.response.status).toBe(403);

        const finalAdmin = admin.database.query('SELECT id FROM users WHERE role = ?').get('admin') as { id: string };
        const demoteFinalAdmin = await admin.call(`/api/users/${finalAdmin.id}`, {
            method: 'PATCH',
            body: { role: 'manager' }
        });
        expect(demoteFinalAdmin.response.status).toBe(409);

        const createProduct = await manager.call('/api/products', {
            method: 'POST',
            body: { name: 'Local Artist Tee', description: 'New store listing', price: 30, role: 'admin' }
        });
        expect(createProduct.response.status).toBe(201);
        const createdProduct = required(createProduct.body?.product);
        expect(createdProduct.role).toBeUndefined();
        expect(createdProduct.audiences).toEqual(['Men', 'Women']);
    });
});

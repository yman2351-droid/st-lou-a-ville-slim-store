import { randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { basename, dirname, extname, resolve, sep } from 'node:path';
import { Database } from 'bun:sqlite';
import { products as catalogSeed } from '../data/products';
import type { OrderStatus, Product, ProductAudience, ProductCategory, ProductSubcategory, UserRole } from '../types';

export interface StoreUser {
    id: string;
    email: string;
    role: UserRole;
}

interface SessionRow {
    session_id: string;
    user_id: string;
    csrf_hash: string;
    email: string;
    role: UserRole;
}

interface ApiOptions {
    database: Database;
    uploadDirectory: string;
    bootstrapEmail?: string;
}

export class ApiError extends Error {
    constructor(readonly status: number, message: string) {
        super(message);
    }
}

const roles = ['admin', 'manager', 'customer'] as const satisfies readonly UserRole[];
const categories = ['Cologne', 'Tops', 'Bottoms', 'Outerwear', 'Shoes', 'Outfits'] as const satisfies readonly ProductCategory[];
const subcategories = ['T-Shirts', 'Tanks', 'V-Necks', 'Crewnecks', 'Lightweight Hoodies', 'Heavyweight Hoodies', 'Shorts', 'Sweatpants', 'Jackets', 'High-Tops', 'Low-Tops', 'Outfit', 'Fragrance'] as const satisfies readonly ProductSubcategory[];
const audiences = ['Men', 'Women', 'Kids'] as const satisfies readonly ProductAudience[];
const apparelColors = ['black', 'charcoal', 'silver', 'gold', 'bone'] as const;
const orderStatuses = ['pending', 'processing', 'shipped', 'completed', 'cancelled'] as const satisfies readonly OrderStatus[];
const maxJsonBytes = 64 * 1024;
const sessionLifetimeSeconds = 60 * 60 * 24 * 7;
const loginFailures = new Map<string, number[]>();
let dummyPasswordHash: Promise<string> | undefined;

const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
    Response.json(body, { status, headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        ...headers
    } });

const cookieValue = (request: Request, name: string) => {
    const cookieHeader = request.headers.get('cookie') ?? '';
    const entry = cookieHeader.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`));
    return entry ? entry.slice(name.length + 1) : null;
};

const safeEqual = (first: string, second: string) => {
    const a = Buffer.from(first);
    const b = Buffer.from(second);
    return a.length === b.length && timingSafeEqual(a, b);
};

const sha256 = (value: string) => new Bun.CryptoHasher('sha256').update(value).digest('hex');
const token = () => randomBytes(32).toString('hex');

const cookie = (name: string, value: string, maxAge: number, secure: boolean, httpOnly = false) =>
    `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Strict; Max-Age=${maxAge}${httpOnly ? '; HttpOnly' : ''}${secure ? '; Secure' : ''}`;

const clearCookie = (name: string, secure: boolean) => cookie(name, '', 0, secure);

const withCookies = (response: Response, cookies: string[]) => {
    const headers = new Headers(response.headers);
    for (const value of cookies) {
        headers.append('Set-Cookie', value);
    }
    return new Response(response.body, { status: response.status, headers });
};

const requiredString = (value: unknown, label: string, maxLength: number) => {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
        throw new ApiError(400, `${label} is required and must be at most ${maxLength} characters.`);
    }
    return value.trim();
};

const validEmail = (value: unknown) => {
    const email = requiredString(value, 'Email', 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new ApiError(400, 'Enter a valid email address.');
    }
    return email;
};

const validPassword = (value: unknown, minimum = 12) => {
    if (typeof value !== 'string' || value.length < minimum || value.length > 256) {
        throw new ApiError(400, `Password must be between ${minimum} and 256 characters.`);
    }
    return value;
};

const parseBody = async (request: Request): Promise<Record<string, unknown>> => {
    const text = await request.text();
    if (text.length > maxJsonBytes) {
        throw new ApiError(413, 'The request body is too large.');
    }
    try {
        const value: unknown = JSON.parse(text);
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            throw new ApiError(400, 'The request must contain a JSON object.');
        }
        return value as Record<string, unknown>;
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        if (error instanceof SyntaxError) {
            throw new ApiError(400, 'The request body is not valid JSON.');
        }
        throw error;
    }
};

const setupDatabase = (database: Database) => {
    database.exec(`
        PRAGMA foreign_keys = ON;
        PRAGMA busy_timeout = 5000;
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'customer')),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            csrf_hash TEXT NOT NULL,
            expires_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS sessions_user_id ON sessions(user_id);
        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            product_json TEXT NOT NULL,
            stock_quantity INTEGER CHECK (stock_quantity IS NULL OR stock_quantity >= 0)
        );
        CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
            email TEXT NOT NULL,
            items_json TEXT NOT NULL,
            total REAL NOT NULL CHECK (total >= 0),
            status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'shipped', 'completed', 'cancelled')),
            stock_reserved INTEGER NOT NULL DEFAULT 0 CHECK (stock_reserved IN (0, 1)),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS site_settings (
            setting_key TEXT PRIMARY KEY,
            setting_value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS announcements (
            id TEXT PRIMARY KEY,
            text TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
            actor_email TEXT NOT NULL,
            action TEXT NOT NULL,
            detail TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);

    const insertProduct = database.query('INSERT OR IGNORE INTO products (id, product_json, stock_quantity) VALUES ($id, $json, NULL)');
    for (const product of catalogSeed) {
        insertProduct.run({ $id: product.id, $json: JSON.stringify(product) });
    }

    database.query('INSERT OR IGNORE INTO site_settings (setting_key, setting_value) VALUES (?, ?)').run(
        'store',
        JSON.stringify({
            announcement: 'THE OFFICIAL ST. LOU-A-VILLE SLIM STORE',
            heroDescription: 'Step inside the world of St. Lou-a-ville Slim. Independent sound, signature cologne, and streetwear built to move with you.',
            producerBio: 'Louisville music producer St. Lou-a-ville Slim brings the sound from the studio to the street. With his own point of view, Slim built this collection around independent energy, a signature scent, and everyday essentials that make an entrance.'
        })
    );
};

const recordAudit = (database: Database, actor: StoreUser, action: string, detail: string) => {
    database.query('INSERT INTO audit_logs (user_id, actor_email, action, detail) VALUES (?, ?, ?, ?)').run(
        actor.id, actor.email, action, detail.slice(0, 240)
    );
};

const readProducts = (database: Database): Product[] =>
    database.query('SELECT product_json, stock_quantity FROM products ORDER BY rowid').all()
        .map(row => {
            const productRow = row as { product_json: string; stock_quantity: number | null };
            return { ...JSON.parse(productRow.product_json) as Product, stockQuantity: productRow.stock_quantity };
        });

const readStoreSettings = (database: Database) => {
    const row = database.query('SELECT setting_value FROM site_settings WHERE setting_key = ?').get('store') as { setting_value: string } | null;
    if (!row) {
        throw new Error('The store settings row is missing.');
    }
    return JSON.parse(row.setting_value) as Record<string, string>;
};

const readAnnouncements = (database: Database) =>
    database.query('SELECT id, text, created_at AS createdAt FROM announcements ORDER BY created_at DESC').all();

const validateCategoryPair = (category: ProductCategory, subcategory: ProductSubcategory) => {
    const allowed: Record<ProductCategory, readonly ProductSubcategory[]> = {
        Cologne: ['Fragrance'],
        Tops: ['T-Shirts', 'Tanks', 'V-Necks', 'Crewnecks', 'Lightweight Hoodies', 'Heavyweight Hoodies'],
        Bottoms: ['Shorts', 'Sweatpants'],
        Outerwear: ['Jackets'],
        Shoes: ['High-Tops', 'Low-Tops'],
        Outfits: ['Outfit']
    };
    if (!allowed[category].includes(subcategory)) {
        throw new ApiError(400, 'The product category and style do not match.');
    }
};

const productFromInput = (input: Record<string, unknown>, previous?: Product): Product => {
    const name = input.name === undefined && previous ? previous.name : requiredString(input.name, 'Product name', 120);
    const description = input.description === undefined && previous ? previous.description : requiredString(input.description, 'Product description', 4000);
    const categoryValue = input.category === undefined ? previous?.category ?? 'Tops' : input.category;
    if (typeof categoryValue !== 'string' || !(categories as readonly string[]).includes(categoryValue)) {
        throw new ApiError(400, 'Choose a valid product category.');
    }
    const category = categoryValue as ProductCategory;
    const subcategoryValue = input.subcategory === undefined && previous ? previous.subcategory : input.subcategory ?? (
        category === 'Cologne' ? 'Fragrance' : category === 'Shoes' ? 'Low-Tops' : category === 'Outfits' ? 'Outfit' :
            category === 'Bottoms' ? 'Sweatpants' : category === 'Outerwear' ? 'Jackets' : 'T-Shirts'
    );
    if (typeof subcategoryValue !== 'string' || !(subcategories as readonly string[]).includes(subcategoryValue)) {
        throw new ApiError(400, 'Choose a valid product style.');
    }
    const subcategory = subcategoryValue as ProductSubcategory;
    validateCategoryPair(category, subcategory);

    const priceValue = input.price === undefined && previous ? previous.price : input.price;
    if (typeof priceValue !== 'number' || !Number.isFinite(priceValue) || priceValue < 0 || priceValue > 100000) {
        throw new ApiError(400, 'Enter a valid product price.');
    }
    const originalPrice = input.originalPrice === undefined && previous ? previous.originalPrice : input.originalPrice;
    if (originalPrice !== undefined && originalPrice !== null &&
        (typeof originalPrice !== 'number' || !Number.isFinite(originalPrice) || originalPrice < priceValue || originalPrice > 100000)) {
        throw new ApiError(400, 'The original price must be at least the current price.');
    }

    const audienceValue = input.audiences === undefined && previous ? previous.audiences : input.audiences ?? ['Men', 'Women'];
    if (!Array.isArray(audienceValue) || audienceValue.length === 0 || audienceValue.some(value => typeof value !== 'string' || !(audiences as readonly string[]).includes(value))) {
        throw new ApiError(400, 'Choose at least one valid product department.');
    }
    const sizesValue = input.sizes === undefined && previous ? previous.sizes : input.sizes ?? [];
    if (!Array.isArray(sizesValue) || sizesValue.length > 30 || sizesValue.some(size => typeof size !== 'string' || !size.trim() || size.length > 12)) {
        throw new ApiError(400, 'Product sizes must be a list of up to 30 short labels.');
    }
    const colorValue = input.garmentColor === undefined && previous ? previous.garmentColor : input.garmentColor ?? 'black';
    if (typeof colorValue !== 'string' || !(apparelColors as readonly string[]).includes(colorValue)) {
        throw new ApiError(400, 'Choose a valid product color.');
    }
    const imageValue = input.imageUrl === undefined && previous ? previous.imageUrl : input.imageUrl;
    if (imageValue !== undefined && imageValue !== null &&
        (typeof imageValue !== 'string' || imageValue.length > 2048 ||
            !(imageValue.startsWith('/images/') || /^\/uploads\/[a-f0-9-]+\.(?:png|jpe?g|webp)$/i.test(imageValue) || /^https:\/\//i.test(imageValue)))) {
        throw new ApiError(400, 'Product images must use a local image path or a secure HTTPS URL.');
    }
    const badgeValue = input.badge === undefined && previous ? previous.badge : input.badge;
    if (badgeValue !== undefined && badgeValue !== null && (typeof badgeValue !== 'string' || badgeValue.length > 60)) {
        throw new ApiError(400, 'Product badges must be at most 60 characters.');
    }

    return {
        id: previous?.id ?? `product-${crypto.randomUUID()}`,
        name,
        description,
        price: priceValue,
        ...(originalPrice == null ? {} : { originalPrice }),
        ...(imageValue == null ? {} : { imageUrl: imageValue }),
        category,
        subcategory,
        audiences: audienceValue as ProductAudience[],
        sizes: sizesValue as string[],
        garmentColor: colorValue as Product['garmentColor'],
        ...(badgeValue ? { badge: badgeValue as string } : {})
    };
};

const orderItems = (value: unknown, database: Database) => {
    if (!Array.isArray(value) || value.length === 0 || value.length > 25) {
        throw new ApiError(400, 'Add between 1 and 25 items to the order.');
    }
    const products = new Map(readProducts(database).map(product => [product.id, product]));
    const combined = new Map<string, { product: Product; size?: string; quantity: number }>();
    for (const item of value) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            throw new ApiError(400, 'An order item is invalid.');
        }
        const entry = item as Record<string, unknown>;
        const id = requiredString(entry.productId, 'Product', 100);
        const product = products.get(id);
        if (!product) {
            throw new ApiError(400, 'An order contains an unavailable product.');
        }
        if (!Number.isInteger(entry.quantity) || (entry.quantity as number) < 1 || (entry.quantity as number) > 25) {
            throw new ApiError(400, 'Each order quantity must be between 1 and 25.');
        }
        const size = entry.size === undefined ? undefined : requiredString(entry.size, 'Product size', 12);
        if ((product.sizes?.length ?? 0) > 0 && (!size || !product.sizes?.includes(size))) {
            throw new ApiError(400, `Choose a valid size for ${product.name}.`);
        }
        if (!product.sizes?.length && size) {
            throw new ApiError(400, `${product.name} does not have size variants.`);
        }
        const key = `${id}:${size ?? ''}`;
        const current = combined.get(key);
        const quantity = (current?.quantity ?? 0) + (entry.quantity as number);
        if (quantity > 25) {
            throw new ApiError(400, 'Each order item is limited to 25 units.');
        }
        combined.set(key, { product, size, quantity });
    }
    const items = [...combined.values()].map(({ product, size, quantity }) => ({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity,
        ...(size ? { size } : {})
    }));
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (total > 100000) {
        throw new ApiError(400, 'The order total exceeds the store limit.');
    }
    for (const item of items) {
        const product = products.get(item.productId);
        if (product?.stockQuantity != null) {
            const quantityInOrder = items.filter(line => line.productId === item.productId).reduce((sum, line) => sum + line.quantity, 0);
            if (quantityInOrder > product.stockQuantity) {
                throw new ApiError(409, `${product.name} does not have enough stock for this order.`);
            }
        }
    }
    return { items, total };
};

const uploadedImagePath = (url: string, uploadDirectory: string) => {
    const name = url.slice('/uploads/'.length);
    if (!/^([a-f0-9-]{36})\.(png|jpe?g|webp)$/i.test(name)) {
        throw new ApiError(400, 'The uploaded image path is invalid.');
    }
    return resolve(uploadDirectory, name);
};

export const createStoreApi = ({ database, uploadDirectory, bootstrapEmail }: ApiOptions) => {
    setupDatabase(database);
    database.query('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
    const secureCookie = process.env.NODE_ENV === 'production';

    const getSession = (request: Request): SessionRow | null => {
        const sessionId = cookieValue(request, 'store_session');
        if (!sessionId || !/^[a-f0-9]{64}$/.test(sessionId)) {
            return null;
        }
        const session = database.query(`
            SELECT sessions.session_id, sessions.user_id, sessions.csrf_hash, users.email, users.role
            FROM sessions JOIN users ON users.id = sessions.user_id
            WHERE sessions.session_id = ? AND sessions.expires_at > ?
        `).get(sessionId, Date.now()) as SessionRow | null;
        if (!session) {
            database.query('DELETE FROM sessions WHERE session_id = ?').run(sessionId);
        }
        return session;
    };

    const requireUser = (session: SessionRow | null): StoreUser => {
        if (!session) {
            throw new ApiError(401, 'Sign in to continue.');
        }
        return { id: session.user_id, email: session.email, role: session.role };
    };

    const requireRole = (session: SessionRow | null, allowed: readonly UserRole[]) => {
        const user = requireUser(session);
        if (!allowed.includes(user.role)) {
            throw new ApiError(403, 'Your account is not authorized to perform this action.');
        }
        return user;
    };

    const requireCsrf = (request: Request, session: SessionRow | null) => {
        const origin = request.headers.get('origin');
        if (origin) {
            let requestOrigin: string;
            let normalizedOrigin: string;
            try {
                requestOrigin = new URL(request.url).origin;
                normalizedOrigin = new URL(origin).origin;
            } catch {
                throw new ApiError(403, 'This request could not be verified.');
            }
            const configuredOrigin = process.env.APP_ORIGIN;
            let configuredOriginValue = '';
            if (configuredOrigin) {
                try {
                    configuredOriginValue = new URL(configuredOrigin).origin;
                } catch {
                    throw new Error('APP_ORIGIN must be an absolute HTTP or HTTPS origin URL.');
                }
            }
            let developmentProxyOrigin = false;
            if (process.env.NODE_ENV === 'development') {
                const parsedOrigin = new URL(normalizedOrigin);
                const port = Number(parsedOrigin.port);
                developmentProxyOrigin = parsedOrigin.protocol === 'http:' &&
                    ['localhost', '127.0.0.1', '[::1]'].includes(parsedOrigin.hostname) &&
                    port >= 5173 && port <= 5183;
            }
            if (normalizedOrigin !== requestOrigin && normalizedOrigin !== configuredOriginValue && !developmentProxyOrigin) {
                throw new ApiError(403, 'Cross-origin write requests are not allowed.');
            }
        }
        const headerToken = request.headers.get('x-csrf-token') ?? '';
        const cookieToken = cookieValue(request, 'store_csrf') ?? '';
        if (!/^[a-f0-9]{64}$/.test(headerToken) || !safeEqual(headerToken, cookieToken)) {
            throw new ApiError(403, 'This request could not be verified. Refresh the page and try again.');
        }
        if (session && !safeEqual(sha256(headerToken), session.csrf_hash)) {
            throw new ApiError(403, 'This session token has expired. Refresh the page and try again.');
        }
    };

    const requireManagerCsrf = (request: Request, session: SessionRow | null) => {
        const user = requireRole(session, ['admin', 'manager']);
        requireCsrf(request, session);
        return user;
    };

    const issueSession = (userId: string) => {
        const sessionId = token();
        const csrfToken = token();
        database.query('INSERT INTO sessions (session_id, user_id, csrf_hash, expires_at) VALUES (?, ?, ?, ?)').run(
            sessionId, userId, sha256(csrfToken), Date.now() + sessionLifetimeSeconds * 1000
        );
        return {
            csrfToken,
            cookies: [
                cookie('store_session', sessionId, sessionLifetimeSeconds, secureCookie, true),
                cookie('store_csrf', csrfToken, sessionLifetimeSeconds, secureCookie)
            ]
        };
    };

    const apiHandler = async (request: Request): Promise<Response> => {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method.toUpperCase();
        const session = getSession(request);

        if (method === 'GET' && path === '/api/session') {
            if (session) {
                const csrfToken = cookieValue(request, 'store_csrf');
                if (csrfToken && /^[a-f0-9]{64}$/.test(csrfToken) && safeEqual(sha256(csrfToken), session.csrf_hash)) {
                    return json({ user: { id: session.user_id, email: session.email, role: session.role }, csrfToken });
                }
                const issued = issueSession(session.user_id);
                database.query('DELETE FROM sessions WHERE session_id = ?').run(session.session_id);
                return withCookies(json({ user: { id: session.user_id, email: session.email, role: session.role }, csrfToken: issued.csrfToken }), issued.cookies);
            }
            const existingToken = cookieValue(request, 'store_csrf');
            const csrfToken = existingToken && /^[a-f0-9]{64}$/.test(existingToken) ? existingToken : token();
            return withCookies(json({ user: null, csrfToken }), [cookie('store_csrf', csrfToken, sessionLifetimeSeconds, secureCookie)]);
        }

        if (method === 'GET' && path === '/api/health') {
            return json({ ok: true });
        }

        if (method === 'GET' && path === '/api/store') {
            const visibleProducts = readProducts(database)
                .filter(product => product.stockQuantity !== 0)
                .map(product => {
                    const publicProduct = { ...product, availableForSale: true };
                    delete publicProduct.stockQuantity;
                    return publicProduct;
                });
            return json({ products: visibleProducts, settings: readStoreSettings(database), announcements: readAnnouncements(database) });
        }

        if (method === 'POST' && path === '/api/register') {
            requireCsrf(request, null);
            const body = await parseBody(request);
            const email = validEmail(body.email);
            if (bootstrapEmail && email === bootstrapEmail.toLowerCase()) {
                throw new ApiError(409, 'This address is reserved for the initial administrator.');
            }
            const password = validPassword(body.password);
            const userId = crypto.randomUUID();
            let passwordHash: string;
            try {
                passwordHash = await Bun.password.hash(password, { algorithm: 'argon2id' });
            } catch (error) {
                console.error('Password hashing failed.', error);
                throw new Error('The account could not be created because password hashing failed.');
            }
            try {
                database.query('INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)').run(userId, email, passwordHash, 'customer');
            } catch (error) {
                if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
                    throw new ApiError(409, 'An account with that email already exists.');
                }
                throw error;
            }
            const issued = issueSession(userId);
            recordAudit(database, { id: userId, email, role: 'customer' }, 'account.register', 'Customer account created');
            return withCookies(json({ user: { id: userId, email, role: 'customer' }, csrfToken: issued.csrfToken }, 201), issued.cookies);
        }

        if (method === 'POST' && path === '/api/login') {
            requireCsrf(request, null);
            const body = await parseBody(request);
            const email = validEmail(body.email);
            const now = Date.now();
            const failures = (loginFailures.get(email) ?? []).filter(time => now - time < 15 * 60 * 1000);
            if (failures.length >= 8) {
                loginFailures.set(email, failures);
                throw new ApiError(429, 'Too many sign-in attempts. Wait 15 minutes before trying again.');
            }
            const userRow = database.query('SELECT id, email, password_hash, role FROM users WHERE email = ? COLLATE NOCASE').get(email) as
                { id: string; email: string; password_hash: string; role: UserRole } | null;
            const password = typeof body.password === 'string' ? body.password : '';
            const passwordHash = userRow?.password_hash ?? await (dummyPasswordHash ??= Bun.password.hash(token(), { algorithm: 'argon2id' }));
            const passwordMatches = await Bun.password.verify(password, passwordHash);
            if (!userRow || !passwordMatches) {
                failures.push(now);
                loginFailures.set(email, failures);
                throw new ApiError(401, 'Email or password is incorrect.');
            }
            loginFailures.delete(email);
            const issued = issueSession(userRow.id);
            const user = { id: userRow.id, email: userRow.email, role: userRow.role };
            recordAudit(database, user, 'auth.login', 'Successful sign in');
            return withCookies(json({ user, csrfToken: issued.csrfToken }), issued.cookies);
        }

        if (method === 'POST' && path === '/api/logout') {
            requireCsrf(request, session);
            if (session) {
                const user = requireUser(session);
                database.query('DELETE FROM sessions WHERE session_id = ?').run(session.session_id);
                recordAudit(database, user, 'auth.logout', 'Signed out');
            }
            return withCookies(json({ ok: true }), [cookie('store_session', '', 0, secureCookie, true), clearCookie('store_csrf', secureCookie)]);
        }

        if (!path.startsWith('/api/')) {
            return json({ error: 'Not found.' }, 404);
        }

        if (method === 'GET' && path === '/api/products') {
            requireRole(session, ['admin', 'manager']);
            return json({ products: readProducts(database) });
        }

        if (method === 'POST' && path === '/api/products') {
            const user = requireManagerCsrf(request, session);
            const product = productFromInput(await parseBody(request));
            database.query('INSERT INTO products (id, product_json, stock_quantity) VALUES (?, ?, NULL)').run(product.id, JSON.stringify(product));
            recordAudit(database, user, 'product.create', product.id);
            return json({ product: { ...product, stockQuantity: null } }, 201);
        }

        const inventoryMatch = path.match(/^\/api\/products\/([^/]+)\/inventory$/);
        if (inventoryMatch && method === 'PATCH') {
            const user = requireManagerCsrf(request, session);
            const productId = decodeURIComponent(inventoryMatch[1]);
            const body = await parseBody(request);
            const quantity = body.quantity;
            if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 0 || quantity > 1000000) {
                throw new ApiError(400, 'Inventory must be a whole number from 0 to 1,000,000.');
            }
            const result = database.query('UPDATE products SET stock_quantity = ? WHERE id = ?').run(quantity, productId);
            if (result.changes === 0) {
                throw new ApiError(404, 'The product was not found.');
            }
            recordAudit(database, user, 'inventory.update', `${productId}: ${quantity}`);
            return json({ ok: true });
        }

        const productMatch = path.match(/^\/api\/products\/([^/]+)$/);
        if (productMatch) {
            const productId = decodeURIComponent(productMatch[1]);
            const existingRow = database.query('SELECT product_json FROM products WHERE id = ?').get(productId) as { product_json: string } | null;
            if (!existingRow) {
                throw new ApiError(404, 'The product was not found.');
            }
            if (method === 'PATCH') {
                const user = requireManagerCsrf(request, session);
                const product = productFromInput(await parseBody(request), JSON.parse(existingRow.product_json) as Product);
                database.query('UPDATE products SET product_json = ? WHERE id = ?').run(JSON.stringify(product), productId);
                recordAudit(database, user, 'product.update', productId);
                const stock = (database.query('SELECT stock_quantity FROM products WHERE id = ?').get(productId) as { stock_quantity: number | null }).stock_quantity;
                return json({ product: { ...product, stockQuantity: stock } });
            }
            if (method === 'DELETE') {
                const user = requireRole(session, ['admin']);
                requireCsrf(request, session);
                database.query('DELETE FROM products WHERE id = ?').run(productId);
                recordAudit(database, user, 'product.delete', productId);
                return json({ ok: true });
            }
        }

        if (method === 'GET' && path === '/api/orders') {
            const user = requireUser(session);
            if (user.role === 'customer') {
                return json({ orders: database.query('SELECT id, email, items_json AS itemsJson, total, status, created_at AS createdAt FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(user.id)
                    .map(row => ({ ...(row as Record<string, unknown>), items: JSON.parse((row as { itemsJson: string }).itemsJson) })) });
            }
            requireRole(session, ['admin', 'manager']);
            return json({ orders: database.query('SELECT id, email, items_json AS itemsJson, total, status, created_at AS createdAt FROM orders ORDER BY created_at DESC').all()
                .map(row => ({ ...(row as Record<string, unknown>), items: JSON.parse((row as { itemsJson: string }).itemsJson) })) });
        }

        if (method === 'POST' && path === '/api/orders') {
            const user = requireRole(session, ['customer']);
            requireCsrf(request, session);
            const { items, total } = orderItems((await parseBody(request)).items, database);
            const id = crypto.randomUUID();
            database.query('INSERT INTO orders (id, user_id, email, items_json, total, status) VALUES (?, ?, ?, ?, ?, ?)').run(
                id, user.id, user.email, JSON.stringify(items), total, 'pending'
            );
            recordAudit(database, user, 'order.create', id);
            return json({ order: { id, email: user.email, items, total, status: 'pending' } }, 201);
        }

        const orderMatch = path.match(/^\/api\/orders\/([^/]+)$/);
        if (orderMatch && method === 'PATCH') {
            const user = requireManagerCsrf(request, session);
            const orderId = decodeURIComponent(orderMatch[1]);
            const body = await parseBody(request);
            if (typeof body.status !== 'string' || !(orderStatuses as readonly string[]).includes(body.status)) {
                throw new ApiError(400, 'Choose a valid order status.');
            }
            const transaction = database.transaction(() => {
                const order = database.query('SELECT items_json, status, stock_reserved FROM orders WHERE id = ?').get(orderId) as
                    { items_json: string; status: OrderStatus; stock_reserved: number } | null;
                if (!order) {
                    throw new ApiError(404, 'The order was not found.');
                }
                const nextStatus = body.status as OrderStatus;
                if (order.status === 'cancelled' || order.status === 'completed' ||
                    (order.status === 'shipped' && nextStatus !== 'completed') ||
                    (order.status === 'pending' && nextStatus !== 'processing' && nextStatus !== 'cancelled') ||
                    (order.status === 'processing' && nextStatus !== 'shipped' && nextStatus !== 'cancelled')) {
                    throw new ApiError(409, 'That order status transition is not allowed.');
                }
                const items = JSON.parse(order.items_json) as Array<{ productId: string; quantity: number }>;
                if (nextStatus === 'processing' && !order.stock_reserved) {
                    for (const item of items) {
                        const changed = database.query(`
                            UPDATE products SET stock_quantity = stock_quantity - ?
                            WHERE id = ? AND (stock_quantity IS NULL OR stock_quantity >= ?)
                        `).run(item.quantity, item.productId, item.quantity);
                        if (!changed.changes) {
                            throw new ApiError(409, `There is not enough stock to process ${item.productId}.`);
                        }
                    }
                    database.query('UPDATE orders SET stock_reserved = 1 WHERE id = ?').run(orderId);
                }
                if (nextStatus === 'cancelled' && order.stock_reserved) {
                    for (const item of items) {
                        database.query('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ? AND stock_quantity IS NOT NULL')
                            .run(item.quantity, item.productId);
                    }
                    database.query('UPDATE orders SET stock_reserved = 0 WHERE id = ?').run(orderId);
                }
                database.query('UPDATE orders SET status = ? WHERE id = ?').run(nextStatus, orderId);
            });
            transaction();
            recordAudit(database, user, 'order.status', `${orderId}: ${body.status}`);
            return json({ ok: true });
        }

        if (method === 'GET' && path === '/api/users') {
            requireRole(session, ['admin']);
            return json({ users: database.query('SELECT id, email, role, created_at AS createdAt FROM users ORDER BY created_at DESC').all() });
        }

        if (method === 'POST' && path === '/api/users') {
            const user = requireRole(session, ['admin']);
            requireCsrf(request, session);
            const body = await parseBody(request);
            const email = validEmail(body.email);
            const password = validPassword(body.password);
            if (typeof body.role !== 'string' || !(roles as readonly string[]).includes(body.role)) {
                throw new ApiError(400, 'Choose a valid account role.');
            }
            const id = crypto.randomUUID();
            const passwordHash = await Bun.password.hash(password, { algorithm: 'argon2id' });
            try {
                database.query('INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)').run(id, email, passwordHash, body.role);
            } catch (error) {
                if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
                    throw new ApiError(409, 'An account with that email already exists.');
                }
                throw error;
            }
            recordAudit(database, user, 'user.create', `${email} (${body.role})`);
            return json({ user: { id, email, role: body.role } }, 201);
        }

        const userMatch = path.match(/^\/api\/users\/([^/]+)$/);
        if (userMatch) {
            const user = requireRole(session, ['admin']);
            requireCsrf(request, session);
            const targetId = decodeURIComponent(userMatch[1]);
            if (method === 'PATCH') {
                const body = await parseBody(request);
                if (typeof body.role !== 'string' || !(roles as readonly string[]).includes(body.role)) {
                    throw new ApiError(400, 'Choose a valid account role.');
                }
                const target = database.query('SELECT role FROM users WHERE id = ?').get(targetId) as { role: UserRole } | null;
                if (!target) {
                    throw new ApiError(404, 'The account was not found.');
                }
                if (target.role === 'admin' && body.role !== 'admin') {
                    const otherAdmins = database.query('SELECT COUNT(*) AS total FROM users WHERE role = ? AND id <> ?').get('admin', targetId) as { total: number };
                    if (!otherAdmins.total) {
                        throw new ApiError(409, 'The last administrator cannot be demoted.');
                    }
                }
                database.query('UPDATE users SET role = ? WHERE id = ?').run(body.role, targetId);
                recordAudit(database, user, 'user.role', `${targetId}: ${body.role}`);
                return json({ ok: true });
            }
            if (method === 'DELETE') {
                const target = database.query('SELECT role FROM users WHERE id = ?').get(targetId) as { role: UserRole } | null;
                if (!target) {
                    throw new ApiError(404, 'The account was not found.');
                }
                if (target.role === 'admin') {
                    const otherAdmins = database.query('SELECT COUNT(*) AS total FROM users WHERE role = ? AND id <> ?').get('admin', targetId) as { total: number };
                    if (!otherAdmins.total) {
                        throw new ApiError(409, 'The last administrator cannot be deleted.');
                    }
                }
                database.query('DELETE FROM users WHERE id = ?').run(targetId);
                recordAudit(database, user, 'user.delete', targetId);
                return json({ ok: true });
            }
        }

        if (method === 'GET' && path === '/api/settings') {
            requireRole(session, ['admin', 'manager']);
            return json({ settings: readStoreSettings(database), announcements: readAnnouncements(database) });
        }

        if (method === 'PATCH' && path === '/api/settings') {
            const user = requireManagerCsrf(request, session);
            const body = await parseBody(request);
            const current = readStoreSettings(database);
            const allowedKeys = ['announcement', 'heroDescription', 'producerBio'];
            for (const [key, value] of Object.entries(body)) {
                if (!allowedKeys.includes(key) || typeof value !== 'string' || value.length > 3000) {
                    throw new ApiError(400, 'Store information contains an unsupported field or invalid text.');
                }
                current[key] = value;
            }
            database.query('UPDATE site_settings SET setting_value = ? WHERE setting_key = ?').run(JSON.stringify(current), 'store');
            recordAudit(database, user, 'store.update', 'Store information updated');
            return json({ settings: current });
        }

        if (method === 'POST' && path === '/api/announcements') {
            const user = requireManagerCsrf(request, session);
            const text = requiredString((await parseBody(request)).text, 'Announcement', 500);
            const id = crypto.randomUUID();
            database.query('INSERT INTO announcements (id, text) VALUES (?, ?)').run(id, text);
            recordAudit(database, user, 'announcement.create', id);
            return json({ announcement: { id, text } }, 201);
        }

        const announcementMatch = path.match(/^\/api\/announcements\/([^/]+)$/);
        if (announcementMatch && method === 'DELETE') {
            const user = requireManagerCsrf(request, session);
            const result = database.query('DELETE FROM announcements WHERE id = ?').run(decodeURIComponent(announcementMatch[1]));
            if (!result.changes) {
                throw new ApiError(404, 'The announcement was not found.');
            }
            recordAudit(database, user, 'announcement.delete', announcementMatch[1]);
            return json({ ok: true });
        }

        if (method === 'POST' && path === '/api/uploads') {
            const user = requireManagerCsrf(request, session);
            const contentLength = Number(request.headers.get('content-length') ?? 0);
            if (contentLength > 5 * 1024 * 1024 + 64 * 1024) {
                throw new ApiError(413, 'Images must be no larger than 5 MB.');
            }
            const form = await request.formData();
            const file = form.get('image');
            if (!(file instanceof File) || file.size === 0 || file.size > 5 * 1024 * 1024) {
                throw new ApiError(400, 'Choose an image no larger than 5 MB.');
            }
            const bytes = new Uint8Array(await file.arrayBuffer());
            const png = bytes.length >= 8 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 &&
                bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10;
            const jpeg = bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
            const webp = bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
                String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
            const extension = png ? '.png' : jpeg ? '.jpg' : webp ? '.webp' : '';
            if (!extension) {
                throw new ApiError(415, 'Upload a valid PNG, JPEG, or WebP image.');
            }
            mkdirSync(uploadDirectory, { recursive: true });
            const fileName = `${crypto.randomUUID()}${extension}`;
            await Bun.write(resolve(uploadDirectory, fileName), bytes);
            recordAudit(database, user, 'image.upload', fileName);
            return json({ imageUrl: `/uploads/${fileName}` }, 201);
        }

        const uploadMatch = path.match(/^\/api\/uploads\/([^/]+)$/);
        if (uploadMatch && method === 'DELETE') {
            const user = requireRole(session, ['admin']);
            requireCsrf(request, session);
            const imageUrl = `/uploads/${basename(decodeURIComponent(uploadMatch[1]))}`;
            const imagePath = uploadedImagePath(imageUrl, uploadDirectory);
            if (readProducts(database).some(product => product.imageUrl === imageUrl)) {
                throw new ApiError(409, 'Replace or remove this image from its product before deleting it.');
            }
            if (!(await Bun.file(imagePath).exists())) {
                throw new ApiError(404, 'The uploaded image was not found.');
            }
            await Bun.file(imagePath).delete();
            recordAudit(database, user, 'image.delete', basename(imagePath));
            return json({ ok: true });
        }

        if (method === 'GET' && path === '/api/audit') {
            requireRole(session, ['admin']);
            return json({ logs: database.query('SELECT actor_email AS actorEmail, action, detail, created_at AS createdAt FROM audit_logs ORDER BY id DESC LIMIT 200').all() });
        }

        throw new ApiError(404, 'Not found.');
    };

    const handler = async (request: Request) => {
        const path = new URL(request.url).pathname;
        if (path.startsWith('/api/')) {
            try {
                return await apiHandler(request);
            } catch (error) {
                if (error instanceof ApiError) {
                    return json({ error: error.message }, error.status);
                }
                console.error('Store API request failed.', error);
                return json({ error: 'The server could not complete this request.' }, 500);
            }
        }
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            return json({ error: 'Not found.' }, 404);
        }
        if (path === '/favicon.ico') {
            return new Response(null, { status: 204 });
        }
        let decodedPath: string;
        try {
            decodedPath = decodeURIComponent(path);
        } catch {
            return json({ error: 'The requested path is invalid.' }, 400);
        }
        const root = path.startsWith('/uploads/') ? resolve(uploadDirectory) : resolve('dist');
        const candidate = resolve(root, `.${decodedPath}`);
        if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) {
            return json({ error: 'The requested path is invalid.' }, 400);
        }
        const asset = Bun.file(candidate);
        if (await asset.exists()) {
            return new Response(request.method === 'HEAD' ? null : asset, {
                headers: {
                    'Content-Type': asset.type || 'application/octet-stream',
                    'X-Content-Type-Options': 'nosniff',
                    'Referrer-Policy': 'strict-origin-when-cross-origin',
                    'Cache-Control': path.startsWith('/uploads/') ? 'public, max-age=3600, immutable' : 'public, max-age=3600'
                }
            });
        }
        if (extname(path)) {
            return json({ error: 'The requested file was not found.' }, 404);
        }
        const index = Bun.file(resolve('dist', 'index.html'));
        if (await index.exists()) {
            return new Response(request.method === 'HEAD' ? null : index, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff' } });
        }
        return json({ error: 'The storefront build is missing. Run "bun run build" first.' }, 503);
    };

    return { handler, apiHandler };
};

export const bootstrapAdministrator = async (database: Database, emailInput: string, password: string) => {
    const email = validEmail(emailInput);
    validPassword(password, 16);
    const admin = database.query('SELECT id FROM users WHERE role = ? LIMIT 1').get('admin');
    if (admin) {
        return false;
    }
    const emailOwner = database.query('SELECT role FROM users WHERE email = ? COLLATE NOCASE').get(email) as { role: UserRole } | null;
    if (emailOwner) {
        throw new Error('The configured administrator email already belongs to a non-administrator account.');
    }
    const passwordHash = await Bun.password.hash(password, { algorithm: 'argon2id' });
    database.query('INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)').run(
        crypto.randomUUID(), email, passwordHash, 'admin'
    );
    database.query('INSERT INTO audit_logs (actor_email, action, detail) VALUES (?, ?, ?)').run(email, 'admin.bootstrap', 'Initial administrator created');
    return true;
};

export const openStoreDatabase = (filePath: string) => {
    mkdirSync(dirname(resolve(filePath)), { recursive: true });
    return new Database(filePath, { create: true });
};

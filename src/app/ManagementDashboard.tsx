import React, { useEffect, useState } from 'react';
import type { OrderStatus, Product, UserRole } from '../types';
import { apiRequest, type SessionUser } from './api';

interface ManagementDashboardProps {
    user: SessionUser;
    csrfToken: string;
    onClose: () => void;
    onStoreChange: () => void;
}

interface StoreOrder {
    id: string;
    email: string;
    total: number;
    status: OrderStatus;
    createdAt: string;
    items: Array<{ productId: string; name: string; price: number; quantity: number; size?: string }>;
}

interface ManagedUser {
    id: string;
    email: string;
    role: UserRole;
    createdAt: string;
}

interface StoreSettings {
    announcement: string;
    heroDescription: string;
    producerBio: string;
}

const dashboardTabs = ['Products', 'Orders', 'Store content'] as const;
type DashboardTab = typeof dashboardTabs[number] | 'Accounts' | 'Activity';
const statusOptions: Record<OrderStatus, OrderStatus[]> = {
    pending: ['processing', 'cancelled'],
    processing: ['shipped', 'cancelled'],
    shipped: ['completed'],
    completed: [],
    cancelled: []
};

const ManagementDashboard: React.FC<ManagementDashboardProps> = ({ user, csrfToken, onClose, onStoreChange }) => {
    const isAdmin = user.role === 'admin';
    const [tab, setTab] = useState<DashboardTab>('Products');
    const [products, setProducts] = useState<Product[]>([]);
    const [orders, setOrders] = useState<StoreOrder[]>([]);
    const [users, setUsers] = useState<ManagedUser[]>([]);
    const [logs, setLogs] = useState<Array<{ actorEmail: string; action: string; detail: string; createdAt: string }>>([]);
    const [settings, setSettings] = useState<StoreSettings | null>(null);
    const [announcements, setAnnouncements] = useState<Array<{ id: string; text: string }>>([]);
    const [drafts, setDrafts] = useState<Record<string, { name: string; description: string; price: string; imageUrl: string }>>({});
    const [inventory, setInventory] = useState<Record<string, string>>({});
    const [newProduct, setNewProduct] = useState({ name: '', description: '', price: '' });
    const [newUser, setNewUser] = useState({ email: '', password: '', role: 'manager' as UserRole });
    const [announcementText, setAnnouncementText] = useState('');
    const [uploadingId, setUploadingId] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);

    const reportError = (cause: unknown) => {
        const message = cause instanceof Error ? cause.message : 'The requested change could not be saved.';
        setError(message);
    };

    const loadProducts = async () => {
        const result = await apiRequest<{ products: Product[] }>('/api/products');
        setProducts(result.products);
        setDrafts(Object.fromEntries(result.products.map(product => [product.id, {
            name: product.name,
            description: product.description,
            price: String(product.price),
            imageUrl: product.imageUrl ?? ''
        }])));
        setInventory(Object.fromEntries(result.products.map(product => [product.id, product.stockQuantity == null ? '' : String(product.stockQuantity)])));
    };

    const loadTab = async () => {
        setError('');
        try {
            if (tab === 'Products') {
                await loadProducts();
            } else if (tab === 'Orders') {
                setOrders((await apiRequest<{ orders: StoreOrder[] }>('/api/orders')).orders);
            } else if (tab === 'Store content') {
                const content = await apiRequest<{ settings: StoreSettings; announcements: Array<{ id: string; text: string }> }>('/api/settings');
                setSettings(content.settings);
                setAnnouncements(content.announcements);
            } else if (tab === 'Accounts' && isAdmin) {
                setUsers((await apiRequest<{ users: ManagedUser[] }>('/api/users')).users);
            } else if (tab === 'Activity' && isAdmin) {
                setLogs((await apiRequest<{ logs: typeof logs }>('/api/audit')).logs);
            }
        } catch (cause) {
            reportError(cause);
        }
    };

    useEffect(() => {
        void loadTab();
    }, [tab, isAdmin]);

    const saveProduct = async (product: Product) => {
        const draft = drafts[product.id];
        if (!draft || !draft.name.trim() || !draft.description.trim() || !Number.isFinite(Number(draft.price)) || Number(draft.price) < 0) {
            setError('Enter a product name, description, and valid non-negative price.');
            return;
        }
        setBusy(true);
        setError('');
        try {
            await apiRequest(`/api/products/${encodeURIComponent(product.id)}`, {
                method: 'PATCH',
                body: JSON.stringify({ name: draft.name, description: draft.description, price: Number(draft.price), imageUrl: draft.imageUrl || null })
            }, csrfToken);
            setNotice(`${draft.name} saved.`);
            await loadProducts();
            onStoreChange();
        } catch (cause) {
            reportError(cause);
        } finally {
            setBusy(false);
        }
    };

    const uploadProductImage = async (productId: string, file?: File) => {
        if (!file) {
            return;
        }
        const form = new FormData();
        form.set('image', file);
        setUploadingId(productId);
        setError('');
        try {
            const result = await apiRequest<{ imageUrl: string }>('/api/uploads', { method: 'POST', body: form }, csrfToken);
            setDrafts(current => ({ ...current, [productId]: { ...current[productId], imageUrl: result.imageUrl } }));
            setNotice('Image uploaded. Save the product to publish it.');
        } catch (cause) {
            reportError(cause);
        } finally {
            setUploadingId(null);
        }
    };

    const saveInventory = async (productId: string) => {
        const quantity = Number(inventory[productId]);
        if (!Number.isInteger(quantity) || quantity < 0 || quantity > 1000000) {
            setError('Inventory must be a whole number from 0 to 1,000,000.');
            return;
        }
        setError('');
        try {
            await apiRequest(`/api/products/${encodeURIComponent(productId)}/inventory`, {
                method: 'PATCH',
                body: JSON.stringify({ quantity })
            }, csrfToken);
            setNotice('Inventory updated.');
            await loadProducts();
        } catch (cause) {
            reportError(cause);
        }
    };

    const addProduct = async (event: React.FormEvent) => {
        event.preventDefault();
        setError('');
        try {
            await apiRequest('/api/products', {
                method: 'POST',
                body: JSON.stringify({ ...newProduct, price: Number(newProduct.price) })
            }, csrfToken);
            setNewProduct({ name: '', description: '', price: '' });
            setNotice('Product added.');
            await loadProducts();
            onStoreChange();
        } catch (cause) {
            reportError(cause);
        }
    };

    const deleteProduct = async (product: Product) => {
        if (!window.confirm(`Delete ${product.name}? This cannot be undone.`)) {
            return;
        }
        try {
            await apiRequest(`/api/products/${encodeURIComponent(product.id)}`, { method: 'DELETE' }, csrfToken);
            setNotice(`${product.name} deleted.`);
            await loadProducts();
            onStoreChange();
        } catch (cause) {
            reportError(cause);
        }
    };

    const deleteUploadedImage = async (product: Product, imageUrl: string) => {
        const fileName = imageUrl.split('/').pop();
        if (!isAdmin || !fileName || !window.confirm('Remove this image from the product and permanently delete the uploaded file?')) {
            return;
        }
        setError('');
        try {
            if (product.imageUrl === imageUrl) {
                await apiRequest(`/api/products/${encodeURIComponent(product.id)}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ imageUrl: null })
                }, csrfToken);
            }
            await apiRequest(`/api/uploads/${encodeURIComponent(fileName)}`, { method: 'DELETE' }, csrfToken);
            setNotice('Uploaded image deleted.');
            await loadProducts();
            onStoreChange();
        } catch (cause) {
            reportError(cause);
        }
    };

    const changeOrderStatus = async (order: StoreOrder, status: OrderStatus) => {
        try {
            await apiRequest(`/api/orders/${encodeURIComponent(order.id)}`, {
                method: 'PATCH',
                body: JSON.stringify({ status })
            }, csrfToken);
            setNotice(`Order status changed to ${status}.`);
            await loadTab();
        } catch (cause) {
            reportError(cause);
        }
    };

    const saveSettings = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!settings) {
            return;
        }
        try {
            await apiRequest('/api/settings', { method: 'PATCH', body: JSON.stringify(settings) }, csrfToken);
            setNotice('Store content saved.');
            onStoreChange();
        } catch (cause) {
            reportError(cause);
        }
    };

    const addAnnouncement = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!announcementText.trim()) {
            setError('Enter announcement text before publishing.');
            return;
        }
        try {
            await apiRequest('/api/announcements', { method: 'POST', body: JSON.stringify({ text: announcementText }) }, csrfToken);
            setAnnouncementText('');
            await loadTab();
            setNotice('Announcement published.');
            onStoreChange();
        } catch (cause) {
            reportError(cause);
        }
    };

    const deleteAnnouncement = async (id: string) => {
        try {
            await apiRequest(`/api/announcements/${encodeURIComponent(id)}`, { method: 'DELETE' }, csrfToken);
            await loadTab();
            setNotice('Announcement removed.');
            onStoreChange();
        } catch (cause) {
            reportError(cause);
        }
    };

    const createUser = async (event: React.FormEvent) => {
        event.preventDefault();
        try {
            await apiRequest('/api/users', { method: 'POST', body: JSON.stringify(newUser) }, csrfToken);
            setNewUser({ email: '', password: '', role: 'manager' });
            setNotice('Account created.');
            await loadTab();
        } catch (cause) {
            reportError(cause);
        }
    };

    const updateUserRole = async (target: ManagedUser, role: UserRole) => {
        try {
            await apiRequest(`/api/users/${encodeURIComponent(target.id)}`, { method: 'PATCH', body: JSON.stringify({ role }) }, csrfToken);
            setNotice(`Updated ${target.email}'s role.`);
            await loadTab();
        } catch (cause) {
            reportError(cause);
        }
    };

    const deleteUser = async (target: ManagedUser) => {
        if (!window.confirm(`Delete the account for ${target.email}?`)) {
            return;
        }
        try {
            await apiRequest(`/api/users/${encodeURIComponent(target.id)}`, { method: 'DELETE' }, csrfToken);
            setNotice('Account deleted.');
            await loadTab();
        } catch (cause) {
            reportError(cause);
        }
    };

    return (
        <div className="account-backdrop" onClick={onClose}>
            <section className="management-panel" role="dialog" aria-modal="true" aria-labelledby="management-title" onClick={event => event.stopPropagation()}>
                <header className="management-heading">
                    <div>
                        <p className="eyebrow">{user.role.toUpperCase()} WORKSPACE · {user.email}</p>
                        <h2 id="management-title">Store management</h2>
                    </div>
                    <button className="icon-button" aria-label="Close store management" onClick={onClose}>×</button>
                </header>
                <nav className="management-tabs" aria-label="Management sections">
                    {[...dashboardTabs, ...(isAdmin ? ['Accounts', 'Activity'] as const : [])].map(item => (
                        <button key={item} className={tab === item ? 'is-active' : ''} aria-pressed={tab === item} onClick={() => { setTab(item); setNotice(''); }}>
                            {item}
                        </button>
                    ))}
                </nav>
                {error && <p className="management-message management-message--error" role="alert">{error}</p>}
                {notice && <p className="management-message" role="status">{notice}</p>}

                {tab === 'Products' && (
                    <div className="management-content">
                        {isAdmin && (
                            <form className="management-form management-create-product" onSubmit={event => void addProduct(event)}>
                                <h3>Add a product</h3>
                                <label>Product name<input required maxLength={120} value={newProduct.name} onChange={event => setNewProduct({ ...newProduct, name: event.target.value })} /></label>
                                <label>Description<textarea required maxLength={4000} value={newProduct.description} onChange={event => setNewProduct({ ...newProduct, description: event.target.value })} /></label>
                                <label>Price<input required type="number" min="0" step="0.01" value={newProduct.price} onChange={event => setNewProduct({ ...newProduct, price: event.target.value })} /></label>
                                <button className="button button-dark" type="submit">ADD PRODUCT</button>
                            </form>
                        )}
                        {products.map(product => {
                            const draft = drafts[product.id] ?? { name: product.name, description: product.description, price: String(product.price), imageUrl: product.imageUrl ?? '' };
                            return (
                                <article className="managed-product" key={product.id}>
                                    <form className="management-form" onSubmit={event => { event.preventDefault(); void saveProduct(product); }}>
                                        <div className="managed-product-title"><h3>{product.name}</h3><span>{product.category} · {product.subcategory}</span></div>
                                        <label>Product name<input maxLength={120} value={draft.name} onChange={event => setDrafts({ ...drafts, [product.id]: { ...draft, name: event.target.value } })} /></label>
                                        <label>Description<textarea maxLength={4000} value={draft.description} onChange={event => setDrafts({ ...drafts, [product.id]: { ...draft, description: event.target.value } })} /></label>
                                        <label>Price<input type="number" min="0" step="0.01" value={draft.price} onChange={event => setDrafts({ ...drafts, [product.id]: { ...draft, price: event.target.value } })} /></label>
                                        <label>Product image (PNG, JPEG, WebP; up to 5 MB)
                                            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => void uploadProductImage(product.id, event.target.files?.[0])} />
                                        </label>
                                        {draft.imageUrl && <img className="managed-product-preview" src={draft.imageUrl} alt={`Current image for ${draft.name}`} />}
                                        <div className="management-actions">
                                            <button className="button button-dark" type="submit" disabled={busy || uploadingId === product.id}>SAVE PRODUCT</button>
                                            {isAdmin && draft.imageUrl.startsWith('/uploads/') && (
                                                <button className="management-delete" type="button" onClick={() => void deleteUploadedImage(product, draft.imageUrl)}>DELETE UPLOADED IMAGE</button>
                                            )}
                                            {isAdmin && <button className="management-delete" type="button" onClick={() => void deleteProduct(product)}>Delete product</button>}
                                        </div>
                                    </form>
                                    <form className="inventory-form" onSubmit={event => { event.preventDefault(); void saveInventory(product.id); }}>
                                        <label>Inventory quantity
                                            <input type="number" min="0" max="1000000" step="1" placeholder="Not tracked" value={inventory[product.id] ?? ''} onChange={event => setInventory({ ...inventory, [product.id]: event.target.value })} />
                                        </label>
                                        <button type="submit">UPDATE INVENTORY</button>
                                    </form>
                                </article>
                            );
                        })}
                    </div>
                )}

                {tab === 'Orders' && (
                    <div className="management-content">
                        {orders.length === 0 && <p>No orders yet. New orders are unpaid demo requests until a payment provider is connected.</p>}
                        {orders.map(order => (
                            <article className="managed-order" key={order.id}>
                                <div><h3>Order {order.id.slice(0, 8)}</h3><p>{order.email} · {new Date(order.createdAt).toLocaleString()}</p></div>
                                <ul>{order.items.map((item, index) => <li key={`${item.productId}-${item.size ?? 'one-size'}-${index}`}>{item.quantity} × {item.name}{item.size ? ` · ${item.size}` : ''} — ${(item.price * item.quantity).toFixed(2)}</li>)}</ul>
                                <strong>${order.total.toFixed(2)} · {order.status.toUpperCase()}</strong>
                                {statusOptions[order.status].length > 0 && (
                                    <label>Update order status
                                        <select value="" onChange={event => { if (event.target.value) void changeOrderStatus(order, event.target.value as OrderStatus); }}>
                                            <option value="" disabled>Choose next status</option>
                                            {statusOptions[order.status].map(status => <option key={status} value={status}>{status}</option>)}
                                        </select>
                                    </label>
                                )}
                            </article>
                        ))}
                    </div>
                )}

                {tab === 'Store content' && (
                    <div className="management-content">
                        {settings && (
                            <form className="management-form" onSubmit={event => void saveSettings(event)}>
                                <label>Store announcement<input maxLength={3000} value={settings.announcement} onChange={event => setSettings({ ...settings, announcement: event.target.value })} /></label>
                                <label>Store introduction<textarea maxLength={3000} value={settings.heroDescription} onChange={event => setSettings({ ...settings, heroDescription: event.target.value })} /></label>
                                <label>Producer story<textarea maxLength={3000} value={settings.producerBio} onChange={event => setSettings({ ...settings, producerBio: event.target.value })} /></label>
                                <button className="button button-dark" type="submit">SAVE STORE CONTENT</button>
                            </form>
                        )}
                        <form className="management-form" onSubmit={event => void addAnnouncement(event)}>
                            <h3>Publish an announcement</h3>
                            <label>Announcement text<input maxLength={500} value={announcementText} onChange={event => setAnnouncementText(event.target.value)} /></label>
                            <button className="button button-dark" type="submit">PUBLISH</button>
                        </form>
                        {announcements.map(announcement => <div className="managed-announcement" key={announcement.id}>
                            <p>{announcement.text}</p>
                            <button className="management-delete" onClick={() => void deleteAnnouncement(announcement.id)}>Remove announcement</button>
                        </div>)}
                    </div>
                )}

                {tab === 'Accounts' && isAdmin && (
                    <div className="management-content">
                        <form className="management-form" onSubmit={event => void createUser(event)}>
                            <h3>Create an account</h3>
                            <label>Email<input required type="email" maxLength={254} value={newUser.email} onChange={event => setNewUser({ ...newUser, email: event.target.value })} /></label>
                            <label>Temporary password (at least 12 characters)<input required type="password" minLength={12} autoComplete="new-password" value={newUser.password} onChange={event => setNewUser({ ...newUser, password: event.target.value })} /></label>
                            <label>Role<select value={newUser.role} onChange={event => setNewUser({ ...newUser, role: event.target.value as UserRole })}><option value="manager">Manager</option><option value="customer">Customer</option><option value="admin">Admin</option></select></label>
                            <button className="button button-dark" type="submit">CREATE ACCOUNT</button>
                        </form>
                        {users.map(target => <article className="managed-user" key={target.id}>
                            <span>{target.email}</span>
                            <select aria-label={`Role for ${target.email}`} value={target.role} onChange={event => void updateUserRole(target, event.target.value as UserRole)}>
                                <option value="admin">Admin</option><option value="manager">Manager</option><option value="customer">Customer</option>
                            </select>
                            <button className="management-delete" onClick={() => void deleteUser(target)}>Delete account</button>
                        </article>)}
                    </div>
                )}

                {tab === 'Activity' && isAdmin && (
                    <div className="management-content">
                        <h3>Latest administrative activity</h3>
                        {logs.map((log, index) => <article className="managed-audit" key={`${log.createdAt}-${index}`}>
                            <strong>{log.action}</strong><span>{log.actorEmail} · {log.createdAt}</span><p>{log.detail}</p>
                        </article>)}
                    </div>
                )}
            </section>
        </div>
    );
};

export default ManagementDashboard;

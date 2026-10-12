import React, { useCallback, useEffect, useRef, useState } from 'react';
import { products } from '../data/products';
import type { Product, ProductAudience, ProductCategory, ProductSubcategory } from '../types';
import AccountCenter from '../components/AccountCenter';
import Footer from '../components/Footer';
import Header from '../components/Header';
import LionMark from '../components/LionMark';
import ProductCard from '../components/ProductCard';
import ProductArtwork from '../components/ProductArtwork';
import { apiRequest, type SessionUser } from './api';
import './store.css';

type Category = ProductCategory | 'Everything';
type Audience = ProductAudience | 'All';

const audiences = ['All', 'Men', 'Women', 'Kids'] as const satisfies readonly Audience[];
const categories = ['Everything', 'Cologne', 'Tops', 'Bottoms', 'Outerwear', 'Shoes', 'Outfits'] as const satisfies readonly Category[];
const garmentSubcategories: Partial<Record<ProductCategory, readonly ProductSubcategory[]>> = {
    Tops: ['T-Shirts', 'Tanks', 'V-Necks', 'Crewnecks', 'Lightweight Hoodies', 'Heavyweight Hoodies'],
    Bottoms: ['Shorts', 'Sweatpants'],
    Outerwear: ['Jackets'],
    Shoes: ['High-Tops', 'Low-Tops'],
    Outfits: ['Outfit']
};
const cartLineKey = (product: Product, size?: string) => `${product.id}:${size ?? 'one-size'}`;

const HomePage: React.FC = () => {
    const [catalog, setCatalog] = useState(products);
    const [storeSettings, setStoreSettings] = useState({
        announcement: 'THE OFFICIAL ST. LOU-A-VILLE SLIM STORE',
        heroDescription: 'Step inside the world of St. Lou-a-ville Slim. Independent sound, signature cologne, and streetwear built to move with you.',
        producerBio: 'Louisville music producer St. Lou-a-ville Slim brings the sound from the studio to the street. With his own point of view, Slim built this collection around independent energy, a signature scent, and everyday essentials that make an entrance.'
    });
    const [announcements, setAnnouncements] = useState<Array<{ id: string; text: string }>>([]);
    const [user, setUser] = useState<SessionUser | null>(null);
    const [csrfToken, setCsrfToken] = useState('');
    const [accountOpen, setAccountOpen] = useState(false);
    const [backendError, setBackendError] = useState('');
    const [activeAudience, setActiveAudience] = useState<Audience>('All');
    const [activeCategory, setActiveCategory] = useState<Category>('Everything');
    const [activeSubcategory, setActiveSubcategory] = useState<ProductSubcategory | null>(null);
    const [cart, setCart] = useState<Record<string, number>>({});
    const [cartOpen, setCartOpen] = useState(false);
    const [checkoutMessage, setCheckoutMessage] = useState('');
    const cartPanelRef = useRef<HTMLElement>(null);
    const cartReturnFocusRef = useRef<HTMLElement | null>(null);

    const signatureScent = catalog.find(product => product.id === 'signature-scent');
    const visibleProducts = catalog.filter(product =>
        (activeCategory === 'Everything' || product.category === activeCategory)
        && (activeAudience === 'All' || product.audiences.includes(activeAudience))
        && (!activeSubcategory || product.subcategory === activeSubcategory)
    );
    const activeSubcategories = activeCategory === 'Everything' ? undefined : garmentSubcategories[activeCategory];
    const cartProducts = Object.entries(cart).map(([lineId, quantity]) => {
        const separator = lineId.lastIndexOf(':');
        const productId = lineId.slice(0, separator);
        const size = lineId.slice(separator + 1);
        const product = catalog.find(item => item.id === productId);

        if (!product) {
            throw new Error(`Shopping bag references unknown product "${productId}".`);
        }

        return { lineId, product, size: size === 'one-size' ? undefined : size, quantity };
    });
    const cartCount = cartProducts.reduce((total, line) => total + line.quantity, 0);
    const subtotal = cartProducts.reduce((total, line) => total + line.product.price * line.quantity, 0);

    const refreshStore = useCallback(async () => {
        try {
            const result = await apiRequest<{ products: Product[]; settings: typeof storeSettings; announcements: Array<{ id: string; text: string }> }>('/api/store');
            setCatalog(result.products);
            setStoreSettings(result.settings);
            setAnnouncements(result.announcements);
            const productIds = new Set(result.products.map(product => product.id));
            setCart(current => Object.fromEntries(Object.entries(current).filter(([lineId]) => productIds.has(lineId.slice(0, lineId.lastIndexOf(':'))))));
            setBackendError('');
        } catch (cause) {
            const message = cause instanceof Error ? cause.message : 'The storefront service could not be reached.';
            setBackendError(message);
            console.error('Could not load the current storefront catalog.', cause);
        }
    }, []);

    useEffect(() => {
        let active = true;
        void Promise.all([
            apiRequest<{ user: SessionUser | null; csrfToken: string }>('/api/session'),
            apiRequest<{ products: Product[]; settings: typeof storeSettings; announcements: Array<{ id: string; text: string }> }>('/api/store')
        ]).then(([session, store]) => {
            if (!active) {
                return;
            }
            setUser(session.user);
            setCsrfToken(session.csrfToken);
            setCatalog(store.products);
            setStoreSettings(store.settings);
            setAnnouncements(store.announcements);
            setBackendError('');
        }).catch(cause => {
            if (!active) {
                return;
            }
            const message = cause instanceof Error ? cause.message : 'The storefront service could not be reached.';
            setBackendError(message);
            console.error('Could not initialize the storefront session.', cause);
        });
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        if (!cartOpen) {
            return;
        }

        const previouslyFocused = cartReturnFocusRef.current;
        const previousOverflow = document.body.style.overflow;
        const cartPanel = cartPanelRef.current;

        cartPanel?.querySelector<HTMLButtonElement>('.close-cart')?.focus();
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setCartOpen(false);
                return;
            }

            if (event.key !== 'Tab' || !cartPanel) {
                return;
            }

            const focusableElements = cartPanel.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
            );
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (!firstElement || !lastElement) {
                return;
            }

            if (event.shiftKey && (document.activeElement === firstElement || !cartPanel.contains(document.activeElement))) {
                event.preventDefault();
                lastElement.focus();
            } else if (!event.shiftKey && (document.activeElement === lastElement || !cartPanel.contains(document.activeElement))) {
                event.preventDefault();
                firstElement.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = previousOverflow;

            if (previouslyFocused?.isConnected) {
                previouslyFocused.focus();
            }

            cartReturnFocusRef.current = null;
        };
    }, [cartOpen]);

    const changeQuantity = (product: Product, change: number, size?: string) => {
        const lineId = cartLineKey(product, size);

        setCart(current => {
            const nextQuantity = (current[lineId] || 0) + change;
            const next = { ...current };
            if (nextQuantity <= 0) {
                delete next[lineId];
            } else {
                next[lineId] = nextQuantity;
            }
            return next;
        });
    };

    const openCart = (trigger: HTMLElement) => {
        cartReturnFocusRef.current = trigger;
        setCartOpen(true);
    };

    const addToCart = (product: Product, trigger: HTMLElement, size?: string) => {
        const inCart = cartProducts.filter(line => line.product.id === product.id).reduce((total, line) => total + line.quantity, 0);
        if (product.stockQuantity != null && inCart >= product.stockQuantity) {
            setCheckoutMessage(`Only ${product.stockQuantity} ${product.name} item${product.stockQuantity === 1 ? '' : 's'} are currently available.`);
            return;
        }
        changeQuantity(product, 1, size);
        setCheckoutMessage('');
        openCart(trigger);
    };

    const submitCheckout = async () => {
        setCheckoutMessage('');
        if (!user || user.role !== 'customer') {
            setCheckoutMessage(user
                ? 'Checkout is available to customer accounts. Sign out and use a customer account.'
                : 'Sign in or create a customer account to submit an order.');
            setAccountOpen(true);
            return;
        }
        if (!csrfToken || !cartProducts.length) {
            setCheckoutMessage('Your session or shopping bag is not ready. Refresh and try again.');
            return;
        }
        try {
            const result = await apiRequest<{ order: { id: string } }>('/api/orders', {
                method: 'POST',
                body: JSON.stringify({
                    items: cartProducts.map(line => ({
                        productId: line.product.id,
                        quantity: line.quantity,
                        ...(line.size ? { size: line.size } : {})
                    }))
                })
            }, csrfToken);
            setCart({});
            setCheckoutMessage(`Order ${result.order.id.slice(0, 8)} submitted as an unpaid demo order. No payment was collected.`);
            await refreshStore();
        } catch (cause) {
            setCheckoutMessage(cause instanceof Error ? cause.message : 'Your order could not be submitted.');
        }
    };

    return (
        <div className="store">
            <div className="announcement"><span className="announcement-mark" aria-hidden="true">✦</span> {storeSettings.announcement || 'THE OFFICIAL ST. LOU-A-VILLE SLIM STORE'} <span className="announcement-divider" aria-hidden="true">/</span> FREE SHIPPING ON ORDERS OVER $100</div>
            <Header
                cartCount={cartCount}
                onCartClick={openCart}
                accountLabel={user?.role === 'admin' ? 'Admin' : user?.role === 'manager' ? 'Manage' : user ? 'Account' : 'Sign in'}
                onAccountClick={() => setAccountOpen(true)}
            />

            {backendError && <div className="service-alert" role="alert">Store service unavailable: {backendError}. Account, inventory, and checkout features are offline.</div>}

            <main>
                <section className="hero" id="home">
                    <div className="hero-copy">
                        <p className="eyebrow"><span className="eyebrow-dot" /> MUSIC PRODUCER · LOUISVILLE, KY</p>
                        <h1>The sound.<br />The scent.<br /><span>The statement.</span></h1>
                        <p className="hero-description">{storeSettings.heroDescription}</p>
                        <a className="button button-dark" href="#shop">SHOP THE COLLECTION <span aria-hidden="true">↗</span></a>
                        <p className="hero-note"><span aria-hidden="true">✦</span> LOUISVILLE-BORN. MADE TO BE HEARD.</p>
                    </div>
                    <div className="hero-art" role="img" aria-label="ST. LOU-A-VILLE SLIM lion logo artwork">
                        <div className="hero-lion-mark">
                            <LionMark className="hero-lion" decorative />
                        </div>
                        <div className="hero-caption">MADE OF MUSIC. WORN WITH INTENTION.</div>
                    </div>
                    <div className="hero-side-note">INDEPENDENT SOUND · DISTINCTIVE STYLE</div>
                </section>

                <section className="ticker" aria-label="Shop highlights">
                    <div>LOUISVILLE MADE <span>✦</span> MUSIC PRODUCER <span>✦</span> SIGNATURE COLOGNE <span>✦</span> BLACK · SILVER · GOLD <span>✦</span> LOUISVILLE MADE <span>✦</span> MUSIC PRODUCER <span>✦</span> SIGNATURE COLOGNE <span>✦</span> BLACK · SILVER · GOLD</div>
                </section>

                {signatureScent && <section className="signature-scent" aria-labelledby="signature-scent-title">
                    <div className="scent-bottle-frame">
                        <div className="scent-glow" aria-hidden="true" />
                        <ProductArtwork product={signatureScent} />
                        <span className="scent-seal">502<br />ORIGINAL</span>
                    </div>
                    <div className="scent-story">
                        <p className="eyebrow">INTRODUCING THE SIGNATURE</p>
                        <h2 id="signature-scent-title">A scent that<br /><span>stays in the room.</span></h2>
                        <p>Meet the original ST. LOU-A-VILLE SLIM cologne. The bottle from the brand, brought to life with a slow, considered movement—made for the studio, the stage, and everything after.</p>
                        <div className="scent-details"><span>THE SIGNATURE</span><span>LOUISVILLE, KY · 502</span></div>
                        <button className="button button-dark scent-cta" disabled={signatureScent.stockQuantity === 0} onClick={event => addToCart(signatureScent, event.currentTarget)}>
                            ADD SIGNATURE SCENT · ${signatureScent.price.toFixed(2)} <span aria-hidden="true">↗</span>
                        </button>
                    </div>
                </section>}

                <section className="shop-section" id="shop">
                    <div className="section-heading">
                        <div>
                            <p className="eyebrow">THE OFFICIAL COLLECTION</p>
                            <h2>Sound good.<br /><span>Look the part.</span></h2>
                        </div>
                        <p className="section-aside">Shop men’s, women’s, and kids’ styles, model looks, fresh kicks, and outfit bundles for less. Model photos are styling inspiration; product cards list the exact pieces and sizes.</p>
                    </div>

                    <div className="shop-toolbar">
                        <div className="filter-groups">
                            <div className="category-list department-list" role="group" aria-label="Shop by department">
                                {audiences.map(audience => (
                                    <button
                                        className={`category-button${activeAudience === audience ? ' is-active' : ''}`}
                                        key={audience}
                                        onClick={() => {
                                            setActiveAudience(audience);
                                            setActiveSubcategory(null);
                                        }}
                                        aria-pressed={activeAudience === audience}
                                    >
                                        {audience === 'All' ? 'All Departments' : audience}
                                    </button>
                                ))}
                            </div>
                            <div className="category-list" role="group" aria-label="Filter products by category">
                                {categories.map(category => (
                                    <button
                                        className={`category-button${activeCategory === category ? ' is-active' : ''}`}
                                        key={category}
                                        onClick={() => {
                                            setActiveCategory(category);
                                            setActiveSubcategory(null);
                                        }}
                                        aria-pressed={activeCategory === category}
                                    >
                                        {category}
                                    </button>
                                ))}
                            </div>
                            {activeSubcategories && (
                                <div className="subcategory-list" role="group" aria-label={`${activeCategory} garment styles`}>
                                    <button
                                        className={`subcategory-button${activeSubcategory === null ? ' is-active' : ''}`}
                                        onClick={() => setActiveSubcategory(null)}
                                        aria-pressed={activeSubcategory === null}
                                    >
                                        All {activeCategory}
                                    </button>
                                    {activeSubcategories.map(subcategory => (
                                        <button
                                            className={`subcategory-button${activeSubcategory === subcategory ? ' is-active' : ''}`}
                                            key={subcategory}
                                            onClick={() => setActiveSubcategory(subcategory)}
                                            aria-pressed={activeSubcategory === subcategory}
                                        >
                                            {subcategory}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <span className="product-count">{visibleProducts.length} {visibleProducts.length === 1 ? 'PIECE' : 'PIECES'} IN THE COLLECTION</span>
                    </div>

                    <div className="product-grid">
                        {visibleProducts.map((product, index) => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                index={index}
                                canAddToCart={product.availableForSale !== false && (product.stockQuantity == null || cartProducts.filter(line => line.product.id === product.id).reduce((total, line) => total + line.quantity, 0) < product.stockQuantity)}
                                onAddToCart={addToCart}
                            />
                        ))}
                    </div>
                </section>

                <section className="artist-note" id="about">
                    <div className="artist-image" role="img" aria-label="St. Lou-a-ville Slim recording music in his studio" />
                    <div className="artist-copy">
                        <p className="eyebrow">MEET THE PRODUCER</p>
                        <h2>From the 502.<br />Made to <span>move you.</span></h2>
                        <p>{storeSettings.producerBio}</p>
                        <a className="text-link" href="#shop">STEP INTO SLIM'S WORLD <span aria-hidden="true">↗</span></a>
                        <span className="artist-doodle" aria-hidden="true">THE SOUND<br />OF THE CITY</span>
                    </div>
                </section>

                {announcements.length > 0 && <section className="store-announcements" aria-label="Store announcements">
                    {announcements.map(announcement => <p key={announcement.id}><span aria-hidden="true">✦</span> {announcement.text}</p>)}
                </section>}

                <section className="newsletter" id="newsletter">
                    <div className="newsletter-spark" aria-hidden="true">✳</div>
                    <p className="eyebrow">BEATS, DROPS &amp; EVERYTHING SLIM</p>
                    <h2>Stay in <span>the mix.</span></h2>
                    <p>New releases, exclusive merch drops, and a closer look at what’s happening in the studio.</p>
                    <a className="button button-dark newsletter-cta" href="#shop">SHOP THE COLLECTION <span aria-hidden="true">↗</span></a>
                    <span className="newsletter-footnote">LOUISVILLE, KENTUCKY · INDEPENDENT BY NATURE</span>
                </section>
            </main>

            <Footer />

            {cartOpen && (
                <div className="cart-backdrop" onClick={() => setCartOpen(false)}>
                    <aside
                        ref={cartPanelRef}
                        className="cart-panel"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="cart-title"
                        onClick={event => event.stopPropagation()}
                    >
                        <div className="cart-heading">
                            <div>
                                <p className="eyebrow">ST. LOU-A-VILLE SLIM OFFICIAL STORE</p>
                                <h2 id="cart-title">Your bag <span>({cartCount})</span></h2>
                            </div>
                            <button className="icon-button close-cart" aria-label="Close cart" onClick={() => setCartOpen(false)}>×</button>
                        </div>
                        {cartProducts.length === 0 ? (
                            <div className="empty-cart">
                                <span aria-hidden="true">✳</span>
                                <p>Your bag is empty.</p>
                                <button className="text-link" onClick={() => setCartOpen(false)}>SHOP THE COLLECTION ↗</button>
                            </div>
                        ) : (
                            <>
                                <div className="cart-items">
                                    {cartProducts.map(({ lineId, product, size, quantity }) => (
                                        <div className="cart-item" key={lineId}>
                                            <div className="cart-item-art">
                                                <ProductArtwork product={product} />
                                            </div>
                                            <div className="cart-item-info">
                                                <h3>{product.name}</h3>
                                                {size && <p className="cart-item-size">Size: {size}</p>}
                                                <p>${product.price.toFixed(2)}</p>
                                                <div className="quantity-control" aria-label={`Quantity of ${product.name}${size ? ` size ${size}` : ''}`}>
                                                    <button aria-label={`Remove one ${product.name}`} onClick={() => changeQuantity(product, -1, size)}>−</button>
                                                    <span>{quantity}</span>
                                                    <button aria-label={`Add one ${product.name}`} disabled={product.stockQuantity != null && cartProducts.filter(item => item.product.id === product.id).reduce((total, item) => total + item.quantity, 0) >= product.stockQuantity} onClick={() => changeQuantity(product, 1, size)}>+</button>
                                                </div>
                                            </div>
                                            <button className="remove-item" onClick={() => setCart(current => {
                                                const next = { ...current };
                                                delete next[lineId];
                                                return next;
                                            })} aria-label={`Remove ${product.name} from cart`}>×</button>
                                        </div>
                                    ))}
                                </div>
                                <div className="cart-summary">
                                    <p className="shipping-note">{subtotal >= 100 ? 'You unlocked free shipping! ✦' : `$${(100 - subtotal).toFixed(2)} away from free shipping ✦`}</p>
                                    <div className="shipping-progress"><span style={{ width: `${Math.min((subtotal / 100) * 100, 100)}%` }} /></div>
                                    <div className="subtotal"><span>Subtotal</span><strong>${subtotal.toFixed(2)}</strong></div>
                                    <p className="tax-note">Shipping and taxes calculated at checkout.</p>
                                    <p className="tax-note">Demo orders are unpaid. No payment details are collected or charged.</p>
                                    <button className="button button-dark checkout-button" onClick={() => void submitCheckout()}>Submit demo order <span aria-hidden="true">↗</span></button>
                                    {checkoutMessage && <p className="checkout-note" role="status">{checkoutMessage}</p>}
                                    <button className="continue-shopping" onClick={() => setCartOpen(false)}>CONTINUE SHOPPING</button>
                                </div>
                            </>
                        )}
                    </aside>
                </div>
            )}

            <AccountCenter
                open={accountOpen}
                user={user}
                csrfToken={csrfToken}
                onClose={() => setAccountOpen(false)}
                onAuthChange={(nextUser, nextCsrf) => {
                    setUser(nextUser);
                    setCsrfToken(nextCsrf);
                    setBackendError('');
                }}
                onStoreChange={() => void refreshStore()}
            />
        </div>
    );
};

export default HomePage;

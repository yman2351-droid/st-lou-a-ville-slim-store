import React, { useState } from 'react';
import type { Product } from '../types';
import ProductArtwork from './ProductArtwork';

interface ProductCardProps {
    product: Product;
    index: number;
    canAddToCart: boolean;
    onAddToCart: (product: Product, trigger: HTMLElement, size?: string) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, index, canAddToCart, onAddToCart }) => {
    const defaultSize = product.sizes?.includes('M') ? 'M' : product.sizes?.[Math.floor((product.sizes?.length ?? 0) / 2)] ?? '';
    const [selectedSize, setSelectedSize] = useState(defaultSize);
    const sizeLabel = product.category === 'Shoes' ? 'US shoe size' : product.audiences.includes('Kids') ? 'Kids size' : 'Apparel size';
    const saleSavings = product.originalPrice ? product.originalPrice - product.price : 0;
    const hasLifestylePreview = product.imageUrl && product.category !== 'Cologne';

    return (
        <article className={`product-card${product.category === 'Outfits' ? ' product-card--bundle' : ''}`} style={{ animationDelay: `${index * 55}ms` }}>
            <div className={`product-art ${product.category === 'Cologne' ? 'product-art--scent' : 'product-art--apparel'}${hasLifestylePreview ? ' product-art--lifestyle' : ''}`}>
                <ProductArtwork product={product} />
                {product.badge && <span className="product-badge">{product.badge}</span>}
                {saleSavings > 0 && <span className="product-savings">SAVE ${saleSavings}</span>}
                <button className="quick-add" disabled={!canAddToCart} onClick={event => onAddToCart(product, event.currentTarget, selectedSize || undefined)} aria-label={`Add ${product.name} to bag`}>
                    <span aria-hidden="true">+</span> {canAddToCart ? 'Add to bag' : 'Stock limit reached'}
                </button>
            </div>
            <div className="product-info">
                <div>
                    <p className="product-category">{product.category === 'Cologne' ? product.category : `${product.subcategory === 'Outfit' ? 'BUNDLED OUTFIT' : product.subcategory} · ${product.garmentColor ?? (product.category === 'Outfits' ? 'Mixed' : product.category === 'Shoes' ? 'Black / Silver / Gold' : 'Black')}`}</p>
                    <h3>{product.name}</h3>
                    <p className="product-description">{product.description}</p>
                </div>
                <div className="product-purchase">
                    {product.sizes && (
                        <label className="size-picker">
                            <span>{sizeLabel}</span>
                            <select aria-label={`Choose ${sizeLabel.toLowerCase()} for ${product.name}`} value={selectedSize} onChange={event => setSelectedSize(event.target.value)}>
                                {product.sizes.map(size => <option key={size} value={size}>{size}</option>)}
                            </select>
                        </label>
                    )}
                    <div className="product-price">
                        {product.originalPrice && <span className="product-original-price">${product.originalPrice.toFixed(2)}</span>}
                        <span>${product.price.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        </article>
    );
};

export default ProductCard;

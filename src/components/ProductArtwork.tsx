import React from 'react';
import type { Product, ProductSubcategory } from '../types';
import { BRAND_LION_MARK_IMAGE } from './brandAssets';
import LionMark from './LionMark';

interface ProductArtworkProps {
    product: Product;
}

const garmentFills = {
    black: { main: '#17191d', shadow: '#090a0c', detail: '#33373e' },
    charcoal: { main: '#41444a', shadow: '#24262b', detail: '#5b5f67' },
    silver: { main: '#c3c7cd', shadow: '#858b94', detail: '#e6e8eb' },
    gold: { main: '#b98a43', shadow: '#765124', detail: '#e2bd77' },
    bone: { main: '#e7e1d4', shadow: '#bcb4a5', detail: '#faf7ef' }
} as const;

const garmentShapes = {
    'T-Shirts': (
        <path d="m223 135 38-17h78l38 17 62 38-38 82-48-24v300H209V231l-48 24-38-82 62-38 38-17Z" />
    ),
    Tanks: (
        <>
            <path d="m241 123 25 23h68l25-23 38 17 32 75-52 25-24-36v335H222V204l-24 36-52-25 32-75 38-17 25 23Z" />
            <path d="m243 125 31 29 31-29-16-10h-30l-16 10Z" fill="#111214" opacity=".78" />
        </>
    ),
    'V-Necks': (
        <>
            <path d="m223 135 38-17h78l38 17 62 38-38 82-48-24v300H209V231l-48 24-38-82 62-38 38-17Z" />
            <path d="m260 119 40 47 40-47" fill="none" stroke="#111214" strokeWidth="10" strokeLinejoin="round" />
        </>
    ),
    Crewnecks: (
        <>
            <path d="m226 138 39-20h70l39 20 72 39-40 91-48-26v289H212V242l-48 26-40-91 72-39 30-11Z" />
            <path d="M264 119q36 31 72 0l-8 39h-56l-8-39Z" fill="#111214" />
            <path d="M211 516h147l-10 22H221l-10-22Zm-48-266 18 9 13-20m240 11-18 9-13-20" fill="none" stroke="#C8CBD1" strokeOpacity=".42" strokeWidth="5" />
        </>
    ),
    'Lightweight Hoodies': (
        <>
            <path d="M246 130q54-51 108 0l22 9 39 28 66 37-42 94-47-25v246H208V273l-47 25-42-94 66-37 39-28 22-9Z" />
            <path d="M252 132q48-71 96 0l-12 39-36 24-36-24-12-39Z" fill="#101114" stroke="#828791" strokeWidth="5" />
            <path d="m267 192 33 19 33-19v50h-66v-50Z" fill="#141519" stroke="#A7ABB2" strokeOpacity=".68" strokeWidth="3" />
            <path d="M270 239v65m60-65v65" stroke="#A7ABB2" strokeOpacity=".58" strokeWidth="3" />
        </>
    ),
    'Heavyweight Hoodies': (
        <>
            <path d="M246 130q54-51 108 0l22 9 39 28 66 37-42 94-47-25v246H208V273l-47 25-42-94 66-37 39-28 22-9Z" />
            <path d="M252 132q48-71 96 0l-12 39-36 24-36-24-12-39Z" fill="#101114" stroke="#D4B26E" strokeWidth="5" />
            <path d="m267 192 33 19 33-19v50h-66v-50Z" fill="#141519" stroke="#D4B26E" strokeOpacity=".72" strokeWidth="3" />
            <path d="M270 239v65m60-65v65" stroke="#D4B26E" strokeOpacity=".58" strokeWidth="3" />
        </>
    ),
    Shorts: (
        <>
            <path d="M170 150h260l34 315q-57 23-129 14l-5-189-20 1-5 188q-72 9-129-14l34-315Z" />
            <path d="M170 174h260m-130-21v137m-22-137v32m44-32v32" fill="none" stroke="#D2B36F" strokeOpacity=".78" strokeWidth="6" />
            <path d="m220 473 80 5m80-5-80 5" stroke="#C9CCD2" strokeOpacity=".5" strokeWidth="4" />
        </>
    ),
    Sweatpants: (
        <>
            <path d="M190 116h220l33 499q-50 23-133 13l-10-293-10 293q-83 10-133-13l33-499Z" />
            <path d="M190 142h220m-110-21v46m-20-46v34m40-34v34" fill="none" stroke="#D2B36F" strokeOpacity=".8" strokeWidth="6" />
            <path d="m217 597 73 5m20-5 73 5" stroke="#C9CCD2" strokeOpacity=".48" strokeWidth="4" />
        </>
    ),
    Jackets: (
        <>
            <path d="m225 137 37-19h76l37 19 45 33 71 43-45 91-52-29v258H206V275l-52 29-45-91 71-43 45-33Z" />
            <path d="m262 119 38 49 38-49-18-12h-40l-18 12Z" fill="#111214" stroke="#C8CBD1" strokeWidth="3" />
            <path d="M300 169v357m-25-219h50m-50 19h50" stroke="#D0B06B" strokeOpacity=".78" strokeWidth="4" />
            <path d="m121 205 53 27m305-27-53 27" stroke="#E0E1E3" strokeWidth="8" />
        </>
    )
} satisfies Record<Exclude<ProductSubcategory, 'Fragrance' | 'High-Tops' | 'Low-Tops' | 'Outfit'>, React.ReactNode>;

const ProductArtwork: React.FC<ProductArtworkProps> = ({ product }) => {
    if (product.category === 'Cologne' && !product.imageUrl) {
        throw new Error(`Cologne product "${product.id}" is missing its bottle image.`);
    }

    if (product.imageUrl) {
        const isCologne = product.category === 'Cologne';

        if (!isCologne) {
            const isKidsModel = product.audiences.includes('Kids');
            const isWomensModel = product.imageUrl.includes('model-streetwear');
            const isBottoms = product.subcategory === 'Shorts' || product.subcategory === 'Sweatpants';
            const scene = isKidsModel ? 'kids' : isWomensModel ? 'womens' : 'mens';
            const garment = isBottoms ? 'bottoms' : 'top';

            return (
                <div
                    className={`product-model-preview product-model-preview--${scene} product-model-preview--${scene}-${garment}`}
                    role="img"
                    aria-label={`Branded concept preview of ${product.name} on a model`}
                >
                    <img src={product.imageUrl} alt="" aria-hidden="true" loading="lazy" />
                    <span className="product-model-logo" aria-hidden="true">
                        <img src={BRAND_LION_MARK_IMAGE} alt="" />
                    </span>
                    <span className="product-model-caption" aria-hidden="true">BRANDED CONCEPT PREVIEW</span>
                </div>
            );
        }

        return (
            <img
                className="product-scent-image"
                src={product.imageUrl}
                alt={product.name}
                loading="lazy"
            />
        );
    }

    if (product.subcategory === 'Fragrance') {
        throw new Error(`Apparel product "${product.id}" cannot use the fragrance subcategory.`);
    }

    const color = garmentFills[product.garmentColor ?? 'black'];

    if (product.category === 'Shoes') {
        const isHighTop = product.subcategory === 'High-Tops';

        return (
            <svg
                className={`shoe-art shoe-art--${product.garmentColor ?? 'black'}`}
                viewBox="0 0 600 700"
                role="img"
                aria-label={`${product.subcategory} in black, silver, and gold`}
                xmlns="http://www.w3.org/2000/svg"
            >
                <defs>
                    <radialGradient id={`shoe-bg-${product.id}`} cx="50%" cy="42%" r="78%">
                        <stop stopColor="#2B2D32" />
                        <stop offset="1" stopColor="#111214" />
                    </radialGradient>
                    <linearGradient id={`shoe-upper-${product.id}`} x1="130" y1="220" x2="444" y2="482" gradientUnits="userSpaceOnUse">
                        <stop stopColor={color.detail} />
                        <stop offset=".45" stopColor={color.main} />
                        <stop offset="1" stopColor={color.shadow} />
                    </linearGradient>
                </defs>
                <path fill={`url(#shoe-bg-${product.id})`} d="M0 0h600v700H0z" />
                <ellipse cx="310" cy="509" rx="220" ry="38" fill="#000" opacity=".34" />
                {isHighTop ? (
                    <path d="m319 374 14-156q2-22 25-23l72 6q24 2 25 27l-3 147 47 43q14 13 13 33l-2 22q-2 17-23 19l-340-1q-31 0-45-17l-24-29q-10-13-1-27l36-49q12-16 30-21l91-25 48-32Z" fill={`url(#shoe-upper-${product.id})`} stroke="#D4B36D" strokeWidth="7" strokeLinejoin="round" />
                ) : (
                    <path d="m333 354 78-9 39 21 41 43q14 13 13 33l-2 22q-2 17-23 19l-340-1q-31 0-45-17l-24-29q-10-13-1-27l36-49q12-16 30-21l91-25 48-32Z" fill={`url(#shoe-upper-${product.id})`} stroke="#D4B36D" strokeWidth="7" strokeLinejoin="round" />
                )}
                <path d="M107 457q22 17 51 17h343q27 0 39-16l-1 34q-2 17-23 19l-340-1q-31 0-45-17l-24-29Z" fill="#E7E5DF" stroke="#858990" strokeWidth="5" strokeLinejoin="round" />
                <path d="M169 432q26-17 67-23l67-12-32 31-97 15m200-76 37 7 25 26-51 8-41-23Z" fill="none" stroke="#D4B36D" strokeWidth="8" strokeLinejoin="round" />
                <path d="m331 391 56-46m-45 62 59-48m-46 63 61-50" stroke="#D6D8DC" strokeWidth="8" strokeLinecap="round" />
                {isHighTop && <path d="m352 224 78 7-1 19-79-7Z" fill="#E2E3E5" stroke="#A0A3A9" strokeWidth="4" />}
                <path d="m176 444 24-9m25-3 20-2m72-57 12-9" stroke="#FFF" strokeOpacity=".42" strokeWidth="4" strokeLinecap="round" />
                <LionMark className="shoe-logo" x={235} y={360} width={62} height={62} decorative />
                <text x="300" y="641" fill="#F1E6CE" fillOpacity=".8" fontFamily="Arial,sans-serif" fontSize="14" fontWeight="700" letterSpacing="5" textAnchor="middle">502 · LOUISVILLE</text>
            </svg>
        );
    }

    if (product.subcategory === 'High-Tops' || product.subcategory === 'Low-Tops' || product.subcategory === 'Outfit') {
        throw new Error(`Product "${product.id}" has a non-apparel subcategory without its product image.`);
    }

    const garment = garmentShapes[product.subcategory];

    if (!garment) {
        throw new Error(`Apparel product "${product.id}" has an unsupported subcategory.`);
    }

    return (
        <svg
            className={`garment-art garment-art--${product.garmentColor ?? 'black'}`}
            viewBox="0 0 600 700"
            role="img"
            aria-label={`${product.garmentColor ?? 'Black'} ${product.subcategory} with the St. Lou-a-ville lion logo`}
            xmlns="http://www.w3.org/2000/svg"
        >
            <defs>
                <radialGradient id={`garment-bg-${product.id}`} cx="50%" cy="42%" r="78%">
                    <stop stopColor="#2B2D32" />
                    <stop offset="1" stopColor="#111214" />
                </radialGradient>
                <linearGradient id={`fabric-${product.id}`} x1="115" y1="130" x2="455" y2="570" gradientUnits="userSpaceOnUse">
                    <stop stopColor={color.detail} />
                    <stop offset=".36" stopColor={color.main} />
                    <stop offset="1" stopColor={color.shadow} />
                </linearGradient>
                <filter id={`fabric-shadow-${product.id}`} x="70" y="70" width="460" height="585" colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse">
                    <feDropShadow dx="0" dy="18" stdDeviation="18" floodColor="#000" floodOpacity=".48" />
                </filter>
            </defs>
            <path fill={`url(#garment-bg-${product.id})`} d="M0 0h600v700H0z" />
            <circle cx="300" cy="300" r="210" fill="#D2B36F" opacity=".04" />
            <g fill={`url(#fabric-${product.id})`} stroke={color.detail} strokeOpacity=".38" strokeWidth="3" strokeLinejoin="round" filter={`url(#fabric-shadow-${product.id})`}>
                {garment}
            </g>
            <LionMark className="garment-logo" x={247} y={245} width={106} height={106} decorative />
            <path d="M0 648q150-47 300-6t300-1v59H0v-52Z" fill="#08090B" opacity=".37" />
            <text x="300" y="675" fill="#F1E6CE" fillOpacity=".8" fontFamily="Arial,sans-serif" fontSize="14" fontWeight="700" letterSpacing="5" textAnchor="middle">LOUISVILLE · KY</text>
        </svg>
    );
};

export default ProductArtwork;

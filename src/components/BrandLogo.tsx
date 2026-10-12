import React from 'react';
import { BRAND_LOGO_IMAGE } from './brandAssets';

interface BrandLogoProps {
    className?: string;
    decorative?: boolean;
}

const BrandLogo: React.FC<BrandLogoProps> = ({ className, decorative = false }) => (
    <img
        className={`lion-logo-image${className ? ` ${className}` : ''}`}
        src={BRAND_LOGO_IMAGE}
        alt={decorative ? '' : 'ST. LOU-A-VILLE SLIM lion logo'}
        aria-hidden={decorative || undefined}
    />
);

export default BrandLogo;

import React from 'react';
import { BRAND_LOGO_IMAGE } from './brandAssets';

interface LionMarkProps {
    className?: string;
    decorative?: boolean;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
}

const LionMark: React.FC<LionMarkProps> = ({ className, decorative = false, x, y, width, height }) => (
    <svg
        className={`lion-logo-image${className ? ` ${className}` : ''}`}
        x={x}
        y={y}
        width={width}
        height={height}
        viewBox="0 0 768 768"
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : 'ST. LOU-A-VILLE SLIM lion logo'}
        aria-hidden={decorative || undefined}
        xmlns="http://www.w3.org/2000/svg"
    >
        <image href={BRAND_LOGO_IMAGE} width="768" height="768" preserveAspectRatio="xMidYMid meet" />
    </svg>
);

export default LionMark;

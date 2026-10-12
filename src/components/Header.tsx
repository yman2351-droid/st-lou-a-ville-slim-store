import React from 'react';
import BrandLogo from './BrandLogo';

interface HeaderProps {
    cartCount: number;
    onCartClick: (trigger: HTMLElement) => void;
    accountLabel: string;
    onAccountClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ cartCount, onCartClick, accountLabel, onAccountClick }) => (
    <header className="site-header">
        <a className="wordmark" href="#home" aria-label="ST. LOU-A-VILLE SLIM home">
            <BrandLogo className="wordmark-emblem" />
        </a>
        <nav className="main-nav" aria-label="Main navigation">
            <a href="#shop">Shop all</a>
            <a href="#about">The producer</a>
            <a href="#newsletter">Connect</a>
            <button className="account-trigger" onClick={onAccountClick}>{accountLabel}</button>
        </nav>
        <button className="cart-trigger" onClick={event => onCartClick(event.currentTarget)} aria-label={`Open shopping bag, ${cartCount} items`}>
            <span className="cart-label">Your bag</span>
            <span className="cart-count">{cartCount}</span>
        </button>
    </header>
);

export default Header;

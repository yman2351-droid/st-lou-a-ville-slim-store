import React from 'react';
import BrandLogo from './BrandLogo';

const Footer: React.FC = () => (
    <footer className="site-footer">
        <a className="wordmark footer-wordmark" href="#home" aria-label="ST. LOU-A-VILLE SLIM home">
            <BrandLogo className="wordmark-emblem" />
        </a>
        <p>Independent sound. Unmistakable style. <span aria-hidden="true">✦</span></p>
        <div className="footer-links">
            <a href="#shop">Shop</a>
            <a href="#about">About St. Lou-a-ville Slim</a>
            <a href="#newsletter">Get in touch</a>
        </div>
        <span className="copyright">© {new Date().getFullYear()} St. Lou-a-ville Slim</span>
    </footer>
);

export default Footer;

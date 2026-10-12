import React from 'react';
import { createRoot } from 'react-dom/client';
import HomePage from './app/page';

const rootElement = document.getElementById('root');

if (!rootElement) {
    throw new Error('The storefront root element is missing.');
}

createRoot(rootElement).render(
    <React.StrictMode>
        <HomePage />
    </React.StrictMode>
);

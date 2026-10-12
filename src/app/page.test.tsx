import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import HomePage from './page';

const originalFetch = globalThis.fetch;

beforeEach(() => {
    globalThis.fetch = new Proxy(originalFetch, {
        apply: () => new Promise<Response>(() => {})
    });
});

afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
});

describe('ST. LOU-A-VILLE SLIM storefront', () => {
    it('shows the collection and filters products by category', () => {
        render(<HomePage />);

        expect(screen.getByText(/MUSIC PRODUCER · LOUISVILLE, KY/)).toBeTruthy();
        expect(screen.getByText('LOUISVILLE-BORN. MADE TO BE HEARD.')).toBeTruthy();
        expect(screen.getByText('LOUISVILLE, KENTUCKY · INDEPENDENT BY NATURE')).toBeTruthy();
        expect(screen.queryByText(/ST\. LOUIS, MO|ST\. LOUIS MADE|EST\. 314|From the 314/i)).toBeNull();
        expect(screen.getAllByRole('link', { name: 'ST. LOU-A-VILLE SLIM home' })).toHaveLength(2);
        expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(25);
        expect(screen.getByRole('heading', { name: /The sound\.The scent\.The statement\./ })).toBeTruthy();
        expect(screen.getAllByRole('img', { name: 'ST. LOU-A-VILLE SLIM lion logo' })).toHaveLength(2);
        expect(screen.getByRole('img', { name: 'ST. LOU-A-VILLE SLIM lion logo artwork' })).toBeTruthy();
        const logoImages = Array.from(document.querySelectorAll('.lion-logo-image')).filter(element => !element.closest('.product-model-logo'));
        expect(logoImages).toHaveLength(9);
        expect(Array.from(logoImages).every(element => {
            const image = element.tagName === 'IMG' ? element : element.querySelector('image');
            const imageSource = image?.getAttribute(element.tagName === 'IMG' ? 'src' : 'href');

            return imageSource === '/images/st-lou-a-ville-logo.png';
        })).toBe(true);
        expect(document.querySelector('img[src*="st-lou-a-ville-lion.jpg"]')).toBeNull();
        expect(screen.getAllByRole('button', { name: /^(Everything|Cologne|Tops|Bottoms|Outerwear|Shoes|Outfits)$/ })).toHaveLength(7);
        expect(screen.getByRole('group', { name: 'Shop by department' })).toBeTruthy();
        const signatureScentFeature = screen.getByRole('heading', { name: /A scent that/ }).closest('section');
        if (!signatureScentFeature) {
            throw new Error('The signature scent feature is missing.');
        }
        expect(within(signatureScentFeature).getByRole('img', { name: 'Signature Scent Cologne' }).getAttribute('src')).toBe('/images/st-lou-a-ville-perfume.jpg');
        fireEvent.click(screen.getByRole('button', { name: 'Cologne' }));

        expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(2);
        expect(screen.getByRole('heading', { name: 'Signature Scent Cologne' })).toBeTruthy();
        expect(screen.queryByRole('heading', { name: 'Studio Essential Tee' })).toBeNull();
    });

    it('filters the logo apparel by garment subcategory and color', () => {
        render(<HomePage />);

        fireEvent.click(screen.getByRole('button', { name: 'Tops' }));
        const topStyles = screen.getByRole('group', { name: 'Tops garment styles' });
        expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(9);
        expect(screen.getByRole('img', { name: 'Branded concept preview of STL Sound Tee on a model' })).toBeTruthy();
        expect(within(topStyles).getByRole('button', { name: 'Tanks' }).getAttribute('aria-pressed')).toBe('false');
        fireEvent.click(within(topStyles).getByRole('button', { name: 'Tanks' }));

        expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(1);
        expect(screen.getByRole('heading', { name: 'Lion Crest Tank' })).toBeTruthy();
        expect(screen.getByText('Tanks · black')).toBeTruthy();
        expect(screen.getByRole('img', { name: 'Branded concept preview of Lion Crest Tank on a model' })).toBeTruthy();
        expect(screen.getByText('BRANDED CONCEPT PREVIEW')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Bottoms' }));
        const bottomStyles = screen.getByRole('group', { name: 'Bottoms garment styles' });
        fireEvent.click(within(bottomStyles).getByRole('button', { name: 'Shorts' }));

        expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(1);
        expect(screen.getByRole('heading', { name: 'City Sound Shorts' })).toBeTruthy();
    });

    it('filters the shop into men, women, and kids departments with child sizes', () => {
        render(<HomePage />);

        const departments = screen.getByRole('group', { name: 'Shop by department' });
        fireEvent.click(within(departments).getByRole('button', { name: 'Kids' }));

        expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(6);
        expect(screen.getByRole('heading', { name: 'Junior Lion Tee' })).toBeTruthy();
        expect(screen.getByRole('heading', { name: 'Junior Studio Hoodie' })).toBeTruthy();
        expect(screen.getByRole('heading', { name: 'Junior Lion Outfit' })).toBeTruthy();
        expect(screen.getByRole('combobox', { name: 'Choose kids size for Junior Lion Tee' }).querySelectorAll('option')).toHaveLength(7);
        expect(screen.queryByRole('heading', { name: 'Studio Essential Tee' })).toBeNull();

        fireEvent.click(within(departments).getByRole('button', { name: 'Women' }));
        expect(screen.getByRole('heading', { name: 'Golden Hour Set' })).toBeTruthy();

        fireEvent.click(within(departments).getByRole('button', { name: 'Men' }));
        expect(screen.getByRole('heading', { name: '502 Studio Set' })).toBeTruthy();
        expect(screen.queryByRole('heading', { name: 'Junior Lion Outfit' })).toBeNull();
    });

    it('sells high-tops and low-cuts in adult and youth shoe sizes', () => {
        render(<HomePage />);

        fireEvent.click(screen.getByRole('button', { name: 'Men' }));
        fireEvent.click(screen.getByRole('button', { name: 'Shoes' }));
        expect(screen.getByRole('heading', { name: 'City Lion High-Tops' })).toBeTruthy();
        expect(screen.getByRole('heading', { name: '502 Low-Cuts' })).toBeTruthy();

        const shoeSize = screen.getByRole('combobox', { name: 'Choose us shoe size for City Lion High-Tops' });
        fireEvent.change(shoeSize, { target: { value: '10' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add City Lion High-Tops to bag' }));

        const bag = within(screen.getByRole('dialog'));
        expect(bag.getByText('Size: 10')).toBeTruthy();
        expect(bag.getAllByText('$96.00')).toHaveLength(2);
    });

    it('shows outfit bundle savings and charges the discounted price', () => {
        render(<HomePage />);

        fireEvent.click(screen.getByRole('button', { name: 'Women' }));
        fireEvent.click(screen.getByRole('button', { name: 'Outfits' }));

        expect(screen.getByRole('heading', { name: 'Golden Hour Set' })).toBeTruthy();
        expect(screen.getByText('BUNDLE · 2 PIECES')).toBeTruthy();
        expect(screen.getByText('SAVE $27')).toBeTruthy();
        expect(screen.getByText('$136.00')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Add Golden Hour Set to bag' }));
        const bag = within(screen.getByRole('dialog'));
        expect(bag.getAllByText('$109.00')).toHaveLength(2);
        expect(bag.getByText('Size: M')).toBeTruthy();
    });

    it('keeps separate apparel sizes as separate shopping-bag lines', () => {
        render(<HomePage />);

        const sizePicker = screen.getByRole('combobox', { name: 'Choose apparel size for Studio Essential Tee' });
        fireEvent.change(sizePicker, { target: { value: 'M' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add Studio Essential Tee to bag' }));
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close cart' }));

        fireEvent.change(sizePicker, { target: { value: 'XL' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add Studio Essential Tee to bag' }));

        const bag = within(screen.getByRole('dialog'));
        expect(bag.getAllByRole('heading', { name: 'Studio Essential Tee' })).toHaveLength(2);
        expect(bag.getByText('Size: M')).toBeTruthy();
        expect(bag.getByText('Size: XL')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Open shopping bag, 2 items' })).toBeTruthy();
    });

    it('adds the animated signature-scent bottle to the bag from its feature', () => {
        render(<HomePage />);

        const scentFeature = screen.getByRole('heading', { name: /A scent that/ }).closest('section');
        expect(scentFeature).not.toBeNull();
        if (!scentFeature) {
            throw new Error('The signature scent feature is missing.');
        }

        const bottle = within(scentFeature).getByRole('img', { name: 'Signature Scent Cologne' });
        expect(bottle.getAttribute('src')).toBe('/images/st-lou-a-ville-perfume.jpg');
        fireEvent.click(within(scentFeature).getByRole('button', { name: /ADD SIGNATURE SCENT/ }));

        expect(screen.getByRole('button', { name: 'Open shopping bag, 1 items' })).toBeTruthy();
        expect(within(screen.getByRole('dialog')).getByRole('heading', { name: 'Signature Scent Cologne' })).toBeTruthy();
    });

    it('updates bag quantities, subtotal, and shipping progress', () => {
        render(<HomePage />);
        fireEvent.click(screen.getByRole('button', { name: 'Add Studio Essential Tee to bag' }));

        const bag = within(screen.getByRole('dialog'));
        fireEvent.click(bag.getByRole('button', { name: 'Add one Studio Essential Tee' }));

        expect(bag.getByText('$76.00')).toBeTruthy();
        expect(bag.getByText('$24.00 away from free shipping ✦')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Open shopping bag, 2 items' })).toBeTruthy();

        fireEvent.click(bag.getByRole('button', { name: 'Add one Studio Essential Tee' }));
        expect(bag.getByText('You unlocked free shipping! ✦')).toBeTruthy();
        expect(bag.getByText('$114.00')).toBeTruthy();
    });

    it('closes the bag with Escape and restores keyboard focus', () => {
        render(<HomePage />);
        const addToBagButton = screen.getByRole('button', { name: 'Add Studio Essential Tee to bag' });
        fireEvent.click(addToBagButton);

        const dialog = screen.getByRole('dialog');
        expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Close cart' }));
        expect(document.body.style.overflow).toBe('hidden');

        fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
        expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'CONTINUE SHOPPING' }));

        fireEvent.keyDown(document, { key: 'Tab' });
        expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Close cart' }));

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(screen.queryByRole('dialog')).toBeNull();
        expect(document.activeElement).toBe(addToBagButton);
        expect(document.body.style.overflow).toBe('');
    });

    it('links from the release updates section back to the collection', () => {
        render(<HomePage />);

        expect(screen.getByRole('heading', { name: 'Stay in the mix.' })).toBeTruthy();
        const newsletter = screen.getByRole('heading', { name: 'Stay in the mix.' }).closest('section');
        expect(newsletter).not.toBeNull();
        if (!newsletter) {
            throw new Error('The release updates section is missing.');
        }
        expect(within(newsletter).getByRole('link', { name: 'SHOP THE COLLECTION' })).toHaveProperty('hash', '#shop');
    });
});

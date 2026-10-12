import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'bun:test';
import AccountCenter from './AccountCenter';

afterEach(cleanup);

describe('AccountCenter', () => {
    it('allows the account password to be shown and hidden', () => {
        render(<AccountCenter open user={null} csrfToken="" onClose={() => {}} onAuthChange={() => {}} onStoreChange={() => {}} />);

        const password = screen.getByLabelText('Password');
        expect(password.getAttribute('type')).toBe('password');

        fireEvent.click(screen.getByRole('button', { name: 'Show' }));
        expect(password.getAttribute('type')).toBe('text');

        fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
        expect(password.getAttribute('type')).toBe('password');
    });
});

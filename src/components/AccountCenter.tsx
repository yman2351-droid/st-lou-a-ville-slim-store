import React, { useEffect, useState } from 'react';
import type { SessionUser } from '../app/api';
import { apiRequest } from '../app/api';
import ManagementDashboard from '../app/ManagementDashboard';

interface AccountCenterProps {
    open: boolean;
    user: SessionUser | null;
    csrfToken: string;
    onClose: () => void;
    onAuthChange: (user: SessionUser | null, csrfToken: string) => void;
    onStoreChange: () => void;
}

type AccountMode = 'sign-in' | 'create-account';

const AccountCenter: React.FC<AccountCenterProps> = ({ open, user, csrfToken, onClose, onAuthChange, onStoreChange }) => {
    const [mode, setMode] = useState<AccountMode>('sign-in');
    const [dashboardOpen, setDashboardOpen] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!open) {
            setError('');
            setPassword('');
            setDashboardOpen(false);
        }
    }, [open]);

    const submitAccount = async (event: React.FormEvent) => {
        event.preventDefault();
        setError('');
        setBusy(true);
        try {
            const endpoint = mode === 'sign-in' ? '/api/login' : '/api/register';
            const result = await apiRequest<{ user: SessionUser; csrfToken: string }>(endpoint, {
                method: 'POST',
                body: JSON.stringify({ email, password })
            }, csrfToken);
            onAuthChange(result.user, result.csrfToken);
            setPassword('');
            setEmail(result.user.email);
            onClose();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Your account request could not be completed.');
        } finally {
            setBusy(false);
        }
    };

    const signOut = async () => {
        setError('');
        try {
            await apiRequest('/api/logout', { method: 'POST' }, csrfToken);
            const session = await apiRequest<{ user: null; csrfToken: string }>('/api/session');
            onAuthChange(null, session.csrfToken);
            onClose();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Sign out could not be completed.');
        }
    };

    if (dashboardOpen && user && (user.role === 'admin' || user.role === 'manager')) {
        return <ManagementDashboard user={user} csrfToken={csrfToken} onClose={() => setDashboardOpen(false)} onStoreChange={onStoreChange} />;
    }

    if (!open) {
        return null;
    }

    return (
        <div className="account-backdrop" onClick={onClose}>
            <section className="account-panel" role="dialog" aria-modal="true" aria-labelledby="account-title" onClick={event => event.stopPropagation()}>
                <header className="account-heading">
                    <div>
                        <p className="eyebrow">{user ? `${user.role.toUpperCase()} ACCOUNT` : 'ST. LOU-A-VILLE SLIM OFFICIAL STORE'}</p>
                        <h2 id="account-title">{user ? 'Your account' : mode === 'sign-in' ? 'Sign in' : 'Create your account'}</h2>
                    </div>
                    <button className="icon-button" aria-label="Close account" onClick={onClose}>×</button>
                </header>
                {error && <p className="management-message management-message--error" role="alert">{error}</p>}
                {user ? (
                    <div className="account-content">
                        <p>Signed in as <strong>{user.email}</strong></p>
                        <p>Account type: <strong>{user.role}</strong></p>
                        {(user.role === 'admin' || user.role === 'manager') && (
                            <button className="button button-dark" onClick={() => setDashboardOpen(true)}>
                                OPEN {user.role === 'admin' ? 'ADMIN' : 'MANAGER'} DASHBOARD <span aria-hidden="true">↗</span>
                            </button>
                        )}
                        <button className="continue-shopping" onClick={() => void signOut()}>SIGN OUT</button>
                    </div>
                ) : (
                    <>
                        <div className="account-mode-switch" role="group" aria-label="Account action">
                            <button className={mode === 'sign-in' ? 'is-active' : ''} aria-pressed={mode === 'sign-in'} onClick={() => { setMode('sign-in'); setError(''); }}>Sign in</button>
                            <button className={mode === 'create-account' ? 'is-active' : ''} aria-pressed={mode === 'create-account'} onClick={() => { setMode('create-account'); setError(''); }}>Create account</button>
                        </div>
                        <form className="management-form account-form" onSubmit={event => void submitAccount(event)}>
                            <label>Email<input type="email" required autoComplete="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} /></label>
                            <label>Password<input type="password" required autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} minLength={mode === 'create-account' ? 12 : undefined} maxLength={256} value={password} onChange={event => setPassword(event.target.value)} /></label>
                            {mode === 'create-account' && <p>New accounts are customers. An admin must assign staff roles.</p>}
                            <button className="button button-dark" type="submit" disabled={busy}>{busy ? 'PLEASE WAIT…' : mode === 'sign-in' ? 'SIGN IN' : 'CREATE CUSTOMER ACCOUNT'}</button>
                        </form>
                    </>
                )}
            </section>
        </div>
    );
};

export default AccountCenter;

export class ApiRequestError extends Error {}

export interface SessionUser {
    id: string;
    email: string;
    role: 'admin' | 'manager' | 'customer';
}

export const apiRequest = async <T,>(path: string, options: RequestInit = {}, csrfToken?: string): Promise<T> => {
    const headers = new Headers(options.headers);
    if (csrfToken) {
        headers.set('X-CSRF-Token', csrfToken);
    }
    if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }
    const response = await fetch(path, { ...options, headers, credentials: 'same-origin' });
    const result: unknown = await response.json().catch(() => null);
    if (!response.ok) {
        const message = result && typeof result === 'object' && 'error' in result && typeof result.error === 'string'
            ? result.error
            : `The request failed (${response.status}).`;
        throw new ApiRequestError(message);
    }
    if (result === null) {
        throw new ApiRequestError('The server returned an invalid response.');
    }
    return result as T;
};

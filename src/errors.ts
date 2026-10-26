/**
 * Normalizes any thrown value into an Error suitable for `core.setFailed`.
 *
 * Node rejects failed DNS lookups / multi-address connection attempts with an
 * `AggregateError` whose own message is often an empty string, which GitHub
 * Actions renders as a bare "AggregateError" with no diagnostics. This helper
 * unwraps the underlying causes so the real errors become visible.
 */
export function toActionError(err: unknown): Error {
    if (err instanceof AggregateError) {
        const causes = err.errors
            .map((cause) => describe(cause))
            .filter((message) => message !== '');
        const headline = err.message || err.name;
        const message =
            causes.length > 0 ? `${headline}: ${causes.join('; ')}` : headline;
        const error = new Error(message);
        error.stack = err.stack ? `${message}\n${err.stack}` : message;
        return error;
    }

    if (err instanceof Error) {
        return err;
    }

    return new Error(describe(err));
}

function describe(err: unknown): string {
    if (err instanceof AggregateError) {
        return toActionError(err).message;
    }

    if (err instanceof Error) {
        return err.message || err.name;
    }

    if (typeof err === 'object' && err !== null) {
        try {
            return JSON.stringify(err) ?? String(err);
        } catch {
            return String(err);
        }
    }

    return String(err);
}

import { describe, expect, it } from 'vitest';

import { toActionError } from './errors';

describe('toActionError', () => {
    it('returns regular errors unchanged', () => {
        const err = new Error('boom');

        expect(toActionError(err)).toBe(err);
    });

    it('unwraps AggregateError causes when the message is empty', () => {
        const err = new AggregateError(
            [
                new Error('getaddrinfo ENOTFOUND db.example.com'),
                new Error('connect ECONNREFUSED ::1:5432'),
            ],
            '',
        );

        expect(toActionError(err).message).toBe(
            'AggregateError: getaddrinfo ENOTFOUND db.example.com; ' +
            'connect ECONNREFUSED ::1:5432',
        );
    });

    it('keeps the AggregateError message when present and causes exist', () => {
        const err = new AggregateError(
            [new Error('connect ECONNREFUSED 127.0.0.1:5432')],
            'All connection attempts failed',
        );

        expect(toActionError(err).message).toBe(
            'All connection attempts failed: connect ECONNREFUSED 127.0.0.1:5432',
        );
    });

    it('unwraps nested AggregateErrors', () => {
        const err = new AggregateError(
            [new AggregateError([new Error('inner cause')], '')],
            '',
        );

        expect(toActionError(err).message).toBe(
            'AggregateError: AggregateError: inner cause',
        );
    });

    it('handles an AggregateError without causes', () => {
        const err = new AggregateError([], '');

        expect(toActionError(err).message).toBe('AggregateError');
    });

    it('wraps thrown values that are not errors', () => {
        expect(toActionError('plain string').message).toBe('plain string');
        expect(toActionError({ code: '28P01' }).message).toBe('{"code":"28P01"}');
    });
});

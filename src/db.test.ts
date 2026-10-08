import { describe, expect, it, vi } from 'vitest';
import {
    cleanupDatabases,
    createDatabase,
    dropDatabase,
    listDatabases,
    terminateBackends,
} from './db';
import type { Queryable } from './db';

function mockClient(): { client: Queryable } {
    return {
        client: {
            query: vi.fn(),
        } as unknown as Queryable,
    };
}

describe('createDatabase', () => {
    it('drops an existing database before creating a new one', async () => {
        const { client } = mockClient();
        const { query } = client as unknown as { query: ReturnType<typeof vi.fn> };

        await createDatabase(client, 'test_1_job_ab12cd');

        expect(query).toHaveBeenNthCalledWith(1, 'DROP DATABASE IF EXISTS "test_1_job_ab12cd"');
        expect(query).toHaveBeenNthCalledWith(2, 'CREATE DATABASE "test_1_job_ab12cd"');
    });
});

describe('listDatabases', () => {
    it('returns the database names matching the pattern', async () => {
        const { client } = mockClient();
        const { query } = client as unknown as { query: ReturnType<typeof vi.fn> };
        query.mockResolvedValueOnce({
            rows: [{ datname: 'test_1_a' }, { datname: 'test_1_b' }],
        });

        const names = await listDatabases(client, 'test_1_%');

        expect(names).toEqual(['test_1_a', 'test_1_b']);
        expect(query).toHaveBeenCalledWith(
            expect.stringContaining('WHERE datname LIKE $1'),
            ['test_1_%'],
        );
    });
});

describe('terminateBackends', () => {
    it('terminates every backend connected to the database', async () => {
        const { client } = mockClient();
        const { query } = client as unknown as { query: ReturnType<typeof vi.fn> };

        await terminateBackends(client, 'test_1_a');

        expect(query).toHaveBeenCalledWith(
            expect.stringContaining('pg_terminate_backend(pid)'),
            ['test_1_a'],
        );
    });
});

describe('dropDatabase', () => {
    it('terminates open backends then drops the database', async () => {
        const { client } = mockClient();
        const { query } = client as unknown as { query: ReturnType<typeof vi.fn> };

        await dropDatabase(client, 'test_1_a');

        expect(query).toHaveBeenNthCalledWith(
            1,
            expect.stringContaining('pg_terminate_backend'),
            ['test_1_a'],
        );
        expect(query).toHaveBeenNthCalledWith(2, 'DROP DATABASE IF EXISTS "test_1_a"');
    });
});

describe('cleanupDatabases', () => {
    it('lists and drops databases matching a pattern', async () => {
        const { client } = mockClient();
        const { query } = client as unknown as { query: ReturnType<typeof vi.fn> };
        query.mockResolvedValueOnce({
            rows: [{ datname: 'test_1_a' }, { datname: 'test_1_b' }],
        });

        const removed = await cleanupDatabases(client, 'test_1_%');

        expect(removed).toEqual(['test_1_a', 'test_1_b']);
        expect(query).toHaveBeenCalledTimes(5);
    });
});

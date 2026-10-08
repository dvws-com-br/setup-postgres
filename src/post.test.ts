import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCore = vi.hoisted(() => ({
    getState: vi.fn(),
    warning: vi.fn(),
}));

const mockClient = vi.hoisted(() => ({
    connect: vi.fn(),
    query: vi.fn(),
    end: vi.fn(),
}));

const mockPg = vi.hoisted(() => ({
    Client: vi.fn(() => mockClient),
}));

vi.mock('@actions/core', () => mockCore);
vi.mock('pg', () => mockPg);

import { main, run } from './post';

function state(overrides: Record<string, string> = {}): Record<string, string> {
    return {
        database_prefix: 'test_',
        run_id: '777',
        host: 'localhost',
        port: '5432',
        user: 'postgres',
        password: 'secret',
        ...overrides,
    };
}

describe('post', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mockCore.getState.mockImplementation((name: string) => state()[name] ?? '');

        mockClient.connect.mockResolvedValue(undefined);
        mockClient.query.mockResolvedValue({ rows: [] });
        mockClient.end.mockResolvedValue(undefined);
    });

    it('does nothing when there is no saved prefix', async () => {
        mockCore.getState.mockImplementation((name: string) =>
            state({ database_prefix: '' })[name] ?? '',
        );

        await run();

        expect(mockPg.Client).not.toHaveBeenCalled();
        expect(mockClient.query).not.toHaveBeenCalled();
    });

    it('does nothing when there is no saved run id', async () => {
        mockCore.getState.mockImplementation((name: string) =>
            state({ run_id: '' })[name] ?? '',
        );

        await run();

        expect(mockPg.Client).not.toHaveBeenCalled();
        expect(mockClient.query).not.toHaveBeenCalled();
    });

    it('drops every database created by the current run', async () => {
        mockClient.query.mockResolvedValueOnce({
            rows: [{ datname: 'test_777_test_abc123' }, { datname: 'test_777_test_def456' }],
        });

        await run();

        expect(mockPg.Client).toHaveBeenCalledWith({
            host: 'localhost',
            port: 5432,
            user: 'postgres',
            password: 'secret',
            database: 'postgres',
        });

        expect(mockClient.query).toHaveBeenNthCalledWith(
            1,
            expect.stringContaining('WHERE datname LIKE $1'),
            ['test_777_%'],
        );
        expect(mockClient.query).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining('pg_terminate_backend'),
            ['test_777_test_abc123'],
        );
        expect(mockClient.query).toHaveBeenNthCalledWith(
            3,
            'DROP DATABASE IF EXISTS "test_777_test_abc123"',
        );
        expect(mockClient.query).toHaveBeenNthCalledWith(
            4,
            expect.stringContaining('pg_terminate_backend'),
            ['test_777_test_def456'],
        );
        expect(mockClient.query).toHaveBeenNthCalledWith(
            5,
            'DROP DATABASE IF EXISTS "test_777_test_def456"',
        );
        expect(mockClient.end).toHaveBeenCalled();
        expect(mockCore.warning).not.toHaveBeenCalled();
    });

    it('warns and closes the connection when a query fails', async () => {
        mockClient.query.mockRejectedValueOnce(new Error('query failed'));

        main();
        await vi.waitFor(() => expect(mockCore.warning).toHaveBeenCalled());

        expect(mockCore.warning).toHaveBeenCalledWith('query failed');
        expect(mockClient.end).toHaveBeenCalled();
    });
});

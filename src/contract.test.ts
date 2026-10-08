import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCore = vi.hoisted(() => ({
    getInput: vi.fn<(name: string) => string>(),
    exportVariable: vi.fn(),
    setOutput: vi.fn(),
    saveState: vi.fn(),
    setFailed: vi.fn(),
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

import { run as runMain } from './main';
import { run as runPost } from './post';

describe('state contract', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        process.env.GITHUB_RUN_ID = '777';
        process.env.GITHUB_JOB = 'test';

        mockCore.getInput.mockImplementation((name) => {
            switch (name) {
                case 'host':
                    return 'db.example.com';
                case 'port':
                    return '5432';
                case 'username':
                    return 'postgres';
                case 'password':
                    return 'secret';
                case 'database-prefix':
                    return 'test_';
                case 'env-name':
                    return 'DB_DATABASE';
                default:
                    return '';
            }
        });

        const savedState: Record<string, string> = {};
        mockCore.saveState.mockImplementation((name: string, value: unknown) => {
            savedState[name] = String(value);
        });
        mockCore.getState.mockImplementation((name: string) => savedState[name] ?? '');

        mockClient.connect.mockResolvedValue(undefined);
        mockClient.query.mockResolvedValue({ rows: [] });
        mockClient.end.mockResolvedValue(undefined);
    });

    it('state saved by main is sufficient for post cleanup', async () => {
        await runMain();

        const dbName = mockCore.exportVariable.mock.calls[0][1] as string;
        expect(dbName).toMatch(/^test_777_test_[0-9a-f]{6}$/);

        mockClient.query.mockResolvedValueOnce({
            rows: [{ datname: dbName }],
        });

        await runPost();

        const queries = mockClient.query.mock.calls;
        const drop = queries[queries.length - 1];

        expect(drop[0]).toBe(`DROP DATABASE IF EXISTS "${dbName}"`);
        expect(drop[1]).toBeUndefined();
    });
});

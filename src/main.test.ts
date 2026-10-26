import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCore = vi.hoisted(() => ({
    getInput: vi.fn<(name: string) => string>(),
    exportVariable: vi.fn(),
    setOutput: vi.fn(),
    saveState: vi.fn(),
    setFailed: vi.fn(),
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

import { main, run } from './main';

const DEFAULT_INPUTS: Record<string, string> = {
    host: 'localhost',
    port: '5432',
    username: 'postgres',
    password: 'secret',
    'database-prefix': 'test_',
    'env-name': 'DB_DATABASE',
};

function mockInputs(overrides: Record<string, string> = {}): void {
    mockCore.getInput.mockImplementation(
        (name) => overrides[name] ?? DEFAULT_INPUTS[name] ?? '',
    );
}

describe('main', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        process.env.GITHUB_RUN_ID = '777';
        process.env.GITHUB_JOB = 'test';

        mockInputs();

        mockClient.connect.mockResolvedValue(undefined);
        mockClient.query.mockResolvedValue({ rows: [] });
        mockClient.end.mockResolvedValue(undefined);
    });

    it('creates a unique database and exports the expected variables', async () => {
        await run();

        expect(mockPg.Client).toHaveBeenCalledWith({
            host: 'localhost',
            port: 5432,
            user: 'postgres',
            password: 'secret',
            database: 'postgres',
        });

        expect(mockClient.connect).toHaveBeenCalled();
        expect(mockClient.query).toHaveBeenCalledTimes(2);

        const dropSql = mockClient.query.mock.calls[0][0] as string;
        const createSql = mockClient.query.mock.calls[1][0] as string;
        const dbName = dropSql.match(/^DROP DATABASE IF EXISTS "([^"]+)"$/)?.[1];

        expect(dbName).toMatch(/^test_777_test_[0-9a-f]{6}$/);
        expect(createSql).toBe(`CREATE DATABASE "${dbName}"`);

        expect(mockCore.exportVariable).toHaveBeenCalledWith('DB_DATABASE', dbName);
        expect(mockCore.setOutput).toHaveBeenCalledWith('database', dbName);
        expect(mockCore.saveState).toHaveBeenCalledWith('envName', 'DB_DATABASE');
        expect(mockCore.saveState).toHaveBeenCalledWith('database', dbName);
        expect(mockCore.saveState).toHaveBeenCalledWith('database_prefix', 'test_');
        expect(mockCore.saveState).toHaveBeenCalledWith('run_id', '777');
        expect(mockCore.saveState).toHaveBeenCalledWith('host', 'localhost');
        expect(mockCore.saveState).toHaveBeenCalledWith('port', '5432');
        expect(mockCore.saveState).toHaveBeenCalledWith('user', 'postgres');
        expect(mockCore.saveState).toHaveBeenCalledWith('password', 'secret');
        expect(mockClient.end).toHaveBeenCalled();
    });

    it('closes the connection and fails the run when a query fails', async () => {
        mockClient.query.mockRejectedValueOnce(new Error('connection failed'));

        main();
        await vi.waitFor(() => expect(mockCore.setFailed).toHaveBeenCalled());

        expect(mockCore.setFailed).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'connection failed' }),
        );
        expect(mockClient.end).toHaveBeenCalled();
    });

    it('fails fast with a helpful message when required inputs are empty', async () => {
        mockInputs({ host: '', port: '', username: '', password: '' });

        main();
        await vi.waitFor(() => expect(mockCore.setFailed).toHaveBeenCalled());

        const [err] = mockCore.setFailed.mock.calls[0] as [Error];
        expect(err.message).toContain("Required inputs 'host', 'username', 'password' are empty");
        expect(err.message).toContain('secrets are not available to every workflow run');
        expect(mockPg.Client).not.toHaveBeenCalled();
        expect(mockClient.connect).not.toHaveBeenCalled();
    });

    it('falls back to the default port when the port input is empty', async () => {
        mockInputs({ port: '' });

        await run();

        expect(mockPg.Client).toHaveBeenCalledWith(
            expect.objectContaining({ port: 5432 }),
        );
        expect(mockClient.connect).toHaveBeenCalled();
    });

    it('fails fast when the port input is not a valid port', async () => {
        mockInputs({ port: 'not-a-port' });

        main();
        await vi.waitFor(() => expect(mockCore.setFailed).toHaveBeenCalled());

        const [err] = mockCore.setFailed.mock.calls[0] as [Error];
        expect(err.message).toContain("Input 'port' must be an integer between 1 and 65535");
        expect(mockPg.Client).not.toHaveBeenCalled();
    });

    it('reports the target and unwrapped causes when the connection fails', async () => {
        mockClient.connect.mockRejectedValueOnce(
            new AggregateError(
                [new Error('getaddrinfo ENOTFOUND localhost')],
                '',
            ),
        );

        main();
        await vi.waitFor(() => expect(mockCore.setFailed).toHaveBeenCalled());

        const [err] = mockCore.setFailed.mock.calls[0] as [Error];
        expect(err.message).toBe(
            'Failed to connect to Postgres at localhost:5432: ' +
            'AggregateError: getaddrinfo ENOTFOUND localhost',
        );
        expect(mockClient.end).not.toHaveBeenCalled();
    });
});

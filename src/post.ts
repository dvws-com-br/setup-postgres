import * as core from '@actions/core';
import { Client } from 'pg';
import { cleanupDatabases } from './db';
import { toActionError } from './errors';

export async function run(): Promise<void> {
    const prefix = core.getState('database_prefix');
    const runId = core.getState('run_id');

    if (!prefix || !runId) {
        return;
    }

    const host = core.getState('host');
    const port = Number(core.getState('port'));
    const client = new Client({
        host,
        port,
        user: core.getState('user'),
        password: core.getState('password'),
        database: 'postgres',
    });

    try {
        await client.connect();
    } catch (err) {
        throw new Error(
            `Failed to connect to Postgres at ${host}:${port}: ` +
            `${toActionError(err).message}`,
        );
    }

    try {
        const removed = await cleanupDatabases(
            client,
            `${prefix}${runId}_%`,
        );

        for (const dbName of removed) {
            console.log(`Database removed: ${dbName}`);
        }

        console.log(`Removed ${removed.length} database(s).`);
    } finally {
        await client.end();
    }
}

export function main(): void {
    run().catch((err) => {
        core.warning(toActionError(err).message);
    });
}

if (typeof require !== 'undefined' && require.main === module) {
    main();
}

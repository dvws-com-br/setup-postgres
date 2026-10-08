import * as core from '@actions/core';
import { Client } from 'pg';
import { cleanupDatabases } from './db';

export async function run(): Promise<void> {
    const prefix = core.getState('database_prefix');
    const runId = core.getState('run_id');

    if (!prefix || !runId) {
        return;
    }

    const client = new Client({
        host: core.getState('host'),
        port: Number(core.getState('port')),
        user: core.getState('user'),
        password: core.getState('password'),
        database: 'postgres',
    });

    await client.connect();

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
        core.warning(err instanceof Error ? err.message : String(err));
    });
}

if (typeof require !== 'undefined' && require.main === module) {
    main();
}

import * as core from '@actions/core';
import { randomBytes } from 'crypto';
import { Client } from 'pg';
import { createDatabase } from './db';

export async function run(): Promise<void> {
    const host = core.getInput('host');
    const port = Number(core.getInput('port'));
    const user = core.getInput('username');
    const password = core.getInput('password');
    const prefix = core.getInput('database-prefix');
    const envName = core.getInput('env-name');

    const suffix = randomBytes(3).toString('hex');
    const dbName =
        `${prefix}${process.env.GITHUB_RUN_ID}_${process.env.GITHUB_JOB}_${suffix}`;

    const client = new Client({
        host,
        port,
        user,
        password,
        database: 'postgres',
    });

    await client.connect();

    try {
        await createDatabase(client, dbName);
    } finally {
        await client.end();
    }

    core.exportVariable(envName, dbName);

    core.setOutput('database', dbName);

    core.saveState('envName', envName);
    core.saveState('database', dbName);
    core.saveState('database_prefix', prefix);
    core.saveState('run_id', process.env.GITHUB_RUN_ID ?? '');
    core.saveState('host', host);
    core.saveState('port', String(port));
    core.saveState('user', user);
    core.saveState('password', password);

    console.log(`Database created: ${dbName}`);
}

export function main(): void {
    run().catch((err) => {
        core.setFailed(err instanceof Error ? err : new Error(String(err)));
    });
}

if (typeof require !== 'undefined' && require.main === module) {
    main();
}

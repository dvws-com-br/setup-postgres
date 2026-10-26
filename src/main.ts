import * as core from '@actions/core';
import { randomBytes } from 'crypto';
import { Client } from 'pg';
import { createDatabase } from './db';
import { toActionError } from './errors';

const REQUIRED_INPUTS = ['host', 'username', 'password'] as const;
const DEFAULT_PORT = 5432;

export async function run(): Promise<void> {
    const host = core.getInput('host');
    const port = parsePort(core.getInput('port'));
    const user = core.getInput('username');
    const password = core.getInput('password');
    const prefix = core.getInput('database-prefix');
    const envName = core.getInput('env-name');

    assertRequiredInputs({ host, username: user, password });

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

    await connect(client, host, port);

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

/**
 * An empty secret still counts as a *supplied* input, so GitHub's
 * `required: true` validation does not catch it. Empty connection values then
 * surface as opaque failures (e.g. a bare `AggregateError` from resolving an
 * empty host), so fail fast with an actionable message instead.
 */
function assertRequiredInputs(inputs: Record<string, string>): void {
    const missing = REQUIRED_INPUTS.filter((name) => !inputs[name]);

    if (missing.length === 0) {
        return;
    }

    const quoted = missing.map((name) => `'${name}'`).join(', ');
    const plural = missing.length > 1;
    throw new Error(
        `Required input${plural ? 's' : ''} ${quoted} ${plural ? 'are' : 'is'} ` +
        'empty. If these values come from secrets, note that secrets are not ' +
        'available to every workflow run — Dependabot pull requests and ' +
        'unapproved fork pull requests do not receive repository secrets.',
    );
}

/** Falls back to the default port when the input is empty (e.g. an unset secret). */
function parsePort(value: string): number {
    if (value === '') {
        return DEFAULT_PORT;
    }

    const port = Number(value);

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(
            `Input 'port' must be an integer between 1 and 65535, received '${value}'.`,
        );
    }

    return port;
}

/** Reports connection failures with the target and the underlying causes. */
async function connect(client: Client, host: string, port: number): Promise<void> {
    try {
        await client.connect();
    } catch (err) {
        throw new Error(
            `Failed to connect to Postgres at ${host}:${port}: ` +
            `${toActionError(err).message}`,
        );
    }
}

export function main(): void {
    run().catch((err) => {
        core.setFailed(toActionError(err));
    });
}

if (typeof require !== 'undefined' && require.main === module) {
    main();
}

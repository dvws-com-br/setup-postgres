export interface Queryable {
    query(text: string, params?: unknown[]): Promise<{
        rows: Array<Record<string, unknown>>;
    }>;
}

export interface DatabaseRow {
    datname?: string;
}

export async function createDatabase(
    client: Queryable,
    dbName: string,
): Promise<void> {
    await client.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    await client.query(`CREATE DATABASE "${dbName}"`);
}

export async function listDatabases(
    client: Queryable,
    pattern: string,
): Promise<string[]> {
    const result = (await client.query(
        `
            SELECT datname
            FROM pg_database
            WHERE datname LIKE $1
        `,
        [pattern],
    )) as { rows: DatabaseRow[] };

    return result.rows
        .map((row) => row.datname)
        .filter((name): name is string => typeof name === 'string');
}

export async function terminateBackends(
    client: Queryable,
    dbName: string,
): Promise<void> {
    await client.query(
        `
            SELECT pg_terminate_backend(pid)
            FROM pg_stat_activity
            WHERE datname = $1
              AND pid <> pg_backend_pid()
        `,
        [dbName],
    );
}

export async function dropDatabase(
    client: Queryable,
    dbName: string,
): Promise<void> {
    await terminateBackends(client, dbName);
    await client.query(`DROP DATABASE IF EXISTS "${dbName}"`);
}

export async function cleanupDatabases(
    client: Queryable,
    pattern: string,
): Promise<string[]> {
    const databases = await listDatabases(client, pattern);

    const removed: string[] = [];
    for (const dbName of databases) {
        await dropDatabase(client, dbName);
        removed.push(dbName);
    }

    return removed;
}

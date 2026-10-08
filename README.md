# setup-postgres

GitHub Action that creates an isolated Postgres database for a CI job. The
database name is the `database-prefix` input plus the GitHub run id, job name
and a random 3-byte hex suffix. As a post step, the action drops every database
created by the same run when the job finishes.

## Usage

```yaml
steps:
  - uses: actions/checkout@v4

  - uses: dvws-com-br/setup-postgres@<version>
    with:
      host: ${{ secrets.POSTGRES_HOST }}
      port: ${{ secrets.POSTGRES_PORT }}
      username: ${{ secrets.POSTGRES_USER }}
      password: ${{ secrets.POSTGRES_PASSWORD }}
      env-name: TEST_DB
```

Optionally, run Postgres as a service container in the same job:

```yaml
services:
  postgres:
    image: postgres:16
    env:
      POSTGRES_PASSWORD: postgres
    ports:
      - 5432:5432
    options: >-
      --health-cmd "pg_isready -U postgres"
      --health-interval 5s
      --health-timeout 5s
      --health-retries 20
```

## Inputs

| Name | Description | Required | Default |
| --- | --- | --- | --- |
| `host` | Database host | yes | |
| `port` | Database port | no | `5432` |
| `username` | Database username | yes | |
| `password` | Database password | yes | |
| `database-prefix` | Prefix for the created database | no | `test_` |
| `env-name` | Name of the environment variable receiving the database name | no | `DB_DATABASE` |

## Outputs

| Name | Description |
| --- | --- |
| `database` | Name of the created database |

The created database name is also exported as the environment variable named
by `env-name`.

## Cleanup

The post step drops every database whose name starts with
`<database-prefix><GITHUB_RUN_ID>_`, so databases leaked by earlier steps of
the same run are also removed. Open backends are terminated before each drop.
Because `GITHUB_RUN_ID` is unique per run, the sweep is safe on a shared
server even when workflows share the default `test_` prefix — databases
belonging to other runs are never touched.

## Development

```bash
npm install
npm test
npm run lint
npm run build
```

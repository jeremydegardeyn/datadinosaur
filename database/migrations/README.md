# Database Migrations

## How this works

**Fresh install** (new VM / new Docker environment):
- `schema.sql` is the single source of truth for table structure.
- `seed.sql` loads the initial blog posts and categories.
- Docker mounts both files via `docker-entrypoint-initdb.d` and runs them automatically on first start.
- You do **not** need to run any migration files — they are already reflected in `schema.sql`.

**Existing live database** (already running in production):
- `schema.sql` can't be re-run against a live DB without dropping tables.
- Run only the migration files that are newer than your last deploy.
- Each migration file is safe to identify by its number prefix (`001_`, `002_`, etc.).

## Running a migration on the live VM

```bash
docker exec -it datadinosaur-db-1 mysql -u root -p datadinosaur
```
Then paste the contents of the migration file and run it, or pipe it in:
```bash
docker exec -i datadinosaur-db-1 mysql -u root -p"YOUR_ROOT_PASSWORD" datadinosaur \
  < database/migrations/001_add_post_visibility.sql
```

## Migration log

| File | What it does | Applied |
|---|---|---|
| `001_add_post_visibility.sql` | Adds `visible TINYINT(1) DEFAULT 1` to `blog_posts` | 2026-05-30 |

# PostgreSQL Migration & Setup Guide

## Prerequisites

- PostgreSQL 13+ installed locally or cloud instance (AWS RDS, Azure, DigitalOcean, etc.)
- Connection string format: `postgresql://username:password@host:port/database`

## Local Development Setup

### 1. Install PostgreSQL (if not already installed)

**Windows (Chocolatey):**
```bash
choco install postgresql
```

**macOS (Homebrew):**
```bash
brew install postgresql
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install postgresql postgresql-contrib
```

### 2. Create Database

```bash
createdb teklifal
```

Or using psql:
```bash
psql -U postgres
CREATE DATABASE teklifal;
\q
```

### 3. Update .env.local

```bash
DATABASE_URL="postgresql://postgres:password@localhost:5432/teklifal"
```

### 4. Run Migrations

```bash
npm run prisma:generate
npm run prisma:migrate
```

This will:
- Generate Prisma client
- Run all pending migrations
- Create database schema with indexes

### 5. Seed Database (Optional)

For development/testing, you can add seed script:

```bash
npx prisma db seed
```

## Production PostgreSQL Setup

### AWS RDS (Recommended)

1. Create RDS instance:
   - Engine: PostgreSQL 15+
   - Instance: db.t3.micro (dev) → db.t3.small (prod)
   - Storage: 20GB gp3
   - Multi-AZ: Yes (for reliability)
   - Backup retention: 7 days

2. Configure security group:
   - Allow port 5432 from app servers only
   - Restrict public access

3. Set connection string:
   ```
   DATABASE_URL="postgresql://admin:SecurePassword123@teklifal-db.xxxxx.amazonaws.com:5432/production"
   ```

### Connection Pooling (PgBouncer)

For production, use connection pooling to limit concurrent connections:

```ini
# pgbouncer.ini
[databases]
production = host=your-rds-host port=5432 dbname=teklifal user=postgres password=secret

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
min_pool_size = 5
reserve_pool_size = 5
```

Update connection string to use PgBouncer:
```
DATABASE_URL="postgresql://postgres:secret@localhost:6432/production"
```

## Backup & Restore

### Automated Backups

AWS RDS automatically backs up daily. For self-hosted:

```bash
# Daily backup script
#!/bin/bash
pg_dump -U postgres teklifal | gzip > ./backups/teklifal-$(date +%Y%m%d-%H%M%S).sql.gz

# Restore
gunzip < ./backups/teklifal-20260223.sql.gz | psql -U postgres teklifal
```

### Point-in-Time Recovery (PITR)

Enable WAL archiving in PostgreSQL:
```sql
ALTER SYSTEM SET wal_level = replica;
ALTER SYSTEM SET archive_mode = on;
ALTER SYSTEM SET archive_command = 'cp %p /var/lib/postgresql/wal_archive/%f';
```

## Performance Tuning

### Connection Limits

```sql
ALTER DATABASE teklifal CONNECTION LIMIT 100;
```

### Query Performance

Enable query logging for slow queries:
```sql
ALTER DATABASE teklifal SET log_min_duration_statement = 1000; -- log queries > 1s
```

View slow queries:
```bash
tail -f /var/lib/postgresql/logs/postgresql.log | grep duration
```

### Index Health

```sql
-- Check unused indexes
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
AND indexname NOT IN (
  SELECT indexname FROM pg_stat_user_indexes WHERE idx_scan = 0
);
```

## Monitoring

### Check Database Size

```sql
SELECT
  datname,
  pg_size_pretty(pg_database_size(datname)) AS size
FROM pg_database
WHERE datname = 'teklifal';
```

### Check Table Sizes

```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Connection Monitoring

```sql
SELECT
  usename,
  count(*) as connections
FROM pg_stat_activity
GROUP BY usename
ORDER BY count(*) DESC;
```

## Troubleshooting

### Connection Refused

Check PostgreSQL is running:
```bash
pg_isready -h localhost -p 5432
```

### Too Many Connections

Increase `max_connections` in postgresql.conf:
```
max_connections = 200
```

Then reload:
```bash
sudo systemctl reload postgresql
```

### Slow Migrations

For large tables, create indexes after data migration:
```sql
CREATE INDEX CONCURRENTLY idx_jobs_status ON jobs(status);
```

---

**Next steps after setup:**
1. Test connection: `npm run prisma:generate && npm run prisma:migrate`
2. Verify with: `SELECT version();` in psql
3. Monitor backups regularly

# PgBouncer Connection Pooling Configuration

## Overview

PgBouncer is a lightweight connection pooler for PostgreSQL. It reduces connection overhead by:
- Limiting database connections (prevents "too many connections" errors)
- Multiplexing client connections
- Supporting transaction and session pooling modes

## Architecture

```
App 1      App 2      App 3
  |          |          |
  └──────────┬──────────┘
          PgBouncer (port 6432)
              |
        PostgreSQL (port 5432)
```

## Installation

### Docker (Recommended)

```dockerfile
# Dockerfile.pgbouncer
FROM pgbouncer/pgbouncer:latest

COPY pgbouncer.ini /etc/pgbouncer/pgbouncer.ini
COPY userlist.txt /etc/pgbouncer/userlist.txt

EXPOSE 6432
```

```bash
docker run -d \
  --name pgbouncer \
  -p 6432:6432 \
  -v $(pwd)/pgbouncer.ini:/etc/pgbouncer/pgbouncer.ini \
  pgbouncer/pgbouncer:latest
```

### Linux Installation

```bash
sudo apt-get install pgbouncer
```

## Configuration

### pgbouncer.ini

```ini
[databases]
# Format: dbname = host=host port=port dbname=database user=username password=password
production = host=teklifal-db.xxxxx.amazonaws.com port=5432 dbname=teklifal
development = host=localhost port=5432 dbname=teklifal

[pgbouncer]
# Port that PgBouncer listens on
listen_port = 6432
listen_addr = 0.0.0.0

# Pooling mode: transaction, session, or statement
# - transaction: Connections returned to pool after each transaction (recommended for web apps)
# - session: One client per backend (connection affinity)
# - statement: Return to pool after each statement (no transaction support)
pool_mode = transaction

# Maximum number of client connections
max_client_conn = 1000

# Maximum number of backend connections per database
default_pool_size = 25

# Minimum number of connections to keep open
min_pool_size = 5

# Extra pool for connection overflow
reserve_pool_size = 5
reserve_pool_timeout = 3

# How long to wait for a connection to become available
wait_timeout = 600

# How long an idle connection can stay open
idle_in_transaction_session_timeout = 0

# Logging
loglevel = info
logfile = /var/log/pgbouncer/pgbouncer.log

# Statistics
stats_period = 60

# Authentication
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
auth_query = SELECT usename, passwd FROM pg_shadow WHERE usename=$1

# Performance settings
server_lifetime = 3600
server_idle_timeout = 900
server_connect_timeout = 15
server_login_retry = 15

# Maintenance
autodb_idle_timeout = 3600
autodb = true

# Admin mode
admin_users = admin
```

### userlist.txt

User credentials for authentication (MD5 hashed passwords):

```
"postgres" "md5password_hash"
"app_user" "md5password_hash"
```

Generate MD5 hash:
```bash
echo -n "password" | md5sum
# or
pg_md5 --md5-path=/etc/pgbouncer/userlist.txt postgres password
```

## Connection String

Update app `.env` to use PgBouncer:

```bash
# Before (direct PostgreSQL)
DATABASE_URL="postgresql://postgres:password@localhost:5432/teklifal"

# After (via PgBouncer)
DATABASE_URL="postgresql://postgres:password@localhost:6432/teklifal"
```

## Pooling Modes Explained

### Transaction Mode (Recommended for Next.js)

```ini
pool_mode = transaction
```

**How it works:**
- Connection returned to pool after each transaction
- Lightweight, supports multiple clients per backend
- Best for REST APIs with short-lived queries

**Flow:**
```
Client 1: BEGIN → Query → COMMIT → (conn released to pool)
Client 2: (gets conn from pool) → BEGIN → Query → COMMIT
```

### Session Mode

```ini
pool_mode = session
```

**How it works:**
- One client gets exclusive access to backend connection
- Connection held until client disconnects
- Best for persistent connections (WebSockets)

**Flow:**
```
Client 1: (holds connection for lifetime)
Client 2: (waits or gets another backend connection)
```

## Capacity Planning

Calculate pool size:

```
default_pool_size = (max_connections_postgres - reserved_connections) / expected_apps

Example:
- PostgreSQL max_connections: 100
- Reserved for admin: 5
- Expected app instances: 3

pool_size = (100 - 5) / 3 = 31 per instance
```

For production with 3 app servers:
- PostgreSQL: 100 max_connections
- PgBouncer per server: pool_size = 25
- Total connections: 25 * 3 = 75 (safe)

## Monitoring

### Check PgBouncer Stats

```bash
# Connect to admin console
psql -h localhost -p 6432 -U admin -d pgbouncer

# View active connections
SHOW CLIENTS;

# View backend connections
SHOW SERVERS;

# View database stats
SHOW DATABASES;

# View pool stats
SHOW POOLS;

# View settings
SHOW CONFIG;
```

### Docker Container Monitoring

```bash
# Get logs
docker logs pgbouncer

# Monitor in real-time
docker logs -f pgbouncer

# Get container stats
docker stats pgbouncer
```

### Key Metrics to Track

```sql
-- Number of active clients
SELECT count(*) FROM (SHOW CLIENTS) WHERE state = 'active';

-- Idle connections waiting
SELECT count(*) FROM (SHOW SERVERS) WHERE state = 'idle';

-- Connections in transaction
SELECT count(*) FROM (SHOW SERVERS) WHERE state = 'used';

-- Pool saturation
SELECT sum(cl_active) / sum(pool_size) as pool_utilization
FROM (SHOW POOLS);
```

## Troubleshooting

### Connection Timeout

```
ERROR: sorry, too many clients already
```

**Solution:**
Increase `max_client_conn` or `default_pool_size`:
```ini
max_client_conn = 2000
default_pool_size = 50
```

Reload:
```bash
pg_isready -h localhost -p 6432
```

### Slow Queries Despite Pooling

**Causes:**
- Pool size too small (clients waiting)
- Queries genuinely slow (check with EXPLAIN ANALYZE)
- Connection contention

**Debug:**
```sql
-- Wait time per client
SELECT * FROM (SHOW CLIENTS) WHERE wait_time > 5;

-- Backend connection utilization
SELECT pool_mode, used, available FROM (SHOW POOLS);
```

### Authentication Failures

```
ERROR: auth_file /etc/pgbouncer/userlist.txt not found
```

**Solution:**
```bash
sudo chown pgbouncer:pgbouncer /etc/pgbouncer/userlist.txt
sudo chmod 600 /etc/pgbouncer/userlist.txt
```

### Reloading Configuration

No downtime reload:
```bash
pg_ctl reload -D /etc/pgbouncer
```

Or via psql:
```sql
RELOAD;
```

## Production Deployment (Docker Compose)

```yaml
version: '3.9'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: secure_password
      POSTGRES_DB: teklifal
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  pgbouncer:
    image: pgbouncer/pgbouncer:latest
    ports:
      - "6432:6432"
    volumes:
      - ./pgbouncer.ini:/etc/pgbouncer/pgbouncer.ini
      - ./userlist.txt:/etc/pgbouncer/userlist.txt
    environment:
      DATABASES_HOST: postgres
      DATABASES_PORT: 5432
      DATABASES_USER: postgres
      DATABASES_PASSWORD: secure_password
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "pg_isready", "-h", "localhost", "-p", "6432"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build: .
    environment:
      DATABASE_URL: "postgresql://postgres:secure_password@pgbouncer:6432/teklifal"
    ports:
      - "3000:3000"
    depends_on:
      pgbouncer:
        condition: service_healthy

volumes:
  postgres_data:
```

Deploy:
```bash
docker-compose up -d
```

---

**Next:** Configure load balancer to distribute across multiple PgBouncer instances for HA

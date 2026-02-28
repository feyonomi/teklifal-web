# Deployment Guide

## Prequisites

- Node.js 20+
- PostgreSQL 13+
- S3 veya benzer object storage (dosya yükleme için)
- Monitoring/logging altyapısı (CloudWatch, Sentry, DataDog vb.)

## Production Environment Variables

```bash
# App
NEXT_PUBLIC_APP_URL=https://your-domain.com
NODE_ENV=production

# Auth
JWT_SECRET=<generate-with: openssl rand -base64 32>
JWT_ISSUER=teklifal
JWT_AUDIENCE=teklifal-web
ACCESS_TOKEN_TTL=12h
DEMO_MODE=false

# Auth Rate Limit
AUTH_REGISTER_RATE_LIMIT=5
AUTH_REGISTER_RATE_WINDOW=3600
AUTH_LOGIN_RATE_LIMIT=5
AUTH_LOGIN_RATE_WINDOW=900
AUTH_PASSWORD_RESET_RATE_LIMIT=3
AUTH_PASSWORD_RESET_RATE_WINDOW=3600
AUTH_RATE_LIMIT_REDIS_REQUIRED=true

# Redis (required for production auth rate limiting)
REDIS_URL=redis://username:password@host:6379

# Database
DATABASE_URL=postgresql://username:password@host:port/teklifal

# S3 / Object Storage (future)
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
# AWS_S3_BUCKET=
# AWS_REGION=

# Monitoring (future)
# SENTRY_DSN=
# LOG_LEVEL=info
```

## CI/CD Environment Sync (Staging & Production)

Deployment öncesi `staging` ve `production` ortamlarında aşağıdaki değişkenlerin tanımlı ve uyumlu olduğundan emin olun:

- `NEXT_PUBLIC_APP_URL`
- `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `ACCESS_TOKEN_TTL`
- `DEMO_MODE=false`
- `DATABASE_URL`
- `REDIS_URL`
- `AUTH_REGISTER_RATE_LIMIT`, `AUTH_REGISTER_RATE_WINDOW`
- `AUTH_LOGIN_RATE_LIMIT`, `AUTH_LOGIN_RATE_WINDOW`
- `AUTH_PASSWORD_RESET_RATE_LIMIT`, `AUTH_PASSWORD_RESET_RATE_WINDOW`
- `AUTH_RATE_LIMIT_REDIS_REQUIRED=true`

Önerilen: `SENTRY_DSN`, `LOG_LEVEL`

## Deployment Steps

1. **Checkout & Install**

```bash
git clone <repo>
cd web
npm ci
```

2. **Database Setup (PostgreSQL)**

### Local / Development
```bash
# 1. Create PostgreSQL database
createdb teklifal

# 2. Update .env.local with connection string
echo "DATABASE_URL=postgresql://postgres:password@localhost:5432/teklifal" >> .env.local

# 3. Generate Prisma client and run migrations
npm run prisma:generate
npm run prisma:migrate
```

### Production (AWS RDS / Cloud Provider)

**Step 1: Provision PostgreSQL Instance**
- Engine: PostgreSQL 15+
- Instance type: db.t3.small (minimum for production)
- Storage: 20GB gp3 SSD
- Multi-AZ: Yes (automatic failover)
- Backup retention: 7-30 days
- Enable automated backups

**Step 2: Configure Security Group**
```
- Allow port 5432

 from app servers only
- Restrict public access
- Enable enhanced monitoring
```

**Step 3: Connection Pooling (PgBouncer)**

Production requires connection pooling to prevent "too many connections" errors:

```bash
# Option A: Docker container (recommended)
docker run -d \
  --name pgbouncer \
  -p 6432:6432 \
  -v $(pwd)/pgbouncer.ini:/etc/pgbouncer/pgbouncer.ini \
  pgbouncer/pgbouncer:latest

# Option B: Managed service
# AWS RDS Proxy, Azure Database for PostgreSQL, or Supabase (has pooling built-in)
```

Update connection string to use pool:
```bash
# Direct (dev only)
DATABASE_URL=postgresql://user:pass@postgres.rds.amazonaws.com:5432/teklifal

# Via PgBouncer (production)
DATABASE_URL=postgresql://user:pass@pgbouncer:6432/teklifal
```

**Step 4: Schema Migration**
```bash
npm run prisma:generate
npm run prisma:migrate deploy
```

See [POSTGRES_SETUP.md](./POSTGRES_SETUP.md) and [PGBOUNCER_CONFIG.md](./PGBOUNCER_CONFIG.md) for detailed setup guides.

3. **Build**

```bash
npm run build
```

4. **Start (Node.js)**

```bash
npm start
```

Or use Docker/systemd/PM2 for process management.

5. **SSL/TLS Certificate**

Use Let's Encrypt (Certbot) or your cloud provider's certificate service.

6. **Reverse Proxy**

nginx/Apache configuration with:

- SSL termination
- Compression
- Security headers (already set in `next.config.ts`)
- Rate limiting (implement at reverse proxy level)

## Health Checks

- `GET /` - Homepage should respond in <500ms
- `GET /api/auth/me` - Should require valid JWT
- `GET /robots.txt` - SEO verification

## Backup & Restore

Implement daily backups:

```bash
# PostgreSQL
pg_dump -U $DB_USER $DB_NAME | gzip > ./backups/db-$(date +%Y%m%d).sql.gz

# Uploaded files (if using S3, snapshots are automatic)
```

## Rollback Procedure

If critical issue found in production:

1. Revert to previous docker image or git commit
2. Run `npm run prisma:migrate resolve` if migration fails
3. Clear CDN cache if applicable
4. Verify with health checks

## Post-Launch Monitoring

- [ ] Set up error tracking (Sentry/similar)
- [ ] Enable database slow-query logs
- [ ] Monitor API latency (p95, p99)
- [ ] Set up uptime monitoring
- [ ] Enable access logs for audit trail

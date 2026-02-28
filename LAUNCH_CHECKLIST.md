# Launch Checklist (Live Production Readiness)

## Security & Access Control
- [x] Demo endpoint disabled in production (`DEMO_MODE=false`)
- [x] JWT tokens use strict issuer/audience validation
- [x] API ownership checks (users can only access own data)
- [x] SSE endpoint only accepts Bearer tokens (no query param)
- [x] All sensitive endpoints require authentication
- [x] Security headers configured (CSP, X-Frame-Options, etc.)
- [x] Auth rate limiting implemented (Redis-backed with production fail-safe)
- [ ] WAF/DDoS protection enabled (CloudFront, Akamai, etc.)

## Database & Infrastructure
- [ ] PostgreSQL in production (migrated from SQLite)
- [ ] Database backups automated (daily)
- [ ] Connection pooling configured (PgBouncer)
- [ ] S3/object storage for file uploads (not local public/)
- [ ] Database monitoring enabled
- [ ] Secrets management (not in .env, use Vault/AWS Secrets Manager)

## Legal & Compliance
- [x] Privacy Policy page created (`/privacy`)
- [x] Terms of Service page created (`/terms`)
- [x] KVKK notice page created (`/kvkk`)
- [x] Cookie Policy page created (`/cookies`)
- [ ] KVKK/legal texts reviewed by legal team
- [ ] Analytics consent banner added (if using GA/Mixpanel)
- [ ] Data handling & retention policy documented
- [ ] GDPR/CCPA compliance for non-Turkish users

## SEO & Tracking
- [x] `robots.txt` generated
- [x] Sitemap generated (`/sitemap.xml`)
- [x] Manifest file created
- [ ] Google Search Console setup
- [ ] Google Analytics 4 integrated
- [ ] Meta tags optimized
- [ ] Mobile responsiveness verified (Lighthouse score >90)

## CI/CD & Operations
- [x] GitHub Actions CI pipeline configured
- [x] TypeScript compilation gated
- [x] ESLint quality gates
- [x] Build artifacts tested
- [ ] Staging environment deployed
- [ ] Smoke tests on staging
- [ ] Blue-green or canary deployment strategy documented
- [ ] Incident response runbook created

### CI/CD Environment Variables Checklist (Staging & Production)

#### Required in both `staging` and `production`
- [ ] `NEXT_PUBLIC_APP_URL`
- [ ] `JWT_SECRET`
- [ ] `JWT_ISSUER`
- [ ] `JWT_AUDIENCE`
- [ ] `ACCESS_TOKEN_TTL`
- [ ] `DEMO_MODE=false`
- [ ] `DATABASE_URL`
- [ ] `REDIS_URL`
- [ ] `AUTH_REGISTER_RATE_LIMIT`
- [ ] `AUTH_REGISTER_RATE_WINDOW`
- [ ] `AUTH_LOGIN_RATE_LIMIT`
- [ ] `AUTH_LOGIN_RATE_WINDOW`
- [ ] `AUTH_PASSWORD_RESET_RATE_LIMIT`
- [ ] `AUTH_PASSWORD_RESET_RATE_WINDOW`
- [ ] `AUTH_RATE_LIMIT_REDIS_REQUIRED=true`

#### Optional / recommended
- [ ] `LOG_LEVEL`
- [ ] `SENTRY_DSN`

#### Verification steps
- [ ] Staging deploy sonrası `/api/auth/login` için 429 davranışı doğrulandı
- [ ] Redis kapalı senaryoda production fail-safe (503) doğrulandı

#### GitHub Environment setup (quick)
- [ ] GitHub repo → Settings → Environments altında `staging` oluşturuldu
- [ ] GitHub repo → Settings → Environments altında `production` oluşturuldu
- [ ] `staging` için aşağıdaki **Secrets** girildi: `JWT_SECRET`, `DATABASE_URL`, `REDIS_URL`
- [ ] `staging` için aşağıdaki **Variables** girildi: `NEXT_PUBLIC_APP_URL`, `JWT_ISSUER`, `JWT_AUDIENCE`, `ACCESS_TOKEN_TTL`, `DEMO_MODE`, `AUTH_REGISTER_RATE_LIMIT`, `AUTH_REGISTER_RATE_WINDOW`, `AUTH_LOGIN_RATE_LIMIT`, `AUTH_LOGIN_RATE_WINDOW`, `AUTH_PASSWORD_RESET_RATE_LIMIT`, `AUTH_PASSWORD_RESET_RATE_WINDOW`, `AUTH_RATE_LIMIT_REDIS_REQUIRED`
- [ ] `production` için aşağıdaki **Secrets** girildi: `JWT_SECRET`, `DATABASE_URL`, `REDIS_URL`
- [ ] `production` için aşağıdaki **Variables** girildi: `NEXT_PUBLIC_APP_URL`, `JWT_ISSUER`, `JWT_AUDIENCE`, `ACCESS_TOKEN_TTL`, `DEMO_MODE`, `AUTH_REGISTER_RATE_LIMIT`, `AUTH_REGISTER_RATE_WINDOW`, `AUTH_LOGIN_RATE_LIMIT`, `AUTH_LOGIN_RATE_WINDOW`, `AUTH_PASSWORD_RESET_RATE_LIMIT`, `AUTH_PASSWORD_RESET_RATE_WINDOW`, `AUTH_RATE_LIMIT_REDIS_REQUIRED`
- [ ] `production` environment için required reviewers (onay) aktif edildi
- [ ] Actions → `Release` workflow manuel çalıştırılıp önce `staging`, sonra `production` doğrulaması geçti

## Email & Notifications (P1 - Soon)
- [ ] Transactional email setup (SendGrid, AWS SES)
- [ ] Email verification for signup
- [ ] Password reset via email
- [ ] Notification templates created
- [ ] Email logging/audit trail

## Monitoring & Observability (P1 - Soon)
- [ ] Error tracking (Sentry/Rollbar)
- [ ] Logging centralized (CloudWatch, ELK, Datadog)
- [ ] Metrics dashboards (response time, error rate, DB load)
- [ ] Uptime monitoring (Pingdom, StatusCake)
- [ ] Alert rules configured
- [ ] On-call rotation defined

## User Growth & Onboarding (P2)
- [ ] Email verification + confirmation
- [ ] Forgot password flow
- [ ] Profile completion flow
- [ ] Welcome email sequence
- [ ] Analytics funnel tracking
- [ ] Referral program (optional)

## Performance & Cost
- [ ] CDN configured for static assets
- [ ] Image optimization (next/image)
- [ ] Database query optimization (N+1 checks)
- [ ] Cache headers set appropriately
- [ ] Cost monitoring dashboards setup

## Documentation
- [x] Deployment guide (`DEPLOYMENT.md`)
- [x] Environment template (`.env.example`)
- [x] README updated with production info
- [ ] API documentation (OpenAPI/Swagger - TODO)
- [ ] Database schema documentation
- [ ] Runbooks for common operations
- [ ] Troubleshooting guide

## Final Sign-Off
- [ ] CTO/Tech Lead approval
- [ ] Legal/Compliance sign-off
- [ ] Product Lead approval on feature set
- [ ] Marketing/Growth plan aligned
- [ ] Support/customer service trained

## Launch Date & Announcement
- [ ] Domain/DNS configured
- [ ] SSL certificate installed
- [ ] Soft launch (internal/beta users)
- [ ] Public announcement (Twitter/Press Release/Blog)
- [ ] Community/forum activity kickoff

---

**Notes:**
- P0 items: Must complete before launch
- P1 items: Within 2-4 weeks post-launch
- P2 items: Within 4-8 weeks post-launch

Estimated time to full P0 completion: **3-5 working days** (with dedicated full-time engineer)

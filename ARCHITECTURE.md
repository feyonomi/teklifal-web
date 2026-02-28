# Architecture & Tech Decision Log

## Stack Decision

- **Framework:** Next.js 16 (React 19) + TypeScript
  - Rationale: Full-stack app, API routes built-in, SSR for SEO
- **Database:** PostgreSQL (production - from SQLite on launch day)
  - Rationale: ACID guarantees, relational model, scaling
- **ORM:** Prisma
  - Rationale: Type-safe migrations, great DX
- **Auth:** JWT + bcrypt
  - Rationale: Stateless, scalable, no session storage needed
- **Styling:** Tailwind CSS v4
  - Rationale: Utility-first, production bundle size optimized
- **Hosting:** Vercel (recommended) or self-hosted Node.js
  - Rationale: Zero-config Next.js deployment, auto-scaling

## Known Limitations (P1-P2 Fixes)

1. **Real-time messaging uses EventEmitter** (single-instance only)
   - Fix: Replace with Redis Pub/Sub or Socket.io (P1)

2. **File uploads to public folder** (not scalable)
   - Fix: Move to S3/CloudStorage with signed URLs (P1)

3. **In-memory rate limiting** (single-server only)
   - Fix: Implement Redis-based rate limiting (P1)

4. **Audit logs not centralized**
   - Fix: Send to external logging service (P1)

5. **No refresh token mechanism**
   - Fix: Implement optional refresh token pattern (P2)

## Security Considerations

- JWT secret must be >32 chars, rotate regularly
- HTTPS required in production
- Implement CORS properly when API consumed externally
- Regular dependency audits (`npm audit`)
- Database connection secrets never in code

## Scaling Timeline

| Users | Infrastructure | Notes |
|-------|---|---|
| 0-100 | Single Vercel instance | Default |
| 100-1K | PostgreSQL + Vercel | Add Redis for sessions |
| 1K-10K | Managed DB, Vercel Pro, CDN | Monitor API latency |
| 10K+ | Dedicated app servers, DB replicas, load balancer | Consider microservices |

---

*Last updated: Feb 23, 2026*

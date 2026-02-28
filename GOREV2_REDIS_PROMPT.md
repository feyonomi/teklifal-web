# GÖREV 2: Redis Rate Limiting & Caching (For Trae)

## Objective

Implement Redis for:
1. **Rate limiting** - Prevent abuse on file upload, API endpoints
2. **Session caching** - Cache user/job/category data (reduce DB queries)
3. **Real-time counters** - Track message counts, job views

## Timeline: 1.5 days

## Architecture

```
App Instances
    ↓
  Redis (Primary: transactions, rate limits, cache)
    ↓
 PostgreSQL (Persistent data)
    ↓
 S3 (File uploads - next GÖREV)
```

## Setup Requirements

### 1. Redis Instance

**Option A: Docker (Local Development)**
```bash
docker run -d \
  --name teklifal-redis \
  -p 6379:6379 \
  redis:7-alpine
```

**Option B: Managed Services (Production)**
- AWS ElastiCache (Redis)
- Upstash (serverless Redis)
- Redis Cloud
- DigitalOcean Managed Redis

### 2. Environment Variables

Add to `.env.production`:
```
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
REDIS_DB=0
```

### 3. Dependencies

```bash
npm install redis ioredis
npm install -D @types/ioredis
```

## Implementation Tasks

### Phase 1: Rate Limiting Middleware

Create `src/lib/rate-limit.ts`:

```typescript
import { Redis } from '@upstash/redis'; // or use ioredis

const redis = new Redis({
  url: process.env.REDIS_URL,
});

export async function rateLimit(
  key: string,
  limit: number,
  window: number // seconds
): Promise<{ allowed: boolean; remaining: number }> {
  const count = await redis.incr(key);
  
  if (count === 1) {
    await redis.expire(key, window);
  }
  
  const remaining = Math.max(0, limit - count);
  
  return {
    allowed: count <= limit,
    remaining,
  };
}
```

### Phase 2: Apply Rate Limits to Routes

**Endpoints to rate limit:**

1. **Upload endpoint** (`/api/upload`)
   - Limit: 10 requests / 1 hour per user
   - Key: `upload:${userId}`

2. **Login endpoint** (`/api/auth/login`)
   - Limit: 5 attempts / 15 minutes per IP
   - Key: `login:${ip}`

3. **API Routes** (job creation, offers, messages)
   - Limit: 100 requests / 1 hour per user
   - Key: `api:${userId}`

### Phase 3: Caching Layer

Create `src/lib/cache.ts`:

```typescript
import { Redis } from '@upstash/redis';

const redis = new Redis({ url: process.env.REDIS_URL });
const CACHE_TTL = 3600; // 1 hour

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  },

  async set<T>(key: string, value: T, ttl = CACHE_TTL): Promise<void> {
    await redis.setex(key, ttl, JSON.stringify(value));
  },

  async invalidate(key: string): Promise<void> {
    await redis.del(key);
  },
};
```

**Cache keys to implement:**
- `categories:list` - All service categories
- `user:${id}` - User profile + preferences
- `job:${id}` - Job details
- `profile:buyer:${id}` - Buyer profile
- `profile:provider:${id}` - Provider profile

### Phase 4: Message Counter (Real-time)

Increment in `/api/jobs/[id]/messages/route.ts`:

```typescript
import { cache } from '@/lib/cache';

export async function POST(req: Request, { params }: RouteParams) {
  // ... create message in DB
  
  // Increment counter
  const messageCountKey = `job:${jobId}:messages`;
  await redis.incr(messageCountKey);
  
  // Invalidate job cache
  await cache.invalidate(`job:${jobId}`);
}
```

## Testing Checklist

- [ ] Redis instance running (`redis-cli PING`)
- [ ] Rate limit rejects after limit exceeded
- [ ] Rate limit headers in response: `X-RateLimit-Limit`, `X-RateLimit-Remaining`
- [ ] Cache hits reduce database queries (monitor in Prisma logs)
- [ ] Cache invalidation works on data update
- [ ] Message counter increments correctly
- [ ] Load testing shows < 50ms response time

## Deployment

1. Provision Redis instance (managed service)
2. Add `REDIS_URL` to GitHub Actions secrets
3. Update `next.config.ts` with Redis health check
4. Monitor Redis memory usage (dashboard)

## Known Limitations

⚠️ Redis is **volatile** - data lost on restart!

For persistence:
- Enable AOF (Append-Only File) in Redis
- Use managed service with automatic backups
- Implement cache fallback to database

## Rollback

If Redis fails:
1. Rate limiting gracefully degrades (allow all)
2. Caching disabled (all DB queries)
3. Update REDIS_URL to null/empty

---

**Start Date:** After GÖREV 1 completion (PostgreSQL)
**End Date:** +1.5 days
**Handoff:** To Agent for GÖREV 3 (S3/Object Storage)

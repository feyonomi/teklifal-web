# TeklifAl Web

Kurumsal teklif ve tedarikçi eşleştirme platformu (Next.js + Prisma).

## Lokal Geliştirme

1. Ortam değişkenlerini oluştur:

```bash
cp .env.example .env.local
```

2. Bağımlılıkları kur:

```bash
npm install
```

3. Prisma client üret:

```bash
npm run prisma:generate
```

4. Uygulamayı başlat:

```bash
npm run dev
```

## Production Build

```bash
npm run lint
npm run typecheck
npm run build
```

## Kalıcı Staging Link (Vercel)

Ngrok yalnızca lokal sunucu açıkken çalışır. Bilgisayar kapalıyken de paylaşılabilir URL için Vercel staging kullan:

- Kurulum rehberi: `VERCEL_STAGING_SETUP.md`
- Hızlı komutlar:

```bash
npm run vercel:login
npm run vercel:link
npm run vercel:deploy:staging
```

## Email Sistemi (GÖREV 4)

- Sağlayıcı: Resend veya SendGrid (ENV ile seçilir)
- Ortam değişkenleri:
  - `EMAIL_PROVIDER=resend` veya `EMAIL_PROVIDER=sendgrid`
  - `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
  - `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`
  - Opsiyonel: `EMAIL_SMOKE_TO` (smoke test için hedef adres)
- Smoke testi:

```bash
npm run email:smoke
```

Sağlayıcı yapılandırılmamışsa veya `EMAIL_SMOKE_TO` boşsa script testi atlar.

## Gerçek Zamanlı Mesajlaşma (GÖREV 6)

- Teknoloji: Server-Sent Events (SSE) + Redis Pub/Sub
- Kanal standardı: `job:{jobId}:messages`
- Ortam değişkenleri:
  - `REDIS_URL` (zorunlu)
- Davranış:
  - `/api/jobs/[id]/messages/stream` endpoint’i Bearer token ile korunur.
  - Sadece ilgili işin buyer/provider kullanıcıları abone olabilir.
  - Mesaj oluşturulduğunda `/api/jobs/[id]/messages` POST içinde aynı kanala publish edilir.
  - Redis yoksa stream 503 döner ve ana iş akışları etkilenmez.

## Supabase E2E Bağlantı Testi

```bash
npm run e2e:supabase
```

## Önemli Not (Windows Path)

Turbopack bazı sürümlerde Türkçe karakter içeren klasör yollarında hata verebilir.
Projeyi mümkünse ASCII karakterli bir klasöre taşıyın (ör. `C:\projects\teklifal\web`).

## Canlıya Çıkış Öncesi Kontrol Listesi

- [ ] `DATABASE_URL` production PostgreSQL bağlantısına taşındı
- [ ] `JWT_SECRET` güçlü bir sır ile değiştirildi
- [ ] `DEMO_MODE=false` üretimde doğrulandı
- [ ] CI pipeline yeşil (`lint`, `typecheck`, `build`)
- [ ] KVKK / Gizlilik / Kullanım Şartları metinleri hukuk onayından geçti
- [ ] Yedekleme, loglama ve alarm mekanizmaları aktif

## CI

GitHub Actions iş akışı: `.github/workflows/ci.yml`

Çalıştırılan adımlar:

- `npm ci`
- `npm run prisma:generate`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run e2e:supabase` (yalnızca `main/master` push veya manuel çalıştırmada `run_e2e=true` + `CI_DATABASE_URL` secret varsa)

Gerekli GitHub Actions secret:

- `CI_DATABASE_URL`: Supabase PostgreSQL bağlantı adresi

Manuel çalıştırma:

- GitHub > Actions > `CI` > `Run workflow` > `run_e2e=true` seç

Environment kontrol scripti (staging/production):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check-github-env.ps1
```

Kısa yol (npm script):

```bash
npm run check:github-env
```

Opsiyonel repo parametresi:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check-github-env.ps1 -Repo owner/repo
```

`gh` CLI kurulum (gerekli):

```powershell
winget install --id GitHub.cli -e
```

Alternatifler:

```powershell
choco install gh
```

```bash
brew install gh
sudo apt install gh
```

## Doğrulama Akışları

Auth smoke (register/verify/login/me/reset):

```bash
npm run smoke:auth
```

İş/Teklif/Mesaj core e2e:

```bash
npm run e2e:core
```

Staging smoke (mevcut doğrulanmış hesaplarla):

```bash
E2E_BASE_URL=https://staging.example.com \
SMOKE_BUYER_EMAIL=... \
SMOKE_BUYER_PASSWORD=... \
SMOKE_PROVIDER_EMAIL=... \
SMOKE_PROVIDER_PASSWORD=... \
SMOKE_WRITE=true \
npm run smoke:staging
```

Baseline performans ölçümü:

```bash
PERF_BASE_URL=http://localhost:3000 PERF_REQUESTS=200 PERF_CONCURRENCY=20 npm run perf:baseline
```

Offer accept API smoke:

```bash
E2E_BASE_URL=https://staging.example.com \
SMOKE_BUYER_EMAIL=... \
SMOKE_BUYER_PASSWORD=... \
SMOKE_PROVIDER_EMAIL=... \
SMOKE_PROVIDER_PASSWORD=... \
npm run smoke:offer-accept
```

Release workflow içinde opsiyonel smoke çalıştırmak için environment değerleri:

- Variables: `SMOKE_BUYER_EMAIL`, `SMOKE_PROVIDER_EMAIL`
- Secrets: `SMOKE_BUYER_PASSWORD`, `SMOKE_PROVIDER_PASSWORD`

# Vercel Staging Setup (Kalıcı Paylaşım)

Amaç: Bilgisayar açık olmasa da herkese açık bir staging linki üzerinden uygulamayı gösterebilmek.

## 1) Projeyi Vercel'e bağla

```bash
npx vercel login
npx vercel link --yes
```

Not: `vercel link` sırasında proje adı sorarsa `teklifal-web-staging` gibi bir isim seç.

## 2) Staging env değişkenlerini gir

Vercel Dashboard → Project → Settings → Environment Variables

`Preview` ortamına aşağıdaki değerleri ekle:

### Zorunlu

- `NEXT_PUBLIC_APP_URL` = (ilk deploy sonrası verilen `*.vercel.app` preview URL)
- `JWT_SECRET` = güçlü bir secret
- `JWT_ISSUER` = `teklifal`
- `JWT_AUDIENCE` = `teklifal-web`
- `ACCESS_TOKEN_TTL` = `12h`
- `DEMO_MODE` = `false`
- `DATABASE_URL` = staging PostgreSQL bağlantısı
- `REDIS_URL` = staging Redis bağlantısı
- `AUTH_REGISTER_RATE_LIMIT` = `5`
- `AUTH_REGISTER_RATE_WINDOW` = `3600`
- `AUTH_LOGIN_RATE_LIMIT` = `5`
- `AUTH_LOGIN_RATE_WINDOW` = `900`
- `AUTH_PASSWORD_RESET_RATE_LIMIT` = `3`
- `AUTH_PASSWORD_RESET_RATE_WINDOW` = `3600`
- `AUTH_RATE_LIMIT_REDIS_REQUIRED` = `true`

### Opsiyonel / önerilen

- `LOG_LEVEL` = `info`
- `SENTRY_DSN` = (varsa)

### E-posta (gerçek email doğrulama için)

- `EMAIL_PROVIDER` = `resend` veya `sendgrid`
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (Resend seçildiyse)
- `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` (SendGrid seçildiyse)

## 3) İlk staging deploy

```bash
npx vercel --yes
```

Bu komut preview (staging) URL üretir: `https://<project>-<hash>.vercel.app`

## 4) Staging smoke çalıştır

Önce staging'de doğrulanmış iki kullanıcı (buyer/provider) hazırla.

```bash
E2E_BASE_URL=https://<staging-url> \
SMOKE_BUYER_EMAIL=... \
SMOKE_BUYER_PASSWORD=... \
SMOKE_PROVIDER_EMAIL=... \
SMOKE_PROVIDER_PASSWORD=... \
node scripts/smoke-staging.mjs
```

Offer accept smoke:

```bash
E2E_BASE_URL=https://<staging-url> \
SMOKE_BUYER_EMAIL=... \
SMOKE_BUYER_PASSWORD=... \
SMOKE_PROVIDER_EMAIL=... \
SMOKE_PROVIDER_PASSWORD=... \
node scripts/smoke-offer-accept.mjs
```

## 5) Günlük paylaşım akışı

- Kod push et → Vercel otomatik yeni preview URL üretir
- Linki ekip/müşteri ile paylaş
- Bilgisayar kapalı olsa da link erişilebilir kalır

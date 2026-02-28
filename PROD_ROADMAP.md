# Demo → Production Roadmap (TeklifAl)

Bu plan mevcut kod tabanına göre hazırlanmıştır.

## Mevcut Durum (Hızlı Özet)

### Hazır Olanlar
- Register / login API uçları mevcut (`/api/auth/register`, `/api/auth/login`)
- Password reset email tetikleme uç noktası mevcut (`/api/auth/password-reset`)
- JWT + bcrypt kullanımı mevcut
- Audit log yazımı var (register/login)
- Güvenlik header’ları mevcut
- CI temel adımları (`lint`, `typecheck`, `build`) mevcut

### Kritik Eksikler (Go-Live için)
- Demo buyer bootstrap kaldırılmalı (`/api/auth/demo-buyer` bağımlılığı)
- Frontend login/register ekranları ve oturum yönetimi tamamlanmalı
- E-posta doğrulama akışı (verification token + doğrulama endpoint/UI)
- Prod-grade rate limit (Redis zorunlu + tüm auth endpointlerine yayılım)
- Staging ortamı + smoke test + runbook

---

## Faz 0 — Auth Cutover (P0, 2-3 gün)

Amaç: Demodan gerçek üyeliğe geçiş.

1. Demo modu kapatma stratejisi
   - `DEMO_MODE=false` ile production’da demo endpoint devre dışı
   - `LandingPage` içindeki otomatik demo token bootstrap kaldırma

2. Frontend auth akışları
   - Login ekranı
   - Register ekranı (buyer/provider role seçimi)
   - Logout
   - 401 durumunda login’e yönlendirme

3. Token saklama ve oturum
   - Kısa vadede: access token güvenli kullanım standardı
   - API isteklerinde merkezi auth header katmanı

Kabul kriteri:
- Demo endpoint olmadan kullanıcı kayıt + giriş + iş oluşturma akışı uçtan uca çalışıyor.

---

## Faz 1 — Güvenlik Sertleştirme (P0, 2 gün)

1. Auth endpoint rate limit kapsamı ✅ (Tamamlandı)
   - `register`, `login`, `password-reset` için ayrı limit politikası
   - Redis yoksa fail-safe davranış ve alarm

2. Parola politikası
   - Minimum karmaşıklık (uzunluk + karakter seti)
   - Zayıf parola reddi

3. E-posta doğrulama zorunluluğu
   - `User` modeline `emailVerifiedAt`, `emailVerificationTokenHash`, `emailVerificationSentAt`
   - Doğrulama maili + doğrulama endpoint’i
   - Doğrulanmamış hesap için kısıtlı erişim

Kabul kriteri:
- Bruteforce denemeleri 429 alıyor, doğrulanmamış kullanıcı kritik işlemlere erişemiyor.

---

## Faz 2 — Operasyonel Hazırlık (P0, 1-2 gün)

1. Staging ortamı
   - Production benzeri env ile staging deploy
   - Staging smoke test scriptleri

2. Gözlemlenebilirlik
   - Sentry entegrasyonu
   - Merkezî log + alarm kuralları

3. Veri ve altyapı
   - PostgreSQL backup otomasyonu
   - PgBouncer/connection pooling doğrulaması

Kabul kriteri:
- Staging’de deploy sonrası smoke test otomatik geçiyor; kritik hata alarmı çalışıyor.

---

## Faz 3 — Compliance ve Launch (P0, 1 gün)

1. KVKK/Gizlilik/Kullanım Şartları hukuk onayı
2. Çerez/analitik consent (kullanılıyorsa)
3. Incident runbook + destek akışı
4. Final launch checklist sign-off

Kabul kriteri:
- Launch checklist P0 maddeleri tamam ve imzalı.

---

## İlk Sprintte Başlayacağımız Net İşler

1. `LandingPage` demo bootstrap kaldırma ve gerçek login redirect
2. Login/Register UI sayfalarını üretime uygun hale getirme
3. Auth guard middleware/pattern (korumalı route’lar)
4. Register/Login/Password-reset için Redis-backed rate limit finalizasyonu
5. Email verification DB migration + endpoint + mail template

---

## Riskler

- Demo akışının kaldırılması bazı ekranlarda 401 üretir (guard zorunlu)
- Email provider config eksikse doğrulama akışı bloklanır
- Redis erişilebilirliği rate-limit ve messaging davranışını etkiler

---

## Önerilen Uygulama Sırası (Bugünden başlamak için)

1. Auth UI + token kullanım standardı
2. Demo bootstrap kaldırma
3. Email verification
4. Rate limiting hardening
5. Staging + smoke + go-live

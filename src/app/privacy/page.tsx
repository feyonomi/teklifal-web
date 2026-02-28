import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gizlilik Politikası | TeklifAl",
  description: "TeklifAl gizlilik politikası ve kişisel verilerin işlenmesine ilişkin esaslar.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 text-slate-200">
      <h1 className="mb-8 text-3xl font-bold text-slate-50">Gizlilik Politikası</h1>
      
      <div className="space-y-6 text-sm leading-relaxed text-slate-300">
        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-100">Genel Bakış</h2>
          <p>
            TeklifAl ("Platform") olarak gizliliğinize önem veriyoruz. Bu Gizlilik Politikası, platformumuzu 
            kullanırken topladığımız bilgileri, bu bilgileri nasıl kullandığımızı ve koruduğumuzu açıklar. 
            Platformu kullanarak bu politikada belirtilen uygulamaları kabul etmiş olursunuz.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-100">Toplanan Bilgiler</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Kayıt Bilgileri:</strong> Ad, soyad, e-posta adresi, telefon numarası ve şifre gibi 
              hesap oluştururken sağladığınız bilgiler.
            </li>
            <li>
              <strong>Profil Bilgileri:</strong> Hizmet verenler için şirket adı, hizmet kategorileri, 
              çalışma saatleri ve portföy görselleri.
            </li>
            <li>
              <strong>İşlem Bilgileri:</strong> Oluşturduğunuz teklif talepleri, gönderdiğiniz teklifler, 
              mesajlaşma içerikleri ve değerlendirmeler.
            </li>
            <li>
              <strong>Teknik Bilgiler:</strong> Cihaz bilgileri, IP adresi, tarayıcı türü ve çerezler aracılığıyla 
              toplanan kullanım verileri.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-100">Bilgilerin Kullanımı</h2>
          <p>Topladığımız bilgileri şu amaçlarla kullanırız:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Hizmetlerimizi sunmak, sürdürmek ve iyileştirmek.</li>
            <li>Hizmet alan ve hizmet verenleri eşleştirmek.</li>
            <li>Platform güvenliğini sağlamak ve kötüye kullanımı önlemek.</li>
            <li>Yasal yükümlülükleri yerine getirmek.</li>
            <li>Sizinle iletişime geçmek ve bildirimler göndermek.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-100">Çerezler (Cookies)</h2>
          <p>
            Deneyiminizi geliştirmek, site trafiğini analiz etmek ve kişiselleştirilmiş içerik sunmak için çerezler 
            kullanıyoruz. Tarayıcı ayarlarınızdan çerez tercihlerinizi yönetebilirsiniz, ancak bazı özellikler 
            çerezler olmadan düzgün çalışmayabilir.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-100">Veri Güvenliği</h2>
          <p>
            Verilerinizi korumak için endüstri standardı güvenlik önlemleri (SSL şifreleme, güvenli sunucular, 
            erişim kontrolleri) uyguluyoruz. Ancak internet üzerinden yapılan hiçbir iletimin %100 güvenli 
            olduğunu garanti edemeyiz.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-100">İletişim</h2>
          <p>
            Gizlilik politikamızla ilgili sorularınız için <a href="mailto:privacy@teklifal.com" className="text-blue-400 hover:underline">privacy@teklifal.com</a> adresinden bize ulaşabilirsiniz.
          </p>
        </section>
      </div>
    </main>
  );
}

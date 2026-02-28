import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kullanım Şartları | TeklifAl",
  description: "TeklifAl platform kullanım şartları.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 text-slate-200">
      <h1 className="mb-8 text-3xl font-bold text-slate-50">Kullanım Şartları</h1>
      
      <div className="space-y-6 text-sm leading-relaxed text-slate-300">
        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-100">1. Taraflar ve Amaç</h2>
          <p>
            Bu Kullanım Şartları, TeklifAl Platformu ("Platform") ile Platform'a üye olan veya Platform'u ziyaret eden 
            ("Kullanıcı") arasındaki ilişkiyi düzenler. Platform'u kullanarak bu şartları kabul etmiş sayılırsınız.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-100">2. Üyelik ve Hesap Güvenliği</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Kullanıcı, üyelik formunda verdiği bilgilerin doğru ve güncel olduğunu taahhüt eder.</li>
            <li>Hesap güvenliğinden Kullanıcı sorumludur. Şifrenin üçüncü kişilerle paylaşılması yasaktır.</li>
            <li>Platform, şüpheli durumlarda üyeliği askıya alma veya iptal etme hakkını saklı tutar.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-100">3. Hizmet Kullanımı</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Platform, hizmet alan ve hizmet vereni bir araya getiren bir pazar yeridir.</li>
            <li>Platform, hizmetin kalitesi veya zamanında ifası konusunda garanti vermez (Hizmet Veren sorumluluğundadır).</li>
            <li>Kullanıcılar, Platform üzerinden gerçekleştirdikleri işlemlerde hukuka ve genel ahlaka uygun davranmalıdır.</li>
            <li>Platform dışına yönlendirme yapılması veya iletişim bilgilerinin izinsiz paylaşılması yasaktır.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-100">4. Fikri Mülkiyet</h2>
          <p>
            Platform üzerindeki tüm içerik, tasarım, logo ve yazılımlar TeklifAl'a aittir. İzinsiz kopyalanamaz, 
            çoğaltılamaz veya ticari amaçla kullanılamaz.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-100">5. Sorumluluk Reddi</h2>
          <p>
            Platform, teknik aksaklıklar, siber saldırılar veya mücbir sebeplerden kaynaklanan kesintilerden sorumlu tutulamaz. 
            Ayrıca, kullanıcılar arasındaki uyuşmazlıklarda Platform taraf değildir.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-100">6. Değişiklikler</h2>
          <p>
            TeklifAl, bu şartları dilediği zaman güncelleme hakkını saklı tutar. Güncellemeler yayınlandığı tarihte yürürlüğe girer.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-100">7. Yetkili Mahkeme</h2>
          <p>
            Bu şartlardan doğan uyuşmazlıklarda İstanbul Mahkemeleri ve İcra Daireleri yetkilidir.
          </p>
        </section>
      </div>
    </main>
  );
}

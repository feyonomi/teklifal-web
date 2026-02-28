import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "KVKK Aydınlatma Metni | TeklifAl",
  description: "6698 sayılı KVKK kapsamında TeklifAl aydınlatma metni.",
};

export default function KvkkPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 text-slate-200">
      <h1 className="mb-8 text-3xl font-bold text-slate-50">KVKK Aydınlatma Metni</h1>
      
      <div className="space-y-6 text-sm leading-relaxed text-slate-300">
        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-100">1. Veri Sorumlusu</h2>
          <p>
            TeklifAl Platformu ("TeklifAl") olarak, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") 
            uyarınca veri sorumlusu sıfatıyla hareket etmekteyiz. Kişisel verilerinizin güvenliği ve gizliliği 
            bizim için önceliklidir. Bu aydınlatma metni, kişisel verilerinizin hangi amaçlarla işlendiği, 
            kimlere aktarıldığı ve haklarınız konusunda sizi bilgilendirmek amacıyla hazırlanmıştır.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-100">2. İşlenen Kişisel Verileriniz</h2>
          <p>Platformumuz üzerinden sunduğumuz hizmetlerden faydalanmanız sırasında aşağıdaki verileriniz işlenebilmektedir:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><strong>Kimlik Bilgileri:</strong> Ad, soyad, T.C. kimlik numarası (gerektiğinde).</li>
            <li><strong>İletişim Bilgileri:</strong> E-posta adresi, telefon numarası, adres bilgileri.</li>
            <li><strong>İşlem Güvenliği Bilgileri:</strong> IP adresi, log kayıtları, giriş-çıkış bilgileri.</li>
            <li><strong>Hizmet Kullanım Bilgileri:</strong> Teklif talepleri, mesajlaşma içerikleri, yüklenen dosyalar.</li>
            <li><strong>Finansal Bilgiler:</strong> Ödeme bilgileri, fatura detayları (hizmet verenler için).</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-100">3. Kişisel Verilerin İşlenme Amaçları</h2>
          <p>Kişisel verileriniz aşağıdaki amaçlarla işlenmektedir:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Üyelik işlemlerinin gerçekleştirilmesi ve hesabın yönetilmesi.</li>
            <li>Teklif alma ve verme süreçlerinin yürütülmesi.</li>
            <li>Hizmet alan ve hizmet veren arasındaki iletişimin sağlanması.</li>
            <li>Yasal yükümlülüklerin yerine getirilmesi (5651 sayılı kanun gereği loglama vb.).</li>
            <li>Müşteri destek hizmetlerinin sunulması ve şikayet yönetimi.</li>
            <li>Platform güvenliğinin sağlanması ve dolandırıcılığın önlenmesi.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-100">4. Kişisel Verilerin Aktarılması</h2>
          <p>
            Kişisel verileriniz, yasal zorunluluklar dışında üçüncü kişilerle paylaşılmamaktadır. Ancak, hizmetin ifası gereği:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Hizmet alanların iletişim bilgileri, yalnızca teklif kabul edildikten sonra ilgili hizmet veren ile paylaşılabilir.</li>
            <li>Ödeme işlemleri için anlaşmalı ödeme kuruluşlarına gerekli bilgiler aktarılabilir.</li>
            <li>Yasal mercilerden gelen talepler doğrultusunda yetkili kamu kurum ve kuruluşlarına aktarım yapılabilir.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-100">5. Kişisel Veri Toplama Yöntemi ve Hukuki Sebebi</h2>
          <p>
            Kişisel verileriniz, platformumuz üzerinden elektronik ortamda (web sitesi, mobil uygulama vb.) otomatik yollarla toplanmaktadır.
            Bu veriler, "sözleşmenin kurulması veya ifası", "hukuki yükümlülüğün yerine getirilmesi" ve "ilgili kişinin temel hak ve özgürlüklerine zarar vermemek kaydıyla veri sorumlusunun meşru menfaatleri" hukuki sebeplerine dayanarak işlenmektedir.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-100">6. İlgili Kişinin Hakları</h2>
          <p>KVKK'nın 11. maddesi uyarınca aşağıdaki haklara sahipsiniz:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme.</li>
            <li>İşlenmişse buna ilişkin bilgi talep etme.</li>
            <li>İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme.</li>
            <li>Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme.</li>
            <li>Eksik veya yanlış işlenmişse düzeltilmesini isteme.</li>
            <li>KVKK şartları çerçevesinde silinmesini veya yok edilmesini isteme.</li>
          </ul>
          <p className="mt-4">
            Haklarınıza ilişkin taleplerinizi <a href="mailto:kvkk@teklifal.com" className="text-blue-400 hover:underline">kvkk@teklifal.com</a> adresine iletebilirsiniz. Talepleriniz en geç 30 gün içinde sonuçlandırılacaktır.
          </p>
        </section>
      </div>
    </main>
  );
}

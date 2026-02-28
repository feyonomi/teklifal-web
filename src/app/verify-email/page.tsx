import Link from "next/link";

type VerifyStatus = "success" | "already" | "expired" | "invalid";

function getStatusContent(status: VerifyStatus) {
  if (status === "success") {
    return {
      title: "E-posta doğrulandı",
      message: "Hesabın başarıyla doğrulandı. Artık giriş yapabilirsin.",
      tone: "text-emerald-400",
    };
  }

  if (status === "already") {
    return {
      title: "E-posta zaten doğrulanmış",
      message: "Bu hesap daha önce doğrulanmış görünüyor. Giriş yapabilirsin.",
      tone: "text-sky-400",
    };
  }

  if (status === "expired") {
    return {
      title: "Doğrulama bağlantısı geçersiz",
      message: "Bağlantının süresi dolmuş veya bağlantı hatalı. Yeni bir doğrulama e-postası talep etmelisin.",
      tone: "text-rose-400",
    };
  }

  return {
    title: "Doğrulama yapılamadı",
    message: "Doğrulama bağlantısı eksik veya geçersiz.",
    tone: "text-rose-400",
  };
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawStatus = Array.isArray(params.status) ? params.status[0] : params.status;

  const status: VerifyStatus =
    rawStatus === "success" || rawStatus === "already" || rawStatus === "expired"
      ? rawStatus
      : "invalid";

  const content = getStatusContent(status);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-slate-100">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">{content.title}</h1>
        <p className={`mt-3 text-sm ${content.tone}`}>{content.message}</p>

        <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
          <Link
            href="/login"
            className="rounded-lg bg-sky-500 px-4 py-2 font-semibold text-slate-950 hover:bg-sky-400"
          >
            Giriş Sayfasına Git
          </Link>
          <Link
            href="/register"
            className="rounded-lg border border-slate-700 px-4 py-2 text-slate-200 hover:border-slate-500"
          >
            Tekrar Kayıt Ol
          </Link>
        </div>
      </div>
    </main>
  );
}

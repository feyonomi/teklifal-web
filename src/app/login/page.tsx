"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

const AUTH_TOKEN_STORAGE_KEY = "authToken";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [isVerificationPending, setIsVerificationPending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const verifiedState = searchParams.get("verified");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setResendMessage(null);
    setVerificationUrl(null);
    setIsVerificationPending(false);
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const json = await response.json();

      if (!response.ok || !json.token) {
        if (response.status === 403 && json.verificationRequired) {
          setIsVerificationPending(true);
          if (typeof json.verificationUrl === "string") {
            setVerificationUrl(json.verificationUrl);
          }
        }
        setError(json.error || "Giriş yapılamadı.");
        return;
      }

      window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, json.token);
      const nextPath = searchParams.get("next");
      const redirectPath =
        nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")
          ? nextPath
          : "/";
      router.replace(redirectPath);
      router.refresh();
    } catch {
      setError("Giriş sırasında beklenmeyen bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email) {
      setError("Önce e-posta adresinizi girin.");
      return;
    }

    setResendMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const json = await response.json();

      if (!response.ok) {
        setError(json.error || "Doğrulama e-postası tekrar gönderilemedi.");
        return;
      }

      if (typeof json.verificationUrl === "string") {
        setVerificationUrl(json.verificationUrl);
      }

      setResendMessage(json.message || "Doğrulama e-postası gönderildi.");
    } catch {
      setError("Doğrulama e-postası tekrar gönderilirken hata oluştu.");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Giriş Yap</h1>
        <p className="mt-1 text-sm text-slate-400">TeklifAl hesabına giriş yaparak devam et.</p>
        {verifiedState === "success" && (
          <p className="mt-2 text-sm text-emerald-400">E-posta doğrulaması tamamlandı. Giriş yapabilirsiniz.</p>
        )}
        {verifiedState === "pending" && (
          <p className="mt-2 text-sm text-amber-400">Lütfen e-posta kutunuzu kontrol ederek hesabınızı doğrulayın.</p>
        )}
        {verifiedState === "expired" && (
          <p className="mt-2 text-sm text-rose-400">Doğrulama bağlantısının süresi dolmuş veya geçersiz.</p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-xs text-slate-300">E-posta</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-xs text-slate-300">Şifre</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500"
            />
          </div>

          {error && <p className="text-sm text-rose-400">{error}</p>}
          {resendMessage && <p className="text-sm text-emerald-400">{resendMessage}</p>}
          {isVerificationPending && (
            <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200">
              <p className="mb-2">Hesabın doğrulanmamış. Doğrulama e-postasını tekrar gönderebilirsin.</p>
              <button
                type="button"
                onClick={handleResendVerification}
                className="rounded-md border border-amber-300/50 px-2 py-1 font-medium hover:border-amber-200"
              >
                Doğrulama Mailini Tekrar Gönder
              </button>
            </div>
          )}
          {verificationUrl && (
            <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-3 text-xs text-slate-300">
              <p className="mb-1">Geliştirme ortamı doğrulama bağlantısı:</p>
              <a href={verificationUrl} className="break-all text-sky-300 underline" target="_blank" rel="noreferrer">
                {verificationUrl}
              </a>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-60"
          >
            {isLoading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
          <Link href="/register" className="hover:text-slate-200">Hesabın yok mu? Kayıt ol</Link>
          <Link href="/" className="hover:text-slate-200">Ana sayfa</Link>
        </div>
      </div>
    </main>
  );
}

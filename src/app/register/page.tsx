"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const AUTH_TOKEN_STORAGE_KEY = "authToken";

type Role = "buyer" | "provider";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("buyer");
  const [fullName, setFullName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const payload: Record<string, string> = {
        email,
        password,
        role,
      };

      if (role === "buyer" && fullName.trim()) {
        payload.fullName = fullName.trim();
      }
      if (role === "provider" && displayName.trim()) {
        payload.displayName = displayName.trim();
      }
      if (city.trim()) {
        payload.city = city.trim();
      }

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = await response.json();

      if (!response.ok || !json.success) {
        setError(json.error || "Kayıt oluşturulamadı.");
        return;
      }

      window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      setSuccessMessage(json.message || "Doğrulama e-postası gönderildi.");
      window.setTimeout(() => {
        router.replace("/login?verified=pending");
      }, 1200);
    } catch {
      setError("Kayıt sırasında beklenmeyen bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Kayıt Ol</h1>
        <p className="mt-1 text-sm text-slate-400">Yeni hesap oluşturarak TeklifAl’ı kullanmaya başla.</p>

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
              minLength={6}
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label htmlFor="role" className="mb-1 block text-xs text-slate-300">Hesap tipi</label>
            <select
              id="role"
              value={role}
              onChange={(event) => setRole(event.target.value as Role)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500"
            >
              <option value="buyer">Alıcı</option>
              <option value="provider">Sağlayıcı</option>
            </select>
          </div>

          {role === "buyer" ? (
            <div>
              <label htmlFor="fullName" className="mb-1 block text-xs text-slate-300">Ad Soyad</label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500"
              />
            </div>
          ) : (
            <div>
              <label htmlFor="displayName" className="mb-1 block text-xs text-slate-300">Görünen isim</label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500"
              />
            </div>
          )}

          <div>
            <label htmlFor="city" className="mb-1 block text-xs text-slate-300">Şehir</label>
            <input
              id="city"
              type="text"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500"
            />
          </div>

          {error && <p className="text-sm text-rose-400">{error}</p>}
          {successMessage && <p className="text-sm text-emerald-400">{successMessage}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-60"
          >
            {isLoading ? "Kayıt oluşturuluyor..." : "Kayıt Ol"}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
          <Link href="/login" className="hover:text-slate-200">Hesabın var mı? Giriş yap</Link>
          <Link href="/" className="hover:text-slate-200">Ana sayfa</Link>
        </div>
      </div>
    </main>
  );
}

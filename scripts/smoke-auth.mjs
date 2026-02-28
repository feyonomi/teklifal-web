const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000";

function uniqueEmail(prefix) {
  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  return `${prefix}+${stamp}@example.com`;
}

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, init);
  let body = null;
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    body = await response.json().catch(() => null);
  } else {
    body = await response.text().catch(() => null);
  }

  return { response, body };
}

async function expectJson(path, init = {}, expectedStatus = 200) {
  const { response, body } = await request(path, init);
  if (response.status !== expectedStatus) {
    throw new Error(
      `${init.method ?? "GET"} ${path} beklenen ${expectedStatus}, gelen ${response.status}: ${JSON.stringify(body)}`,
    );
  }
  return body;
}

async function verifyWithUrl(verificationUrl) {
  if (!verificationUrl) {
    throw new Error("verificationUrl dönmedi. Bu script development ortamında register sonrası doğrulama bekler.");
  }

  const res = await fetch(verificationUrl, { redirect: "follow" });
  const finalUrl = res.url;
  if (!finalUrl.includes("/verify-email?status=success") && !finalUrl.includes("/verify-email?status=already")) {
    throw new Error(`Email doğrulama başarısız. Final URL: ${finalUrl}`);
  }
}

async function run() {
  const email = uniqueEmail("auth-smoke");
  const password = "Test1234!";

  const register = await expectJson(
    "/api/auth/register",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        role: "buyer",
        fullName: "Smoke Auth Buyer",
        city: "Istanbul",
      }),
    },
    201,
  );

  await verifyWithUrl(register?.verificationUrl);

  await expectJson(
    "/api/auth/login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "wrong-password" }),
    },
    401,
  );

  const login = await expectJson(
    "/api/auth/login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    },
    200,
  );

  const token = login?.token;
  if (!token) {
    throw new Error("Login token alınamadı.");
  }

  const me = await expectJson(
    "/api/auth/me",
    {
      headers: { Authorization: `Bearer ${token}` },
    },
    200,
  );

  if (me?.user?.email !== email) {
    throw new Error("/api/auth/me kullanıcı doğrulaması başarısız.");
  }

  await expectJson(
    "/api/auth/password-reset",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    },
    200,
  );

  const resend = await expectJson(
    "/api/auth/resend-verification",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    },
    200,
  );

  if (!resend?.alreadyVerified) {
    throw new Error("Doğrulanmış kullanıcı için resend-verification alreadyVerified=true dönmedi.");
  }

  console.log("AUTH_SMOKE_STATUS:OK");
  console.log(`AUTH_SMOKE_EMAIL:${email}`);
}

run().catch((error) => {
  console.error("AUTH_SMOKE_STATUS:FAILED");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

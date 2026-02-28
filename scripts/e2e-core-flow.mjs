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

async function registerAndVerify({ role, email, password, profile }) {
  const registered = await expectJson(
    "/api/auth/register",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        role,
        ...profile,
      }),
    },
    201,
  );

  const verificationUrl = registered?.verificationUrl;
  if (!verificationUrl) {
    throw new Error("verificationUrl dönmedi. Bu script development/staging smoke için tasarlandı.");
  }

  const verifyResponse = await fetch(verificationUrl, { redirect: "follow" });
  const finalUrl = verifyResponse.url;

  if (!finalUrl.includes("/verify-email?status=success") && !finalUrl.includes("/verify-email?status=already")) {
    throw new Error(`Email doğrulama başarısız: ${finalUrl}`);
  }
}

async function loginAndToken(email, password) {
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
    throw new Error(`Token alınamadı: ${email}`);
  }

  return token;
}

async function run() {
  const password = "Test1234!";
  const buyerEmail = uniqueEmail("buyer-e2e");
  const providerEmail = uniqueEmail("provider-e2e");

  await registerAndVerify({
    role: "buyer",
    email: buyerEmail,
    password,
    profile: { fullName: "E2E Buyer", city: "Istanbul" },
  });

  await registerAndVerify({
    role: "provider",
    email: providerEmail,
    password,
    profile: { displayName: "E2E Provider", city: "Istanbul" },
  });

  const buyerToken = await loginAndToken(buyerEmail, password);
  const providerToken = await loginAndToken(providerEmail, password);

  const buyerMe = await expectJson(
    "/api/auth/me",
    { headers: { Authorization: `Bearer ${buyerToken}` } },
    200,
  );
  const providerMe = await expectJson(
    "/api/auth/me",
    { headers: { Authorization: `Bearer ${providerToken}` } },
    200,
  );

  const buyerUserId = buyerMe?.user?.id;
  const providerUserId = providerMe?.user?.id;
  if (!buyerUserId || !providerUserId) {
    throw new Error("/api/auth/me user id alınamadı.");
  }

  const createdJob = await expectJson(
    "/api/jobs",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${buyerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "E2E Core Job",
        description: "E2E core flow için otomatik oluşturulan iş kaydı.",
        category: "Temizlik",
        city: "Istanbul",
        budgetMin: 1000,
        budgetMax: 2000,
      }),
    },
    201,
  );

  const jobId = createdJob?.data?.id;
  if (!jobId) {
    throw new Error("Job id alınamadı.");
  }

  const createdOffer = await expectJson(
    `/api/jobs/${jobId}/offers`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${providerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        price: 1500,
        note: "E2E provider teklifi",
      }),
    },
    201,
  );

  const offerId = createdOffer?.data?.id;
  if (!offerId) {
    throw new Error("Offer id alınamadı.");
  }

  const offers = await expectJson(
    `/api/jobs/${jobId}/offers`,
    {
      headers: {
        Authorization: `Bearer ${buyerToken}`,
      },
    },
    200,
  );

  const offersData = Array.isArray(offers?.data) ? offers.data : [];
  if (offersData.length < 1) {
    throw new Error("İşe ait teklif listesi boş döndü.");
  }

  const offerExists = offersData.some((offer) => offer?.id === offerId);
  if (!offerExists) {
    throw new Error("Yeni oluşturulan teklif listede bulunamadı.");
  }

  await expectJson(
    `/api/jobs/${jobId}/offers/${offerId}/accept`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${buyerToken}`,
      },
    },
    200,
  );

  await expectJson(
    `/api/jobs/${jobId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${buyerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: "E2E buyer mesajı" }),
    },
    201,
  );

  await expectJson(
    `/api/jobs/${jobId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${providerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: "E2E provider mesajı" }),
    },
    201,
  );

  const buyerMessages = await expectJson(
    `/api/jobs/${jobId}/messages`,
    {
      headers: {
        Authorization: `Bearer ${buyerToken}`,
      },
    },
    200,
  );

  const providerMessages = await expectJson(
    `/api/jobs/${jobId}/messages`,
    {
      headers: {
        Authorization: `Bearer ${providerToken}`,
      },
    },
    200,
  );

  const buyerMessagesData = Array.isArray(buyerMessages?.data) ? buyerMessages.data : [];
  const providerMessagesData = Array.isArray(providerMessages?.data) ? providerMessages.data : [];

  if (buyerMessagesData.length < 2 || providerMessagesData.length < 2) {
    throw new Error("İki taraflı mesaj listesi beklenen uzunlukta değil.");
  }

  const hasBuyerMessage = buyerMessagesData.some((m) => m?.senderId === buyerUserId);
  const hasProviderMessage = buyerMessagesData.some((m) => m?.senderId === providerUserId);

  if (!hasBuyerMessage || !hasProviderMessage) {
    throw new Error("Mesaj listesinde buyer/provider gönderimleri birlikte bulunamadı.");
  }

  console.log("CORE_E2E_STATUS:OK");
  console.log(`CORE_E2E_JOB_ID:${jobId}`);
  console.log(`CORE_E2E_OFFER_ID:${offerId}`);
  console.log(`CORE_E2E_OFFERS:${offersData.length}`);
  console.log(`CORE_E2E_MESSAGES:${buyerMessagesData.length}`);
}

run().catch((error) => {
  console.error("CORE_E2E_STATUS:FAILED");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

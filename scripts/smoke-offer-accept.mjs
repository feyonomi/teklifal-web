const baseUrl = process.env.E2E_BASE_URL;
const buyerEmail = process.env.SMOKE_BUYER_EMAIL;
const buyerPassword = process.env.SMOKE_BUYER_PASSWORD;
const providerEmail = process.env.SMOKE_PROVIDER_EMAIL;
const providerPassword = process.env.SMOKE_PROVIDER_PASSWORD;

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`Eksik env: ${name}`);
  }
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

async function login(email, password) {
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
    throw new Error(`Login token alınamadı: ${email}`);
  }
  return token;
}

async function run() {
  requireEnv("E2E_BASE_URL", baseUrl);
  requireEnv("SMOKE_BUYER_EMAIL", buyerEmail);
  requireEnv("SMOKE_BUYER_PASSWORD", buyerPassword);
  requireEnv("SMOKE_PROVIDER_EMAIL", providerEmail);
  requireEnv("SMOKE_PROVIDER_PASSWORD", providerPassword);

  const buyerToken = await login(buyerEmail, buyerPassword);
  const providerToken = await login(providerEmail, providerPassword);

  const createdJob = await expectJson(
    "/api/jobs",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${buyerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Offer Accept Smoke Job",
        description: "Offer accept endpoint smoke testi için otomatik oluşturulan kayıt.",
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

  const firstOffer = await expectJson(
    `/api/jobs/${jobId}/offers`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${providerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        price: 1500,
        note: "Offer accept smoke teklifi",
      }),
    },
    201,
  );

  const offerId = firstOffer?.data?.id;
  if (!offerId) {
    throw new Error("Offer id alınamadı.");
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
  const accepted = offersData.find((offer) => offer?.id === offerId);
  if (!accepted || accepted.status !== "accepted") {
    throw new Error("Kabul edilen teklif status=accepted doğrulanamadı.");
  }

  await expectJson(
    `/api/jobs/${jobId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${providerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: "Offer accept sonrası provider mesajı" }),
    },
    201,
  );

  await expectJson(
    `/api/jobs/${jobId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${buyerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: "Offer accept sonrası buyer cevabı" }),
    },
    201,
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

  const messageCount = Array.isArray(providerMessages?.data)
    ? providerMessages.data.length
    : 0;

  if (messageCount < 2) {
    throw new Error("Offer accept sonrası iki taraflı mesajlaşma doğrulanamadı.");
  }

  console.log("OFFER_ACCEPT_SMOKE_STATUS:OK");
  console.log(`OFFER_ACCEPT_SMOKE_JOB_ID:${jobId}`);
  console.log(`OFFER_ACCEPT_SMOKE_OFFER_ID:${offerId}`);
  console.log(`OFFER_ACCEPT_SMOKE_MESSAGES:${messageCount}`);
}

run().catch((error) => {
  console.error("OFFER_ACCEPT_SMOKE_STATUS:FAILED");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

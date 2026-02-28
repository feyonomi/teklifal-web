const baseUrl = process.env.E2E_BASE_URL;
const buyerEmail = process.env.SMOKE_BUYER_EMAIL;
const buyerPassword = process.env.SMOKE_BUYER_PASSWORD;
const providerEmail = process.env.SMOKE_PROVIDER_EMAIL;
const providerPassword = process.env.SMOKE_PROVIDER_PASSWORD;
const writeMode = (process.env.SMOKE_WRITE ?? "false").toLowerCase() === "true";

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
  const data = await expectJson(
    "/api/auth/login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    },
    200,
  );

  if (!data?.token) {
    throw new Error(`Login token yok: ${email}`);
  }

  return data.token;
}

async function run() {
  requireEnv("E2E_BASE_URL", baseUrl);
  requireEnv("SMOKE_BUYER_EMAIL", buyerEmail);
  requireEnv("SMOKE_BUYER_PASSWORD", buyerPassword);
  requireEnv("SMOKE_PROVIDER_EMAIL", providerEmail);
  requireEnv("SMOKE_PROVIDER_PASSWORD", providerPassword);

  const buyerToken = await login(buyerEmail, buyerPassword);
  const providerToken = await login(providerEmail, providerPassword);

  await expectJson("/api/auth/me", {
    headers: { Authorization: `Bearer ${buyerToken}` },
  }, 200);

  await expectJson("/api/auth/me", {
    headers: { Authorization: `Bearer ${providerToken}` },
  }, 200);

  const jobs = await expectJson("/api/jobs?status=open", {}, 200);
  const jobsData = Array.isArray(jobs?.data) ? jobs.data : [];

  let createdJobId = null;
  let acceptedOfferId = null;

  if (writeMode) {
    const job = await expectJson(
      "/api/jobs",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${buyerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Staging Smoke Job",
          description: "Staging smoke write-mode için otomatik job kaydı.",
          category: "Temizlik",
          city: "Istanbul",
          budgetMin: 500,
          budgetMax: 1000,
        }),
      },
      201,
    );

    createdJobId = job?.data?.id;
    if (!createdJobId) {
      throw new Error("Write-mode job id alınamadı.");
    }

    const offer = await expectJson(
      `/api/jobs/${createdJobId}/offers`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${providerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          price: 900,
          note: "Staging smoke teklifi",
        }),
      },
      201,
    );

    acceptedOfferId = offer?.data?.id;
    if (!acceptedOfferId) {
      throw new Error("Write-mode offer id alınamadı.");
    }

    await expectJson(
      `/api/jobs/${createdJobId}/offers/${acceptedOfferId}/accept`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${buyerToken}`,
        },
      },
      200,
    );

    await expectJson(
      `/api/jobs/${createdJobId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${buyerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: "Staging smoke mesajı" }),
      },
      201,
    );

    await expectJson(
      `/api/jobs/${createdJobId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${providerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: "Staging smoke provider yanıtı" }),
      },
      201,
    );

    await expectJson(
      `/api/jobs/${createdJobId}/messages`,
      {
        headers: {
          Authorization: `Bearer ${providerToken}`,
        },
      },
      200,
    );
  }

  console.log("STAGING_SMOKE_STATUS:OK");
  console.log(`STAGING_JOBS_OPEN_COUNT:${jobsData.length}`);
  if (createdJobId) {
    console.log(`STAGING_CREATED_JOB_ID:${createdJobId}`);
  }
  if (acceptedOfferId) {
    console.log(`STAGING_ACCEPTED_OFFER_ID:${acceptedOfferId}`);
  }
}

run().catch((error) => {
  console.error("STAGING_SMOKE_STATUS:FAILED");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000";

function buildTitleTag() {
  const now = new Date();
  const yyyy = now.getFullYear().toString();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `E2E-${yyyy}${mm}${dd}`;
}

async function requestJson(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, init);
  let body;

  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const detail = body ? JSON.stringify(body) : response.statusText;
    throw new Error(`${init.method ?? "GET"} ${path} failed (${response.status}): ${detail}`);
  }

  return body;
}

async function waitForServerReady(maxAttempts = 60) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await requestJson("/api/jobs");
      return;
    } catch {
      await delay(1000);
    }
  }

  throw new Error("Dev server did not become ready in time.");
}

async function run() {
  const devServer = spawn("npm run dev", {
    cwd: process.cwd(),
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });

  let recentLogs = "";

  devServer.stdout.on("data", (chunk) => {
    recentLogs += chunk.toString();
    if (recentLogs.length > 4000) {
      recentLogs = recentLogs.slice(-4000);
    }
  });

  devServer.stderr.on("data", (chunk) => {
    recentLogs += chunk.toString();
    if (recentLogs.length > 4000) {
      recentLogs = recentLogs.slice(-4000);
    }
  });

  try {
    await waitForServerReady();

    const demo = await requestJson("/api/auth/demo-buyer");
    const token = demo?.token;

    if (!token) {
      throw new Error("Demo buyer token alınamadı.");
    }

    const title = `${buildTitleTag()} Supabase Test`;
    const payload = {
      title,
      description: "Bu kayıt Supabase yazma testi için otomatik oluşturuldu.",
      category: "Temizlik",
      city: "Istanbul",
      budgetMin: 1000,
      budgetMax: 2000,
    };

    const created = await requestJson("/api/jobs", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const mine = await requestJson("/api/jobs?mine=true", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const createdId = created?.data?.id;
    const mineData = Array.isArray(mine?.data) ? mine.data : [];
    const existsInMine = mineData.some((job) => job?.id === createdId);

    if (!createdId || !existsInMine) {
      throw new Error("Oluşturulan kayıt doğrulama listesinde bulunamadı.");
    }

    console.log(`CREATED_JOB_ID:${createdId}`);
    console.log(`CREATED_TITLE:${created.data.title}`);
    console.log(`MINE_COUNT:${mineData.length}`);
    console.log("E2E_STATUS:OK");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("E2E_STATUS:FAILED");
    console.error(message);
    if (recentLogs.trim()) {
      console.error("--- RECENT_DEV_LOGS ---");
      console.error(recentLogs.trim());
    }
    process.exitCode = 1;
  } finally {
    if (devServer.pid) {
      if (process.platform === "win32") {
        spawnSync("taskkill", ["/PID", String(devServer.pid), "/T", "/F"], {
          stdio: "ignore",
        });
      } else {
        devServer.kill("SIGTERM");
      }
    }
  }
}

run();

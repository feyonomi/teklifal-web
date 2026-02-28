const baseUrl = process.env.PERF_BASE_URL ?? process.env.E2E_BASE_URL ?? "http://localhost:3000";
const endpoint = process.env.PERF_ENDPOINT ?? "/api/jobs?status=open";
const totalRequests = Number(process.env.PERF_REQUESTS ?? 200);
const concurrency = Number(process.env.PERF_CONCURRENCY ?? 20);
const timeoutMs = Number(process.env.PERF_TIMEOUT_MS ?? 10000);

function percentile(sortedValues, p) {
  if (!sortedValues.length) {
    return 0;
  }
  const idx = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil((p / 100) * sortedValues.length) - 1));
  return sortedValues[idx];
}

async function runWorker(workerId, state) {
  while (true) {
    const current = state.index;
    if (current >= totalRequests) {
      return;
    }
    state.index += 1;

    const startedAt = performance.now();

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(`${baseUrl}${endpoint}`, { signal: controller.signal });
      clearTimeout(timer);

      const duration = performance.now() - startedAt;
      state.times.push(duration);

      if (response.ok) {
        state.success += 1;
      } else {
        state.fail += 1;
        state.errors.push(`worker:${workerId} status:${response.status}`);
      }
    } catch (error) {
      const duration = performance.now() - startedAt;
      state.times.push(duration);
      state.fail += 1;
      const message = error instanceof Error ? error.message : String(error);
      state.errors.push(`worker:${workerId} error:${message}`);
    }
  }
}

async function run() {
  if (!Number.isFinite(totalRequests) || totalRequests <= 0) {
    throw new Error("PERF_REQUESTS pozitif sayı olmalı.");
  }
  if (!Number.isFinite(concurrency) || concurrency <= 0) {
    throw new Error("PERF_CONCURRENCY pozitif sayı olmalı.");
  }

  const state = {
    index: 0,
    success: 0,
    fail: 0,
    times: [],
    errors: [],
  };

  const startedAt = performance.now();
  const workers = Array.from({ length: concurrency }, (_, i) => runWorker(i + 1, state));
  await Promise.all(workers);
  const totalDurationMs = performance.now() - startedAt;

  const sorted = [...state.times].sort((a, b) => a - b);
  const p50 = percentile(sorted, 50);
  const p95 = percentile(sorted, 95);
  const p99 = percentile(sorted, 99);
  const avg = sorted.length ? sorted.reduce((acc, n) => acc + n, 0) / sorted.length : 0;
  const rps = totalDurationMs > 0 ? (totalRequests / totalDurationMs) * 1000 : 0;

  console.log("PERF_BASELINE_STATUS:OK");
  console.log(`PERF_ENDPOINT:${endpoint}`);
  console.log(`PERF_REQUESTS:${totalRequests}`);
  console.log(`PERF_CONCURRENCY:${concurrency}`);
  console.log(`PERF_SUCCESS:${state.success}`);
  console.log(`PERF_FAIL:${state.fail}`);
  console.log(`PERF_RPS:${rps.toFixed(2)}`);
  console.log(`PERF_AVG_MS:${avg.toFixed(2)}`);
  console.log(`PERF_P50_MS:${p50.toFixed(2)}`);
  console.log(`PERF_P95_MS:${p95.toFixed(2)}`);
  console.log(`PERF_P99_MS:${p99.toFixed(2)}`);

  if (state.errors.length > 0) {
    console.log("PERF_ERRORS_SAMPLE:");
    state.errors.slice(0, 10).forEach((err) => console.log(err));
  }

  if (state.fail > 0) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error("PERF_BASELINE_STATUS:FAILED");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

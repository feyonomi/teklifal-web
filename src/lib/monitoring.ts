import * as Sentry from "@sentry/node";

let initialized = false;

function isEnabled() {
  return !!process.env.SENTRY_DSN;
}

function initIfNeeded() {
  if (initialized || !isEnabled()) {
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0,
  });

  initialized = true;
}

export function captureException(
  error: unknown,
  context?: {
    event?: string;
    requestId?: string;
    path?: string;
    method?: string;
    userId?: string;
    extra?: Record<string, unknown>;
  },
) {
  if (!isEnabled()) {
    return;
  }

  initIfNeeded();

  Sentry.withScope((scope) => {
    if (context?.event) {
      scope.setTag("event", context.event);
    }
    if (context?.requestId) {
      scope.setTag("request_id", context.requestId);
    }
    if (context?.path) {
      scope.setTag("path", context.path);
    }
    if (context?.method) {
      scope.setTag("method", context.method);
    }
    if (context?.userId) {
      scope.setUser({ id: context.userId });
    }
    if (context?.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }

    Sentry.captureException(error instanceof Error ? error : new Error(String(error)));
  });
}

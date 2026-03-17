import * as Sentry from "@sentry/nextjs"

type ApiLogLevel = "info" | "error"

type ApiLogPayload = {
  type: "api_request" | "api_error"
  requestId: string
  endpoint: string
  userId?: string | null
  message?: string
  error?: string
  status?: number
  [key: string]: unknown
}

function writeLog(level: ApiLogLevel, payload: ApiLogPayload) {
  const serialized = JSON.stringify(payload)

  if (level === "error") {
    console.error(serialized)
    return
  }

  console.log(serialized)
}

export function createRequestId() {
  return crypto.randomUUID()
}

export function logApiRequest(payload: Omit<ApiLogPayload, "type">) {
  writeLog("info", {
    type: "api_request",
    ...payload,
  } as ApiLogPayload)
}

export function logApiError(
  payload: Omit<ApiLogPayload, "type" | "error"> & { error: unknown }
) {
  const normalizedError =
    payload.error instanceof Error
      ? payload.error.message
      : typeof payload.error === "string"
        ? payload.error
        : JSON.stringify(payload.error)

  writeLog("error", {
    type: "api_error",
    ...payload,
    error: normalizedError,
  } as ApiLogPayload)

  // Send to Sentry — preserves full stack trace if original Error is available
  const sentryError =
    payload.error instanceof Error
      ? payload.error
      : new Error(normalizedError)

  Sentry.captureException(sentryError, {
    extra: {
      requestId: payload.requestId,
      endpoint: payload.endpoint,
      userId: payload.userId,
      status: payload.status,
      message: payload.message,
    },
  })
}
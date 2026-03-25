import { createHmac, randomBytes, timingSafeEqual } from "crypto"

type StatePayload = {
  uid: string
  nonce: string
  exp: number
}

function getStateSecret() {
  const secret = process.env.GOOGLE_OAUTH_STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) {
    throw new Error("Missing GOOGLE_OAUTH_STATE_SECRET")
  }
  return secret
}

function sign(payloadB64: string) {
  return createHmac("sha256", getStateSecret()).update(payloadB64).digest("base64url")
}

export function createGoogleOAuthState(userId: string, ttlSeconds = 10 * 60) {
  const payload: StatePayload = {
    uid: userId,
    nonce: randomBytes(16).toString("base64url"),
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  }

  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
  const signature = sign(payloadB64)
  return `${payloadB64}.${signature}`
}

export function verifyGoogleOAuthState(state: string) {
  const [payloadB64, signature] = state.split(".")
  if (!payloadB64 || !signature) {
    throw new Error("Invalid OAuth state")
  }

  const expected = sign(payloadB64)
  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)

  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    throw new Error("Invalid OAuth state signature")
  }

  const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as StatePayload

  if (!payload.uid || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Expired OAuth state")
  }

  return payload
}

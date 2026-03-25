import type { SupabaseClient } from "@supabase/supabase-js"
import { BUSINESS_ROLES, type BusinessMemberRole, hasAnyRole } from "@/lib/businessRoles"

type BusinessRecord = {
  id: string
  name: string | null
  reply_tone?: string | null
  account_id?: string | null
  external_business_id?: string | null
  platform?: string | null
  connected_at?: string | null
}

export type AccessibleBusiness = BusinessRecord & {
  role: BusinessMemberRole
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function toNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function normalizeRole(value: unknown): BusinessMemberRole {
  if (BUSINESS_ROLES.includes(value as BusinessMemberRole)) {
    return value as BusinessMemberRole
  }

  return "viewer"
}

function normalizeBusinessRecord(value: unknown): BusinessRecord | null {
  if (!isRecord(value) || typeof value.id !== "string") {
    return null
  }

  return {
    id: value.id,
    name: toNullableString(value.name),
    reply_tone: toNullableString(value.reply_tone),
    account_id: toNullableString(value.account_id),
    external_business_id: toNullableString(value.external_business_id),
    platform: toNullableString(value.platform),
    connected_at: toNullableString(value.connected_at),
  }
}

function unwrapJoinedBusiness(value: unknown): BusinessRecord | null {
  if (Array.isArray(value)) {
    return normalizeBusinessRecord(value[0])
  }

  return normalizeBusinessRecord(value)
}

export function hasBusinessRole(role: BusinessMemberRole | null | undefined, minimumRole: BusinessMemberRole) {
  if (!role) {
    return false
  }

  return hasAnyRole(role, [minimumRole])
}

function sortBusinesses(businesses: AccessibleBusiness[]) {
  return [...businesses].sort((left, right) => {
    const leftConnectedAt = left.connected_at ? Date.parse(left.connected_at) : 0
    const rightConnectedAt = right.connected_at ? Date.parse(right.connected_at) : 0
    return rightConnectedAt - leftConnectedAt
  })
}

export async function listAccessibleBusinesses(userId: string, supabase: SupabaseClient): Promise<{ businesses: AccessibleBusiness[]; error: string | null }> {
  const membershipResult = await supabase
    .from("business_members")
    .select("role, businesses!inner(id, name, reply_tone, account_id, external_business_id, platform, connected_at)")
    .eq("user_id", userId)
    .eq("status", "active")

  if (!membershipResult.error) {
    const businesses = (membershipResult.data ?? [])
      .map((row) => {
        const record = isRecord(row) ? row : null
        const business = unwrapJoinedBusiness(record?.businesses)

        if (!business) {
          return null
        }

        return {
          ...business,
          role: normalizeRole(record?.role),
        }
      })
      .filter((business): business is AccessibleBusiness => business !== null)

    return { businesses: sortBusinesses(businesses), error: null }
  }

  return { businesses: [], error: membershipResult.error.message }
}

export async function getBusinessAccess(userId: string, businessId: string, supabase: SupabaseClient): Promise<{ business: AccessibleBusiness | null; error: string | null }> {
  const membershipResult = await supabase
    .from("business_members")
    .select("role, businesses!inner(id, name, reply_tone, account_id, external_business_id, platform, connected_at)")
    .eq("user_id", userId)
    .eq("business_id", businessId)
    .eq("status", "active")
    .maybeSingle()

  if (!membershipResult.error) {
    const record = isRecord(membershipResult.data) ? membershipResult.data : null
    const business = unwrapJoinedBusiness(record?.businesses)

    if (!business) {
      return { business: null, error: null }
    }

    return {
      business: {
        ...business,
        role: normalizeRole(record?.role),
      },
      error: null,
    }
  }

  return { business: null, error: membershipResult.error.message }
}

export async function assertBusinessRole(
  userId: string,
  businessId: string,
  supabase: SupabaseClient,
  minimumRole: BusinessMemberRole,
): Promise<{ business: AccessibleBusiness | null; role: BusinessMemberRole | null; error: string | null }> {
  const { business, error } = await getBusinessAccess(userId, businessId, supabase)

  if (error) {
    return { business: null, role: null, error }
  }

  if (!business) {
    return { business: null, role: null, error: "Business membership not found" }
  }

  if (!hasBusinessRole(business.role, minimumRole)) {
    return { business: null, role: business.role, error: `Insufficient role. Requires ${minimumRole} or higher.` }
  }

  return { business, role: business.role, error: null }
}

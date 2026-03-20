import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createRequestId, logApiError, logApiRequest } from "@/lib/apiLogger"
import { assertBusinessRole, getBusinessAccess, listAccessibleBusinesses, type AccessibleBusiness } from "@/lib/businessAccess"
import { BUSINESS_ROLES, hasPermission, type BusinessMemberRole } from "@/lib/businessRoles"
import { createServerClient, createServiceClient } from "@/lib/supabaseServerClient"

type TeamMemberRecord = {
  id: string
  userId: string
  role: BusinessMemberRole
  status: string
  createdAt: string | null
  email: string
  name: string | null
}

type JoinedUserRecord = {
  id?: unknown
  email?: unknown
  name?: unknown
}

function getBearerToken(req: NextRequest): string {
  const authHeader = req.headers.get("Authorization") || ""
  return authHeader.replace(/^Bearer\s+/i, "").trim()
}

function normalizeRole(value: unknown): BusinessMemberRole | null {
  return BUSINESS_ROLES.includes(value as BusinessMemberRole) ? (value as BusinessMemberRole) : null
}

function toUserRecord(value: unknown): JoinedUserRecord | null {
  if (!value || typeof value !== "object") {
    return null
  }

  return value as JoinedUserRecord
}

function unwrapJoinedUser(value: unknown): JoinedUserRecord | null {
  if (Array.isArray(value)) {
    return toUserRecord(value[0])
  }

  return toUserRecord(value)
}

function normalizeTeamMember(row: unknown): TeamMemberRecord | null {
  if (!row || typeof row !== "object") {
    return null
  }

  const record = row as Record<string, unknown>
  const user = unwrapJoinedUser(record.users)
  const role = normalizeRole(record.role)

  if (
    typeof record.id !== "string" ||
    typeof record.user_id !== "string" ||
    typeof user?.email !== "string" ||
    !role
  ) {
    return null
  }

  return {
    id: record.id,
    userId: record.user_id,
    role,
    status: typeof record.status === "string" ? record.status : "active",
    createdAt: typeof record.created_at === "string" ? record.created_at : null,
    email: user.email,
    name: typeof user.name === "string" ? user.name : null,
  }
}

function sortMembers(members: TeamMemberRecord[]) {
  const roleRank: Record<BusinessMemberRole, number> = {
    owner: 4,
    manager: 3,
    responder: 2,
    viewer: 1,
  }

  return [...members].sort((left, right) => {
    const rankDiff = roleRank[right.role] - roleRank[left.role]

    if (rankDiff !== 0) {
      return rankDiff
    }

    const leftLabel = (left.name || left.email).toLowerCase()
    const rightLabel = (right.name || right.email).toLowerCase()
    return leftLabel.localeCompare(rightLabel)
  })
}

async function getAuthenticatedContext(req: NextRequest) {
  const token = getBearerToken(req)

  if (!token) {
    return { token: null, user: null, supabase: null as Awaited<ReturnType<typeof createServerClient>> | null }
  }

  const supabase = await createServerClient(token)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { token, user, supabase }
}

async function listMembersForBusiness(businessId: string) {
  const admin = createServiceClient()
  const { data, error } = await admin
    .from("business_members")
    .select("id, user_id, role, status, created_at, users!inner(id, email, name)")
    .eq("business_id", businessId)
    .eq("status", "active")

  if (error) {
    return { members: [] as TeamMemberRecord[], error: error.message }
  }

  const members = sortMembers((data ?? []).map(normalizeTeamMember).filter((member): member is TeamMemberRecord => member !== null))
  return { members, error: null }
}

async function countOwners(businessId: string) {
  const admin = createServiceClient()
  const { count, error } = await admin
    .from("business_members")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("status", "active")
    .eq("role", "owner")

  return { count: count ?? 0, error: error?.message ?? null }
}

function buildTeamPayload(params: {
  businesses: AccessibleBusiness[]
  selectedBusinessId: string | null
  currentUserId: string
  members: TeamMemberRecord[]
  canManageTeam: boolean
}) {
  return {
    businesses: params.businesses.map((business) => ({
      id: business.id,
      name: business.name,
      role: business.role,
    })),
    selectedBusinessId: params.selectedBusinessId,
    currentUserId: params.currentUserId,
    canManageTeam: params.canManageTeam,
    members: params.members,
  }
}

export async function GET(req: NextRequest) {
  const endpoint = "/api/team-members"
  const requestId = createRequestId()

  try {
    const { user, supabase } = await getAuthenticatedContext(req)

    if (!user || !supabase) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const requestedBusinessId = req.nextUrl.searchParams.get("businessId")?.trim() || null
    const { businesses, error } = await listAccessibleBusinesses(user.id, supabase)

    if (error) {
      logApiError({ requestId, endpoint, userId: user.id, status: 500, message: "Failed to load accessible businesses", error })
      return NextResponse.json({ error: "Failed to load team settings" }, { status: 500 })
    }

    if (businesses.length === 0) {
      return NextResponse.json(buildTeamPayload({
        businesses: [],
        selectedBusinessId: null,
        currentUserId: user.id,
        canManageTeam: false,
        members: [],
      }))
    }

    const selectedBusiness = requestedBusinessId
      ? businesses.find((business) => business.id === requestedBusinessId) ?? null
      : businesses[0]

    if (!selectedBusiness) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 })
    }

    const { members, error: membersError } = await listMembersForBusiness(selectedBusiness.id)

    if (membersError) {
      logApiError({ requestId, endpoint, userId: user.id, businessId: selectedBusiness.id, status: 500, message: "Failed to load business members", error: membersError })
      return NextResponse.json({ error: "Failed to load team members" }, { status: 500 })
    }

    return NextResponse.json(buildTeamPayload({
      businesses,
      selectedBusinessId: selectedBusiness.id,
      currentUserId: user.id,
      canManageTeam: hasPermission(selectedBusiness.role, "canManageTeam"),
      members,
    }))
  } catch (error) {
    logApiError({ requestId, endpoint, status: 500, message: "Failed to fetch team members", error })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const endpoint = "/api/team-members"
  const requestId = createRequestId()

  try {
    const { user, supabase } = await getAuthenticatedContext(req)

    if (!user || !supabase) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    const businessId = typeof body?.businessId === "string" ? body.businessId.trim() : ""
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
    const role = normalizeRole(body?.role)

    if (!businessId || !email || !role) {
      return NextResponse.json({ error: "businessId, email, and role are required" }, { status: 400 })
    }

    const access = await assertBusinessRole(user.id, businessId, supabase, "owner")

    if (access.error) {
      return NextResponse.json({ error: access.error }, { status: access.role ? 403 : 404 })
    }

    const admin = createServiceClient()
    const { data: targetUser, error: userLookupError } = await admin
      .from("users")
      .select("id, email, name")
      .ilike("email", email)
      .maybeSingle()

    if (userLookupError) {
      logApiError({ requestId, endpoint, userId: user.id, businessId, status: 500, message: "Failed to look up invited user", error: userLookupError })
      return NextResponse.json({ error: "Failed to add team member" }, { status: 500 })
    }

    if (!targetUser?.id || typeof targetUser.email !== "string") {
      return NextResponse.json({ error: "No user found with that email yet. Ask them to sign up first." }, { status: 404 })
    }

    const { error: upsertError } = await admin
      .from("business_members")
      .upsert(
        {
          business_id: businessId,
          user_id: targetUser.id,
          role,
          status: "active",
        },
        { onConflict: "business_id,user_id" },
      )

    if (upsertError) {
      logApiError({ requestId, endpoint, userId: user.id, businessId, status: 500, message: "Failed to add team member", error: upsertError })
      return NextResponse.json({ error: "Failed to add team member" }, { status: 500 })
    }

    logApiRequest({ requestId, endpoint, userId: user.id, businessId, message: "Team member added", targetUserId: targetUser.id, role })
    return NextResponse.json({ success: true })
  } catch (error) {
    logApiError({ requestId, endpoint, status: 500, message: "Failed to add team member", error })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const endpoint = "/api/team-members"
  const requestId = createRequestId()

  try {
    const { user, supabase } = await getAuthenticatedContext(req)

    if (!user || !supabase) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    const businessId = typeof body?.businessId === "string" ? body.businessId.trim() : ""
    const memberUserId = typeof body?.memberUserId === "string" ? body.memberUserId.trim() : ""
    const role = normalizeRole(body?.role)

    if (!businessId || !memberUserId || !role) {
      return NextResponse.json({ error: "businessId, memberUserId, and role are required" }, { status: 400 })
    }

    const access = await assertBusinessRole(user.id, businessId, supabase, "owner")

    if (access.error) {
      return NextResponse.json({ error: access.error }, { status: access.role ? 403 : 404 })
    }

    const admin = createServiceClient()
    const { data: existingMember, error: memberError } = await admin
      .from("business_members")
      .select("id, role")
      .eq("business_id", businessId)
      .eq("user_id", memberUserId)
      .eq("status", "active")
      .maybeSingle()

    if (memberError) {
      logApiError({ requestId, endpoint, userId: user.id, businessId, status: 500, message: "Failed to load team member before update", error: memberError })
      return NextResponse.json({ error: "Failed to update team member" }, { status: 500 })
    }

    if (!existingMember?.id) {
      return NextResponse.json({ error: "Team member not found" }, { status: 404 })
    }

    if (existingMember.role === "owner" && role !== "owner") {
      const { count, error: ownerCountError } = await countOwners(businessId)

      if (ownerCountError) {
        logApiError({ requestId, endpoint, userId: user.id, businessId, status: 500, message: "Failed to count owners", error: ownerCountError })
        return NextResponse.json({ error: "Failed to update team member" }, { status: 500 })
      }

      if (count <= 1) {
        return NextResponse.json({ error: "At least one owner must remain on the business." }, { status: 400 })
      }
    }

    const { error: updateError } = await admin
      .from("business_members")
      .update({ role })
      .eq("business_id", businessId)
      .eq("user_id", memberUserId)

    if (updateError) {
      logApiError({ requestId, endpoint, userId: user.id, businessId, status: 500, message: "Failed to update team member role", error: updateError })
      return NextResponse.json({ error: "Failed to update team member" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logApiError({ requestId, endpoint, status: 500, message: "Failed to update team member", error })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const endpoint = "/api/team-members"
  const requestId = createRequestId()

  try {
    const { user, supabase } = await getAuthenticatedContext(req)

    if (!user || !supabase) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    const businessId = typeof body?.businessId === "string" ? body.businessId.trim() : ""
    const memberUserId = typeof body?.memberUserId === "string" ? body.memberUserId.trim() : ""

    if (!businessId || !memberUserId) {
      return NextResponse.json({ error: "businessId and memberUserId are required" }, { status: 400 })
    }

    const access = await assertBusinessRole(user.id, businessId, supabase, "owner")

    if (access.error) {
      return NextResponse.json({ error: access.error }, { status: access.role ? 403 : 404 })
    }

    const { business } = await getBusinessAccess(user.id, businessId, supabase)

    if (!business) {
      return NextResponse.json({ error: "Business membership not found" }, { status: 404 })
    }

    const admin = createServiceClient()
    const { data: existingMember, error: memberError } = await admin
      .from("business_members")
      .select("id, role")
      .eq("business_id", businessId)
      .eq("user_id", memberUserId)
      .eq("status", "active")
      .maybeSingle()

    if (memberError) {
      logApiError({ requestId, endpoint, userId: user.id, businessId, status: 500, message: "Failed to load team member before removal", error: memberError })
      return NextResponse.json({ error: "Failed to remove team member" }, { status: 500 })
    }

    if (!existingMember?.id) {
      return NextResponse.json({ error: "Team member not found" }, { status: 404 })
    }

    if (existingMember.role === "owner") {
      const { count, error: ownerCountError } = await countOwners(businessId)

      if (ownerCountError) {
        logApiError({ requestId, endpoint, userId: user.id, businessId, status: 500, message: "Failed to count owners before removal", error: ownerCountError })
        return NextResponse.json({ error: "Failed to remove team member" }, { status: 500 })
      }

      if (count <= 1) {
        return NextResponse.json({ error: "At least one owner must remain on the business." }, { status: 400 })
      }
    }

    const { error: deleteError } = await admin
      .from("business_members")
      .delete()
      .eq("business_id", businessId)
      .eq("user_id", memberUserId)

    if (deleteError) {
      logApiError({ requestId, endpoint, userId: user.id, businessId, status: 500, message: "Failed to remove team member", error: deleteError })
      return NextResponse.json({ error: "Failed to remove team member" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logApiError({ requestId, endpoint, status: 500, message: "Failed to remove team member", error })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
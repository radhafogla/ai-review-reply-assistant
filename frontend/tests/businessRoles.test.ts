import { describe, expect, it } from "vitest"
import { hasAnyRole, hasPermission, rolePermissions } from "../lib/businessRoles"

describe("businessRoles", () => {
  it("matches the expected permission matrix", () => {
    expect(rolePermissions.owner).toEqual({
      canManageTeam: true,
      canConfigureSync: true,
      canPostReplies: true,
      canViewDashboard: true,
    })

    expect(rolePermissions.viewer).toEqual({
      canManageTeam: false,
      canConfigureSync: false,
      canPostReplies: false,
      canViewDashboard: true,
    })
  })

  it("checks individual permissions correctly", () => {
    expect(hasPermission("manager", "canConfigureSync")).toBe(true)
    expect(hasPermission("responder", "canManageTeam")).toBe(false)
    expect(hasPermission("viewer", "canViewDashboard")).toBe(true)
  })

  it("respects role hierarchy for minimum access", () => {
    expect(hasAnyRole("owner", ["manager"])).toBe(true)
    expect(hasAnyRole("manager", ["responder"])).toBe(true)
    expect(hasAnyRole("viewer", ["responder"])).toBe(false)
    expect(hasAnyRole("responder", ["owner", "manager"])).toBe(false)
  })
})
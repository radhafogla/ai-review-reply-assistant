"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useRouter } from "next/navigation"

type Props = {
  isOpen: boolean
  onClose: () => void
  userEmail?: string
}

export default function SettingsModal({ isOpen, onClose, userEmail }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"account" | "danger">("account")
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("")
  const [deleteStep, setDeleteStep] = useState<"initial" | "email" | "final">("initial")
  const [deletingType, setDeletingType] = useState<"data" | "account" | null>(null)

  const handleDeleteData = async () => {
    setIsDeleting(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        alert("Session expired. Please sign in again.")
        return
      }

      const res = await fetch("/api/delete-data", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      })

      if (!res.ok) {
        alert("Failed to delete data. Please try again.")
        return
      }

      alert("All your data has been deleted successfully. You will be logged out.")
      setDeleteStep("initial")
      setDeleteConfirmEmail("")
      setDeletingType(null)
      onClose()

      await supabase.auth.signOut()
      router.push("/")
    } catch (error) {
      console.error("Delete data error:", error)
      alert("An error occurred. Please try again.")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteAccount = async () => {
    setIsDeleting(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        alert("Session expired. Please sign in again.")
        return
      }

      const res = await fetch("/api/delete-account", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      })

      if (!res.ok) {
        alert("Failed to delete account. Please try again.")
        return
      }

      alert("Your account has been permanently deleted.")
      setDeleteStep("initial")
      setDeleteConfirmEmail("")
      setDeletingType(null)
      onClose()

      await supabase.auth.admin.deleteUser(sessionData.session!.user.id)
      await supabase.auth.signOut()
      router.push("/")
    } catch (error) {
      console.error("Delete account error:", error)
      alert("An error occurred. Please try again.")
    } finally {
      setIsDeleting(false)
    }
  }

  const canProceedDelete = deleteConfirmEmail === userEmail

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white shadow-lg">
        {/* Header */}
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Settings</h2>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-700"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200">
          <div className="flex gap-4 px-6 py-3">
            <button
              onClick={() => {
                setActiveTab("account")
                setDeleteStep("initial")
                setDeleteConfirmEmail("")
                setDeletingType(null)
              }}
              className={`text-sm font-semibold ${
                activeTab === "account"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "border-b-2 border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              Account
            </button>
            <button
              onClick={() => {
                setActiveTab("danger")
                setDeleteStep("initial")
                setDeleteConfirmEmail("")
                setDeletingType(null)
              }}
              className={`text-sm font-semibold ${
                activeTab === "danger"
                  ? "border-b-2 border-red-600 text-red-600"
                  : "border-b-2 border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              Danger Zone
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {activeTab === "account" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-2">Account Info</h3>
                <div className="rounded-lg bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-600">Email</p>
                  <p className="text-sm text-slate-900 break-all">{userEmail || "Not available"}</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-2">Settings</h3>
                <p className="text-sm text-slate-600">More account settings coming soon...</p>
              </div>
            </div>
          )}

          {activeTab === "danger" && (
            <div className="space-y-6">
              {/* Delete Data Section */}
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                <h3 className="font-semibold text-orange-900 mb-2">Delete All Data</h3>
                <p className="text-sm text-orange-800 mb-4">
                  This will permanently delete all your businesses, reviews, integrations, and replies. Your account will remain active.
                </p>

                {deletingType !== "data" && (
                  <button
                    onClick={() => {
                      setDeletingType("data")
                      setDeleteStep("email")
                      setDeleteConfirmEmail("")
                    }}
                    className="px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700"
                  >
                    Delete All Data
                  </button>
                )}

                {deletingType === "data" && deleteStep === "email" && (
                  <div className="space-y-3 mt-4">
                    <p className="text-sm text-orange-900 font-medium">
                      To confirm, please type your email address:
                    </p>
                    <input
                      type="text"
                      placeholder="Enter your email"
                      value={deleteConfirmEmail}
                      onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-orange-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setDeletingType(null)
                          setDeleteStep("initial")
                          setDeleteConfirmEmail("")
                        }}
                        className="flex-1 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => setDeleteStep("final")}
                        disabled={!canProceedDelete}
                        className="flex-1 px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
                      >
                        Continue
                      </button>
                    </div>
                  </div>
                )}

                {deletingType === "data" && deleteStep === "final" && (
                  <div className="space-y-3 mt-4">
                    <div className="rounded-lg bg-orange-100 p-3 border border-orange-300">
                      <p className="text-sm text-orange-900 font-semibold">⚠️ Last warning</p>
                      <p className="text-sm text-orange-800 mt-1">
                        This action cannot be undone. All your data will be permanently deleted.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setDeletingType(null)
                          setDeleteStep("initial")
                          setDeleteConfirmEmail("")
                        }}
                        disabled={isDeleting}
                        className="flex-1 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:bg-slate-100"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteData}
                        disabled={isDeleting}
                        className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
                      >
                        {isDeleting ? "Deleting..." : "Yes, Delete Everything"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Delete Account Section */}
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <h3 className="font-semibold text-red-900 mb-2">Delete Account</h3>
                <p className="text-sm text-red-800 mb-4">
                  This will permanently delete your account and all associated data. This action cannot be undone.
                </p>

                {deletingType !== "account" && (
                  <button
                    onClick={() => {
                      setDeletingType("account")
                      setDeleteStep("email")
                      setDeleteConfirmEmail("")
                    }}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
                  >
                    Delete Account
                  </button>
                )}

                {deletingType === "account" && deleteStep === "email" && (
                  <div className="space-y-3 mt-4">
                    <p className="text-sm text-red-900 font-medium">
                      To confirm, please type your email address:
                    </p>
                    <input
                      type="text"
                      placeholder="Enter your email"
                      value={deleteConfirmEmail}
                      onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setDeletingType(null)
                          setDeleteStep("initial")
                          setDeleteConfirmEmail("")
                        }}
                        className="flex-1 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => setDeleteStep("final")}
                        disabled={!canProceedDelete}
                        className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
                      >
                        Continue
                      </button>
                    </div>
                  </div>
                )}

                {deletingType === "account" && deleteStep === "final" && (
                  <div className="space-y-3 mt-4">
                    <div className="rounded-lg bg-red-100 p-3 border border-red-300">
                      <p className="text-sm text-red-900 font-semibold">⚠️ Final Warning</p>
                      <p className="text-sm text-red-800 mt-1">
                        This will permanently delete your account and ALL data. You will not be able to recover this account or any data associated with it.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setDeletingType(null)
                          setDeleteStep("initial")
                          setDeleteConfirmEmail("")
                        }}
                        disabled={isDeleting}
                        className="flex-1 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:bg-slate-100"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteAccount}
                        disabled={isDeleting}
                        className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
                      >
                        {isDeleting ? "Deleting..." : "Yes, Delete My Account"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

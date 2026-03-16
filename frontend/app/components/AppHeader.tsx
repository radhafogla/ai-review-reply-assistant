"use client";

import { supabase } from "@/lib/supabaseClient";

interface AppHeaderProps {
  title?: string;
  userName?: string | null;
}

export default function AppHeader({
  title = "Welcome",
  userName
}: AppHeaderProps) {
  const displayName = userName?.trim() || "there";

  return (
    <div className="mb-4 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
      <div className="flex items-center justify-between gap-4 py-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {title} {displayName}!
        </h1>

        <button
          type="button"
          onClick={async () => await supabase.auth.signOut()}
          className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-600"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
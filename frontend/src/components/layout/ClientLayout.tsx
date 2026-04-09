"use client";

import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import { useAuthStore } from "@/store/useAuthStore";

export default function ClientLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, loadUser } = useAuthStore();
  const isLoginPage = pathname === "/login";

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!isLoading && !user && !isLoginPage) {
      router.replace("/login");
    }
  }, [isLoading, user, isLoginPage, router]);

  // Show nothing while checking auth (prevents flash)
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="w-5 h-5 border-2 border-gray-700 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  // Login page — no sidebar, no auth required
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Not logged in — will redirect via the useEffect above
  if (!user) {
    return null;
  }

  // Authenticated — show app with sidebar
  const isLessonPage = pathname?.startsWith("/lesson/");
  if (isLessonPage) {
    return <>{children}</>;
  }

  return (
    <>
      <Sidebar />
      <div className="ml-0 md:ml-56">{children}</div>
    </>
  );
}

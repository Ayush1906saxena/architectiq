"use client";

import { ReactNode, useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import { useAuthStore } from "@/store/useAuthStore";

export default function ClientLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLessonPage = pathname?.startsWith("/lesson/");
  const isLoginPage = pathname === "/login";
  const loadUser = useAuthStore((s) => s.loadUser);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  if (isLessonPage || isLoginPage) {
    return <>{children}</>;
  }

  return (
    <>
      <Sidebar />
      <div style={{ marginLeft: "14rem" }}>{children}</div>
    </>
  );
}

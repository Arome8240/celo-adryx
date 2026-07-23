"use client";

import { usePathname } from "next/navigation";

import { BottomNav } from "@/components/bottom-nav";
import { Navbar } from "@/components/navbar";

/**
 * Onboarding is a full-screen intro, not another tab inside the app shell —
 * showing the navbar/bottom-nav there would just be chrome around chrome.
 */
export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isOnboarding = pathname?.startsWith("/onboarding");

  if (isOnboarding) {
    return <main className="flex-1">{children}</main>;
  }

  return (
    <>
      <Navbar />
      <main className="flex-1 pb-16 sm:pb-0">{children}</main>
      <BottomNav />
    </>
  );
}

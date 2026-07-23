"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export const ONBOARDING_STORAGE_KEY = "adryx-onboarded";

/**
 * First-launch redirect to /onboarding — this is a MiniPay mini app, opened
 * fresh inside MiniPay's in-app browser rather than a site people bookmark
 * and revisit gradually, so a one-time intro screen belongs in the launch
 * path itself rather than behind a link someone has to find.
 */
export function OnboardingGate() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/onboarding") return;
    if (localStorage.getItem(ONBOARDING_STORAGE_KEY)) return;
    router.replace("/onboarding");
  }, [pathname, router]);

  return null;
}

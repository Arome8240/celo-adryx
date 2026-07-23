"use client";

import { useEffect, useState } from "react";
import { Airplane } from "iconsax-react";
import { cn } from "@/lib/utils";

const SPLASH_VISIBLE_MS = 900;
const SPLASH_FADE_MS = 300;

/**
 * Brief branded cover screen on cold start — mounted once in the root
 * layout, so it only ever appears on a fresh app launch, never on
 * client-side navigation between pages. Purely presentational: it doesn't
 * know or care whether OnboardingGate is about to redirect underneath it,
 * it just covers the screen long enough that transition never flashes.
 */
export function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), SPLASH_VISIBLE_MS);
    const hideTimer = setTimeout(
      () => setVisible(false),
      SPLASH_VISIBLE_MS + SPLASH_FADE_MS,
    );
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-background transition-opacity duration-300",
        fading ? "opacity-0" : "opacity-100",
      )}
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
        <Plane className="h-10 w-10 text-primary" />
      </div>
      <span className="text-xl font-bold tracking-tight">Adryx</span>
    </div>
  );
}

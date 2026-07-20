"use client";

import { useAuthStore } from "./auth-store";

/**
 * Wallet-based auth has no separate login page to redirect to — connecting
 * the wallet *is* signing in (see wallet-provider.tsx). So this just reports
 * state for a page to render "connect your wallet to continue" inline,
 * unlike adryxflight's version which redirects across subdomains.
 */
export function useRequireAuth() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isSigningIn = useAuthStore((s) => s.isSigningIn);
  return { ready: !!accessToken, isSigningIn };
}

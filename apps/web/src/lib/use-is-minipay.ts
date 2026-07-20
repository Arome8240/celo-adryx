"use client";

import { useEffect, useState } from "react";

/**
 * Whether the app is currently running inside MiniPay's in-app browser.
 * `window.ethereum.isMiniPay` is only meaningful client-side, so this always
 * starts `false` (matching server-rendered markup) and flips after mount —
 * every consumer of this hook should be prepared for that one-render lag.
 */
export function useIsMiniPay(): boolean {
  const [isMiniPay, setIsMiniPay] = useState(false);

  useEffect(() => {
    if (window.ethereum?.isMiniPay) {
      setIsMiniPay(true);
    }
  }, []);

  return isMiniPay;
}

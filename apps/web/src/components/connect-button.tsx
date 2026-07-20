"use client";

import { ConnectButton as RainbowKitConnectButton } from "@rainbow-me/rainbowkit";
import { useIsMiniPay } from "@/lib/use-is-minipay";

export function ConnectButton() {
  const isMiniPay = useIsMiniPay();

  if (isMiniPay) {
    return null;
  }

  return <RainbowKitConnectButton />;
}

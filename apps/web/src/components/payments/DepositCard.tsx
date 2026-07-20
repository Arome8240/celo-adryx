"use client";

import { useState } from "react";
import { erc20Abi, parseAbi, type Hex } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { BookingRecord } from "@/lib/bookings-api";
import { paymentsApi } from "@/lib/payments-api";
import { useIsMiniPay } from "@/lib/use-is-minipay";

const ESCROW_ABI = parseAbi([
  "function deposit(bytes32 bookingIdHash, uint256 amount)",
  "function depositNative(bytes32 bookingIdHash) payable",
]);

type Step = "idle" | "approving" | "depositing" | "confirming";

export function DepositCard({
  booking,
  onConfirmed,
}: {
  booking: BookingRecord;
  onConfirmed: (updated: BookingRecord) => void;
}) {
  const isMiniPay = useIsMiniPay();
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | undefined>();

  // MiniPay wallets hold USDm — everyone else more commonly holds native
  // CELO, so that's the default outside MiniPay. See TASKS.md Phase 8.
  const asset = isMiniPay ? "USDM" : "CELO";

  const stepLabel: Record<Step, string> = {
    idle: `Pay with ${asset === "USDM" ? "USDm" : "CELO"}`,
    approving: "Approving USDm…",
    depositing: "Depositing…",
    confirming: "Confirming…",
  };

  async function handlePay() {
    setError(undefined);
    if (!walletClient || !publicClient || !address) {
      setError("Connect your wallet to pay");
      return;
    }

    try {
      const quote = await paymentsApi.initiate(booking.id, asset);
      const amount = BigInt(quote.amount);
      const contractAddress = quote.contractAddress as Hex;
      const bookingIdHash = quote.bookingIdHash as Hex;

      let depositHash: Hex;
      if (quote.isNative) {
        setStep("depositing");
        depositHash = await walletClient.writeContract({
          address: contractAddress,
          abi: ESCROW_ABI,
          functionName: "depositNative",
          args: [bookingIdHash],
          value: amount,
        });
      } else {
        const tokenAddress = quote.tokenAddress as Hex;

        setStep("approving");
        const approveHash = await walletClient.writeContract({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: "approve",
          args: [contractAddress, amount],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });

        setStep("depositing");
        depositHash = await walletClient.writeContract({
          address: contractAddress,
          abi: ESCROW_ABI,
          functionName: "deposit",
          args: [bookingIdHash, amount],
        });
      }
      await publicClient.waitForTransactionReceipt({ hash: depositHash });

      setStep("confirming");
      const updated = await paymentsApi.confirm(booking.id, depositHash);
      onConfirmed(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setStep("idle");
    }
  }

  const busy = step !== "idle";

  return (
    <Card className="p-5">
      <h3 className="mb-2 font-semibold">Complete your payment</h3>
      <p className="mb-4 text-sm text-muted-foreground">
        {asset === "USDM"
          ? "Pay directly from your connected wallet — this approves and deposits USDm into the booking's escrow contract, held until your reservation is confirmed."
          : "Pay directly from your connected wallet — this sends CELO into the booking's escrow contract (priced at the current CELO/USD rate), held until your reservation is confirmed."}
      </p>
      {!isConnected && (
        <p className="mb-3 text-sm text-destructive">Connect your wallet to pay.</p>
      )}
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
      <Button onClick={handlePay} disabled={busy || !isConnected} className="w-full">
        {busy ? stepLabel[step] : stepLabel.idle}
      </Button>
    </Card>
  );
}

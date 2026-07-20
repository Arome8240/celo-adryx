"use client";

import { useState } from "react";
import { erc20Abi, parseAbi, type Hex } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { BookingRecord } from "@/lib/bookings-api";
import { paymentsApi } from "@/lib/payments-api";

const ESCROW_ABI = parseAbi([
  "function deposit(bytes32 bookingIdHash, uint256 amount)",
]);

type Step = "idle" | "approving" | "depositing" | "confirming";

const STEP_LABEL: Record<Step, string> = {
  idle: "Pay with cUSD",
  approving: "Approving cUSD…",
  depositing: "Depositing…",
  confirming: "Confirming…",
};

export function DepositCard({
  booking,
  onConfirmed,
}: {
  booking: BookingRecord;
  onConfirmed: (updated: BookingRecord) => void;
}) {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | undefined>();

  async function handlePay() {
    setError(undefined);
    if (!walletClient || !publicClient || !address) {
      setError("Connect your wallet to pay");
      return;
    }

    try {
      const quote = await paymentsApi.initiate(booking.id);
      const amount = BigInt(quote.amount);
      const tokenAddress = quote.tokenAddress as Hex;
      const contractAddress = quote.contractAddress as Hex;
      const bookingIdHash = quote.bookingIdHash as Hex;

      setStep("approving");
      const approveHash = await walletClient.writeContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [contractAddress, amount],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      setStep("depositing");
      const depositHash = await walletClient.writeContract({
        address: contractAddress,
        abi: ESCROW_ABI,
        functionName: "deposit",
        args: [bookingIdHash, amount],
      });
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
        Pay directly from your connected wallet — this approves and deposits cUSD into the
        booking&apos;s escrow contract, held until your reservation is confirmed.
      </p>
      {!isConnected && (
        <p className="mb-3 text-sm text-destructive">Connect your wallet to pay.</p>
      )}
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
      <Button onClick={handlePay} disabled={busy || !isConnected} className="w-full">
        {busy ? STEP_LABEL[step] : STEP_LABEL.idle}
      </Button>
    </Card>
  );
}

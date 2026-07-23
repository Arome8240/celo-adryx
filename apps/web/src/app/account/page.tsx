"use client";

import { useAccount, useDisconnect } from "wagmi";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConnectButton } from "@/components/connect-button";
import { UserBalance } from "@/components/user-balance";
import { useAuthStore } from "@/lib/auth-store";
import { useRequireAuth } from "@/lib/use-require-auth";

export default function AccountPage() {
  const { ready, isSigningIn } = useRequireAuth();
  const { isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const clearSession = useAuthStore((s) => s.clearSession);
  const user = useAuthStore((s) => s.user);

  if (!ready) {
    return (
      <main className="container max-w-lg py-8">
        <Card className="flex flex-col items-center gap-4 p-6 text-center">
          <p className="text-muted-foreground">
            {isSigningIn ? "Signing in…" : "Connect your wallet to view your account."}
          </p>
          {!isSigningIn && <ConnectButton />}
        </Card>
      </main>
    );
  }

  function handleDisconnect() {
    clearSession();
    disconnect();
  }

  return (
    <main className="container max-w-lg py-8">
      <h1 className="mb-6 text-2xl font-semibold">Account</h1>

      <UserBalance />

      <Card className="p-5">
        <h3 className="mb-3 font-semibold">Contact details</h3>
        <p className="text-sm text-muted-foreground">
          {user?.email ?? "No email on file"}
        </p>
        <p className="text-sm text-muted-foreground">
          {user?.phone ?? "No phone on file"}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Added automatically from your most recent booking&apos;s contact details.
        </p>
      </Card>

      {isConnected && (
        <Button variant="outline" className="mt-5 w-full" onClick={handleDisconnect}>
          Disconnect wallet
        </Button>
      )}
    </main>
  );
}

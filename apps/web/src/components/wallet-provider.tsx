"use client";

import { RainbowKitProvider, connectorsForWallets } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { injectedWallet } from "@rainbow-me/rainbowkit/wallets";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SiweMessage } from "siwe";
import { useEffect, useRef, useState } from "react";
import {
  useAccount,
  useConnect,
  useSignMessage,
  WagmiProvider,
  createConfig,
  http,
} from "wagmi";
import { celo, celoSepolia } from "wagmi/chains";
import { authApi } from "@/lib/auth-api";
import { useAuthStore } from "@/lib/auth-store";

const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: [injectedWallet],
    },
  ],
  {
    appName: "my-celo-app",
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  },
);

const wagmiConfig = createConfig({
  chains: [celo, celoSepolia],
  connectors,
  transports: {
    [celo.id]: http(),
    [celoSepolia.id]: http(),
  },
  ssr: true,
});

const queryClient = new QueryClient();

function WalletProviderInner({ children }: { children: React.ReactNode }) {
  const { connect, connectors } = useConnect();
  const { address, isConnected, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);
  const setIsSigningIn = useAuthStore((s) => s.setIsSigningIn);
  const signInInFlight = useRef(false);

  // Check if the app is running inside MiniPay — the wallet connection is
  // implicit there, so connect immediately without a "Connect Wallet" tap.
  useEffect(() => {
    if (window.ethereum && window.ethereum.isMiniPay) {
      const injectedConnector = connectors.find((c) => c.id === "injected");
      if (injectedConnector) {
        connect({ connector: injectedConnector });
      }
    }
  }, [connect, connectors]);

  // Sign-In-With-Ethereum: a connected wallet with no matching session is
  // this app's entire signup/login flow — see TASKS.md Phase 1.
  useEffect(() => {
    if (!isConnected || !address) return;
    if (accessToken && user?.walletAddress.toLowerCase() === address.toLowerCase()) {
      return;
    }
    if (signInInFlight.current) return;

    let cancelled = false;
    signInInFlight.current = true;
    setIsSigningIn(true);

    (async () => {
      try {
        const { nonce } = await authApi.nonce();
        const siweMessage = new SiweMessage({
          domain: window.location.host,
          address,
          statement: "Sign in to my-celo-app.",
          uri: window.location.origin,
          version: "1",
          chainId: chainId ?? celo.id,
          nonce,
        });
        const message = siweMessage.prepareMessage();
        const signature = await signMessageAsync({ message });
        const result = await authApi.verify(message, signature);
        if (!cancelled) {
          setSession(result.user, result.accessToken, result.refreshToken);
        }
      } catch (err) {
        // Most commonly: the user rejected the signature request. Left
        // unauthenticated — the effect retries next time isConnected/address
        // change (e.g. the user tries connecting again).
        console.error("Sign-in with Ethereum failed:", err);
      } finally {
        signInInFlight.current = false;
        if (!cancelled) setIsSigningIn(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isConnected, address, accessToken, user, chainId, signMessageAsync, setSession, setIsSigningIn]);

  // Wallet disconnected — drop any session tied to the previous address.
  useEffect(() => {
    if (!isConnected && accessToken) {
      clearSession();
    }
  }, [isConnected, accessToken, clearSession]);

  return <>{children}</>;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <WalletProviderInner>{children}</WalletProviderInner>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

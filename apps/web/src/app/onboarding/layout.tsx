import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Welcome",
  description:
    "Get started with Adryx — search real flights and pay straight from your wallet in USDm or CELO.",
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

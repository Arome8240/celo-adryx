"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Airplane, SearchNormal, Wallet, Ticket } from "iconsax-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMiniPay } from "@/lib/use-is-minipay";
import { ONBOARDING_STORAGE_KEY } from "@/components/onboarding-gate";

export default function OnboardingPage() {
  const router = useRouter();
  const isMiniPay = useIsMiniPay();
  const [step, setStep] = useState(0);

  const steps = [
    {
      icon: Airplane,
      title: "Welcome to Adryx",
      description:
        "Book real flights and pay straight from your wallet — no cards, no bank transfers, no waiting on approvals.",
    },
    {
      icon: SearchNormal,
      title: "Search live flights",
      description:
        "Real fares from airlines worldwide — search any route and any date, just like a travel site.",
    },
    {
      icon: Wallet,
      title: "Pay with your wallet",
      description: isMiniPay
        ? "You're on MiniPay — pay instantly in USDm. Your funds stay in escrow until your booking is confirmed."
        : "Connect any wallet and pay in CELO. Your funds stay in escrow until your booking is confirmed.",
    },
    {
      icon: Ticket,
      title: "Your trips, one tap away",
      description:
        "Track bookings and manage your account from the tab bar below — built for quick, on-the-go use.",
    },
  ];

  const isLast = step === steps.length - 1;
  const current = steps[step];
  const Icon = current.icon;

  function complete() {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    router.replace("/");
  }

  return (
    <div
      className="mx-auto flex min-h-dvh w-full max-w-sm flex-col px-6 py-8"
      style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
    >
      <div className="flex justify-end">
        {!isLast && (
          <button
            onClick={complete}
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Skip
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <Icon variant="Bold" className="h-9 w-9 text-primary" />
        </div>
        <h1 className="mb-3 text-2xl font-bold tracking-tight">{current.title}</h1>
        <p className="text-muted-foreground">{current.description}</p>
      </div>

      <div className="mb-6 flex items-center justify-center gap-2">
        {steps.map((_, index) => (
          <div
            key={index}
            className={cn(
              "h-1.5 rounded-full transition-all",
              index === step ? "w-6 bg-primary" : "w-1.5 bg-muted",
            )}
          />
        ))}
      </div>

      <div className="flex items-center gap-3">
        {step > 0 && (
          <Button variant="outline" className="flex-1" onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
        )}
        <Button
          className="flex-1"
          onClick={() => (isLast ? complete() : setStep((s) => s + 1))}
        >
          {isLast ? "Get started" : "Next"}
        </Button>
      </div>
    </div>
  );
}

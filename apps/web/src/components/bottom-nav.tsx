"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Ticket, User } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Search", icon: Home },
  { href: "/bookings", label: "Trips", icon: Ticket },
  { href: "/account", label: "Account", icon: User },
];

/**
 * Bottom tab bar for mobile — this is a MiniPay mini app, meant to be opened
 * inside MiniPay's in-app browser, so the primary navigation should feel
 * like a native mobile app rather than a marketing site. Hidden on larger
 * viewports, where the top Navbar already covers navigation.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-3">
        {TABS.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

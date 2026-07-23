"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { User, Ticket, ProfileCircle } from "iconsax-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuthStore } from "@/lib/auth-store"
import { cn } from "@/lib/utils"

const profileLinks = [
  { name: "My Trips", href: "/bookings", icon: Ticket },
  { name: "Account", href: "/account", icon: ProfileCircle },
]

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function ProfileMenu() {
  const pathname = usePathname()
  const user = useAuthStore((s) => s.user)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <User className="h-5 w-5" />
          <span className="sr-only">Open profile menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {user?.walletAddress && (
          <>
            <DropdownMenuLabel className="font-mono text-xs font-normal text-muted-foreground">
              {shortenAddress(user.walletAddress)}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        {profileLinks.map((link) => {
          const Icon = link.icon
          return (
            <DropdownMenuItem key={link.href} asChild>
              <Link
                href={link.href}
                className={cn(
                  "cursor-pointer",
                  pathname === link.href && "text-primary",
                )}
              >
                <Icon className="mr-2 h-4 w-4" />
                {link.name}
              </Link>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center justify-between px-4">
        {/* Logo — My Trips/Account are reachable via BottomNav on mobile, so there's nothing else to put here on small screens */}
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <span className="font-bold text-xl">
            Adryx
          </span>
        </Link>

        <div className="hidden md:flex items-center">
          <ProfileMenu />
        </div>
      </div>
    </header>
  )
}

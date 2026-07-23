"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { HambergerMenu, Export, User, Ticket, ProfileCircle } from "iconsax-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ConnectButton } from "@/components/connect-button"
import { useAuthStore } from "@/lib/auth-store"
import { cn } from "@/lib/utils"

const navLinks = [
  { name: "Home", href: "/" },
  { name: "Docs", href: "https://docs.celo.org", external: true },
]

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
  const pathname = usePathname()
  const isSigningIn = useAuthStore((s) => s.isSigningIn)

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          {/* Mobile menu button */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <HambergerMenu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80">
              <div className="flex items-center gap-2 mb-8">

                <span className="font-bold text-lg">
                  my-celo-app
                </span>
              </div>
              <nav className="flex flex-col gap-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noopener noreferrer" : undefined}
                    className={`flex items-center gap-2 text-base font-medium transition-colors hover:text-primary ${
                      pathname === link.href ? "text-foreground" : "text-foreground/70"
                    }`}
                  >
                    {link.name}
                    {link.external && <Export className="h-4 w-4" />}
                  </Link>
                ))}
                {profileLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-2 text-base font-medium transition-colors hover:text-primary ${
                      pathname === link.href ? "text-foreground" : "text-foreground/70"
                    }`}
                  >
                    <link.icon className="h-4 w-4" />
                    {link.name}
                  </Link>
                ))}
                <div className="mt-6 pt-6 border-t">
                  <ConnectButton />
                </div>
              </nav>
            </SheetContent>
          </Sheet>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">

            <span className="hidden font-bold text-xl sm:inline-block">
              my-celo-app
            </span>
          </Link>
        </div>
        
        {/* Desktop navigation */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              target={link.external ? "_blank" : undefined}
              rel={link.external ? "noopener noreferrer" : undefined}
              className={`flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-primary ${
                pathname === link.href
                  ? "text-foreground"
                  : "text-foreground/70"
              }`}
            >
              {link.name}
              {link.external && <Export className="h-4 w-4" />}
            </Link>
          ))}
          
          <div className="flex items-center gap-3">
            {isSigningIn && (
              <span className="text-sm text-muted-foreground">Signing in…</span>
            )}
            <ConnectButton />
            <ProfileMenu />
          </div>
        </nav>
      </div>
    </header>
  )
}

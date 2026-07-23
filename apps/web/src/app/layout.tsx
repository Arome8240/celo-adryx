import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

import { BottomNav } from '@/components/bottom-nav';
import { Navbar } from '@/components/navbar';
import { OnboardingGate } from '@/components/onboarding-gate';
import { WalletProvider } from "@/components/wallet-provider"

const inter = Inter({ subsets: ['latin'] });

const APP_NAME = 'Adryx';
const APP_DESCRIPTION =
  'Search real flights and pay straight from your wallet in USDm or CELO — no cards, no bank transfers. Adryx is a MiniPay mini app for booking flights on Celo.';

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — Book Flights on Celo`,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  openGraph: {
    type: 'website',
    siteName: APP_NAME,
    title: `${APP_NAME} — Book Flights on Celo`,
    description: APP_DESCRIPTION,
  },
  twitter: {
    card: 'summary',
    title: `${APP_NAME} — Book Flights on Celo`,
    description: APP_DESCRIPTION,
  },
  verification: {
    other: {
      'talentapp:project_verification':
        'daeb8c6793603c82e87fe6fad94a8ff2a01d8202615bcdcea1d1b45a673b2992ac02ab422a745bb47e875914a23ca72d505a0c11c559ba8bb805ad897a049f7e',
    },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#020817' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* Navbar is included on all pages */}
        <div className="relative flex min-h-screen flex-col">
          <WalletProvider>
            <OnboardingGate />
            <Navbar />
            <main className="flex-1 pb-16 sm:pb-0">
              {children}
            </main>
            <BottomNav />
          </WalletProvider>
        </div>
      </body>
    </html>
  );
}

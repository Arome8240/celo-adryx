import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

import { Navbar } from '@/components/navbar';
import { WalletProvider } from "@/components/wallet-provider"

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'my-celo-app',
  description: 'A new Celo blockchain project',
  verification: {
    other: {
      'talentapp:project_verification':
        'daeb8c6793603c82e87fe6fad94a8ff2a01d8202615bcdcea1d1b45a673b2992ac02ab422a745bb47e875914a23ca72d505a0c11c559ba8bb805ad897a049f7e',
    },
  },
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
            <Navbar />
            <main className="flex-1">
              {children}
            </main>
          </WalletProvider>
        </div>
      </body>
    </html>
  );
}

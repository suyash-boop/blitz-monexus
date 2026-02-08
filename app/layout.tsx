import type { Metadata } from 'next';
import { Space_Grotesk, Geist_Mono } from 'next/font/google';
import './globals.css';

import { PrivyProvider } from '@/components/providers/PrivyProvider';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Monexus - Monad Community Platform',
  description: 'A Monad-native community platform with social feed and on-chain bounty system',
  keywords: ['Monad', 'blockchain', 'community', 'bounty', 'web3', 'crypto'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${spaceGrotesk.variable} ${geistMono.variable} antialiased bg-[#0a0a0f] text-text-primary min-h-screen`}
      >
        <PrivyProvider>
          <QueryProvider>
            <div className="flex flex-col min-h-screen">
              <Header />
              <div className="flex flex-1">
                <Sidebar />
                <main className="flex-1 lg:ml-64 pb-16 lg:pb-0">
                  {children}
                </main>
              </div>
              <MobileNav />
            </div>
          </QueryProvider>
        </PrivyProvider>
      </body>
    </html>
  );
}

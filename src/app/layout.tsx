import type { Metadata, Viewport } from 'next'
import './globals.css'
import { LanguageProvider } from '@/components/LanguageContext'
import LayoutWrapper from '@/components/LayoutWrapper'

export const metadata: Metadata = {
  title: 'Bossque Carwash - Dashboard',
  description: 'Modern carwash management system with real-time queue and payment processing',
  manifest: '/manifest.json', // Add manifest link
  appleWebApp: { // Apple specific PWA settings
    capable: true,
    statusBarStyle: 'default',
    title: 'Bossque Carwash',
  },
  keywords: ['carwash', 'management', 'dashboard', 'queue', 'payment'],
  authors: [{ name: 'Bossque Team' }],
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  colorScheme: 'dark light',
  themeColor: '#2563eb', // Moved themeColor here
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ms" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const theme = localStorage.getItem('theme');
                if (theme === 'light') {
                  document.documentElement.classList.remove('dark');
                } else {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body className="bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 antialiased selection:bg-blue-500/30 transition-colors duration-300">
        <LanguageProvider>
          <LayoutWrapper>
            {children}
          </LayoutWrapper>
        </LanguageProvider>
      </body>
    </html>
  )
}

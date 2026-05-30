import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Bossque Kiosk",
  description: "Self-service kiosk for Bossque Carwash customers",
  manifest: "/kiosk/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Bossque Kiosk',
  },
};

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
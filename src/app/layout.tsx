import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Skupni koledar',
  description: 'Skupni koledar z vlogami: administrator, urejevalec, gledalec.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sl">
      <body>{children}</body>
    </html>
  );
}

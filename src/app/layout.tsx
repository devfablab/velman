import type { Metadata } from 'next';
import ThemeRegistry from '@/components/ThemeRegistry';
import './globals.css';

export const metadata: Metadata = {
  title: 'velman',
  description: '데브허브 관리자',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <ThemeRegistry>{children}</ThemeRegistry>
      </body>
    </html>
  );
}

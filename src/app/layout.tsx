import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import ThemeRegistry from '@/components/ThemeRegistry';
import './globals.css';

export const metadata: Metadata = {
  title: 'velman',
  description: '데브허브 관리앱',
};

const Pre = localFont({
  src: './fonts/PretendardVariable.woff2',
  style: 'normal',
  variable: '--pre',
});

const Neo = localFont({
  src: './fonts/NanumSquareNeoVF.woff2',
  style: 'normal',
  variable: '--neo',
});

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko-KR" className={`${Pre.variable} ${Neo.variable}`} suppressHydrationWarning>
      <body>
        <AppRouterCacheProvider>
          <ThemeRegistry>{children}</ThemeRegistry>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}

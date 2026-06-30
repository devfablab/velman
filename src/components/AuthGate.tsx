'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Box } from '@mui/material';
import LoadingBox from './LoadingBox';

type GateState = 'checking' | 'ready';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<GateState>('checking');

  useEffect(() => {
    const controller = new AbortController();

    setState('checking');

    fetch('/api/auth/me', {
      credentials: 'include',
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok && pathname !== '/login') {
          router.replace('/login');
          return;
        }

        if (response.ok && pathname === '/login') {
          router.replace('/dashboard');
          return;
        }

        setState('ready');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

        if (pathname !== '/login') {
          router.replace('/login');
          return;
        }

        setState('ready');
      });

    return () => {
      controller.abort();
    };
  }, [pathname, router]);

  if (state === 'checking') {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <LoadingBox />
      </Box>
    );
  }

  return children;
}

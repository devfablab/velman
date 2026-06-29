'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Box, CircularProgress } from '@mui/material';
import { getSupabaseBrowser } from '@/lib/supabase';

type GateState = 'checking' | 'ready';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<GateState>('checking');

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    let alive = true;

    supabase.auth.getSession().then((result) => {
      if (!alive) return;
      const session = result.data.session;

      if (!session && pathname !== '/login') {
        router.replace('/login');
        return;
      }

      if (session && pathname === '/login') {
        router.replace('/dashboard');
        return;
      }

      setState('ready');
    });

    const listener = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && pathname !== '/login') {
        router.replace('/login');
      }
    });

    return () => {
      alive = false;
      listener.data.subscription.unsubscribe();
    };
  }, [pathname, router]);

  if (state === 'checking') {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return children;
}

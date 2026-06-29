'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Box, Button, Container, Divider, List, ListItemButton, ListItemText, Paper, Stack, Typography } from '@mui/material';
import { getSupabaseBrowser } from '@/lib/supabase';

const menus = [
  { href: '/dashboard', label: '대시보드' },
  { href: '/members', label: '회원 관리' },
  { href: '/sites', label: '개설된 사이트 관리' },
  { href: '/revenue', label: '수익/정산 관리' },
  { href: '/plans', label: '요금제 설정' },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
    router.replace('/login');
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Paper elevation={0} square sx={{ width: 260, borderRight: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ p: 3 }}>
          <Typography variant="h5" fontWeight={800}>velman</Typography>
          <Typography variant="body2" color="text.secondary">데브허브 관리자</Typography>
        </Box>
        <Divider />
        <List sx={{ px: 2, py: 2 }}>
          {menus.map((menu) => {
            const selected = pathname === menu.href || pathname.startsWith(`${menu.href}/`);
            return (
              <ListItemButton
                key={menu.href}
                component={Link}
                href={menu.href}
                selected={selected}
                sx={{ borderRadius: 2, mb: 0.5 }}
              >
                <ListItemText primary={menu.label} />
              </ListItemButton>
            );
          })}
        </List>
      </Paper>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Paper elevation={0} square sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
          <Container maxWidth="xl">
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 2 }}>
              <Typography variant="body2" color="text.secondary">로컬 관리자</Typography>
              <Button type="button" variant="outlined" size="small" onClick={handleSignOut}>로그아웃</Button>
            </Stack>
          </Container>
        </Paper>
        <Container maxWidth="xl" sx={{ py: 4 }}>
          {children}
        </Container>
      </Box>
    </Box>
  );
}

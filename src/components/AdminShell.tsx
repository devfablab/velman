'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Box, Container, Divider, List, ListItemButton, ListItemText, Paper, Typography } from '@mui/material';

const menus = [
  { href: '/dashboard', label: '대시보드' },
  { href: '/members', label: '회원 관리' },
  { href: '/sites', label: '개설된 사이트 관리' },
  { href: '/revenue', label: '수익/정산 관리' },
  { href: '/reports', label: '신고 현황' },
  { href: '/plans', label: '요금제 설정' },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Paper elevation={0} square sx={{ width: 260, borderRight: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ p: 3 }}>
          <Typography variant="h5">velman</Typography>
          <Typography variant="subtitle2">데브허브 관리앱</Typography>
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

      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Container maxWidth="xl" sx={{ py: 4, flex: 1 }}>
          {children}
        </Container>
      </Box>
    </Box>
  );
}

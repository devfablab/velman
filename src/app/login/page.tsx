'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { getSupabaseBrowser } from '@/lib/supabase';
import AuthGate from '@/components/AuthGate';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage('');

    const supabase = getSupabaseBrowser();
    const result = await supabase.auth.signInWithPassword({ email, password });

    setSubmitting(false);

    if (result.error) {
      setErrorMessage(result.error.message);
      return;
    }

    router.replace('/dashboard');
  };

  return (
    <AuthGate>
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: 'background.default', p: 3 }}>
        <Paper component="form" onSubmit={handleSubmit} sx={{ width: '100%', maxWidth: 420, p: 4 }}>
          <Stack spacing={3}>
            <Stack spacing={0.5}>
              <Typography variant="h4">velman</Typography>
              <Typography color="text.secondary">데브허브 관리자 로그인</Typography>
            </Stack>
            {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
            <TextField
              label="이메일"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              fullWidth
              size="small"
            />
            <TextField
              label="비밀번호"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              fullWidth
              size="small"
            />
            <Button type="submit" variant="contained" size="small" disabled={submitting}>
              로그인
            </Button>
          </Stack>
        </Paper>
      </Box>
    </AuthGate>
  );
}

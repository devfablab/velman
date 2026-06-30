'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { getSupabaseBrowser, type SupabaseEnv } from '@/lib/supabase';
import AuthGate from '@/components/AuthGate';

type SessionPayload = {
  ok: true;
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [submittingMode, setSubmittingMode] = useState<SupabaseEnv | null>(null);

  const handleSubmit = async (mode: SupabaseEnv) => {
    setSubmittingMode(mode);
    setErrorMessage('');

    const supabase = getSupabaseBrowser(mode);
    const result = await supabase.auth.signInWithPassword({ email, password });
    const session = result.data.session;

    if (result.error || !session) {
      setSubmittingMode(null);
      setErrorMessage(result.error?.message || '로그인에 실패했습니다.');
      return;
    }

    const response = await fetch('/api/auth/session', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        mode,
      }),
    });
    const payload = (await response.json()) as SessionPayload | { message?: string };

    setSubmittingMode(null);

    if (!response.ok) {
      setErrorMessage('message' in payload && payload.message ? payload.message : '로그인에 실패했습니다.');
      return;
    }

    router.replace('/dashboard');
  };

  const handleTestLoginClick = () => {
    void handleSubmit('test');
  };

  const handleProdLoginClick = () => {
    void handleSubmit('prod');
  };

  return (
    <AuthGate>
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: 'background.default', p: 3 }}>
        <Paper component="section" sx={{ width: '100%', maxWidth: 420, p: 4 }}>
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
            <Stack direction="row" spacing={1}>
              <Button
                type="button"
                variant="outlined"
                size="small"
                disabled={submittingMode !== null}
                onClick={handleTestLoginClick}
                fullWidth
              >
                {submittingMode === 'test' ? '로그인 중' : '테스트 로그인'}
              </Button>
              <Button
                type="button"
                variant="contained"
                size="small"
                disabled={submittingMode !== null}
                onClick={handleProdLoginClick}
                fullWidth
              >
                {submittingMode === 'prod' ? '로그인 중' : '운영 로그인'}
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Box>
    </AuthGate>
  );
}

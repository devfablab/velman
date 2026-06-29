'use client';

import { useEffect, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Snackbar, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import PageHeader from '@/components/PageHeader';
import LoadingBox from '@/components/LoadingBox';
import EmptyState from '@/components/EmptyState';
import { apiFetch } from '@/lib/clientApi';
import { formatMoney } from '@/lib/utils';
import type { PlanRow } from '@/lib/types';

export default function PlansPage() {
  const [plans, setPlans] = useState<PlanRow[] | null>(null);
  const [selected, setSelected] = useState<PlanRow | null>(null);
  const [price, setPrice] = useState('');
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const load = () => {
    setPlans(null);
    apiFetch<{ items: PlanRow[] }>('/api/plans').then((result) => setPlans(result.items)).catch(() => setPlans([]));
  };

  useEffect(() => {
    load();
  }, []);

  const handleOpen = (plan: PlanRow) => {
    setSelected(plan);
    setPrice(String(plan.price));
  };

  const handleSave = async () => {
    if (!selected) return;
    await apiFetch<{ ok: true }>('/api/plans', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selected.id, price }),
    });
    setSelected(null);
    setSnackbarMessage('요금제를 수정했습니다.');
    load();
  };

  return (
    <Stack spacing={3}>
      <PageHeader title="요금제 설정" description="plans 테이블 기준 사이트 개설 요금제 가격 관리" />
      {!plans ? <LoadingBox /> : plans.length === 0 ? <EmptyState message="요금제가 없습니다." /> : (
        <Paper>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>구분</TableCell>
                <TableCell>요금제명</TableCell>
                <TableCell align="right">가격</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id} hover sx={{ cursor: 'pointer' }} onClick={() => handleOpen(plan)}>
                  <TableCell>{plan.categoryLabel}</TableCell>
                  <TableCell>{plan.planLabel}</TableCell>
                  <TableCell align="right">{formatMoney(plan.price)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} maxWidth="xs" fullWidth>
        <DialogTitle>요금제 가격 수정</DialogTitle>
        <DialogContent dividers>
          {selected ? (
            <Stack spacing={2}>
              <Typography>구분: {selected.categoryLabel}</Typography>
              <Typography>요금제명: {selected.planLabel}</Typography>
              <Typography>현재 가격: {formatMoney(selected.price)}</Typography>
              <TextField
                label="변경 가격"
                value={price}
                onChange={(event) => setPrice(event.target.value.replace(/[^0-9]/g, ''))}
                slotProps={{ htmlInput: { inputMode: 'numeric' } }}
                fullWidth
              />
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={() => setSelected(null)}>취소</Button>
          <Button type="button" variant="contained" onClick={handleSave}>수정</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(snackbarMessage)}
        autoHideDuration={2500}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        onClose={() => setSnackbarMessage('')}
        message={snackbarMessage}
      />
    </Stack>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Grid, Paper, Stack, Typography } from '@mui/material';
import PageHeader from '@/components/PageHeader';
import LoadingBox from '@/components/LoadingBox';
import { apiFetch } from '@/lib/clientApi';
import { formatMoney } from '@/lib/utils';

type DashboardData = {
  totalMembers: number;
  todayMembers: number;
  totalSites: number;
  todaySites: number;
  totalPaymentAmount: number;
  todayPaymentAmount: number;
  todayPaymentCount: number;
  todayRefundAmount: number;
  todayRefundCount: number;
};

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="h5" fontWeight={800} sx={{ mt: 1 }}>{value}</Typography>
    </Paper>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    apiFetch<DashboardData>('/api/dashboard').then(setData).catch(() => setData(null));
  }, []);

  if (!data) return <LoadingBox />;

  return (
    <Stack spacing={3}>
      <PageHeader title="대시보드" description="전체 운영 현황 요약" />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}><StatCard label="총 결제액" value={formatMoney(data.totalPaymentAmount)} /></Grid>
        <Grid size={{ xs: 12, md: 3 }}><StatCard label="오늘 결제액" value={formatMoney(data.todayPaymentAmount)} /></Grid>
        <Grid size={{ xs: 12, md: 3 }}><StatCard label="오늘 결제 건수" value={`${data.todayPaymentCount.toLocaleString('ko-KR')}건`} /></Grid>
        <Grid size={{ xs: 12, md: 3 }}><StatCard label="오늘 환불액" value={formatMoney(data.todayRefundAmount)} /></Grid>
        <Grid size={{ xs: 12, md: 3 }}><StatCard label="오늘 환불 건수" value={`${data.todayRefundCount.toLocaleString('ko-KR')}건`} /></Grid>
        <Grid size={{ xs: 12, md: 3 }}><StatCard label="총 가입자" value={`${data.totalMembers.toLocaleString('ko-KR')}명`} /></Grid>
        <Grid size={{ xs: 12, md: 3 }}><StatCard label="오늘 가입자" value={`${data.todayMembers.toLocaleString('ko-KR')}명`} /></Grid>
        <Grid size={{ xs: 12, md: 3 }}><StatCard label="총 개설 사이트 수" value={`${data.totalSites.toLocaleString('ko-KR')}개`} /></Grid>
        <Grid size={{ xs: 12, md: 3 }}><StatCard label="오늘 개설 사이트 수" value={`${data.todaySites.toLocaleString('ko-KR')}개`} /></Grid>
      </Grid>
    </Stack>
  );
}

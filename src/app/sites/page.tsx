'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Pagination,
  Paper,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  TableContainer,
} from '@mui/material';
import PageHeader from '@/components/PageHeader';
import LoadingBox from '@/components/LoadingBox';
import EmptyState from '@/components/EmptyState';
import StatusChip from '@/components/StatusChip';
import { apiFetch } from '@/lib/clientApi';
import { formatDateTime, formatMoney } from '@/lib/utils';
import { siteTypeLabel } from '@/lib/labels';
import type { SiteRow, TablePage } from '@/lib/types';

export default function SitesPage() {
  const [tab, setTab] = useState<'blog' | 'community'>('blog');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<TablePage<SiteRow> | null>(null);
  const [selected, setSelected] = useState<SiteRow | null>(null);

  const load = (targetPage: number, siteType = tab, q = keyword) => {
    setData(null);
    const params = new URLSearchParams({ page: String(targetPage), type: siteType });
    if (q.trim()) params.set('q', q.trim());
    apiFetch<TablePage<SiteRow>>(`/api/sites?${params.toString()}`)
      .then(setData)
      .catch(() => setData({ items: [], page: targetPage, pageSize: 20, total: 0 }));
  };

  useEffect(() => {
    load(page);
  }, [page, tab]);

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    load(1);
  };

  const pageCount = Math.max(Math.ceil((data?.total || 0) / 20), 1);

  return (
    <Stack spacing={3}>
      <PageHeader title="개설된 사이트 관리" description="개설된 블로그/커뮤니티 목록과 운영 상태 확인" />
      <Paper sx={{ px: 2 }}>
        <Tabs
          value={tab}
          onChange={(_event, value: 'blog' | 'community') => {
            setTab(value);
            setPage(1);
          }}
        >
          <Tab value="blog" label="블로그" />
          <Tab value="community" label="커뮤니티" />
        </Tabs>
      </Paper>
      <Paper component="form" onSubmit={handleSearch} sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            label="사이트명 또는 사이트 영문명"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            fullWidth
          />
          <Button type="submit" variant="contained" sx={{ minWidth: 120 }}>
            검색
          </Button>
        </Stack>
      </Paper>
      {!data ? (
        <LoadingBox />
      ) : data.items.length === 0 ? (
        <EmptyState message="사이트가 없습니다." />
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>사이트명</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>가입 승인 회원수</TableCell>
                <TableCell>요금제</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>폐쇄/중지 상태</TableCell>
                <TableCell>개설일</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.items.map((site) => (
                <TableRow key={site.id} hover sx={{ cursor: 'pointer' }} onClick={() => setSelected(site)}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{site.siteLabel}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {site.approvedMemberCount.toLocaleString('ko-KR')}명
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {site.planLabel ? `${site.planLabel} / ${formatMoney(site.planPrice)}` : '-'}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <StatusChip label={site.status} />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(site.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
            <Pagination count={pageCount} page={page} onChange={(_event, value) => setPage(value)} />
          </Box>
        </TableContainer>
      )}

      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} maxWidth="sm" fullWidth>
        <DialogTitle>사이트 상세</DialogTitle>
        <DialogContent dividers>
          {selected ? (
            <Stack spacing={1.2}>
              <Typography>사이트명: {selected.siteLabel}</Typography>
              <Typography>주소: /{selected.siteKey}</Typography>
              <Typography>종류: {siteTypeLabel(selected.siteType)}</Typography>
              <Typography>개설일: {formatDateTime(selected.createdAt)}</Typography>
              <Typography>가입 승인된 회원수: {selected.approvedMemberCount.toLocaleString('ko-KR')}명</Typography>
              <Typography>
                요금제: {selected.planLabel ? `${selected.planLabel} / ${formatMoney(selected.planPrice)}` : '-'}
              </Typography>
              <Typography>총 수익: {formatMoney(selected.totalRevenue)}</Typography>
              <Typography>총 환불액: {formatMoney(selected.totalRefunded)}</Typography>
              <Typography>폐쇄/중지 상태: {selected.status}</Typography>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={() => setSelected(null)}>
            닫기
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

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
import { apiFetch } from '@/lib/clientApi';
import { formatDateTime, formatMoney } from '@/lib/utils';
import { siteTypeLabel } from '@/lib/labels';
import type { SiteRow, TablePage } from '@/lib/types';
import PageHeader from '@/components/PageHeader';
import LoadingBox from '@/components/LoadingBox';
import EmptyState from '@/components/EmptyState';
import StatusChip from '@/components/StatusChip';
import Anchor from '@/components/Anchor';

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <Paper sx={{ p: 0 }}>
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
            size="small"
          />
          <Button type="submit" size="small" variant="contained" sx={{ minWidth: 120 }}>
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
              <Typography variant="h6" component="h2">
                {selected.siteLabel}
              </Typography>
              <Typography variant="subtitle2">
                <Anchor href={`https://velhub-kr.vercel.app/${selected.siteKey}`}>
                  {siteTypeLabel(selected.siteType)}{' '}
                  {selected.planLabel ? `(${selected.planLabel} / ${formatMoney(selected.planPrice)})` : null}
                </Anchor>
              </Typography>
              <Typography variant="subtitle2">{formatDateTime(selected.createdAt)} 개설됨</Typography>
              <Stack gap={5} direction="row">
                <Stack gap={1} direction="row">
                  <Typography variant="subtitle2">가입 승인된 회원수</Typography>
                  <Typography variant="body2">{selected.approvedMemberCount.toLocaleString('ko-KR')} 명</Typography>
                </Stack>
                <Stack gap={1} direction="row">
                  <Typography variant="subtitle2">폐쇄/중지 상태</Typography>
                  <Typography variant="body2">{selected.status}</Typography>
                </Stack>
              </Stack>
              <Stack gap={5} direction="row">
                <Stack gap={1} direction="row">
                  <Typography variant="subtitle2">총 수익</Typography>
                  <Typography variant="body2">{formatMoney(selected.totalRevenue)}</Typography>
                </Stack>
                <Stack gap={1} direction="row">
                  <Typography variant="subtitle2">총 환불액</Typography>
                  <Typography variant="body2">{formatMoney(selected.totalRefunded)}</Typography>
                </Stack>
              </Stack>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button type="button" size="small" onClick={() => setSelected(null)}>
            닫기
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

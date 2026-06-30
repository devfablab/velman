'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Pagination,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import type { MemberDetail, MemberRow, TablePage } from '@/lib/types';
import { apiFetch } from '@/lib/clientApi';
import { formatDateTime } from '@/lib/utils';
import PageHeader from '@/components/PageHeader';
import LoadingBox from '@/components/LoadingBox';
import EmptyState from '@/components/EmptyState';
import StatusChip from '@/components/StatusChip';

export default function MembersPage() {
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<TablePage<MemberRow> | null>(null);
  const [selected, setSelected] = useState<MemberDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const load = (targetPage: number, q = keyword) => {
    setData(null);
    const params = new URLSearchParams({ page: String(targetPage) });
    if (q.trim()) params.set('q', q.trim());
    apiFetch<TablePage<MemberRow>>(`/api/members?${params.toString()}`)
      .then(setData)
      .catch(() => setData({ items: [], page: targetPage, pageSize: 20, total: 0 }));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    load(1);
  };

  const handleOpen = async (member: MemberRow) => {
    setLoadingDetail(true);
    try {
      const detail = await apiFetch<MemberDetail>(`/api/members/${member.id}`);
      setSelected(detail);
    } finally {
      setLoadingDetail(false);
    }
  };

  const pageCount = Math.max(Math.ceil((data?.total || 0) / 20), 1);

  return (
    <Stack spacing={3}>
      <PageHeader title="회원 관리" description="가입자 목록과 회원별 사이트 가입 상태 확인" />
      <Paper component="form" onSubmit={handleSearch} sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            placeholder="이메일 또는 활동명"
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
        <EmptyState message="회원이 없습니다." />
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>이메일</TableCell>
                <TableCell>활동명</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>미성년자 여부</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>계정 상태</TableCell>
                <TableCell>가입일</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.items.map((member) => (
                <TableRow key={member.id} hover sx={{ cursor: 'pointer' }} onClick={() => handleOpen(member)}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{member.email}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{member.userName}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {member.isMinor === null ? '-' : member.isMinor ? '미성년자' : '성인'}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <StatusChip label={member.accountStatus} />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(member.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
            <Pagination count={pageCount} page={page} onChange={(_event, value) => setPage(value)} />
          </Box>
        </TableContainer>
      )}

      <Dialog open={Boolean(selected) || loadingDetail} onClose={() => setSelected(null)} maxWidth="md" fullWidth>
        <DialogTitle>회원 상세</DialogTitle>
        <DialogContent dividers>
          {!selected ? (
            <LoadingBox />
          ) : (
            <Stack spacing={3}>
              <Stack gap={2}>
                <Typography variant="h6" component="h2">
                  기본 정보
                </Typography>
                <Stack gap={1}>
                  <Stack gap={2} direction="row">
                    <Typography variant="subtitle2">이메일</Typography>
                    <Typography variant="body2">{selected.email} </Typography>
                  </Stack>
                  <Stack gap={2} direction="row">
                    <Typography variant="subtitle2">활동명</Typography>
                    <Typography variant="body2">
                      {selected.userName} ({formatDateTime(selected.createdAt)} 가입)
                    </Typography>
                  </Stack>
                  {selected.birthDate ? (
                    <Stack gap={2} direction="row" alignItems="center">
                      <Typography variant="subtitle2">생년월일</Typography>
                      <Typography variant="body2">{selected.birthDate}</Typography>
                      {selected.isMinor === null ? null : (
                        <Chip
                          size="small"
                          color={selected.isMinor ? 'error' : 'primary'}
                          label={selected.isMinor ? '수익활동 불가' : '수익활동 가능'}
                        />
                      )}
                    </Stack>
                  ) : null}
                  <Stack gap={2} direction="row">
                    <Typography variant="subtitle2">계정 상태</Typography>
                    <Typography variant="body2">{selected.accountStatus}</Typography>
                  </Stack>
                </Stack>
              </Stack>
              <Divider />
              <Stack gap={2}>
                <Typography variant="h6" component="h2">
                  사이트 가입 요약
                </Typography>
                <Stack gap={5} direction="row">
                  <Stack gap={1} direction="row">
                    <Typography variant="subtitle2">가입한 사이트 수</Typography>
                    <Typography variant="body2">{selected.joinedSiteCount} 개</Typography>
                  </Stack>
                  <Stack gap={1} direction="row">
                    <Typography variant="subtitle2">가입 승인 사이트 수</Typography>
                    <Typography variant="body2">{selected.approvedSiteCount} 개</Typography>
                  </Stack>
                  <Stack gap={1} direction="row">
                    <Typography variant="subtitle2">비승인 사이트 수</Typography>
                    <Typography variant="body2">{selected.notApprovedSiteCount} 개</Typography>
                  </Stack>
                </Stack>
              </Stack>
              <Divider />
              <Stack gap={2}>
                <Typography variant="h6" component="h2">
                  가입한 블로그/커뮤니티 목록
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>사이트 이름</TableCell>
                      <TableCell>종류</TableCell>
                      <TableCell>역할</TableCell>
                      <TableCell>상태</TableCell>
                      <TableCell>승인</TableCell>
                      <TableCell>승인일</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selected.sites.map((site) => (
                      <TableRow key={`${site.siteId}-${site.role}`}>
                        <TableCell>{site.siteLabel}</TableCell>
                        <TableCell>{site.siteType}</TableCell>
                        <TableCell>{site.role}</TableCell>
                        <TableCell>{site.accountStatus}</TableCell>
                        <TableCell>{site.isApproval ? '승인' : '비승인'}</TableCell>
                        <TableCell>{formatDateTime(site.approvalAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Stack>
            </Stack>
          )}
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

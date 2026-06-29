'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Box,
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
  TableContainer,
} from '@mui/material';
import PageHeader from '@/components/PageHeader';
import LoadingBox from '@/components/LoadingBox';
import EmptyState from '@/components/EmptyState';
import StatusChip from '@/components/StatusChip';
import { apiFetch } from '@/lib/clientApi';
import { paymentStatusLabel, settlementStatusLabel } from '@/lib/labels';
import { formatDateTime, formatMoney } from '@/lib/utils';
import type { SettlementRow, TablePage, TransactionRow } from '@/lib/types';

type RevenueTab = 'transactions' | 'refunds' | 'scheduled' | 'confirmed' | 'completed';

const tabLabels: Record<RevenueTab, string> = {
  transactions: '전체 거래 내역',
  refunds: '전체 환불 내역',
  scheduled: '정산 예정',
  confirmed: '정산 확정',
  completed: '정산 완료',
};

export default function RevenuePage() {
  const [tab, setTab] = useState<RevenueTab>('transactions');
  const [page, setPage] = useState(1);
  const [transactions, setTransactions] = useState<TablePage<TransactionRow> | null>(null);
  const [settlements, setSettlements] = useState<TablePage<SettlementRow> | null>(null);

  const isSettlementTab = useMemo(() => ['scheduled', 'confirmed', 'completed'].includes(tab), [tab]);

  useEffect(() => {
    if (isSettlementTab) {
      setSettlements(null);
      apiFetch<TablePage<SettlementRow>>(`/api/revenue/settlements?page=${page}&status=${tab}`)
        .then(setSettlements)
        .catch(() => setSettlements({ items: [], page, pageSize: 20, total: 0 }));
      return;
    }

    setTransactions(null);
    const path = tab === 'refunds' ? 'refunds' : 'transactions';
    apiFetch<TablePage<TransactionRow>>(`/api/revenue/${path}?page=${page}`)
      .then(setTransactions)
      .catch(() => setTransactions({ items: [], page, pageSize: 20, total: 0 }));
  }, [isSettlementTab, page, tab]);

  const handleTabChange = (_event: React.SyntheticEvent, value: RevenueTab) => {
    setTab(value);
    setPage(1);
  };

  const pageCount = Math.max(Math.ceil(((isSettlementTab ? settlements?.total : transactions?.total) || 0) / 20), 1);

  return (
    <Stack spacing={3}>
      <PageHeader title="수익/정산 관리" description="거래, 환불, 정산 상태 확인" />
      <Paper sx={{ px: 2 }}>
        <Tabs value={tab} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
          <Tab value="transactions" label="전체 거래 내역" />
          <Tab value="refunds" label="전체 환불 내역" />
          <Tab value="scheduled" label="정산 예정" />
          <Tab value="confirmed" label="정산 확정" />
          <Tab value="completed" label="정산 완료" />
        </Tabs>
      </Paper>

      {isSettlementTab ? (
        !settlements ? (
          <LoadingBox />
        ) : settlements.items.length === 0 ? (
          <EmptyState message={`${tabLabels[tab]} 데이터가 없습니다.`} />
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>사이트</TableCell>
                  <TableCell>오너</TableCell>
                  <TableCell>정산 기간</TableCell>
                  <TableCell>상태</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap', textAlign: 'right' }}>총 결제금액</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap', textAlign: 'right' }}>최종 정산금액</TableCell>
                  <TableCell>확정일</TableCell>
                  <TableCell>완료일</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {settlements.items.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.siteLabel || '-'}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.receiverName || row.receiverEmail || '-'}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {formatDateTime(row.periodStart)} ~ {formatDateTime(row.periodEnd)}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <StatusChip label={settlementStatusLabel(row.status)} />
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      {formatMoney(row.grossAmount)}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      {formatMoney(row.settlementAmount)}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(row.confirmedAt)}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(row.completedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )
      ) : !transactions ? (
        <LoadingBox />
      ) : transactions.items.length === 0 ? (
        <EmptyState message={`${tabLabels[tab]} 데이터가 없습니다.`} />
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>구매자</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>사이트</TableCell>
                <TableCell>결제 유형</TableCell>
                <TableCell>상태</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap', textAlign: 'right' }}>결제금액</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap', textAlign: 'right' }}>환불금액</TableCell>
                <TableCell>일시</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {transactions.items.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.buyerName || row.buyerEmail || '-'}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.siteLabel || '-'}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.paymentType}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <StatusChip label={paymentStatusLabel(row.status)} />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap', textAlign: 'right' }}>{formatMoney(row.amount)}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                    {formatMoney(row.refundedAmount)}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(row.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <Pagination count={pageCount} page={page} onChange={(_event, value) => setPage(value)} />
      </Box>
    </Stack>
  );
}

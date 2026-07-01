'use client';

import { type SyntheticEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
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
import { apiFetch } from '@/lib/clientApi';
import { paymentStatusLabel, paymentTypeLabel, settlementStatusLabel } from '@/lib/labels';
import { formatDateTime, formatMoney } from '@/lib/utils';
import type { SettlementRow, TablePage, TransactionRow } from '@/lib/types';
import PageHeader from '@/components/PageHeader';
import LoadingBox from '@/components/LoadingBox';
import EmptyState from '@/components/EmptyState';
import StatusChip from '@/components/StatusChip';

type RevenueTab = 'transactions' | 'refunds' | 'scheduled' | 'confirmed' | 'completed';
type SettlementAction = 'confirm' | 'complete';
type ProcessingAction = 'create' | SettlementAction;
type SettlementCreateResponse = { ok: true; createdCount: number };
type SettlementActionResponse = { ok: true; updatedCount: number };

const tabLabels: Record<RevenueTab, string> = {
  transactions: '전체 거래 내역',
  refunds: '전체 환불 내역',
  scheduled: '정산 예정',
  confirmed: '정산 확정',
  completed: '정산 완료',
};

function getBulkAction(tab: RevenueTab): SettlementAction | null {
  if (tab === 'scheduled') return 'confirm';
  if (tab === 'confirmed') return 'complete';
  return null;
}

function getBulkActionLabel(tab: RevenueTab) {
  if (tab === 'scheduled') return '전체 정산 확정';
  if (tab === 'confirmed') return '전체 정산 완료 처리';
  return '';
}

export default function RevenuePage() {
  const [tab, setTab] = useState<RevenueTab>('transactions');
  const [page, setPage] = useState(1);
  const [transactions, setTransactions] = useState<TablePage<TransactionRow> | null>(null);
  const [settlements, setSettlements] = useState<TablePage<SettlementRow> | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [processingAction, setProcessingAction] = useState<ProcessingAction | null>(null);

  const isSettlementTab = useMemo(() => ['scheduled', 'confirmed', 'completed'].includes(tab), [tab]);
  const bulkAction = getBulkAction(tab);
  const total = isSettlementTab ? settlements?.total : transactions?.total;
  const pageSize = isSettlementTab ? settlements?.pageSize : transactions?.pageSize;
  const pageCount = Math.max(Math.ceil((total || 0) / (pageSize || 20)), 1);

  const loadData = useCallback(async () => {
    setErrorMessage('');

    if (isSettlementTab) {
      setSettlements(null);

      try {
        const payload = await apiFetch<TablePage<SettlementRow>>(`/api/revenue/settlements?page=${page}&status=${tab}`);
        setSettlements(payload);
      } catch {
        setSettlements({ items: [], page, pageSize: 20, total: 0 });
      }

      return;
    }

    setTransactions(null);

    try {
      const path = tab === 'refunds' ? 'refunds' : 'transactions';
      const payload = await apiFetch<TablePage<TransactionRow>>(`/api/revenue/${path}?page=${page}`);
      setTransactions(payload);
    } catch {
      setTransactions({ items: [], page, pageSize: 20, total: 0 });
    }
  }, [isSettlementTab, page, tab]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleTabChange = (_event: SyntheticEvent, value: RevenueTab) => {
    setTab(value);
    setPage(1);
    setErrorMessage('');
    setSuccessMessage('');
  };

  const reloadFirstPage = async () => {
    if (page === 1) {
      await loadData();
      return;
    }

    setPage(1);
  };

  const handleCreateSettlementsClick = async () => {
    setProcessingAction('create');
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const payload = await apiFetch<SettlementCreateResponse>('/api/revenue/settlements', {
        method: 'POST',
      });

      setSuccessMessage(
        payload.createdCount > 0
          ? `정산 예정 ${payload.createdCount}건을 생성했습니다.`
          : '새로 생성할 정산 예정 데이터가 없습니다.',
      );
      await reloadFirstPage();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '정산 예정 생성에 실패했습니다.');
    } finally {
      setProcessingAction(null);
    }
  };

  const handleBulkActionClick = async (action: SettlementAction) => {
    setProcessingAction(action);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const payload = await apiFetch<SettlementActionResponse>('/api/revenue/settlements', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      setSuccessMessage(
        action === 'confirm'
          ? `정산 ${payload.updatedCount}건을 확정 처리했습니다.`
          : `정산 ${payload.updatedCount}건을 완료 처리했습니다.`,
      );
      await reloadFirstPage();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '정산 처리에 실패했습니다.');
    } finally {
      setProcessingAction(null);
    }
  };

  return (
    <Stack spacing={3}>
      <PageHeader title="수익/정산 관리" description="거래, 환불, 정산 상태 확인" />
      <Paper sx={{ p: 0 }}>
        <Tabs value={tab} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
          <Tab value="transactions" label="전체 거래 내역" />
          <Tab value="refunds" label="전체 환불 내역" />
          <Tab value="scheduled" label="정산 예정" />
          <Tab value="confirmed" label="정산 확정" />
          <Tab value="completed" label="정산 완료" />
        </Tabs>
      </Paper>

      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
      {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}

      {tab === 'scheduled' || tab === 'confirmed' ? (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
          {tab === 'scheduled' ? (
            <Button
              type="button"
              variant="contained"
              disabled={processingAction !== null}
              onClick={() => void handleCreateSettlementsClick()}
            >
              {processingAction === 'create' ? '생성 중' : '정산 예정 업데이트'}
            </Button>
          ) : null}
          {bulkAction ? (
            <Button
              type="button"
              variant="contained"
              disabled={processingAction !== null || !settlements || settlements.items.length === 0}
              onClick={() => void handleBulkActionClick(bulkAction)}
            >
              {processingAction === bulkAction ? '처리 중' : getBulkActionLabel(tab)}
            </Button>
          ) : null}
        </Box>
      ) : null}

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
                  {tab !== 'scheduled' ? <TableCell>확정일</TableCell> : null}
                  {tab === 'completed' ? <TableCell>완료일</TableCell> : null}
                </TableRow>
              </TableHead>
              <TableBody>
                {settlements.items.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.siteLabel || '-'}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.receiverEmail || '-'}</TableCell>
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
                    {tab !== 'scheduled' ? (
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(row.confirmedAt)}</TableCell>
                    ) : null}
                    {tab === 'completed' ? (
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(row.completedAt)}</TableCell>
                    ) : null}
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
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.buyerEmail || '-'}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.siteLabel || '-'}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{paymentTypeLabel(row.paymentType)}</TableCell>
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

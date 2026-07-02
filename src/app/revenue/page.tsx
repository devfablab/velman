'use client';

import { type SyntheticEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
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
type ProcessingAction = 'create' | 'paymentStatement' | SettlementAction;
type SettlementCreateResponse = { ok: true; createdCount: number };
type SettlementActionResponse = { ok: true; updatedCount: number };
type PaymentStatementMonthsResponse = { ok: true; months: string[] };

const tabLabels: Record<RevenueTab, string> = {
  transactions: '전체 거래 내역',
  refunds: '전체 환불 내역',
  scheduled: '정산 예정',
  confirmed: '정산 확정',
  completed: '정산 완료',
};

function getSettlementAction(tab: RevenueTab): SettlementAction | null {
  if (tab === 'scheduled') return 'confirm';
  if (tab === 'confirmed') return 'complete';
  return null;
}

function getSettlementActionLabel(tab: RevenueTab) {
  if (tab === 'scheduled') return '전체 정산 확정';
  if (tab === 'confirmed') return '전체 정산 완료 처리';
  return '';
}

function getFilenameFromContentDisposition(contentDisposition: string | null, fallback: string) {
  if (!contentDisposition) return fallback;

  const encodedMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/);
  if (encodedMatch?.[1]) return decodeURIComponent(encodedMatch[1]);

  const plainMatch = contentDisposition.match(/filename="?([^";]+)"?/);
  if (plainMatch?.[1]) return plainMatch[1];

  return fallback;
}

async function getDownloadErrorMessage(response: Response) {
  const contentType = response.headers.get('Content-Type') || '';

  if (!contentType.includes('application/json')) {
    return '파일 다운로드에 실패했습니다.';
  }

  const payload = (await response.json()) as { message?: string };

  return payload.message || '파일 다운로드에 실패했습니다.';
}

async function downloadExcel(url: string, init: RequestInit, fallbackFilename: string) {
  const response = await fetch(url, {
    ...init,
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(await getDownloadErrorMessage(response));
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = getFilenameFromContentDisposition(response.headers.get('Content-Disposition'), fallbackFilename);
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export default function RevenuePage() {
  const [tab, setTab] = useState<RevenueTab>('transactions');
  const [page, setPage] = useState(1);
  const [transactions, setTransactions] = useState<TablePage<TransactionRow> | null>(null);
  const [settlements, setSettlements] = useState<TablePage<SettlementRow> | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [processingAction, setProcessingAction] = useState<ProcessingAction | null>(null);
  const [paymentStatementMonths, setPaymentStatementMonths] = useState<string[]>([]);
  const [paymentStatementMonth, setPaymentStatementMonth] = useState('');

  const isSettlementTab = useMemo(() => ['scheduled', 'confirmed', 'completed'].includes(tab), [tab]);
  const settlementAction = getSettlementAction(tab);
  const total = isSettlementTab ? settlements?.total : transactions?.total;
  const pageSize = isSettlementTab ? settlements?.pageSize : transactions?.pageSize;
  const pageCount = Math.max(Math.ceil((total || 0) / (pageSize || 20)), 1);

  const loadPaymentStatementMonths = useCallback(async () => {
    try {
      const payload = await apiFetch<PaymentStatementMonthsResponse>(
        '/api/revenue/settlements/payment-statement?mode=months',
      );
      setPaymentStatementMonths(payload.months);
      setPaymentStatementMonth((current) => current || payload.months[0] || '');
    } catch {
      setPaymentStatementMonths([]);
      setPaymentStatementMonth('');
    }
  }, []);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (tab === 'completed') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadPaymentStatementMonths();
    }
  }, [loadPaymentStatementMonths, tab]);

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

  const handleSettlementActionClick = async (action: SettlementAction) => {
    setProcessingAction(action);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (action === 'complete') {
        await downloadExcel(
          '/api/revenue/settlements',
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action }),
          },
          '대량이체.xlsx',
        );
        setSuccessMessage('정산 완료 처리하고 대량이체 파일을 다운로드했습니다.');
        await reloadFirstPage();
        return;
      }

      const payload = await apiFetch<SettlementActionResponse>('/api/revenue/settlements', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      setSuccessMessage(`정산 ${payload.updatedCount}건을 확정 처리했습니다.`);
      await reloadFirstPage();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '정산 처리에 실패했습니다.');
    } finally {
      setProcessingAction(null);
    }
  };

  const handlePaymentStatementMonthChange = (event: SelectChangeEvent) => {
    setPaymentStatementMonth(event.target.value);
  };

  const handlePaymentStatementDownloadClick = async () => {
    if (!paymentStatementMonth) return;

    setProcessingAction('paymentStatement');
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await downloadExcel(
        `/api/revenue/settlements/payment-statement?month=${encodeURIComponent(paymentStatementMonth)}`,
        { method: 'GET' },
        `간이지급명세서_${paymentStatementMonth}.xlsx`,
      );
      setSuccessMessage('간이지급명세서 파일을 다운로드했습니다.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '간이지급명세서 다운로드에 실패했습니다.');
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
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          {tab === 'scheduled' ? (
            <Button
              type="button"
              variant="outlined"
              disabled={processingAction !== null}
              onClick={() => void handleCreateSettlementsClick()}
            >
              {processingAction === 'create' ? '생성 중' : '정산 예정 생성'}
            </Button>
          ) : null}
          {settlementAction ? (
            <Button
              type="button"
              variant="contained"
              disabled={processingAction !== null || !settlements || settlements.items.length === 0}
              onClick={() => void handleSettlementActionClick(settlementAction)}
            >
              {processingAction === settlementAction ? '처리 중' : getSettlementActionLabel(tab)}
            </Button>
          ) : null}
        </Box>
      ) : null}

      {tab === 'completed' ? (
        <Paper>
          <Stack gap={1} alignItems="center" justifyContent="flex-end" direction="row">
            <Typography variant="subtitle2">간이지급명세서</Typography>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <Select
                labelId="payment-statement-month-label"
                value={paymentStatementMonth}
                disabled={processingAction !== null || paymentStatementMonths.length === 0}
                onChange={handlePaymentStatementMonthChange}
              >
                {paymentStatementMonths.map((month) => (
                  <MenuItem key={month} value={month}>
                    {month}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              type="button"
              variant="contained"
              disabled={processingAction !== null || !paymentStatementMonth}
              onClick={() => void handlePaymentStatementDownloadClick()}
            >
              {processingAction === 'paymentStatement' ? '다운로드 중' : '다운로드'}
            </Button>
          </Stack>
        </Paper>
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
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.receiverEmail || row.receiverName || '-'}</TableCell>
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

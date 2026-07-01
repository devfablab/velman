import type { SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseEnv } from './supabase';
import { normalizeText } from './utils';

const GENERAL_PAYMENT_FEE_RATE = 290;
const BILLING_PAYMENT_FEE_RATE = 320;
const RATE_DIVIDER = 10000;

const billingPaymentTypes = new Set(['plan_billing', 'membership_blog', 'subscription_board', 'subscription_series']);
const feeOwnerPaymentTypes = new Set([
  'membership_blog',
  'subscription_board',
  'subscription_series',
  'donation_site',
  'donation_board',
  'donation_series',
  'donation_post',
]);

type SettlementAction = 'confirm' | 'complete';

type ActionBody = {
  settlementId?: string;
  action?: string;
};

type SettlementState = {
  id: string;
  status: string;
};

type SettlementItemRow = {
  id: string;
  payment_id: string;
  payment_amount: number | string;
  split_amount: number | string;
  platform_fee_amount: number | string;
  pg_fee_amount: number | string;
  pg_fee_vat_amount: number | string;
};

type PaymentFeeRow = {
  payment_id: string;
  fee_amount: number | string | null;
  fee_vat_amount: number | string | null;
};

type PaymentRow = {
  id: string;
  order_no: string;
  amount: number | string;
  currency: string | null;
  payment_type: string;
  transaction_no: string | null;
  tx_no: string | null;
  approved_at: string | null;
  created_at: string;
};

type PaymentSplitRow = {
  id: string;
  created_at: string;
  payment_id: string;
  site_id: string;
  receiver_user_id: string | null;
  receiver_type: string;
  amount: number | string;
  payments: PaymentRow | null;
};

type SettlementCreateGroup = {
  siteId: string;
  receiverUserId: string;
  splits: PaymentSplitRow[];
};

type SettlementInsertRow = {
  receiver_user_id: string;
  status: 'scheduled';
  period_start: string;
  period_end: string;
  gross_amount: number;
  platform_fee_amount: number;
  pg_fee_amount: number;
  pg_fee_vat_amount: number;
  settlement_amount: number;
  site_id: string;
};

type SettlementInsertResult = {
  id: string;
  site_id: string;
  receiver_user_id: string;
};

type SettlementItemInsertRow = {
  settlement_id: string;
  payment_id: string;
  payment_split_id: string;
  site_id: string;
  receiver_user_id: string;
  payment_amount: number;
  split_amount: number;
  platform_fee_amount: number;
  pg_fee_amount: number;
  pg_fee_vat_amount: number;
  settlement_amount: number;
};

type SettlementItemUpdate = {
  id: string;
  paymentAmount: number;
  platformFeeAmount: number;
  pgFeeAmount: number;
  pgFeeVatAmount: number;
  settlementAmount: number;
};

export type SettlementActionInput = {
  settlementId: string;
  action: SettlementAction;
};

function toNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) return Number(value);
  return 0;
}

function roundAmount(value: number) {
  return Math.round(value);
}

function getValidAction(value: string | undefined): SettlementAction | null {
  if (value === 'confirm' || value === 'complete') return value;
  return null;
}

function getPaymentFeeRate(paymentType: string) {
  return billingPaymentTypes.has(paymentType) ? BILLING_PAYMENT_FEE_RATE : GENERAL_PAYMENT_FEE_RATE;
}

function calculatePaymentFee(amount: number, paymentType: string) {
  const feeAmount = roundAmount((amount * getPaymentFeeRate(paymentType)) / RATE_DIVIDER);
  const feeVatAmount = roundAmount(feeAmount / 10);

  return { feeAmount, feeVatAmount };
}

function isFeePayer(split: PaymentSplitRow, splits: PaymentSplitRow[]) {
  const paymentType = split.payments?.payment_type || '';
  const receiverType = split.receiver_type.toLowerCase();

  if (paymentType === 'purchase_post') {
    if (receiverType.includes('author') || receiverType.includes('writer')) return true;
    return !splits.some((row) => {
      const value = row.receiver_type.toLowerCase();
      return value.includes('author') || value.includes('writer');
    });
  }

  if (feeOwnerPaymentTypes.has(paymentType)) {
    if (receiverType.includes('owner')) return true;
    return !splits.some((row) => row.receiver_type.toLowerCase().includes('owner'));
  }

  return splits[0]?.id === split.id;
}

function getPeriodDate(split: PaymentSplitRow) {
  return split.payments?.approved_at || split.payments?.created_at || split.created_at;
}

function getGroupKey(siteId: string, receiverUserId: string) {
  return `${siteId}:${receiverUserId}`;
}

export function parseSettlementActionBody(body: ActionBody): SettlementActionInput | { message: string } {
  const settlementId = normalizeText(body.settlementId);
  const action = getValidAction(body.action);

  if (!settlementId) {
    return { message: '정산 ID가 없습니다.' };
  }

  if (!action) {
    return { message: '정산 처리 유형이 올바르지 않습니다.' };
  }

  return { settlementId, action };
}

function groupItemsByPayment(items: SettlementItemRow[]) {
  const map = new Map<string, SettlementItemRow[]>();

  for (const item of items) {
    const group = map.get(item.payment_id) || [];
    group.push(item);
    map.set(item.payment_id, group);
  }

  return map;
}

function makePaymentFeeMap(rows: PaymentFeeRow[]) {
  return new Map(rows.map((row) => [row.payment_id, row]));
}

function getEstimatedFeeByPayment(items: SettlementItemRow[]) {
  const map = new Map<string, { feeAmount: number; feeVatAmount: number; transactionAmount: number }>();

  for (const item of items) {
    const current = map.get(item.payment_id) || { feeAmount: 0, feeVatAmount: 0, transactionAmount: 0 };
    current.feeAmount += toNumber(item.pg_fee_amount);
    current.feeVatAmount += toNumber(item.pg_fee_vat_amount);
    current.transactionAmount = Math.max(current.transactionAmount, toNumber(item.payment_amount));
    map.set(item.payment_id, current);
  }

  return map;
}

function distributeAmount(total: number, items: SettlementItemRow[], key: 'pg_fee_amount' | 'pg_fee_vat_amount') {
  const estimatedTotal = items.reduce((sum, item) => sum + toNumber(item[key]), 0);
  const positiveItems = items.filter((item) => toNumber(item[key]) > 0);

  if (estimatedTotal <= 0 || positiveItems.length === 0) {
    return new Map(items.map((item) => [item.id, 0]));
  }

  const result = new Map<string, number>();
  const roundedTotal = roundAmount(total);
  const distributed = positiveItems.map((item, index) => {
    const usedAmount = Array.from(result.values()).reduce((sum, amount) => sum + amount, 0);
    const amount =
      index === positiveItems.length - 1
        ? roundedTotal - usedAmount
        : roundAmount((roundedTotal * toNumber(item[key])) / estimatedTotal);
    result.set(item.id, amount);

    return amount;
  });

  void distributed;

  for (const item of items) {
    if (!result.has(item.id)) result.set(item.id, 0);
  }

  return result;
}

async function getSettlement(supabaseAdmin: SupabaseClient, settlementId: string) {
  const result = await supabaseAdmin.from('settlements').select('id, status').eq('id', settlementId).maybeSingle();

  if (result.error) return { message: result.error.message };
  if (!result.data) return { message: '정산 데이터를 찾을 수 없습니다.' };

  return result.data as SettlementState;
}

async function getSettlementItems(supabaseAdmin: SupabaseClient, settlementId: string) {
  const result = await supabaseAdmin
    .from('settlement_items')
    .select('id, payment_id, payment_amount, split_amount, platform_fee_amount, pg_fee_amount, pg_fee_vat_amount')
    .eq('settlement_id', settlementId);

  if (result.error) return { message: result.error.message };

  return (result.data || []) as SettlementItemRow[];
}

async function getUnsettledSplits(supabaseAdmin: SupabaseClient) {
  const existingResult = await supabaseAdmin.from('settlement_items').select('payment_split_id');
  if (existingResult.error) return { message: existingResult.error.message };

  const existingIds = new Set(
    (existingResult.data || []).map((row: { payment_split_id: string }) => row.payment_split_id),
  );
  const splitResult = await supabaseAdmin
    .from('payment_splits')
    .select(
      'id, created_at, payment_id, site_id, receiver_user_id, receiver_type, amount, payments(id, order_no, amount, currency, payment_type, transaction_no, tx_no, approved_at, created_at, status, refunded_at)',
    )
    .not('receiver_user_id', 'is', null)
    .order('created_at', { ascending: true });

  if (splitResult.error) return { message: splitResult.error.message };

  return ((splitResult.data || []) as unknown as PaymentSplitRow[]).filter((split) => {
    if (existingIds.has(split.id)) return false;
    if (!split.payments) return false;
    if (split.payments.status !== 'paid') return false;

    return Boolean(split.receiver_user_id);
  });
}

function groupSplits(splits: PaymentSplitRow[]) {
  const map = new Map<string, SettlementCreateGroup>();

  for (const split of splits) {
    if (!split.receiver_user_id) continue;

    const key = getGroupKey(split.site_id, split.receiver_user_id);
    const current = map.get(key) || { siteId: split.site_id, receiverUserId: split.receiver_user_id, splits: [] };
    current.splits.push(split);
    map.set(key, current);
  }

  return Array.from(map.values());
}

function buildScheduledSettlement(group: SettlementCreateGroup): SettlementInsertRow {
  const periodDates = group.splits.map(getPeriodDate).sort();
  const itemTotals = group.splits.reduce(
    (acc, split) => {
      const payment = split.payments;
      const paymentAmount = toNumber(payment?.amount);
      const splitAmount = toNumber(split.amount);
      const samePaymentSplits = group.splits.filter((row) => row.payment_id === split.payment_id);
      const fee = payment
        ? calculatePaymentFee(paymentAmount, payment.payment_type)
        : { feeAmount: 0, feeVatAmount: 0 };
      const pgFeeAmount = isFeePayer(split, samePaymentSplits) ? fee.feeAmount : 0;
      const pgFeeVatAmount = isFeePayer(split, samePaymentSplits) ? fee.feeVatAmount : 0;

      return {
        grossAmount: acc.grossAmount + paymentAmount,
        pgFeeAmount: acc.pgFeeAmount + pgFeeAmount,
        pgFeeVatAmount: acc.pgFeeVatAmount + pgFeeVatAmount,
        settlementAmount: acc.settlementAmount + Math.max(splitAmount - pgFeeAmount - pgFeeVatAmount, 0),
      };
    },
    { grossAmount: 0, pgFeeAmount: 0, pgFeeVatAmount: 0, settlementAmount: 0 },
  );

  return {
    receiver_user_id: group.receiverUserId,
    status: 'scheduled',
    period_start: periodDates[0] || new Date().toISOString(),
    period_end: periodDates[periodDates.length - 1] || new Date().toISOString(),
    gross_amount: itemTotals.grossAmount,
    platform_fee_amount: 0,
    pg_fee_amount: itemTotals.pgFeeAmount,
    pg_fee_vat_amount: itemTotals.pgFeeVatAmount,
    settlement_amount: itemTotals.settlementAmount,
    site_id: group.siteId,
  };
}

function buildScheduledSettlementItems(group: SettlementCreateGroup, settlementId: string): SettlementItemInsertRow[] {
  return group.splits.map((split) => {
    const payment = split.payments;
    const paymentAmount = toNumber(payment?.amount);
    const splitAmount = toNumber(split.amount);
    const samePaymentSplits = group.splits.filter((row) => row.payment_id === split.payment_id);
    const fee = payment ? calculatePaymentFee(paymentAmount, payment.payment_type) : { feeAmount: 0, feeVatAmount: 0 };
    const pgFeeAmount = isFeePayer(split, samePaymentSplits) ? fee.feeAmount : 0;
    const pgFeeVatAmount = isFeePayer(split, samePaymentSplits) ? fee.feeVatAmount : 0;

    return {
      settlement_id: settlementId,
      payment_id: split.payment_id,
      payment_split_id: split.id,
      site_id: split.site_id,
      receiver_user_id: split.receiver_user_id || '',
      payment_amount: paymentAmount,
      split_amount: splitAmount,
      platform_fee_amount: 0,
      pg_fee_amount: pgFeeAmount,
      pg_fee_vat_amount: pgFeeVatAmount,
      settlement_amount: Math.max(splitAmount - pgFeeAmount - pgFeeVatAmount, 0),
    };
  });
}

export async function createScheduledSettlements(supabaseAdmin: SupabaseClient) {
  const splits = await getUnsettledSplits(supabaseAdmin);
  if ('message' in splits) return splits;

  const groups = groupSplits(splits);

  if (groups.length === 0) {
    return { ok: true as const, createdCount: 0 };
  }

  for (const group of groups) {
    const settlementInsert = buildScheduledSettlement(group);
    const settlementResult = await supabaseAdmin
      .from('settlements')
      .insert(settlementInsert)
      .select('id, site_id, receiver_user_id')
      .single();

    if (settlementResult.error) return { message: settlementResult.error.message };

    const settlement = settlementResult.data as SettlementInsertResult;
    const itemRows = buildScheduledSettlementItems(group, settlement.id);
    const itemResult = await supabaseAdmin.from('settlement_items').insert(itemRows);

    if (itemResult.error) return { message: itemResult.error.message };
  }

  return { ok: true as const, createdCount: groups.length };
}

async function ensureTestPaymentFees(supabaseAdmin: SupabaseClient, items: SettlementItemRow[]) {
  const paymentIds = [...new Set(items.map((item) => item.payment_id))];

  if (paymentIds.length === 0) return { ok: true as const };

  const existingResult = await supabaseAdmin.from('payment_fees').select('payment_id').in('payment_id', paymentIds);
  if (existingResult.error) return { message: existingResult.error.message };

  const existingIds = new Set((existingResult.data || []).map((row: { payment_id: string }) => row.payment_id));
  const missingIds = paymentIds.filter((paymentId) => !existingIds.has(paymentId));

  if (missingIds.length === 0) return { ok: true as const };

  const paymentResult = await supabaseAdmin
    .from('payments')
    .select('id, order_no, amount, currency, payment_type, transaction_no, tx_no, approved_at, created_at')
    .in('id', missingIds);

  if (paymentResult.error) return { message: paymentResult.error.message };

  const paymentMap = new Map(((paymentResult.data || []) as PaymentRow[]).map((payment) => [payment.id, payment]));
  const estimatedMap = getEstimatedFeeByPayment(items);
  const rows = missingIds.map((paymentId) => {
    const payment = paymentMap.get(paymentId);
    const estimated = estimatedMap.get(paymentId) || { feeAmount: 0, feeVatAmount: 0, transactionAmount: 0 };
    const transactionAmount = payment ? toNumber(payment.amount) : estimated.transactionAmount;
    const fee = payment
      ? calculatePaymentFee(transactionAmount, payment.payment_type)
      : { feeAmount: roundAmount(estimated.feeAmount), feeVatAmount: roundAmount(estimated.feeVatAmount) };

    return {
      payment_id: paymentId,
      order_no: payment?.order_no || paymentId,
      pg_transaction_no: payment?.transaction_no || payment?.tx_no || null,
      portone_transaction_no: payment?.tx_no || null,
      transaction_at: payment?.approved_at || payment?.created_at || new Date().toISOString(),
      settlement_at: new Date().toISOString(),
      transaction_amount: transactionAmount,
      transaction_currency: payment?.currency || 'KRW',
      settlement_amount: Math.max(transactionAmount - fee.feeAmount - fee.feeVatAmount, 0),
      settlement_currency: payment?.currency || 'KRW',
      fee_amount: fee.feeAmount,
      fee_vat_amount: fee.feeVatAmount,
      raw_data: {
        source: 'internal_test_calculation',
        paymentType: payment?.payment_type || null,
      },
      applied_at: null,
    };
  });

  const insertResult = await supabaseAdmin.from('payment_fees').insert(rows);
  if (insertResult.error) return { message: insertResult.error.message };

  return { ok: true as const };
}

async function getPaymentFees(supabaseAdmin: SupabaseClient, paymentIds: string[]) {
  const result = await supabaseAdmin
    .from('payment_fees')
    .select('payment_id, fee_amount, fee_vat_amount')
    .in('payment_id', paymentIds);

  if (result.error) return { message: result.error.message };

  return (result.data || []) as PaymentFeeRow[];
}

function buildSettlementItemUpdates(items: SettlementItemRow[], feeRows: PaymentFeeRow[]) {
  const itemGroups = groupItemsByPayment(items);
  const feeMap = makePaymentFeeMap(feeRows);
  const updates: SettlementItemUpdate[] = [];

  for (const [paymentId, paymentItems] of itemGroups) {
    const fee = feeMap.get(paymentId);
    const feeAmountMap = distributeAmount(toNumber(fee?.fee_amount), paymentItems, 'pg_fee_amount');
    const feeVatAmountMap = distributeAmount(toNumber(fee?.fee_vat_amount), paymentItems, 'pg_fee_vat_amount');

    for (const item of paymentItems) {
      const pgFeeAmount = feeAmountMap.get(item.id) || 0;
      const pgFeeVatAmount = feeVatAmountMap.get(item.id) || 0;
      const settlementAmount = Math.max(toNumber(item.split_amount) - pgFeeAmount - pgFeeVatAmount, 0);

      updates.push({
        id: item.id,
        paymentAmount: toNumber(item.payment_amount),
        platformFeeAmount: toNumber(item.platform_fee_amount),
        pgFeeAmount,
        pgFeeVatAmount,
        settlementAmount,
      });
    }
  }

  return updates;
}

async function updateSettlementItems(supabaseAdmin: SupabaseClient, updates: SettlementItemUpdate[]) {
  for (const update of updates) {
    const result = await supabaseAdmin
      .from('settlement_items')
      .update({
        pg_fee_amount: update.pgFeeAmount,
        pg_fee_vat_amount: update.pgFeeVatAmount,
        settlement_amount: update.settlementAmount,
      })
      .eq('id', update.id);

    if (result.error) return { message: result.error.message };
  }

  return { ok: true as const };
}

async function markPaymentFeesApplied(supabaseAdmin: SupabaseClient, paymentIds: string[]) {
  if (paymentIds.length === 0) return { ok: true as const };

  const result = await supabaseAdmin
    .from('payment_fees')
    .update({ applied_at: new Date().toISOString() })
    .in('payment_id', paymentIds);

  if (result.error) return { message: result.error.message };

  return { ok: true as const };
}

async function updateSettlementSummary(
  supabaseAdmin: SupabaseClient,
  settlementId: string,
  updates: SettlementItemUpdate[],
) {
  const summary = updates.reduce(
    (acc, update) => ({
      grossAmount: acc.grossAmount + update.paymentAmount,
      platformFeeAmount: acc.platformFeeAmount + update.platformFeeAmount,
      pgFeeAmount: acc.pgFeeAmount + update.pgFeeAmount,
      pgFeeVatAmount: acc.pgFeeVatAmount + update.pgFeeVatAmount,
      settlementAmount: acc.settlementAmount + update.settlementAmount,
    }),
    { grossAmount: 0, platformFeeAmount: 0, pgFeeAmount: 0, pgFeeVatAmount: 0, settlementAmount: 0 },
  );

  const result = await supabaseAdmin
    .from('settlements')
    .update({
      status: 'confirmed',
      gross_amount: summary.grossAmount,
      platform_fee_amount: summary.platformFeeAmount,
      pg_fee_amount: summary.pgFeeAmount,
      pg_fee_vat_amount: summary.pgFeeVatAmount,
      settlement_amount: summary.settlementAmount,
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', settlementId);

  if (result.error) return { message: result.error.message };

  return { ok: true as const };
}

export async function confirmSettlement(supabaseAdmin: SupabaseClient, mode: SupabaseEnv, settlementId: string) {
  const settlement = await getSettlement(supabaseAdmin, settlementId);
  if ('message' in settlement) return settlement;

  if (settlement.status !== 'scheduled') {
    return { message: '정산 예정 상태에서만 확정할 수 있습니다.' };
  }

  const items = await getSettlementItems(supabaseAdmin, settlementId);
  if ('message' in items) return items;

  if (items.length === 0) {
    return { message: '정산 항목이 없습니다.' };
  }

  if (mode === 'test') {
    const testFeeResult = await ensureTestPaymentFees(supabaseAdmin, items);
    if ('message' in testFeeResult) return testFeeResult;
  }

  const paymentIds = [...new Set(items.map((item) => item.payment_id))];
  const feeRows = await getPaymentFees(supabaseAdmin, paymentIds);
  if ('message' in feeRows) return feeRows;

  const feePaymentIds = new Set(feeRows.map((row) => row.payment_id));
  const missingPaymentIds = paymentIds.filter((paymentId) => !feePaymentIds.has(paymentId));

  if (missingPaymentIds.length > 0) {
    return { message: '결제 수수료 확인값이 없는 정산 항목이 있습니다.' };
  }

  const updates = buildSettlementItemUpdates(items, feeRows);
  const itemUpdateResult = await updateSettlementItems(supabaseAdmin, updates);
  if ('message' in itemUpdateResult) return itemUpdateResult;

  const feeUpdateResult = await markPaymentFeesApplied(supabaseAdmin, paymentIds);
  if ('message' in feeUpdateResult) return feeUpdateResult;

  const summaryResult = await updateSettlementSummary(supabaseAdmin, settlementId, updates);
  if ('message' in summaryResult) return summaryResult;

  return { ok: true as const };
}

export async function completeSettlement(supabaseAdmin: SupabaseClient, settlementId: string) {
  const settlement = await getSettlement(supabaseAdmin, settlementId);
  if ('message' in settlement) return settlement;

  if (settlement.status !== 'confirmed') {
    return { message: '정산 확정 상태에서만 완료 처리할 수 있습니다.' };
  }

  const result = await supabaseAdmin
    .from('settlements')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', settlementId);

  if (result.error) return { message: result.error.message };

  return { ok: true as const };
}

async function getSettlementIdsByStatus(supabaseAdmin: SupabaseClient, status: 'scheduled' | 'confirmed') {
  const result = await supabaseAdmin
    .from('settlements')
    .select('id')
    .eq('status', status)
    .order('created_at', { ascending: true });

  if (result.error) {
    return { message: result.error.message };
  }

  return (result.data || []).map((row: { id: string }) => row.id);
}

export async function confirmScheduledSettlements(supabaseAdmin: SupabaseClient, mode: SupabaseEnv) {
  const settlementIds = await getSettlementIdsByStatus(supabaseAdmin, 'scheduled');
  if ('message' in settlementIds) {
    return settlementIds;
  }

  for (const settlementId of settlementIds) {
    const result = await confirmSettlement(supabaseAdmin, mode, settlementId);
    if ('message' in result) {
      return result;
    }
  }

  return { ok: true as const, updatedCount: settlementIds.length };
}

export async function completeConfirmedSettlements(supabaseAdmin: SupabaseClient) {
  const settlementIds = await getSettlementIdsByStatus(supabaseAdmin, 'confirmed');
  if ('message' in settlementIds) {
    return settlementIds;
  }

  for (const settlementId of settlementIds) {
    const result = await completeSettlement(supabaseAdmin, settlementId);
    if ('message' in result) {
      return result;
    }
  }

  return { ok: true as const, updatedCount: settlementIds.length };
}

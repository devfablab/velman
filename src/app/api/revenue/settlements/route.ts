import { NextRequest } from 'next/server';
import { getPageParams, getSearchValue, jsonResponse, requireAdmin } from '@/lib/api';
import type { SettlementRow, SettlementStatus, TablePage } from '@/lib/types';
import { decryptNullable } from '@/lib/decrypt';

type SettlementDbRow = {
  id: string;
  site_id: string;
  receiver_user_id: string;
  status: SettlementStatus;
  period_start: string;
  period_end: string;
  gross_amount: number | string;
  platform_fee_amount: number | string;
  pg_fee_amount: number | string;
  pg_fee_vat_amount: number | string;
  settlement_amount: number | string;
  confirmed_at: string | null;
  completed_at: string | null;
  memo: string | null;
  rhizomes: { site_label: string | null } | null;
  particles: { email: string } | null;
};

type StigmaRow = { user_id: string; user_name: string; payment_email: string };

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const { page, pageSize, from, to } = getPageParams(request);
  const status = getSearchValue(request, 'status') as SettlementStatus | '';

  let query = auth.supabaseAdmin
    .from('settlements')
    .select(
      'id, site_id, receiver_user_id, status, period_start, period_end, gross_amount, platform_fee_amount, pg_fee_amount, pg_fee_vat_amount, settlement_amount, confirmed_at, completed_at, memo, rhizomes(site_label), particles(email)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(from, to);

  if (status) query = query.eq('status', status);

  const result = await query;
  if (result.error) {
    return jsonResponse({ items: [], page, pageSize, total: 0, message: result.error.message });
  }

  const rows = (result.data || []) as unknown as SettlementDbRow[];
  const receiverIds = rows.map((row) => row.receiver_user_id);
  const stigmaResult = receiverIds.length
    ? await auth.supabaseAdmin.from('stigmas').select('user_id, user_name, payment_email').in('user_id', receiverIds)
    : { data: [] as StigmaRow[] };
  const stigmaMap = new Map((stigmaResult.data || []).map((row) => [row.user_id, row as StigmaRow]));

  const items: SettlementRow[] = rows.map((row) => {
    const stigma = stigmaMap.get(row.receiver_user_id);
    return {
      id: row.id,
      siteLabel: row.rhizomes?.site_label || null,
      receiverEmail: row.particles?.email || decryptNullable(stigma?.payment_email) || null,
      receiverName: stigma?.user_name || null,
      status: row.status,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      grossAmount: Number(row.gross_amount),
      platformFeeAmount: Number(row.platform_fee_amount),
      pgFeeAmount: Number(row.pg_fee_amount),
      pgFeeVatAmount: Number(row.pg_fee_vat_amount),
      settlementAmount: Number(row.settlement_amount),
      confirmedAt: row.confirmed_at,
      completedAt: row.completed_at,
      memo: row.memo,
    };
  });

  const payload: TablePage<SettlementRow> = {
    items,
    page,
    pageSize,
    total: result.count || 0,
  };

  return jsonResponse(payload);
}

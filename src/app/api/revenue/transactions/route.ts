import { NextRequest } from 'next/server';
import { getPageParams, jsonResponse, requireAdmin } from '@/lib/api';
import type { TablePage, TransactionRow } from '@/lib/types';
import { decryptNullable } from '@/lib/decrypt';

type PaymentRow = {
  id: string;
  created_at: string;
  approved_at: string | null;
  buyer_user_id: string;
  amount: number | string;
  refunded_amount: number | string | null;
  status: string;
  payment_type: string;
  target_type: string;
};

type StigmaRow = { user_id: string; payment_email: string; user_name: string };
type SplitRow = { payment_id: string; rhizomes: { site_label: string | null } | null };

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const { page, pageSize, from, to } = getPageParams(request);

  const result = await auth.supabaseAdmin
    .from('payments')
    .select('id, created_at, approved_at, buyer_user_id, amount, refunded_amount, status, payment_type, target_type', {
      count: 'exact',
    })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (result.error) return jsonResponse({ message: result.error.message }, { status: 500 });

  const rows = (result.data || []) as PaymentRow[];
  const buyerIds = rows.map((row) => row.buyer_user_id);
  const paymentIds = rows.map((row) => row.id);

  const [stigmaResult, splitResult] = await Promise.all([
    buyerIds.length
      ? auth.supabaseAdmin.from('stigmas').select('user_id, payment_email, user_name').in('user_id', buyerIds)
      : { data: [] as StigmaRow[] },
    paymentIds.length
      ? auth.supabaseAdmin
          .from('payment_splits')
          .select('payment_id, rhizomes(site_label)')
          .in('payment_id', paymentIds)
      : { data: [] as SplitRow[] },
  ]);

  const buyerMap = new Map((stigmaResult.data || []).map((row) => [row.user_id, row as StigmaRow]));
  const siteMap = new Map<string, string | null>();
  for (const row of (splitResult.data || []) as unknown as SplitRow[]) {
    if (!siteMap.has(row.payment_id)) siteMap.set(row.payment_id, row.rhizomes?.site_label || null);
  }

  const items: TransactionRow[] = rows.map((row) => {
    const buyer = buyerMap.get(row.buyer_user_id);
    return {
      id: row.id,
      createdAt: row.created_at,
      approvedAt: row.approved_at,
      buyerEmail: decryptNullable(buyer?.payment_email, auth.mode) || null,
      buyerName: buyer?.user_name || null,
      siteLabel: siteMap.get(row.id) || null,
      amount: Number(row.amount || 0),
      refundedAmount: row.refunded_amount === null ? null : Number(row.refunded_amount),
      status: row.status,
      paymentType: row.payment_type,
      targetType: row.target_type,
    };
  });

  const payload: TablePage<TransactionRow> = {
    items,
    page,
    pageSize,
    total: result.count || 0,
  };

  return jsonResponse(payload);
}

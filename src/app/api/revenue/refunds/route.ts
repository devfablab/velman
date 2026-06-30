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
  refunded_at: string | null;
  status: string;
  payment_type: string;
  target_type: string;
};

type StigmaRow = { user_id: string; payment_email: string; user_name: string };

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const { page, pageSize, from, to } = getPageParams(request);

  const result = await auth.supabaseAdmin
    .from('payments')
    .select(
      'id, created_at, approved_at, buyer_user_id, amount, refunded_amount, refunded_at, status, payment_type, target_type',
      { count: 'exact' },
    )
    .not('refunded_at', 'is', null)
    .order('refunded_at', { ascending: false })
    .range(from, to);

  if (result.error) return jsonResponse({ message: result.error.message }, { status: 500 });

  const rows = (result.data || []) as PaymentRow[];
  const buyerIds = rows.map((row) => row.buyer_user_id);
  const stigmaResult = buyerIds.length
    ? await auth.supabaseAdmin.from('stigmas').select('user_id, payment_email, user_name').in('user_id', buyerIds)
    : { data: [] as StigmaRow[] };
  const buyerMap = new Map((stigmaResult.data || []).map((row) => [row.user_id, row as StigmaRow]));

  const items: TransactionRow[] = rows.map((row) => {
    const buyer = buyerMap.get(row.buyer_user_id);
    return {
      id: row.id,
      createdAt: row.refunded_at || row.created_at,
      approvedAt: row.approved_at,
      buyerEmail: decryptNullable(buyer?.payment_email, auth.mode) || null,
      buyerName: buyer?.user_name || null,
      siteLabel: null,
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

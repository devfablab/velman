import { NextRequest } from 'next/server';
import { jsonResponse, requireAdmin } from '@/lib/api';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const { supabaseAdmin } = auth;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString();

  const [members, todayMembers, sites, todaySites, payments, todayPayments, refunds] = await Promise.all([
    supabaseAdmin.from('particles').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('particles').select('id', { count: 'exact', head: true }).gte('created_at', todayIso),
    supabaseAdmin.from('rhizomes').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('rhizomes').select('id', { count: 'exact', head: true }).gte('created_at', todayIso),
    supabaseAdmin.from('payments').select('amount, status, refunded_amount'),
    supabaseAdmin.from('payments').select('amount, status').gte('created_at', todayIso),
    supabaseAdmin.from('payments').select('refunded_amount, refunded_at').not('refunded_at', 'is', null).gte('refunded_at', todayIso),
  ]);

  const allPaymentRows = payments.data || [];
  const todayPaymentRows = todayPayments.data || [];
  const refundRows = refunds.data || [];

  return jsonResponse({
    totalMembers: members.count || 0,
    todayMembers: todayMembers.count || 0,
    totalSites: sites.count || 0,
    todaySites: todaySites.count || 0,
    totalPaymentAmount: allPaymentRows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    todayPaymentAmount: todayPaymentRows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    todayPaymentCount: todayPaymentRows.length,
    todayRefundAmount: refundRows.reduce((sum, row) => sum + Number(row.refunded_amount || 0), 0),
    todayRefundCount: refundRows.length,
  });
}

import { NextRequest } from 'next/server';
import { getPageParams, getSearchValue, jsonResponse, requireAdmin } from '@/lib/api';
import { getAccountStatus } from '@/lib/utils';
import type { SiteRow, TablePage } from '@/lib/types';

type RhizomeRow = {
  id: string;
  created_at: string;
  site_key: string;
  site_label: string | null;
  site_type: string;
  is_shutdown: boolean;
  is_blocked: boolean | null;
  plan_type: string | null;
  plans: {
    plan_label: string;
    price: number | string;
  } | null;
};

type SplitRow = { site_id: string; amount: number | string; payments: { refunded_amount: number | string | null } | null };

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const { supabaseAdmin } = auth;
  const { page, pageSize, from, to } = getPageParams(request);
  const q = getSearchValue(request);
  const type = getSearchValue(request, 'type');

  let query = supabaseAdmin
    .from('rhizomes')
    .select('id, created_at, site_key, site_label, site_type, is_shutdown, is_blocked, plan_type, plans(plan_label, price)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (type) query = query.eq('site_type', type);
  if (q) query = query.or(`site_key.ilike.%${q}%,site_label.ilike.%${q}%`);

  const result = await query;
  if (result.error) return jsonResponse({ message: result.error.message }, { status: 500 });

  const rows = (result.data || []) as unknown as RhizomeRow[];
  const siteIds = rows.map((row) => row.id);

  const [memberResult, splitResult] = await Promise.all([
    siteIds.length ? supabaseAdmin.from('rhizome_stigmas').select('site_id').in('site_id', siteIds).eq('is_approval', true) : { data: [] as { site_id: string }[] },
    siteIds.length ? supabaseAdmin.from('payment_splits').select('site_id, amount, payments(refunded_amount)').in('site_id', siteIds) : { data: [] as SplitRow[] },
  ]);

  const memberCountMap = new Map<string, number>();
  for (const row of memberResult.data || []) {
    memberCountMap.set(row.site_id, (memberCountMap.get(row.site_id) || 0) + 1);
  }

  const revenueMap = new Map<string, { revenue: number; refund: number }>();
  for (const row of ((splitResult.data || []) as unknown as SplitRow[])) {
    const current = revenueMap.get(row.site_id) || { revenue: 0, refund: 0 };
    current.revenue += Number(row.amount || 0);
    current.refund += Number(row.payments?.refunded_amount || 0);
    revenueMap.set(row.site_id, current);
  }

  const items: SiteRow[] = rows.map((row) => {
    const money = revenueMap.get(row.id) || { revenue: 0, refund: 0 };
    return {
      id: row.id,
      siteKey: row.site_key,
      siteLabel: row.site_label || '-',
      siteType: row.site_type,
      createdAt: row.created_at,
      approvedMemberCount: memberCountMap.get(row.id) || 0,
      planLabel: row.plans?.plan_label || null,
      planPrice: row.plans ? Number(row.plans.price) : null,
      status: getAccountStatus(row),
      totalRevenue: money.revenue,
      totalRefunded: money.refund,
    };
  });

  const payload: TablePage<SiteRow> = {
    items,
    page,
    pageSize,
    total: result.count || 0,
  };

  return jsonResponse(payload);
}

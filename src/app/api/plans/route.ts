import { NextRequest } from 'next/server';
import { errorResponse, jsonResponse, requireAdmin } from '@/lib/api';
import type { PlanRow } from '@/lib/types';

type PlanDbRow = {
  id: string;
  product_type: string;
  category_label: string;
  plan_label: string;
  price: number | string;
  sort_order: number | string | null;
};

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const result = await auth.supabaseAdmin
    .from('plans')
    .select('id, product_type, category_label, plan_label, price, sort_order')
    .order('sort_order', { ascending: true });

  if (result.error) return errorResponse(result.error.message, 500);

  const items: PlanRow[] = ((result.data || []) as PlanDbRow[]).map((row) => ({
    id: row.id,
    productType: row.product_type,
    categoryLabel: row.category_label,
    planLabel: row.plan_label,
    price: Number(row.price),
    sortOrder: row.sort_order === null ? null : Number(row.sort_order),
  }));

  return jsonResponse({ items });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = (await request.json()) as { id?: string; price?: string };
  const id = typeof body.id === 'string' ? body.id : '';
  const priceText = typeof body.price === 'string' ? body.price.replace(/,/g, '').trim() : '';
  const price = Number(priceText);

  if (!id) return errorResponse('요금제 id가 없습니다.');
  if (!Number.isInteger(price) || price < 0) return errorResponse('가격을 확인해 주세요.');

  const result = await auth.supabaseAdmin
    .from('plans')
    .update({ price })
    .eq('id', id)
    .select('id')
    .single();

  if (result.error) return errorResponse(result.error.message, 500);

  return jsonResponse({ ok: true });
}

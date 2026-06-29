import { NextRequest } from 'next/server';
import { decrypt } from '@/lib/decrypt';
import { getPageParams, getSearchValue, jsonResponse, requireAdmin } from '@/lib/api';
import { getAccountStatus, isAdultFromBirthDate } from '@/lib/utils';
import type { MemberRow, TablePage } from '@/lib/types';

type StigmaRow = {
  id: string;
  created_at: string;
  user_id: string;
  email: string;
  user_name: string;
  role: string;
};

type ChorogonRow = {
  user_id: string;
  birth_date: string | null;
};

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const { supabaseAdmin } = auth;
  const { page, pageSize, from, to } = getPageParams(request);
  const q = getSearchValue(request);

  let query = supabaseAdmin
    .from('stigmas')
    .select('id, created_at, user_id, email, user_name, role', { count: 'exact' })
    .neq('role', 'admin')
    .order('created_at', { ascending: false })
    .range(from, to);

  if (q) {
    query = query.or(`email.ilike.%${q}%,user_name.ilike.%${q}%`);
  }

  const result = await query;
  if (result.error) {
    return jsonResponse({ message: result.error.message }, { status: 500 });
  }

  const rows = (result.data || []) as StigmaRow[];
  const particleIds = rows.map((row) => row.user_id);
  const chorogons = particleIds.length
    ? await supabaseAdmin.from('chorogons').select('user_id, birth_date').in('user_id', particleIds)
    : { data: [] as ChorogonRow[] };
  const chorogonMap = new Map((chorogons.data || []).map((row) => [row.user_id, row as ChorogonRow]));

  const items: MemberRow[] = rows.map((row) => {
    const birthDate = chorogonMap.get(row.user_id)?.birth_date || null;
    const adult = isAdultFromBirthDate(birthDate);
    return {
      id: row.id,
      particleId: row.user_id,
      email: decrypt(row.email),
      userName: decrypt(row.user_name),
      createdAt: row.created_at,
      birthDate,
      isMinor: adult === null ? null : !adult,
      accountStatus: getAccountStatus({}),
    };
  });

  const payload: TablePage<MemberRow> = {
    items,
    page,
    pageSize,
    total: result.count || 0,
  };

  return jsonResponse(payload);
}

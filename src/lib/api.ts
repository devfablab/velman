import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from './supabase';
import { normalizeText } from './utils';

export function jsonResponse<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ message }, { status });
}

export function getPageParams(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(Number(searchParams.get('page') || 1), 1);
  const pageSize = 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return { page, pageSize, from, to };
}

export async function requireAdmin(request: NextRequest) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return { ok: false as const, response: errorResponse('로그인이 필요합니다.', 401) };
  }

  const supabaseAdmin = getSupabaseAdmin();
  const userResult = await supabaseAdmin.auth.getUser(token);
  const authUser = userResult.data.user;

  if (!authUser?.email) {
    return { ok: false as const, response: errorResponse('로그인이 필요합니다.', 401) };
  }

  const stigmaResult = await supabaseAdmin
    .from('stigmas')
    .select('id, user_id, email, role, user_name')
    .eq('user_id', authUser.id)
    .maybeSingle();

  if (stigmaResult.error) {
    return { ok: false as const, response: errorResponse(stigmaResult.error.message, 500) };
  }

  if (stigmaResult.data?.role !== 'admin') {
    return { ok: false as const, response: errorResponse('관리자만 접근할 수 있습니다.', 403) };
  }

  return { ok: true as const, supabaseAdmin, admin: stigmaResult.data };
}

export function getSearchValue(request: NextRequest, key = 'q') {
  return normalizeText(request.nextUrl.searchParams.get(key));
}

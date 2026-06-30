import { NextRequest } from 'next/server';
import { clearAdminSessionCookies, errorResponse, jsonResponse, setAdminSessionCookies } from '@/lib/api';
import { getSupabaseAdmin, type SupabaseEnv } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type SessionBody = {
  accessToken?: string;
  refreshToken?: string;
  mode?: string;
};

function getAuthMode(value: string | undefined): SupabaseEnv {
  return value === 'prod' ? 'prod' : 'test';
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as SessionBody;
  const accessToken = normalizeText(body.accessToken);
  const refreshToken = normalizeText(body.refreshToken);
  const mode = getAuthMode(body.mode);

  if (!accessToken || !refreshToken) {
    return errorResponse('로그인 세션 정보가 없습니다.', 400);
  }

  const supabaseAdmin = getSupabaseAdmin(mode);
  const userResult = await supabaseAdmin.auth.getUser(accessToken);
  const authUser = userResult.data.user;

  if (!authUser) {
    return errorResponse('로그인 세션을 확인할 수 없습니다.', 401);
  }

  const stigmaResult = await supabaseAdmin.from('stigmas').select('id, role').eq('user_id', authUser.id).maybeSingle();

  if (stigmaResult.error) {
    return errorResponse(stigmaResult.error.message, 500);
  }

  if (stigmaResult.data?.role !== 'admin') {
    return errorResponse('관리자만 접근할 수 있습니다.', 403);
  }

  const response = jsonResponse({ ok: true });
  setAdminSessionCookies(response, { accessToken, refreshToken, mode });
  return response;
}

export async function DELETE() {
  const response = jsonResponse({ ok: true });
  clearAdminSessionCookies(response);
  return response;
}

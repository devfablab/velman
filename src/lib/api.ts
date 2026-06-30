import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getSupabaseAuth, type SupabaseEnv } from './supabase';
import { normalizeText } from './utils';

const SESSION_MAX_AGE = 60 * 60 * 24;
const ACCESS_TOKEN_COOKIE = 'velman_admin_access_token';
const REFRESH_TOKEN_COOKIE = 'velman_admin_refresh_token';
const AUTH_ENV_COOKIE = 'velman_admin_env';

export type AdminSession = {
  accessToken: string;
  refreshToken: string;
  mode: SupabaseEnv;
};

type SessionCookieOptions = {
  httpOnly: true;
  maxAge?: number;
  path: string;
  sameSite: 'lax';
  secure: boolean;
};

function getSessionCookieOptions(maxAge = SESSION_MAX_AGE): SessionCookieOptions {
  return {
    httpOnly: true,
    maxAge,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  };
}

function getAuthMode(value: string | null | undefined): SupabaseEnv {
  return value === 'prod' ? 'prod' : 'test';
}

function getCookieSession(request: NextRequest) {
  const accessToken = normalizeText(request.cookies.get(ACCESS_TOKEN_COOKIE)?.value);
  const refreshToken = normalizeText(request.cookies.get(REFRESH_TOKEN_COOKIE)?.value);
  const mode = getAuthMode(request.cookies.get(AUTH_ENV_COOKIE)?.value);

  return { accessToken, refreshToken, mode };
}

export function setAdminSessionCookies(response: NextResponse, session: AdminSession) {
  const options = getSessionCookieOptions();
  response.cookies.set(ACCESS_TOKEN_COOKIE, session.accessToken, options);
  response.cookies.set(REFRESH_TOKEN_COOKIE, session.refreshToken, options);
  response.cookies.set(AUTH_ENV_COOKIE, session.mode, options);
}

export function clearAdminSessionCookies(response: NextResponse) {
  const options = getSessionCookieOptions(0);
  response.cookies.set(ACCESS_TOKEN_COOKIE, '', options);
  response.cookies.set(REFRESH_TOKEN_COOKIE, '', options);
  response.cookies.set(AUTH_ENV_COOKIE, '', options);
}

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

async function getValidSession(request: NextRequest) {
  const authorization = request.headers.get('authorization') || '';
  const headerToken = authorization.replace(/^Bearer\s+/i, '').trim();
  const cookieSession = getCookieSession(request);
  const accessToken = headerToken || cookieSession.accessToken;
  const supabaseAdmin = getSupabaseAdmin(cookieSession.mode);

  if (accessToken) {
    const userResult = await supabaseAdmin.auth.getUser(accessToken);

    if (userResult.data.user) {
      return {
        supabaseAdmin,
        authUser: userResult.data.user,
        mode: cookieSession.mode,
        session: cookieSession.refreshToken
          ? { accessToken, refreshToken: cookieSession.refreshToken, mode: cookieSession.mode }
          : null,
      };
    }
  }

  if (!cookieSession.refreshToken) {
    return null;
  }

  const supabaseAuth = getSupabaseAuth(cookieSession.mode);
  const refreshResult = await supabaseAuth.auth.refreshSession({ refresh_token: cookieSession.refreshToken });
  const refreshedSession = refreshResult.data.session;

  if (!refreshedSession?.access_token || !refreshedSession.refresh_token || !refreshedSession.user) {
    return null;
  }

  return {
    supabaseAdmin,
    authUser: refreshedSession.user,
    mode: cookieSession.mode,
    session: {
      accessToken: refreshedSession.access_token,
      refreshToken: refreshedSession.refresh_token,
      mode: cookieSession.mode,
    },
  };
}

export async function requireAdmin(request: NextRequest) {
  const sessionResult = await getValidSession(request);

  if (!sessionResult?.authUser.email) {
    return { ok: false as const, response: errorResponse('로그인이 필요합니다.', 401) };
  }

  const { supabaseAdmin, authUser, mode, session } = sessionResult;
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

  return { ok: true as const, supabaseAdmin, admin: stigmaResult.data, mode, session };
}

export function getSearchValue(request: NextRequest, key = 'q') {
  return normalizeText(request.nextUrl.searchParams.get(key));
}

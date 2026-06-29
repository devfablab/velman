import { getSupabaseBrowser } from './supabase';

export async function apiFetch<T>(url: string, init?: RequestInit) {
  const supabase = getSupabaseBrowser();
  const sessionResult = await supabase.auth.getSession();
  const accessToken = sessionResult.data.session?.access_token;

  const headers = new Headers(init?.headers);
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(url, {
    ...init,
    headers,
  });

  const payload = (await response.json()) as T | { message?: string };
  if (!response.ok) {
    const message = 'message' in payload && payload.message ? payload.message : '요청 처리에 실패했습니다.';
    throw new Error(message);
  }

  return payload as T;
}

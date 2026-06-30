import { NextRequest } from 'next/server';
import { clearAdminSessionCookies, jsonResponse, requireAdmin, setAdminSessionCookies } from '@/lib/api';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);

  if (!auth.ok) {
    clearAdminSessionCookies(auth.response);
    return auth.response;
  }

  const response = jsonResponse({ admin: auth.admin });

  if (auth.session) {
    setAdminSessionCookies(response, auth.session);
  }

  return response;
}

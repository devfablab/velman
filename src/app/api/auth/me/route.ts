import { NextRequest } from 'next/server';
import { jsonResponse, requireAdmin } from '@/lib/api';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  return jsonResponse({ admin: auth.admin });
}

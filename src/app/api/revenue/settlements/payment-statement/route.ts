import { NextRequest } from 'next/server';
import { errorResponse, jsonResponse, requireAdmin } from '@/lib/api';
import { createPaymentStatementExcel, getPaymentStatementMonths } from '@/lib/settlementExcels';
import { normalizeText } from '@/lib/utils';

export const runtime = 'nodejs';

function excelResponse(buffer: Buffer, filename: string) {
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'no-store',
    },
  });
}

function isValidMonth(value: string) {
  return /^\d{4}-\d{2}$/.test(value);
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const mode = normalizeText(request.nextUrl.searchParams.get('mode'));

  if (mode === 'months') {
    const result = await getPaymentStatementMonths(auth.supabaseAdmin);
    if ('message' in result) return errorResponse(result.message, 400);

    return jsonResponse(result);
  }

  const month = normalizeText(request.nextUrl.searchParams.get('month'));

  if (!isValidMonth(month)) {
    return errorResponse('귀속월이 올바르지 않습니다.', 400);
  }

  const result = await createPaymentStatementExcel(auth.supabaseAdmin, auth.mode, month);
  if ('message' in result) return errorResponse(result.message, 400);

  return excelResponse(result.buffer, result.filename);
}

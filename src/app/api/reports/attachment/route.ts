import { NextRequest } from 'next/server';
import { errorResponse, jsonResponse, requireAdmin } from '@/lib/api';

type AttachmentReportType = 'legals' | 'rights';

type AttachmentRecord = {
  name?: unknown;
  filename?: unknown;
  fileName?: unknown;
  originalName?: unknown;
  path?: unknown;
  filePath?: unknown;
  storagePath?: unknown;
  key?: unknown;
  url?: unknown;
};

type ReportAttachmentRow = {
  attachments?: unknown;
  copyright_proof_files?: unknown;
};

const reportTableMap = {
  legals: 'report_legals',
  rights: 'report_rights',
} satisfies Record<AttachmentReportType, string>;

const reportBucketMap = {
  legals: 'report-legals',
  rights: 'report-rights',
} satisfies Record<AttachmentReportType, string>;

function isAttachmentReportType(value: string | null): value is AttachmentReportType {
  return value === 'legals' || value === 'rights';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getAttachmentText(record: AttachmentRecord, keys: (keyof AttachmentRecord)[]) {
  const value = keys.map((key) => record[key]).find((item) => typeof item === 'string' && item.trim());

  return typeof value === 'string' ? value : '';
}

function getAttachmentPath(value: unknown) {
  if (!isRecord(value)) return '';

  const record = value as AttachmentRecord;

  return getAttachmentText(record, ['path', 'filePath', 'storagePath', 'key', 'url']);
}

function getAttachmentList(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value;
}

function hasAttachmentPath(files: unknown[], path: string) {
  return files.some((file) => getAttachmentPath(file) === path);
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const searchParams = request.nextUrl.searchParams;
  const reportType = searchParams.get('reportType');
  const reportId = searchParams.get('reportId');
  const path = searchParams.get('path');

  if (!isAttachmentReportType(reportType)) {
    return errorResponse('신고 유형이 올바르지 않습니다.', 400);
  }

  if (!reportId) {
    return errorResponse('신고 ID가 없습니다.', 400);
  }

  if (!path) {
    return errorResponse('첨부파일 경로가 없습니다.', 400);
  }

  const table = reportTableMap[reportType];
  const bucket = reportBucketMap[reportType];
  const selectColumns = reportType === 'legals' ? 'attachments' : 'copyright_proof_files';

  const result = await auth.supabaseAdmin.from(table).select(selectColumns).eq('id', reportId).maybeSingle();

  if (result.error) {
    return errorResponse(result.error.message, 500);
  }

  if (!result.data) {
    return errorResponse('신고 내역을 찾을 수 없습니다.', 404);
  }

  const row = result.data as ReportAttachmentRow;
  const files = getAttachmentList(reportType === 'legals' ? row.attachments : row.copyright_proof_files);

  if (!hasAttachmentPath(files, path)) {
    return errorResponse('첨부파일을 찾을 수 없습니다.', 404);
  }

  const signedUrlResult = await auth.supabaseAdmin.storage.from(bucket).createSignedUrl(path, 60);

  if (signedUrlResult.error) {
    return errorResponse(signedUrlResult.error.message, 500);
  }

  return jsonResponse({ signedUrl: signedUrlResult.data.signedUrl });
}

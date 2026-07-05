import { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { errorResponse, getPageParams, getSearchValue, jsonResponse, requireAdmin } from '@/lib/api';
import {
  buildBoardHref,
  buildPostHref,
  buildSiteHref,
  falseManipulatedInfoCategoryLabel,
  filmingReasonTypeLabel,
  filmingRequestTypeLabel,
  getReportStatus,
  getReportType,
  guidelineCategoryLabel,
  illegalInfoCategoryLabel,
  joinLabels,
  legalRequestTypeLabel,
  legalTypeLabel,
  privacyReportTypeLabel,
  reportCategoryColumn,
  reportCategoryLabel,
  reportStatuses,
  reportTableNames,
  rightReasonTypeLabel,
  rightsOwnerTypeLabel,
  truncateText,
} from '@/lib/reports';
import type {
  ReportCategoryCount,
  ReportDetailField,
  ReportRow,
  ReportSearchLevel,
  ReportSearchResult,
  ReportSearchRow,
  ReportStatus,
  ReportTargetType,
  ReportType,
  TablePage,
} from '@/lib/types';

const SEARCH_LIMIT = 20;

type ReportBaseRow = {
  id: string;
  target_type: string | null;
  target_id: string | null;
  site_id: string | null;
  board_id: string | null;
  post_id: string | null;
  comment_id: string | null;
  reporter_user_id: string | null;
  status: ReportStatus;
  created_at: string;
  updated_at: string | null;
  handled_at: string | null;
  handler_user_id: string | null;
};

type GuidelineReportDbRow = ReportBaseRow & {
  target_type: Exclude<ReportTargetType, null>;
  target_id: string;
  reporter_user_id: string;
  report_category: string;
};

type LegalReportDbRow = ReportBaseRow & {
  legal_type: string;
  email: string;
  phone: string;
  attachments: unknown;
  request_type: string | null;
  illegal_info_categories: string[] | null;
  false_manipulated_info_categories: string[] | null;
  report_content: string | null;
  report_reason: string | null;
  report_basis: string | null;
  illegal_info_confirmed: boolean | null;
  false_manipulated_info_confirmed: boolean | null;
  illegal_info_notice_confirmed: boolean | null;
  filming_request_types: string[] | null;
  filming_reason_types: string[] | null;
  filming_target: string | null;
  filming_request_confirmed: boolean | null;
  filming_notice_confirmed: boolean | null;
  privacy_report_type: string | null;
  exposed_information: string | null;
  privacy_request_reason: string | null;
  report_url: string | null;
};

type RightReportDbRow = ReportBaseRow & {
  report_url: string | null;
  email: string;
  phone: string;
  reason_type: string;
  rights_owner_type: string | null;
  copyright_original_urls: string[] | null;
  copyright_proof_files: unknown;
};

type SiteRow = { id: string; site_key: string; site_label: string | null };
type BoardRow = { id: string; site_id: string; board_key: string; board_label: string | null };
type PostRow = { id: string; site_id: string; board_id: string; slug: number | string; subject: string };
type CommentRow = { id: string; site_id: string; board_id: string; post_id: string; content: string };
type ParticleRow = { id: string; email: string };
type CategoryOnlyRow = { report_category?: string; legal_type?: string; reason_type?: string };

type ReportMaps = {
  siteMap: Map<string, SiteRow>;
  boardMap: Map<string, BoardRow>;
  postMap: Map<string, PostRow>;
  commentMap: Map<string, CommentRow>;
  userMap: Map<string, ParticleRow>;
};

type ReportPatchBody = {
  reportType?: string;
  reportId?: string;
  status?: string;
};

function uniqueIds(values: (string | null | undefined)[]) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function toTargetType(value: string | null): ReportTargetType {
  if (value === 'site' || value === 'board' || value === 'post' || value === 'comment') return value;
  return null;
}

function stringifyValue(value: unknown) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function addDetail(details: ReportDetailField[], label: string, value: unknown) {
  const text = stringifyValue(value);
  if (!text) return details;
  return [...details, { label, value: text }];
}

function getAttachmentCount(value: unknown) {
  return Array.isArray(value) ? `${value.length}개` : '';
}

function getTargetSummary(row: ReportBaseRow, maps: ReportMaps) {
  const site = row.site_id ? maps.siteMap.get(row.site_id) || null : null;
  const board = row.board_id ? maps.boardMap.get(row.board_id) || null : null;
  const post = row.post_id ? maps.postMap.get(row.post_id) || null : null;
  const comment = row.comment_id ? maps.commentMap.get(row.comment_id) || null : null;
  const siteKey = site?.site_key || null;
  const boardKey = board?.board_key || null;
  const postSlug = post?.slug === undefined || post?.slug === null ? null : String(post.slug);

  return {
    targetType: toTargetType(row.target_type),
    targetId: row.target_id,
    siteId: row.site_id,
    siteKey,
    siteLabel: site?.site_label || siteKey,
    siteHref: buildSiteHref(siteKey),
    boardId: row.board_id,
    boardKey,
    boardLabel: board?.board_label || boardKey,
    boardHref: buildBoardHref(siteKey, boardKey),
    postId: row.post_id,
    postSlug,
    postSubject: post?.subject || null,
    postHref: buildPostHref(siteKey, boardKey, postSlug),
    commentId: row.comment_id,
    commentPreview: truncateText(comment?.content, 27),
    commentHref: buildPostHref(siteKey, boardKey, postSlug),
    reporterEmail: row.reporter_user_id ? maps.userMap.get(row.reporter_user_id)?.email || null : null,
  };
}

async function getMaps(supabaseAdmin: SupabaseClient, rows: ReportBaseRow[]): Promise<ReportMaps> {
  const siteIds = uniqueIds(rows.map((row) => row.site_id));
  const boardIds = uniqueIds(rows.map((row) => row.board_id));
  const postIds = uniqueIds(rows.map((row) => row.post_id));
  const commentIds = uniqueIds(rows.map((row) => row.comment_id));
  const userIds = uniqueIds(rows.flatMap((row) => [row.reporter_user_id, row.handler_user_id]));

  const [siteResult, boardResult, postResult, commentResult, userResult] = await Promise.all([
    siteIds.length
      ? supabaseAdmin.from('rhizomes').select('id, site_key, site_label').in('id', siteIds)
      : { data: [] as SiteRow[] },
    boardIds.length
      ? supabaseAdmin.from('boards').select('id, site_id, board_key, board_label').in('id', boardIds)
      : { data: [] as BoardRow[] },
    postIds.length
      ? supabaseAdmin.from('posts').select('id, site_id, board_id, slug, subject').in('id', postIds)
      : { data: [] as PostRow[] },
    commentIds.length
      ? supabaseAdmin.from('post_comments').select('id, site_id, board_id, post_id, content').in('id', commentIds)
      : { data: [] as CommentRow[] },
    userIds.length ? supabaseAdmin.from('particles').select('id, email').in('id', userIds) : { data: [] as ParticleRow[] },
  ]);

  return {
    siteMap: new Map(((siteResult.data || []) as SiteRow[]).map((row) => [row.id, row])),
    boardMap: new Map(((boardResult.data || []) as BoardRow[]).map((row) => [row.id, row])),
    postMap: new Map(((postResult.data || []) as PostRow[]).map((row) => [row.id, row])),
    commentMap: new Map(((commentResult.data || []) as CommentRow[]).map((row) => [row.id, row])),
    userMap: new Map(((userResult.data || []) as ParticleRow[]).map((row) => [row.id, row])),
  };
}

function mapGuidelineReport(row: GuidelineReportDbRow, maps: ReportMaps): ReportRow {
  const target = getTargetSummary(row, maps);
  return {
    id: row.id,
    reportType: 'guidelines',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    handledAt: row.handled_at,
    status: row.status,
    targetType: target.targetType,
    targetId: target.targetId,
    siteId: target.siteId,
    siteKey: target.siteKey,
    siteLabel: target.siteLabel,
    siteHref: target.siteHref,
    boardId: target.boardId,
    boardKey: target.boardKey,
    boardLabel: target.boardLabel,
    boardHref: target.boardHref,
    postId: target.postId,
    postSlug: target.postSlug,
    postSubject: target.postSubject,
    postHref: target.postHref,
    commentId: target.commentId,
    commentPreview: target.commentPreview,
    commentHref: target.commentHref,
    reportUrl: null,
    reporterEmail: target.reporterEmail,
    email: null,
    phone: null,
    categoryLabel: guidelineCategoryLabel(row.report_category),
    summary: null,
    details: [{ label: '신고 분류', value: guidelineCategoryLabel(row.report_category) }],
  };
}

function mapLegalReport(row: LegalReportDbRow, maps: ReportMaps): ReportRow {
  const target = getTargetSummary(row, maps);
  const categoryLabel = legalTypeLabel(row.legal_type);
  const details = [
    { label: '법위반 유형', value: categoryLabel },
    { label: '이메일', value: row.email },
    { label: '연락처', value: row.phone },
  ];

  return {
    id: row.id,
    reportType: 'legals',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    handledAt: row.handled_at,
    status: row.status,
    targetType: target.targetType,
    targetId: target.targetId,
    siteId: target.siteId,
    siteKey: target.siteKey,
    siteLabel: target.siteLabel,
    siteHref: target.siteHref,
    boardId: target.boardId,
    boardKey: target.boardKey,
    boardLabel: target.boardLabel,
    boardHref: target.boardHref,
    postId: target.postId,
    postSlug: target.postSlug,
    postSubject: target.postSubject,
    postHref: target.postHref,
    commentId: target.commentId,
    commentPreview: target.commentPreview,
    commentHref: target.commentHref,
    reportUrl: row.report_url,
    reporterEmail: target.reporterEmail,
    email: row.email,
    phone: row.phone,
    categoryLabel,
    summary: row.report_reason || row.report_content || row.privacy_request_reason || null,
    details: [
      ...details,
      ...[
        ['요청 유형', row.request_type ? legalRequestTypeLabel(row.request_type) : ''],
        ['불법정보 분류', joinLabels(row.illegal_info_categories, illegalInfoCategoryLabel)],
        ['허위조작정보 분류', joinLabels(row.false_manipulated_info_categories, falseManipulatedInfoCategoryLabel)],
        ['신고 내용', row.report_content],
        ['신고 사유', row.report_reason],
        ['신고 근거', row.report_basis],
        ['불법정보 확인', row.illegal_info_confirmed],
        ['허위조작정보 확인', row.false_manipulated_info_confirmed],
        ['고지 확인', row.illegal_info_notice_confirmed],
        ['불법촬영물 요청 유형', joinLabels(row.filming_request_types, filmingRequestTypeLabel)],
        ['불법촬영물 사유', joinLabels(row.filming_reason_types, filmingReasonTypeLabel)],
        ['촬영 대상', row.filming_target],
        ['불법촬영물 요청 확인', row.filming_request_confirmed],
        ['불법촬영물 고지 확인', row.filming_notice_confirmed],
        ['개인정보 신고 대상', row.privacy_report_type ? privacyReportTypeLabel(row.privacy_report_type) : ''],
        ['노출 정보', row.exposed_information],
        ['개인정보 요청 사유', row.privacy_request_reason],
        ['첨부파일', getAttachmentCount(row.attachments)],
        ['신고대상 URL', row.report_url],
      ].reduce<ReportDetailField[]>((acc, item) => addDetail(acc, item[0] as string, item[1]), []),
    ],
  };
}

function mapRightReport(row: RightReportDbRow, maps: ReportMaps): ReportRow {
  const target = getTargetSummary(row, maps);
  const categoryLabel = rightReasonTypeLabel(row.reason_type);
  return {
    id: row.id,
    reportType: 'rights',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    handledAt: row.handled_at,
    status: row.status,
    targetType: target.targetType,
    targetId: target.targetId,
    siteId: target.siteId,
    siteKey: target.siteKey,
    siteLabel: target.siteLabel,
    siteHref: target.siteHref,
    boardId: target.boardId,
    boardKey: target.boardKey,
    boardLabel: target.boardLabel,
    boardHref: target.boardHref,
    postId: target.postId,
    postSlug: target.postSlug,
    postSubject: target.postSubject,
    postHref: target.postHref,
    commentId: target.commentId,
    commentPreview: target.commentPreview,
    commentHref: target.commentHref,
    reportUrl: row.report_url,
    reporterEmail: target.reporterEmail,
    email: row.email,
    phone: row.phone,
    categoryLabel,
    summary: null,
    details: [
      { label: '권리침해 유형', value: categoryLabel },
      { label: '이메일', value: row.email },
      { label: '연락처', value: row.phone },
      ...[
        ['권리자 유형', row.rights_owner_type ? rightsOwnerTypeLabel(row.rights_owner_type) : ''],
        ['저작권 원본 URL', row.copyright_original_urls?.join(', ') || ''],
        ['저작권 증빙파일', getAttachmentCount(row.copyright_proof_files)],
        ['신고대상 URL', row.report_url],
      ].reduce<ReportDetailField[]>((acc, item) => addDetail(acc, item[0] as string, item[1]), []),
    ],
  };
}

function mapRows(reportType: ReportType, rows: ReportBaseRow[], maps: ReportMaps) {
  if (reportType === 'guidelines') return (rows as GuidelineReportDbRow[]).map((row) => mapGuidelineReport(row, maps));
  if (reportType === 'legals') return (rows as LegalReportDbRow[]).map((row) => mapLegalReport(row, maps));
  return (rows as RightReportDbRow[]).map((row) => mapRightReport(row, maps));
}

function getSelectColumns(reportType: ReportType) {
  if (reportType === 'guidelines') {
    return 'id, target_type, target_id, site_id, board_id, post_id, comment_id, reporter_user_id, report_category, status, created_at, updated_at, handled_at, handler_user_id';
  }

  if (reportType === 'legals') {
    return 'id, legal_type, target_type, target_id, site_id, board_id, post_id, comment_id, reporter_user_id, email, phone, attachments, request_type, illegal_info_categories, false_manipulated_info_categories, report_content, report_reason, report_basis, illegal_info_confirmed, false_manipulated_info_confirmed, illegal_info_notice_confirmed, filming_request_types, filming_reason_types, filming_target, filming_request_confirmed, filming_notice_confirmed, privacy_report_type, exposed_information, privacy_request_reason, status, created_at, updated_at, handled_at, handler_user_id, report_url';
  }

  return 'id, target_type, target_id, site_id, board_id, post_id, comment_id, report_url, reporter_user_id, email, phone, reason_type, rights_owner_type, copyright_original_urls, copyright_proof_files, status, created_at, updated_at, handled_at, handler_user_id';
}

function applyTargetFilter<T extends { eq: (column: string, value: string) => T }>(
  query: T,
  level: ReportSearchLevel | '',
  id: string | null,
) {
  if (!level || !id) return query;
  if (level === 'site') return query.eq('site_id', id);
  if (level === 'board') return query.eq('board_id', id);
  if (level === 'post') return query.eq('post_id', id);
  return query.eq('comment_id', id);
}

async function getCategoryCounts(supabaseAdmin: SupabaseClient, reportType: ReportType, field: string, id: string) {
  const categoryColumn = reportCategoryColumn(reportType);
  const result = await supabaseAdmin.from(reportTableNames[reportType]).select(categoryColumn).eq(field, id);
  const rows = (result.data || []) as CategoryOnlyRow[];
  const counts = new Map<string, number>();

  rows.forEach((row) => {
    const key = row.report_category || row.legal_type || row.reason_type || '';
    if (!key) return;
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return Array.from(counts.entries()).map<ReportCategoryCount>(([key, count]) => ({
    key,
    label: reportCategoryLabel(reportType, key),
    count,
  }));
}

async function getReportCount(supabaseAdmin: SupabaseClient, reportType: ReportType, field: string, id: string) {
  const result = await supabaseAdmin
    .from(reportTableNames[reportType])
    .select('id', { count: 'exact', head: true })
    .eq(field, id);
  return result.count || 0;
}

function searchLevel(value: string | null | undefined): ReportSearchLevel | '' {
  if (value === 'site' || value === 'board' || value === 'post' || value === 'comment') return value;
  return '';
}

async function mapSiteSearchRows(supabaseAdmin: SupabaseClient, reportType: ReportType, sites: SiteRow[]) {
  const rows = await Promise.all(
    sites.map(async (site) => {
      const categoryCounts = await getCategoryCounts(supabaseAdmin, reportType, 'site_id', site.id);
      const totalCount = await getReportCount(supabaseAdmin, reportType, 'site_id', site.id);
      return {
        id: site.id,
        level: 'site' as const,
        label: `${site.site_label || site.site_key} / ${totalCount.toLocaleString('ko-KR')} 건`,
        href: buildSiteHref(site.site_key),
        totalCount,
        categoryCounts,
        siteId: site.id,
        siteKey: site.site_key,
        siteLabel: site.site_label,
        boardId: null,
        boardKey: null,
        boardLabel: null,
        postId: null,
        postSlug: null,
        postSubject: null,
        commentId: null,
        commentPreview: null,
      } satisfies ReportSearchRow;
    }),
  );
  return rows;
}

async function mapBoardSearchRows(supabaseAdmin: SupabaseClient, reportType: ReportType, boards: BoardRow[], site: SiteRow | null) {
  const rows = await Promise.all(
    boards.map(async (board) => {
      const categoryCounts = await getCategoryCounts(supabaseAdmin, reportType, 'board_id', board.id);
      const totalCount = await getReportCount(supabaseAdmin, reportType, 'board_id', board.id);
      return {
        id: board.id,
        level: 'board' as const,
        label: `${board.board_label || board.board_key} / ${totalCount.toLocaleString('ko-KR')} 건`,
        href: buildBoardHref(site?.site_key, board.board_key),
        totalCount,
        categoryCounts,
        siteId: board.site_id,
        siteKey: site?.site_key || null,
        siteLabel: site?.site_label || null,
        boardId: board.id,
        boardKey: board.board_key,
        boardLabel: board.board_label,
        postId: null,
        postSlug: null,
        postSubject: null,
        commentId: null,
        commentPreview: null,
      } satisfies ReportSearchRow;
    }),
  );
  return rows;
}

async function mapPostSearchRows(
  supabaseAdmin: SupabaseClient,
  reportType: ReportType,
  posts: PostRow[],
  site: SiteRow | null,
  board: BoardRow | null,
) {
  const rows = await Promise.all(
    posts.map(async (post) => {
      const categoryCounts = await getCategoryCounts(supabaseAdmin, reportType, 'post_id', post.id);
      const totalCount = await getReportCount(supabaseAdmin, reportType, 'post_id', post.id);
      const slug = String(post.slug);
      return {
        id: post.id,
        level: 'post' as const,
        label: `${post.subject} / ${totalCount.toLocaleString('ko-KR')} 건`,
        href: buildPostHref(site?.site_key, board?.board_key, slug),
        totalCount,
        categoryCounts,
        siteId: post.site_id,
        siteKey: site?.site_key || null,
        siteLabel: site?.site_label || null,
        boardId: post.board_id,
        boardKey: board?.board_key || null,
        boardLabel: board?.board_label || null,
        postId: post.id,
        postSlug: slug,
        postSubject: post.subject,
        commentId: null,
        commentPreview: null,
      } satisfies ReportSearchRow;
    }),
  );
  return rows;
}

async function mapCommentSearchRows(
  supabaseAdmin: SupabaseClient,
  reportType: ReportType,
  comments: CommentRow[],
  site: SiteRow | null,
  board: BoardRow | null,
  post: PostRow | null,
) {
  const rows = await Promise.all(
    comments.map(async (comment) => {
      const categoryCounts = await getCategoryCounts(supabaseAdmin, reportType, 'comment_id', comment.id);
      const totalCount = await getReportCount(supabaseAdmin, reportType, 'comment_id', comment.id);
      const slug = post?.slug === undefined || post?.slug === null ? null : String(post.slug);
      const preview = truncateText(comment.content, 70);
      return {
        id: comment.id,
        level: 'comment' as const,
        label: `${preview || comment.id} / ${totalCount.toLocaleString('ko-KR')} 건`,
        href: buildPostHref(site?.site_key, board?.board_key, slug),
        totalCount,
        categoryCounts,
        siteId: comment.site_id,
        siteKey: site?.site_key || null,
        siteLabel: site?.site_label || null,
        boardId: comment.board_id,
        boardKey: board?.board_key || null,
        boardLabel: board?.board_label || null,
        postId: comment.post_id,
        postSlug: slug,
        postSubject: post?.subject || null,
        commentId: comment.id,
        commentPreview: preview,
      } satisfies ReportSearchRow;
    }),
  );
  return rows;
}

async function readSite(supabaseAdmin: SupabaseClient, siteId: string | null) {
  if (!siteId) return null;
  const result = await supabaseAdmin.from('rhizomes').select('id, site_key, site_label').eq('id', siteId).maybeSingle();
  return (result.data || null) as SiteRow | null;
}

async function readBoard(supabaseAdmin: SupabaseClient, boardId: string | null) {
  if (!boardId) return null;
  const result = await supabaseAdmin.from('boards').select('id, site_id, board_key, board_label').eq('id', boardId).maybeSingle();
  return (result.data || null) as BoardRow | null;
}

async function readPost(supabaseAdmin: SupabaseClient, postId: string | null) {
  if (!postId) return null;
  const result = await supabaseAdmin.from('posts').select('id, site_id, board_id, slug, subject').eq('id', postId).maybeSingle();
  return (result.data || null) as PostRow | null;
}

async function searchReports(request: NextRequest, supabaseAdmin: SupabaseClient, reportType: ReportType) {
  const level = searchLevel(getSearchValue(request, 'level'));
  const q = getSearchValue(request);

  if (!level || !q) return jsonResponse<ReportSearchResult>({ items: [] });

  if (level === 'site') {
    const result = await supabaseAdmin
      .from('rhizomes')
      .select('id, site_key, site_label')
      .ilike('site_key', `%${q}%`)
      .limit(SEARCH_LIMIT);
    if (result.error) return errorResponse(result.error.message, 500);
    const items = await mapSiteSearchRows(supabaseAdmin, reportType, (result.data || []) as SiteRow[]);
    return jsonResponse<ReportSearchResult>({ items });
  }

  if (level === 'board') {
    const siteId = getSearchValue(request, 'siteId');
    if (!siteId) return errorResponse('사이트를 먼저 선택하세요.', 400);
    const [site, boardResult] = await Promise.all([
      readSite(supabaseAdmin, siteId),
      supabaseAdmin
        .from('boards')
        .select('id, site_id, board_key, board_label')
        .eq('site_id', siteId)
        .ilike('board_key', `%${q}%`)
        .limit(SEARCH_LIMIT),
    ]);
    if (boardResult.error) return errorResponse(boardResult.error.message, 500);
    const items = await mapBoardSearchRows(supabaseAdmin, reportType, (boardResult.data || []) as BoardRow[], site);
    return jsonResponse<ReportSearchResult>({ items });
  }

  if (level === 'post') {
    const boardId = getSearchValue(request, 'boardId');
    if (!boardId) return errorResponse('게시판을 먼저 선택하세요.', 400);
    const board = await readBoard(supabaseAdmin, boardId);
    const site = await readSite(supabaseAdmin, board?.site_id || null);
    const postResult = await supabaseAdmin
      .from('posts')
      .select('id, site_id, board_id, slug, subject')
      .eq('board_id', boardId)
      .eq('slug', q)
      .limit(SEARCH_LIMIT);
    if (postResult.error) return errorResponse(postResult.error.message, 500);
    const items = await mapPostSearchRows(supabaseAdmin, reportType, (postResult.data || []) as PostRow[], site, board);
    return jsonResponse<ReportSearchResult>({ items });
  }

  const commentResult = await supabaseAdmin
    .from('post_comments')
    .select('id, site_id, board_id, post_id, content')
    .eq('id', q)
    .limit(1);
  if (commentResult.error) return errorResponse(commentResult.error.message, 500);
  const comments = (commentResult.data || []) as CommentRow[];
  const comment = comments[0] || null;
  const [site, board, post] = await Promise.all([
    readSite(supabaseAdmin, comment?.site_id || null),
    readBoard(supabaseAdmin, comment?.board_id || null),
    readPost(supabaseAdmin, comment?.post_id || null),
  ]);
  const items = await mapCommentSearchRows(supabaseAdmin, reportType, comments, site, board, post);
  return jsonResponse<ReportSearchResult>({ items });
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const reportType = getReportType(getSearchValue(request, 'type'));
  const mode = getSearchValue(request, 'mode');

  if (mode === 'search') return searchReports(request, auth.supabaseAdmin, reportType);

  const { page, pageSize, from, to } = getPageParams(request);
  const status = getReportStatus(getSearchValue(request, 'status'));
  const targetLevel = searchLevel(getSearchValue(request, 'targetLevel'));
  const targetId = getSearchValue(request, 'targetId');
  const table = reportTableNames[reportType];

  let query = auth.supabaseAdmin
    .from(table)
    .select(getSelectColumns(reportType), { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (status) query = query.eq('status', status);
  query = applyTargetFilter(query, targetLevel, targetId);

  const result = await query;
  if (result.error) return jsonResponse({ message: result.error.message }, { status: 500 });

  const rows = (result.data || []) as unknown as ReportBaseRow[];
  const maps = await getMaps(auth.supabaseAdmin, rows);
  const payload: TablePage<ReportRow> = {
    items: mapRows(reportType, rows, maps),
    page,
    pageSize,
    total: result.count || 0,
  };

  return jsonResponse(payload);
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = (await request.json()) as ReportPatchBody;
  const reportType = getReportType(body.reportType);
  const status = getReportStatus(body.status);

  if (!body.reportId) return errorResponse('신고 ID가 없습니다.', 400);
  if (!status || !reportStatuses.includes(status)) return errorResponse('신고 상태가 올바르지 않습니다.', 400);

  const handledAt = status === 'dismissed' || status === 'completed' ? new Date().toISOString() : null;
  const result = await auth.supabaseAdmin
    .from(reportTableNames[reportType])
    .update({
      status,
      updated_at: new Date().toISOString(),
      handled_at: handledAt,
      handler_user_id: auth.admin.user_id,
    })
    .eq('id', body.reportId);

  if (result.error) return errorResponse(result.error.message, 500);

  return jsonResponse({ ok: true });
}

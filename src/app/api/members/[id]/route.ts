import { NextRequest } from 'next/server';
import { errorResponse, jsonResponse, requireAdmin } from '@/lib/api';
import { getAccountStatus, isAdultFromBirthDate } from '@/lib/utils';
import type { MemberDetail, MemberSiteRow } from '@/lib/types';
import { decrypt } from '@/lib/decrypt';

type Params = { params: Promise<{ id: string }> };

type StigmaRow = {
  id: string;
  created_at: string;
  user_id: string;
  email: string;
  user_name: string;
};

type ChorogonRow = { birth_date: string | null };

type RhizomeStigmaRow = {
  site_id: string;
  role: string;
  is_approval: boolean;
  approval_at: string | null;
  is_block: boolean | null;
  kicked_at: string | null;
  banned_at: string | null;
  withdrawn_at: string | null;
  rejected_at: string | null;
  rhizomes: {
    id: string;
    site_key: string;
    site_label: string | null;
    site_type: string;
  } | null;
};

export async function GET(request: NextRequest, context: Params) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const { supabaseAdmin } = auth;
  const { id } = await context.params;

  const stigmaResult = await supabaseAdmin
    .from('stigmas')
    .select('id, created_at, user_id, email, user_name')
    .eq('id', id)
    .maybeSingle();

  if (stigmaResult.error) return errorResponse(stigmaResult.error.message, 500);
  if (!stigmaResult.data) return errorResponse('회원을 찾을 수 없습니다.', 404);

  const stigma = stigmaResult.data as StigmaRow;

  const [chorogonResult, siteResult] = await Promise.all([
    supabaseAdmin.from('chorogons').select('birth_date').eq('user_id', stigma.user_id).maybeSingle(),
    supabaseAdmin
      .from('rhizome_stigmas')
      .select(
        'site_id, role, is_approval, approval_at, is_block, kicked_at, banned_at, withdrawn_at, rejected_at, rhizomes(id, site_key, site_label, site_type)',
      )
      .eq('user_id', stigma.id)
      .order('created_at', { ascending: false }),
  ]);

  if (chorogonResult.error) return errorResponse(chorogonResult.error.message, 500);
  if (siteResult.error) return errorResponse(siteResult.error.message, 500);

  const chorogon = chorogonResult.data as ChorogonRow | null;
  const birthDate = chorogon?.birth_date || null;
  const birth = birthDate ? decrypt(birthDate, auth.mode) : null;
  const adult = isAdultFromBirthDate(birth);
  const rows = (siteResult.data || []) as unknown as RhizomeStigmaRow[];
  const sites: MemberSiteRow[] = rows.map((row) => ({
    siteId: row.site_id,
    siteKey: row.rhizomes?.site_key || '',
    siteLabel: row.rhizomes?.site_label || '-',
    siteType: row.rhizomes?.site_type || '-',
    role: row.role,
    accountStatus: getAccountStatus(row),
    isApproval: row.is_approval,
    approvalAt: row.approval_at,
  }));

  const payload: MemberDetail = {
    id: stigma.id,
    particleId: stigma.user_id,
    email: decrypt(stigma.email, auth.mode),
    userName: decrypt(stigma.user_name, auth.mode),
    createdAt: stigma.created_at,
    birthDate: birth,
    isMinor: adult === null ? null : !adult,
    accountStatus: getAccountStatus({}),
    joinedSiteCount: sites.length,
    approvedSiteCount: sites.filter((site) => site.isApproval).length,
    notApprovedSiteCount: sites.filter((site) => !site.isApproval).length,
    sites,
  };

  return jsonResponse(payload);
}

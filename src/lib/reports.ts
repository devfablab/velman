import type { ReportStatus, ReportType } from './types';

export const REPORT_BASE_URL = 'https://velhub-kr.vercel.app';

export const reportTypeLabels: Record<ReportType, string> = {
  guidelines: '가이드라인 신고',
  legals: '법위반 신고',
  rights: '권리침해 신고',
};

export const reportTableNames: Record<ReportType, 'report_guidelines' | 'report_legals' | 'report_rights'> = {
  guidelines: 'report_guidelines',
  legals: 'report_legals',
  rights: 'report_rights',
};

export const reportStatuses: ReportStatus[] = ['received', 'reviewing', 'dismissed', 'completed'];

export function getReportType(value: string | null | undefined): ReportType {
  if (value === 'legals' || value === 'rights') return value;
  return 'guidelines';
}

export function getReportStatus(value: string | null | undefined): ReportStatus | '' {
  if (value === 'received' || value === 'reviewing' || value === 'dismissed' || value === 'completed') return value;
  return '';
}

export function guidelineCategoryLabel(value: string) {
  const labels: Record<string, string> = {
    hate: '혐오/차별',
    spam: '스팸/도배',
    youth_harmful: '청소년 유해',
    illegal_info: '불법정보',
    obscene: '음란/선정',
    violence: '폭력/잔혹',
    child_youth_protection: '아동·청소년 보호',
    offensive: '불쾌/공격적 표현',
  };
  return labels[value] || value;
}

export function legalTypeLabel(value: string) {
  const labels: Record<string, string> = {
    illegal_info: '불법정보',
    illegal_filming: '불법촬영물등',
    privacy: '개인정보 침해',
  };
  return labels[value] || value;
}

export function legalRequestTypeLabel(value: string) {
  const labels: Record<string, string> = {
    illegal_info: '불법정보',
    false_manipulated_info: '허위조작정보',
  };
  return labels[value] || value;
}

export function illegalInfoCategoryLabel(value: string) {
  const labels: Record<string, string> = {
    obscene_distribution: '음란정보 유통',
    false_fact_defamation: '거짓 사실 적시 명예훼손',
    hate_speech: '차별·혐오 표현',
    fear_anxiety_repeated_message: '공포심·불안감 유발 반복 메시지',
    system_damage_disruption: '정보통신시스템 훼손·장애',
    youth_harmful_media_violation: '청소년유해매체물 표시의무 위반',
    illegal_gambling: '불법 도박',
    personal_info_illegal_trade: '개인정보 불법 거래',
    weapons_explosives_manufacturing: '총포·화약류 제조 방법',
    drug_use_manufacture_trade: '마약류 사용·제조·매매',
    national_secret_leak: '국가기밀 누설',
    national_security_law_violation: '국가보안법 위반',
    other_criminal_purpose_aiding: '그 밖의 범죄 목적 방조',
  };
  return labels[value] || value;
}

export function falseManipulatedInfoCategoryLabel(value: string) {
  const labels: Record<string, string> = {
    false_information: '허위정보',
    manipulated_information: '조작정보',
  };
  return labels[value] || value;
}

export function filmingRequestTypeLabel(value: string) {
  const labels: Record<string, string> = {
    distribution_report: '유통 신고',
    deletion_request: '삭제 요청',
  };
  return labels[value] || value;
}

export function filmingReasonTypeLabel(value: string) {
  const labels: Record<string, string> = {
    illegal_filming: '불법촬영물',
    deepfake: '허위영상물',
    child_youth_sexual_exploitation: '아동·청소년 성착취물',
  };
  return labels[value] || value;
}

export function privacyReportTypeLabel(value: string) {
  const labels: Record<string, string> = {
    post: '게시글',
    comment: '댓글',
    other: '기타',
  };
  return labels[value] || value;
}

export function rightReasonTypeLabel(value: string) {
  const labels: Record<string, string> = {
    defamation: '명예훼손',
    personality_rights: '인격권 침해',
    copyright: '저작권 침해',
    trademark: '상표권 침해',
    counterfeit: '위조상품',
    design_patent_utility: '디자인·특허·실용신안 침해',
  };
  return labels[value] || value;
}

export function rightsOwnerTypeLabel(value: string) {
  const labels: Record<string, string> = {
    individual: '개인',
    organization: '단체/기업',
  };
  return labels[value] || value;
}

export function reportCategoryLabel(reportType: ReportType, value: string) {
  if (reportType === 'guidelines') return guidelineCategoryLabel(value);
  if (reportType === 'legals') return legalTypeLabel(value);
  return rightReasonTypeLabel(value);
}

export function reportCategoryColumn(reportType: ReportType) {
  if (reportType === 'guidelines') return 'report_category';
  if (reportType === 'legals') return 'legal_type';
  return 'reason_type';
}

export function joinLabels(values: string[] | null | undefined, labeler: (value: string) => string) {
  return values?.length ? values.map(labeler).join(', ') : '';
}

export function truncateText(value: string | null | undefined, maxLength: number) {
  if (!value) return null;
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

export function buildSiteHref(siteKey: string | null | undefined) {
  return siteKey ? `${REPORT_BASE_URL}/${siteKey}` : null;
}

export function buildBoardHref(siteKey: string | null | undefined, boardKey: string | null | undefined) {
  return siteKey && boardKey ? `${REPORT_BASE_URL}/${siteKey}/${boardKey}` : null;
}

export function buildPostHref(siteKey: string | null | undefined, boardKey: string | null | undefined, slug: string | null | undefined) {
  return siteKey && boardKey && slug ? `${REPORT_BASE_URL}/${siteKey}/${boardKey}/${slug}` : null;
}

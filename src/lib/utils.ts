export const PAGE_SIZE = 20;

export function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function toNumber(value: unknown) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) return Number(value);
  return 0;
}

export function formatMoney(value: number | null | undefined) {
  return `${Number(value || 0).toLocaleString('ko-KR')}원`;
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function isAdultFromBirthDate(value: string | null | undefined) {
  const digits = normalizeText(value).replace(/\D/g, '');
  if (digits.length < 8) return null;
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  if (!year || !month || !day) return null;
  const birthDate = new Date(year, month - 1, day);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age >= 19;
}

export function getAccountStatus(row: {
  is_block?: boolean | null;
  is_blocked?: boolean | null;
  is_shutdown?: boolean | null;
  kicked_at?: string | null;
  banned_at?: string | null;
  withdrawn_at?: string | null;
  rejected_at?: string | null;
}) {
  if (row.is_shutdown) return '폐쇄';
  if (row.is_blocked || row.is_block) return '중지';
  if (row.banned_at) return '차단';
  if (row.kicked_at) return '강퇴';
  if (row.withdrawn_at) return '탈퇴';
  if (row.rejected_at) return '비승인';
  return '정상';
}

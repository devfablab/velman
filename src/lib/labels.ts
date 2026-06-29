export function paymentStatusLabel(value: string) {
  const labels: Record<string, string> = {
    paid: '결제완료',
    ready: '대기',
    failed: '실패',
    canceled: '취소',
    refunded: '환불',
    partial_refunded: '부분환불',
  };
  return labels[value] || value;
}

export function settlementStatusLabel(value: string) {
  const labels: Record<string, string> = {
    scheduled: '정산 예정',
    confirmed: '정산 확정',
    completed: '정산 완료',
  };
  return labels[value] || value;
}

export function siteTypeLabel(value: string) {
  const labels: Record<string, string> = {
    blog: '블로그',
    community: '커뮤니티',
  };
  return labels[value] || value;
}

export type AdminStatus = 'unauthenticated' | 'forbidden' | 'authenticated';

export type SettlementStatus = 'scheduled' | 'confirmed' | 'completed';

export type MoneySummary = {
  grossAmount: number;
  refundedAmount: number;
};

export type TablePage<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

export type MemberRow = {
  id: string;
  particleId: string;
  email: string;
  userName: string;
  createdAt: string;
  birthDate: string | null;
  isMinor: boolean | null;
  accountStatus: string;
};

export type MemberSiteRow = {
  siteId: string;
  siteKey: string;
  siteLabel: string;
  siteType: string;
  role: string;
  accountStatus: string;
  isApproval: boolean;
  approvalAt: string | null;
};

export type MemberDetail = MemberRow & {
  approvedSiteCount: number;
  notApprovedSiteCount: number;
  joinedSiteCount: number;
  sites: MemberSiteRow[];
};

export type SiteRow = {
  id: string;
  siteKey: string;
  siteLabel: string;
  siteType: string;
  createdAt: string;
  approvedMemberCount: number;
  planLabel: string | null;
  planPrice: number | null;
  status: string;
  totalRevenue: number;
  totalRefunded: number;
};

export type PlanRow = {
  id: string;
  productType: string;
  categoryLabel: string;
  planLabel: string;
  price: number;
  sortOrder: number | null;
};

export type TransactionRow = {
  id: string;
  createdAt: string;
  approvedAt: string | null;
  buyerEmail: string | null;
  buyerName: string | null;
  siteLabel: string | null;
  amount: number;
  refundedAmount: number | null;
  status: string;
  paymentType: string;
  targetType: string;
};

export type SettlementRow = {
  id: string;
  siteLabel: string | null;
  receiverEmail: string | null;
  receiverName: string | null;
  status: SettlementStatus;
  periodStart: string;
  periodEnd: string;
  grossAmount: number;
  platformFeeAmount: number;
  pgFeeAmount: number;
  pgFeeVatAmount: number;
  settlementAmount: number;
  confirmedAt: string | null;
  completedAt: string | null;
  memo: string | null;
};

export type ReportType = 'guidelines' | 'legals' | 'rights';

export type ReportStatus = 'received' | 'reviewing' | 'dismissed' | 'completed';

export type ReportTargetType = 'site' | 'board' | 'post' | 'comment' | null;

export type ReportDetailField = {
  label: string;
  value: string;
};

export type ReportCategoryCount = {
  key: string;
  label: string;
  count: number;
};

export type ReportSearchLevel = 'site' | 'board' | 'post' | 'comment';

export type ReportSearchRow = {
  id: string;
  level: ReportSearchLevel;
  label: string;
  href: string | null;
  totalCount: number;
  categoryCounts: ReportCategoryCount[];
  siteId: string | null;
  siteKey: string | null;
  siteLabel: string | null;
  boardId: string | null;
  boardKey: string | null;
  boardLabel: string | null;
  postId: string | null;
  postSlug: string | null;
  postSubject: string | null;
  commentId: string | null;
  commentPreview: string | null;
};

export type ReportSearchResult = {
  items: ReportSearchRow[];
};

export type ReportAttachment = {
  name: string;
  path: string;
};

export type ReportDetail = {
  label: string;
  value: string;
};

export type ReportRow = {
  id: string;
  reportType: ReportType;
  createdAt: string;
  updatedAt: string | null;
  handledAt: string | null;
  status: ReportStatus;
  targetType: ReportTargetType;
  targetId: string | null;
  siteId: string | null;
  siteKey: string | null;
  siteLabel: string | null;
  siteHref: string | null;
  boardId: string | null;
  boardKey: string | null;
  boardLabel: string | null;
  boardHref: string | null;
  postId: string | null;
  postSlug: string | null;
  postSubject: string | null;
  postHref: string | null;
  commentId: string | null;
  commentPreview: string | null;
  commentHref: string | null;
  reportUrl: string | null;
  reporterEmail: string | null;
  email: string | null;
  phone: string | null;
  categoryLabel: string;
  summary: string | null;
  attachments: ReportAttachment[];
  details: ReportDetail[];
};

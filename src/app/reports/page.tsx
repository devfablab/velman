'use client';

import { type FormEvent, type ReactNode, type SyntheticEvent, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Pagination,
  Paper,
  Radio,
  Select,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import { apiFetch } from '@/lib/clientApi';
import { reportStatusLabel, reportTargetTypeLabel } from '@/lib/labels';
import { reportTypeLabels } from '@/lib/reports';
import { formatDateTime } from '@/lib/utils';
import type {
  ReportAttachment,
  ReportCategoryCount,
  ReportRow,
  ReportSearchLevel,
  ReportSearchResult,
  ReportSearchRow,
  ReportStatus,
  ReportType,
  TablePage,
} from '@/lib/types';
import PageHeader from '@/components/PageHeader';
import LoadingBox from '@/components/LoadingBox';
import EmptyState from '@/components/EmptyState';
import StatusChip from '@/components/StatusChip';

const reportTabs: ReportType[] = ['guidelines', 'legals', 'rights'];
const editableStatuses: ReportStatus[] = ['received', 'reviewing', 'dismissed', 'completed'];

const statusOptions: { value: ReportStatus | ''; label: string }[] = [
  { value: '', label: '전체' },
  { value: 'received', label: '접수' },
  { value: 'reviewing', label: '검토 중' },
  { value: 'dismissed', label: '반려' },
  { value: 'completed', label: '처리 완료' },
];

const booleanDetailLabels = new Set([
  '공지 확인',
  '불법정보 확인',
  '허위조작정보 확인',
  '불법정보/허위조작정보 고지 확인',
  '불법촬영물 요청 확인',
  '불법촬영물 고지 확인',
]);

type DialogRow = {
  label: string;
  value: ReactNode;
  visible: boolean;
};

function openWindow(url: string | null) {
  if (!url) return;

  window.open(url, `velhub-report-${Date.now()}`, 'popup=yes,width=1200,height=800,left=80,top=80,noopener,noreferrer');
}

async function copyText(value: string | null) {
  if (!value) return;
  await navigator.clipboard.writeText(value);
}

function displayCount(value: number) {
  return `${value.toLocaleString('ko-KR')} 건`;
}

function normalizeBooleanDetailValue(value: string) {
  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === 'true') return '확인';
  if (normalizedValue === 'false') return '미확인';

  return value;
}

function shouldShowDetail(detail: { label: string; value: string }) {
  if (booleanDetailLabels.has(detail.label)) return true;
  return detail.value.trim().length > 0;
}

function getDetailValue(detail: { label: string; value: string }) {
  if (booleanDetailLabels.has(detail.label)) {
    return normalizeBooleanDetailValue(detail.value);
  }

  return detail.value;
}

function isVisibleText(value: string | null) {
  return Boolean(value && value.trim());
}

async function openAttachment(reportType: ReportType, reportId: string, attachment: ReportAttachment) {
  if (reportType !== 'legals' && reportType !== 'rights') {
    return;
  }

  const params = new URLSearchParams({
    reportType,
    reportId,
    path: attachment.path,
  });

  const result = await apiFetch<{ signedUrl: string }>(`/api/reports/attachment?${params.toString()}`);

  openWindow(result.signedUrl);
}

function CategoryCounts({ counts }: { counts: ReportCategoryCount[] }) {
  if (counts.length === 0) {
    return <Typography variant="body2">신고당한 건수가 없습니다</Typography>;
  }

  return (
    <Stack direction="row" spacing={1.2} flexWrap="wrap" useFlexGap>
      {counts.map((item) => (
        <Typography key={item.key} variant="body2">
          {item.label}: {displayCount(item.count)}
        </Typography>
      ))}
    </Stack>
  );
}

function SearchResultTable({
  rows,
  selected,
  onSelect,
}: {
  rows: ReportSearchRow[];
  selected: ReportSearchRow | null;
  onSelect: (row: ReportSearchRow) => void;
}) {
  if (rows.length === 0) return <EmptyState message="신고당한 건수가 없습니다" />;

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ whiteSpace: 'nowrap' }}>선택</TableCell>
            <TableCell sx={{ whiteSpace: 'nowrap' }}>대상</TableCell>
            <TableCell sx={{ whiteSpace: 'nowrap', textAlign: 'right' }}>총 신고당한 건수</TableCell>
            <TableCell sx={{ whiteSpace: 'nowrap' }}>보기</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={`${row.level}-${row.id}`} hover>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                <Radio
                  checked={selected?.id === row.id && selected.level === row.level}
                  onChange={() => onSelect(row)}
                />
              </TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.label}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap', textAlign: 'right' }}>{displayCount(row.totalCount)}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                {row.href ? (
                  <Button type="button" size="small" onClick={() => openWindow(row.href)}>
                    보기
                  </Button>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function TargetLink({ label, href }: { label: string | null; href: string | null }) {
  if (!label) return null;
  if (!href) return <>{label}</>;

  return (
    <Button type="button" size="small" onClick={() => openWindow(href)} sx={{ minWidth: 0, p: 0 }}>
      {label}
    </Button>
  );
}

function ReportUrlValue({ url, onCopied }: { url: string | null; onCopied: () => void }) {
  if (!url) return null;

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
        {url}
      </Typography>
      <Button
        type="button"
        size="small"
        variant="outlined"
        onClick={async () => {
          await copyText(url);
          onCopied();
        }}
        sx={{ whiteSpace: 'nowrap' }}
      >
        복사
      </Button>
    </Stack>
  );
}

function ReportAttachments({
  report,
  onOpen,
}: {
  report: ReportRow;
  onOpen: (reportType: ReportType, reportId: string, attachment: ReportAttachment) => void;
}) {
  if (report.reportType !== 'legals' && report.reportType !== 'rights') {
    return null;
  }

  if (report.attachments.length === 0) {
    return null;
  }

  return (
    <Stack spacing={1}>
      {report.attachments.map((attachment) => (
        <Stack key={attachment.path} direction="row" spacing={1} alignItems="center">
          <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
            {attachment.name}
          </Typography>
          <Button
            type="button"
            size="small"
            variant="outlined"
            onClick={() => onOpen(report.reportType, report.id, attachment)}
            sx={{ whiteSpace: 'nowrap' }}
          >
            보기
          </Button>
        </Stack>
      ))}
    </Stack>
  );
}

function ReportDialogRows({
  report,
  onCopied,
  onAttachmentOpen,
}: {
  report: ReportRow;
  onCopied: () => void;
  onAttachmentOpen: (reportType: ReportType, reportId: string, attachment: ReportAttachment) => void;
}) {
  const detailRows: DialogRow[] = report.details.filter(shouldShowDetail).map((detail) => ({
    label: detail.label,
    value: getDetailValue(detail),
    visible: true,
  }));

  const rows: DialogRow[] = [
    {
      label: '신고 유형',
      value: reportTypeLabels[report.reportType],
      visible: true,
    },
    {
      label: '신고 대상',
      value: reportTargetTypeLabel(report.targetType),
      visible: true,
    },
    {
      label: '신고 분류',
      value: report.categoryLabel,
      visible: isVisibleText(report.categoryLabel),
    },
    {
      label: '처리 상태',
      value: reportStatusLabel(report.status),
      visible: true,
    },
    {
      label: '접수일',
      value: formatDateTime(report.createdAt),
      visible: true,
    },
    {
      label: '수정일',
      value: report.updatedAt ? formatDateTime(report.updatedAt) : null,
      visible: isVisibleText(report.updatedAt),
    },
    {
      label: '처리일',
      value: report.handledAt ? formatDateTime(report.handledAt) : null,
      visible: isVisibleText(report.handledAt),
    },
    {
      label: '신고자',
      value: report.reporterEmail,
      visible: isVisibleText(report.reporterEmail),
    },
    {
      label: '입력 이메일',
      value: report.email,
      visible: isVisibleText(report.email),
    },
    {
      label: '연락처',
      value: report.phone,
      visible: isVisibleText(report.phone),
    },
    {
      label: '사이트',
      value: <TargetLink label={report.siteLabel} href={report.siteHref} />,
      visible: isVisibleText(report.siteLabel),
    },
    {
      label: '게시판',
      value: <TargetLink label={report.boardLabel} href={report.boardHref} />,
      visible: isVisibleText(report.boardLabel),
    },
    {
      label: '글',
      value: <TargetLink label={report.postSubject} href={report.postHref} />,
      visible: isVisibleText(report.postSubject),
    },
    {
      label: '댓글',
      value: <TargetLink label={report.commentPreview} href={report.commentHref} />,
      visible: isVisibleText(report.commentPreview),
    },
    {
      label: '신고대상 URL',
      value: <ReportUrlValue url={report.reportUrl} onCopied={onCopied} />,
      visible: isVisibleText(report.reportUrl),
    },
    ...detailRows,
    {
      label: '첨부파일',
      value: <ReportAttachments report={report} onOpen={onAttachmentOpen} />,
      visible: (report.reportType === 'legals' || report.reportType === 'rights') && report.attachments.length > 0,
    },
  ];

  const visibleRows = rows.filter((row) => row.visible);

  if (visibleRows.length === 0) {
    return <Typography variant="body2">신고 상세내용이 없습니다.</Typography>;
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableBody>
          {visibleRows.map((row, index) => (
            <TableRow key={`${row.label}-${index}`}>
              <TableCell
                component="th"
                scope="row"
                sx={{
                  width: 160,
                  whiteSpace: 'nowrap',
                  fontWeight: 700,
                }}
              >
                {row.label}
              </TableCell>
              <TableCell
                sx={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {row.value}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function ReportsPage() {
  const [tab, setTab] = useState<ReportType>('guidelines');
  const [status, setStatus] = useState<ReportStatus | ''>('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<TablePage<ReportRow> | null>(null);
  const [siteKeyword, setSiteKeyword] = useState('');
  const [boardKeyword, setBoardKeyword] = useState('');
  const [postKeyword, setPostKeyword] = useState('');
  const [commentKeyword, setCommentKeyword] = useState('');
  const [siteRows, setSiteRows] = useState<ReportSearchRow[]>([]);
  const [boardRows, setBoardRows] = useState<ReportSearchRow[]>([]);
  const [postRows, setPostRows] = useState<ReportSearchRow[]>([]);
  const [commentRows, setCommentRows] = useState<ReportSearchRow[]>([]);
  const [selectedSite, setSelectedSite] = useState<ReportSearchRow | null>(null);
  const [selectedBoard, setSelectedBoard] = useState<ReportSearchRow | null>(null);
  const [selectedPost, setSelectedPost] = useState<ReportSearchRow | null>(null);
  const [selectedComment, setSelectedComment] = useState<ReportSearchRow | null>(null);
  const [editingReport, setEditingReport] = useState<ReportRow | null>(null);
  const [editingStatus, setEditingStatus] = useState<ReportStatus>('received');
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState('');

  const selectedSearch = selectedComment || selectedPost || selectedBoard || selectedSite;
  const pageCount = useMemo(() => Math.max(Math.ceil((data?.total || 0) / (data?.pageSize || 20)), 1), [data]);

  const loadReports = (targetPage: number, reportType = tab, statusValue = status) => {
    setData(null);

    const params = new URLSearchParams({ page: String(targetPage), type: reportType });

    if (statusValue) params.set('status', statusValue);

    apiFetch<TablePage<ReportRow>>(`/api/reports?${params.toString()}`)
      .then(setData)
      .catch(() => setData({ items: [], page: targetPage, pageSize: 20, total: 0 }));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadReports(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, tab, status]);

  const resetSearch = () => {
    setSiteRows([]);
    setBoardRows([]);
    setPostRows([]);
    setCommentRows([]);
    setSelectedSite(null);
    setSelectedBoard(null);
    setSelectedPost(null);
    setSelectedComment(null);
    setBoardKeyword('');
    setPostKeyword('');
    setCommentKeyword('');
  };

  const handleTabChange = (_event: SyntheticEvent, value: ReportType) => {
    setTab(value);
    setStatus('');
    setPage(1);
    resetSearch();
  };

  const runSearch = async (level: ReportSearchLevel, keyword: string) => {
    const params = new URLSearchParams({ mode: 'search', type: tab, level, q: keyword.trim() });

    if (level === 'board' && selectedSite?.siteId) params.set('siteId', selectedSite.siteId);
    if (level === 'post' && selectedBoard?.boardId) params.set('boardId', selectedBoard.boardId);

    const result = await apiFetch<ReportSearchResult>(`/api/reports?${params.toString()}`);

    if (level === 'site') setSiteRows(result.items);
    if (level === 'board') setBoardRows(result.items);
    if (level === 'post') setPostRows(result.items);
    if (level === 'comment') setCommentRows(result.items);
  };

  const handleSiteSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSelectedSite(null);
    setSelectedBoard(null);
    setSelectedPost(null);
    setSelectedComment(null);
    setBoardRows([]);
    setPostRows([]);
    setCommentRows([]);
    setPage(1);
    void runSearch('site', siteKeyword);
  };

  const handleBoardSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSelectedBoard(null);
    setSelectedPost(null);
    setSelectedComment(null);
    setPostRows([]);
    setCommentRows([]);
    setPage(1);
    void runSearch('board', boardKeyword);
  };

  const handlePostSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSelectedPost(null);
    setSelectedComment(null);
    setCommentRows([]);
    setPage(1);
    void runSearch('post', postKeyword);
  };

  const handleCommentSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSelectedComment(null);
    setPage(1);
    void runSearch('comment', commentKeyword);
  };

  const handleOpenStatusDialog = (report: ReportRow) => {
    setEditingReport(report);
    setEditingStatus(report.status);
  };

  const handleSaveStatus = async () => {
    if (!editingReport) return;

    setSaving(true);

    try {
      await apiFetch<{ ok: true }>('/api/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: editingReport.reportType,
          reportId: editingReport.id,
          status: editingStatus,
        }),
      });

      setData((current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) =>
                item.id === editingReport.id ? { ...item, status: editingStatus } : item,
              ),
            }
          : current,
      );

      setEditingReport(null);
      setSnackbar('처리 상태가 저장되었습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleSearchRowSelect = (row: ReportSearchRow) => {
    if (row.level === 'site') {
      setSelectedSite(row);
      setSelectedBoard(null);
      setSelectedPost(null);
      setSelectedComment(null);
    }

    if (row.level === 'board') {
      setSelectedBoard(row);
      setSelectedPost(null);
      setSelectedComment(null);
    }

    if (row.level === 'post') {
      setSelectedPost(row);
      setSelectedComment(null);
    }

    if (row.level === 'comment') {
      setSelectedComment(row);
    }
  };

  const handleStatusSelectChange = (event: SelectChangeEvent<ReportStatus>) => {
    setEditingStatus(event.target.value as ReportStatus);
  };

  const handleAttachmentOpen = (reportType: ReportType, reportId: string, attachment: ReportAttachment) => {
    void openAttachment(reportType, reportId, attachment);
  };

  return (
    <Stack spacing={3}>
      <PageHeader title="신고 현황" description="가이드라인 신고, 법위반 신고, 권리침해 신고 처리" />

      <Paper sx={{ p: 0 }}>
        <Tabs value={tab} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
          {reportTabs.map((reportType) => (
            <Tab key={reportType} value={reportType} label={reportTypeLabels[reportType]} />
          ))}
        </Tabs>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Stack component="form" onSubmit={handleSiteSearch} direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <TextField
              placeholder="사이트 영문명을 입력하세요."
              value={siteKeyword}
              onChange={(event) => setSiteKeyword(event.target.value)}
              fullWidth
              size="small"
            />
            <Button type="submit" size="small" variant="contained" sx={{ minWidth: 140 }}>
              1차 검색하기
            </Button>
          </Stack>

          {siteRows.length > 0 ? (
            <SearchResultTable rows={siteRows} selected={selectedSite} onSelect={handleSearchRowSelect} />
          ) : null}

          {selectedSite ? (
            <Stack spacing={1.5}>
              <Typography variant="subtitle2">신고 카테고리별 건수</Typography>
              <CategoryCounts counts={selectedSite.categoryCounts} />
              <Stack
                component="form"
                onSubmit={handleBoardSearch}
                direction={{ xs: 'column', md: 'row' }}
                spacing={1.5}
              >
                <TextField
                  placeholder="게시판 영문명을 입력하세요."
                  value={boardKeyword}
                  onChange={(event) => setBoardKeyword(event.target.value)}
                  fullWidth
                  size="small"
                />
                <Button type="submit" size="small" variant="contained" sx={{ minWidth: 140 }}>
                  2차 검색하기
                </Button>
              </Stack>
            </Stack>
          ) : null}

          {boardRows.length > 0 ? (
            <SearchResultTable rows={boardRows} selected={selectedBoard} onSelect={handleSearchRowSelect} />
          ) : null}

          {selectedBoard ? (
            <Stack spacing={1.5}>
              <Typography variant="subtitle2">신고 카테고리별 건수</Typography>
              <CategoryCounts counts={selectedBoard.categoryCounts} />
              <Stack component="form" onSubmit={handlePostSearch} direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                <TextField
                  placeholder="게시물 slug를 입력하세요."
                  value={postKeyword}
                  onChange={(event) => setPostKeyword(event.target.value)}
                  fullWidth
                  size="small"
                />
                <Button type="submit" size="small" variant="contained" sx={{ minWidth: 140 }}>
                  3차 검색하기
                </Button>
              </Stack>
            </Stack>
          ) : null}

          {postRows.length > 0 ? (
            <SearchResultTable rows={postRows} selected={selectedPost} onSelect={handleSearchRowSelect} />
          ) : null}

          {selectedPost ? (
            <Stack spacing={1.5}>
              <Typography variant="subtitle2">신고 카테고리별 건수</Typography>
              <CategoryCounts counts={selectedPost.categoryCounts} />
              <Stack
                component="form"
                onSubmit={handleCommentSearch}
                direction={{ xs: 'column', md: 'row' }}
                spacing={1.5}
              >
                <TextField
                  placeholder="댓글 ID를 입력하세요."
                  value={commentKeyword}
                  onChange={(event) => setCommentKeyword(event.target.value)}
                  fullWidth
                  size="small"
                />
                <Button type="submit" size="small" variant="contained" sx={{ minWidth: 140 }}>
                  4차 검색하기
                </Button>
              </Stack>
            </Stack>
          ) : null}

          {commentRows.length > 0 ? (
            <SearchResultTable rows={commentRows} selected={selectedComment} onSelect={handleSearchRowSelect} />
          ) : null}

          {selectedComment ? (
            <Stack spacing={1.5}>
              <Typography variant="subtitle2">신고 카테고리별 건수</Typography>
              <CategoryCounts counts={selectedComment.categoryCounts} />
            </Stack>
          ) : null}
        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="report-status-label">처리 상태</InputLabel>
            <Select
              labelId="report-status-label"
              label="처리 상태"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as ReportStatus | '');
                setPage(1);
              }}
            >
              {statusOptions.map((option) => (
                <MenuItem key={option.value || 'all'} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box sx={{ flex: 1 }}>
            {selectedSearch ? (
              <Typography variant="body2">선택 대상: {selectedSearch.label}</Typography>
            ) : (
              <Typography variant="body2">선택 대상 없음</Typography>
            )}
          </Box>
          {selectedSearch ? (
            <Button type="button" size="small" onClick={resetSearch}>
              선택 초기화
            </Button>
          ) : null}
        </Stack>
      </Paper>

      {!data ? (
        <LoadingBox />
      ) : data.items.length === 0 ? (
        <EmptyState message="신고 내역이 없습니다." />
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>접수일</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>상태</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>사이트명</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>게시판명</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>글제목</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>댓글내용</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>신고 분류</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>신고자</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>신고대상 URL</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>처리</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.items.map((report) => (
                <TableRow key={report.id} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(report.createdAt)}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <StatusChip label={reportStatusLabel(report.status)} />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <TargetLink label={report.siteLabel} href={report.siteHref} />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <TargetLink label={report.boardLabel} href={report.boardHref} />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <TargetLink label={report.postSubject} href={report.postHref} />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <TargetLink label={report.commentPreview} href={report.commentHref} />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{report.categoryLabel}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{report.reporterEmail || report.email}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <ReportUrlValue
                      url={report.reportUrl}
                      onCopied={() => setSnackbar('신고대상 URL을 복사했습니다.')}
                    />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {report.reportType === 'guidelines' ? (
                      <Button
                        type="button"
                        size="small"
                        variant="outlined"
                        onClick={() => handleOpenStatusDialog(report)}
                      >
                        상태 변경
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="small"
                        variant="outlined"
                        onClick={() => handleOpenStatusDialog(report)}
                      >
                        신고 내역/처리
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
            <Pagination count={pageCount} page={page} onChange={(_event, value) => setPage(value)} />
          </Box>
        </TableContainer>
      )}

      <Dialog open={Boolean(editingReport)} onClose={() => setEditingReport(null)} maxWidth="md" fullWidth>
        <DialogTitle>{editingReport?.reportType === 'guidelines' ? '처리 상태 변경' : '신고 내역/처리'}</DialogTitle>
        <DialogContent dividers>
          {editingReport ? (
            <Stack spacing={2}>
              <ReportDialogRows
                report={editingReport}
                onCopied={() => setSnackbar('신고대상 URL을 복사했습니다.')}
                onAttachmentOpen={handleAttachmentOpen}
              />

              <FormControl fullWidth size="small">
                <InputLabel id="edit-report-status-label">처리 상태</InputLabel>
                <Select
                  labelId="edit-report-status-label"
                  label="처리 상태"
                  value={editingStatus}
                  onChange={handleStatusSelectChange}
                >
                  {editableStatuses.map((nextStatus) => (
                    <MenuItem key={nextStatus} value={nextStatus}>
                      {reportStatusLabel(nextStatus)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button type="button" size="small" onClick={() => setEditingReport(null)} disabled={saving}>
            닫기
          </Button>
          <Button
            type="button"
            size="small"
            variant="contained"
            onClick={() => void handleSaveStatus()}
            disabled={saving}
          >
            저장
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={2700}
        message={snackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        onClose={() => setSnackbar('')}
      />
    </Stack>
  );
}

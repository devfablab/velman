import ExcelJS from 'exceljs';
import path from 'path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { decrypt } from '@/lib/decrypt';
import type { SupabaseEnv } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

const TRANSFER_TEMPLATE_PATH = path.join(process.cwd(), 'public', 'transfer.xlsx');
const PAYMENT_STATEMENT_TEMPLATE_PATH = path.join(process.cwd(), 'public', 'payment-statement.xlsx');
const TRANSFER_SHEET_NAME = '당타행_양식';
const PAYMENT_STATEMENT_SHEET_NAME = 'Sheet1';
const PAYMENT_STATEMENT_BUSINESS_CODE = '940306';
const PAYMENT_STATEMENT_ROW_LIMIT = 1000;
const TRANSFER_ROW_LIMIT = 498;

const bankCodeLabels: Record<string, string> = {
  '002': '002-한국산업은행',
  '003': '003-기업은행',
  '004': '004-국민은행',
  '007': '007-수협은행',
  '011': '011-농협은행',
  '012': '012-지역농축협',
  '020': '020-우리은행',
  '023': '023-SC은행',
  '027': '027-씨티은행',
  '031': '031-대구은행',
  '032': '032-부산은행',
  '034': '034-광주은행',
  '035': '035-제주은행',
  '037': '037-전북은행',
  '039': '039-경남은행',
  '045': '045-새마을금고',
  '048': '048-신협',
  '050': '050-상호저축은행',
  '054': '054-HSBC',
  '055': '055-도이치',
  '057': '057-JP모간',
  '060': '060-BOA',
  '061': '061-BNP',
  '062': '062-중국공상',
  '064': '064-산림조합',
  '067': '067-중국건설은행',
  '071': '071-우체국',
  '081': '081-하나은행',
  '088': '088-신한은행',
  '089': '089-케이뱅크',
  '090': '090-카카오뱅크',
  '092': '092-토스뱅크',
  '209': '209-동양증권',
  '218': '218-KB증권',
  '230': '230-미래에셋',
  '238': '238-대우증권',
  '240': '240-삼성증권',
  '243': '243-한국투자',
  '247': '247-NH투자증권',
  '261': '261-교보증권',
  '262': '262-하이투자증권',
  '263': '263-현대차증권',
  '264': '264-키움증권',
  '265': '265-이베스트',
  '266': '266-SK증권',
  '267': '267-대신증권',
  '269': '269-한화증권',
  '270': '270-하나대투',
  '278': '278-신한금융투자',
  '279': '279-DB금융투자',
  '280': '280-유진투자증권',
  '287': '287-메리츠종금',
  '291': '291-신영증권',
  '292': '292-케이프투자증권',
};

type ExcelResult =
  | { ok: true; buffer: Buffer; filename: string; count: number }
  | { message: string };

type MonthResult =
  | { ok: true; months: string[] }
  | { message: string };

type SettlementExcelRow = {
  id: string;
  receiver_user_id: string;
  settlement_amount: number | string;
  completed_at?: string | null;
};

type ChorogonRow = Record<string, unknown> & {
  user_id: string;
  name?: string | null;
  resident_registration_number?: string | null;
  business_registration_number?: string | null;
  bank_code?: string | null;
  account_number?: string | null;
  account_holder?: string | null;
};

type RecipientInfo = {
  userId: string;
  name: string;
  residentRegistrationNumber: string;
  businessRegistrationNumber: string;
  bankCode: string;
  accountNumber: string;
  accountHolder: string;
};

function toNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) return Number(value);
  return 0;
}

function getString(value: unknown) {
  if (typeof value === 'string') return normalizeText(value);
  if (typeof value === 'number') return normalizeText(String(value));
  return '';
}

function decryptRequired(value: unknown, mode: SupabaseEnv, label: string) {
  const encryptedValue = getString(value);

  if (!encryptedValue) {
    throw new Error(`${label} 값이 없습니다.`);
  }

  return decrypt(encryptedValue, mode);
}

function decryptOptional(value: unknown, mode: SupabaseEnv) {
  const encryptedValue = getString(value);

  if (!encryptedValue) return '';

  return decrypt(encryptedValue, mode);
}

function getBankCodeLabel(value: string) {
  const normalizedValue = normalizeText(value);
  const code = normalizedValue.includes('-') ? normalizedValue.split('-')[0] : normalizedValue;

  return bankCodeLabels[code] || normalizedValue;
}

function getPaymentStatementTaxRate(businessCode: string) {
  if (businessCode === '940905') return 5;
  if (businessCode === '940904') return 20;

  return 3;
}

function getTimestampText() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');

  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('');
}

function getMonthStart(month: string) {
  return `${month}-01T00:00:00.000Z`;
}

function getNextMonthStart(month: string) {
  const [year, monthValue] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthValue, 1));
  const nextYear = date.getUTCFullYear();
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, '0');

  return `${nextYear}-${nextMonth}-01T00:00:00.000Z`;
}

function getPreviousMonthText() {
  const now = new Date();
  const previousMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const year = previousMonthDate.getUTCFullYear();
  const month = String(previousMonthDate.getUTCMonth() + 1).padStart(2, '0');

  return `${year}-${month}`;
}

function getMonthText(dateText: string) {
  return dateText.slice(0, 7);
}

function getContinuousMonths(startMonth: string, endMonth: string) {
  const [startYear, startMonthValue] = startMonth.split('-').map(Number);
  const [endYear, endMonthValue] = endMonth.split('-').map(Number);
  const startIndex = startYear * 12 + startMonthValue;
  const endIndex = endYear * 12 + endMonthValue;
  const length = Math.max(endIndex - startIndex + 1, 0);

  return Array.from({ length }, (_value, index) => {
    const date = new Date(Date.UTC(startYear, startMonthValue - 1 + index, 1));
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');

    return `${year}-${month}`;
  }).reverse();
}

function getUniqueValues(values: string[]) {
  return Array.from(new Set(values));
}

function getRecipientInfo(row: ChorogonRow, mode: SupabaseEnv): RecipientInfo {
  return {
    userId: row.user_id,
    name: decryptRequired(row.name, mode, '성명'),
    residentRegistrationNumber: decryptOptional(row.resident_registration_number, mode),
    businessRegistrationNumber: decryptOptional(row.business_registration_number, mode),
    bankCode: getBankCodeLabel(getString(row.bank_code)),
    accountNumber: decryptRequired(row.account_number, mode, '입금계좌번호'),
    accountHolder: decryptRequired(row.account_holder, mode, '예금주명'),
  };
}

async function getRecipientMap(supabaseAdmin: SupabaseClient, mode: SupabaseEnv, userIds: string[]) {
  const uniqueUserIds = getUniqueValues(userIds);

  if (uniqueUserIds.length === 0) return new Map<string, RecipientInfo>();

  const result = await supabaseAdmin.from('chorogons').select('*').in('user_id', uniqueUserIds);

  if (result.error) return { message: result.error.message };

  try {
    return new Map(((result.data || []) as ChorogonRow[]).map((row) => [row.user_id, getRecipientInfo(row, mode)]));
  } catch (error) {
    return { message: error instanceof Error ? error.message : '수령자 정보 복호화에 실패했습니다.' };
  }
}

async function getConfirmedSettlements(supabaseAdmin: SupabaseClient) {
  const result = await supabaseAdmin
    .from('settlements')
    .select('id, receiver_user_id, settlement_amount')
    .eq('status', 'confirmed')
    .order('created_at', { ascending: true });

  if (result.error) return { message: result.error.message };

  return (result.data || []) as SettlementExcelRow[];
}

async function getCompletedSettlementsByMonth(supabaseAdmin: SupabaseClient, month: string) {
  const result = await supabaseAdmin
    .from('settlements')
    .select('id, receiver_user_id, settlement_amount, completed_at')
    .eq('status', 'completed')
    .gte('completed_at', getMonthStart(month))
    .lt('completed_at', getNextMonthStart(month))
    .order('completed_at', { ascending: true });

  if (result.error) return { message: result.error.message };

  return (result.data || []) as SettlementExcelRow[];
}

function getWorksheet(workbook: ExcelJS.Workbook, sheetName: string) {
  const worksheet = workbook.getWorksheet(sheetName);

  if (!worksheet) {
    return { message: `${sheetName} 시트를 찾을 수 없습니다.` };
  }

  return worksheet;
}

function clearTransferSheet(worksheet: ExcelJS.Worksheet) {
  for (const rowNumber of Array.from({ length: TRANSFER_ROW_LIMIT }, (_value, index) => index + 2)) {
    worksheet.getCell(`A${rowNumber}`).value = null;
    worksheet.getCell(`B${rowNumber}`).value = null;
    worksheet.getCell(`C${rowNumber}`).value = null;
    worksheet.getCell(`D${rowNumber}`).value = null;
  }
}

function clearPaymentStatementSheet(worksheet: ExcelJS.Worksheet) {
  for (const rowNumber of Array.from({ length: PAYMENT_STATEMENT_ROW_LIMIT }, (_value, index) => index + 2)) {
    for (const columnNumber of Array.from({ length: 10 }, (_value, index) => index + 1)) {
      worksheet.getRow(rowNumber).getCell(columnNumber).value = null;
    }
  }
}

function buildTransferRows(settlements: SettlementExcelRow[], recipientMap: Map<string, RecipientInfo>) {
  return settlements.map((settlement) => {
    const recipient = recipientMap.get(settlement.receiver_user_id);

    if (!recipient) {
      throw new Error('수령자 정보를 찾을 수 없습니다.');
    }

    if (!recipient.bankCode) {
      throw new Error('은행코드 값이 없습니다.');
    }

    return {
      bankCode: recipient.bankCode,
      accountNumber: recipient.accountNumber,
      amount: toNumber(settlement.settlement_amount),
      accountHolder: recipient.accountHolder,
    };
  });
}

function buildPaymentStatementRows(settlements: SettlementExcelRow[], recipientMap: Map<string, RecipientInfo>, month: string) {
  return settlements
    .map((settlement) => {
      const recipient = recipientMap.get(settlement.receiver_user_id);

      if (!recipient) return null;
      if (!recipient.residentRegistrationNumber) return null;
      if (recipient.businessRegistrationNumber) return null;

      const amount = toNumber(settlement.settlement_amount);
      const taxRate = getPaymentStatementTaxRate(PAYMENT_STATEMENT_BUSINESS_CODE);
      const incomeTax = Math.floor((amount * taxRate) / 100);
      const localIncomeTax = Math.floor(incomeTax / 10);

      return {
        month: month.slice(5, 7),
        businessCode: PAYMENT_STATEMENT_BUSINESS_CODE,
        name: recipient.name,
        registrationNumber: recipient.residentRegistrationNumber,
        amount,
        taxRate,
        incomeTax,
        localIncomeTax,
      };
    })
    .filter((row) => row !== null);
}

export async function createTransferExcel(supabaseAdmin: SupabaseClient, mode: SupabaseEnv): Promise<ExcelResult> {
  const settlements = await getConfirmedSettlements(supabaseAdmin);
  if ('message' in settlements) return settlements;
  if (settlements.length === 0) return { message: '정산 확정 데이터가 없습니다.' };
  if (settlements.length > TRANSFER_ROW_LIMIT) return { message: '대량이체 엑셀 입력 가능 건수를 초과했습니다.' };

  const recipientMap = await getRecipientMap(
    supabaseAdmin,
    mode,
    settlements.map((settlement) => settlement.receiver_user_id),
  );
  if ('message' in recipientMap) return recipientMap;

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TRANSFER_TEMPLATE_PATH);

  const worksheet = getWorksheet(workbook, TRANSFER_SHEET_NAME);
  if ('message' in worksheet) return worksheet;

  try {
    const rows = buildTransferRows(settlements, recipientMap);
    clearTransferSheet(worksheet);

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2;
      worksheet.getCell(`A${rowNumber}`).value = row.bankCode;
      worksheet.getCell(`B${rowNumber}`).value = row.accountNumber;
      worksheet.getCell(`B${rowNumber}`).numFmt = '@';
      worksheet.getCell(`C${rowNumber}`).value = row.amount;
      worksheet.getCell(`D${rowNumber}`).value = row.accountHolder;
    }

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    return {
      ok: true,
      buffer,
      filename: `대량이체_${getTimestampText()}.xlsx`,
      count: rows.length,
    };
  } catch (error) {
    return { message: error instanceof Error ? error.message : '대량이체 엑셀 생성에 실패했습니다.' };
  }
}

export async function getPaymentStatementMonths(supabaseAdmin: SupabaseClient): Promise<MonthResult> {
  const result = await supabaseAdmin
    .from('settlements')
    .select('completed_at')
    .eq('status', 'completed')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: true });

  if (result.error) return { message: result.error.message };

  const rows = (result.data || []) as { completed_at: string }[];
  const monthValues = rows.map((row) => getMonthText(row.completed_at));

  if (monthValues.length === 0) return { ok: true, months: [] };

  const startMonth = monthValues[0];
  const endMonth = getPreviousMonthText();

  if (startMonth > endMonth) return { ok: true, months: [] };

  return { ok: true, months: getContinuousMonths(startMonth, endMonth) };
}

export async function createPaymentStatementExcel(
  supabaseAdmin: SupabaseClient,
  mode: SupabaseEnv,
  month: string,
): Promise<ExcelResult> {
  const settlements = await getCompletedSettlementsByMonth(supabaseAdmin, month);
  if ('message' in settlements) return settlements;
  if (settlements.length === 0) return { message: '선택한 월의 정산 완료 데이터가 없습니다.' };

  const recipientMap = await getRecipientMap(
    supabaseAdmin,
    mode,
    settlements.map((settlement) => settlement.receiver_user_id),
  );
  if ('message' in recipientMap) return recipientMap;

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(PAYMENT_STATEMENT_TEMPLATE_PATH);

  const worksheet = getWorksheet(workbook, PAYMENT_STATEMENT_SHEET_NAME);
  if ('message' in worksheet) return worksheet;

  const rows = buildPaymentStatementRows(settlements, recipientMap, month);

  if (rows.length === 0) return { message: '선택한 월의 개인 정산 완료 데이터가 없습니다.' };
  if (rows.length > PAYMENT_STATEMENT_ROW_LIMIT) return { message: '간이지급명세서 입력 가능 건수를 초과했습니다.' };

  clearPaymentStatementSheet(worksheet);

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    worksheet.getCell(`A${rowNumber}`).value = index + 1;
    worksheet.getCell(`B${rowNumber}`).value = row.month;
    worksheet.getCell(`C${rowNumber}`).value = row.businessCode;
    worksheet.getCell(`D${rowNumber}`).value = row.name;
    worksheet.getCell(`E${rowNumber}`).value = row.registrationNumber;
    worksheet.getCell(`E${rowNumber}`).numFmt = '@';
    worksheet.getCell(`F${rowNumber}`).value = '1';
    worksheet.getCell(`G${rowNumber}`).value = row.amount;
    worksheet.getCell(`H${rowNumber}`).value = row.taxRate;
    worksheet.getCell(`I${rowNumber}`).value = row.incomeTax;
    worksheet.getCell(`J${rowNumber}`).value = row.localIncomeTax;
  }

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  return {
    ok: true,
    buffer,
    filename: `간이지급명세서_${month}.xlsx`,
    count: rows.length,
  };
}

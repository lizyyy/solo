import type { 
  Certificate, 
  CertificateType, 
  CertificateStatus, 
  FieldConflict 
} from './types';

const TYPE_NAMES: Record<CertificateType, string> = {
  store_license: '门店许可证',
  health_certificate: '员工健康证',
  supplier_qualification: '供应商资质'
};

const STATUS_NAMES: Record<CertificateStatus, string> = {
  pending: '待审核',
  valid: '有效',
  expired: '已过期',
  expiring_soon: '即将过期',
  invalid: '无效'
};

export function getTypeName(type: CertificateType): string {
  return TYPE_NAMES[type] || type;
}

export function getStatusName(status: CertificateStatus): string {
  return STATUS_NAMES[status] || status;
}

export function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calculateStatus(expiryDate: string): CertificateStatus {
  const expiry = parseDate(expiryDate);
  if (!expiry) return 'invalid';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilExpiry < 0) return 'expired';
  if (daysUntilExpiry <= 30) return 'expiring_soon';
  return 'valid';
}

export function validateCertificate(data: Partial<Certificate>): string[] {
  const errors: string[] = [];
  
  if (!data.certificateNumber?.trim()) {
    errors.push('证照编号不能为空');
  }
  
  if (!data.type) {
    errors.push('证照类型不能为空');
  }
  
  if (!data.name?.trim()) {
    errors.push('证照名称不能为空');
  }
  
  if (!data.holder?.trim()) {
    errors.push('持证人/单位不能为空');
  }
  
  const issueDate = parseDate(data.issueDate || '');
  const expiryDate = parseDate(data.expiryDate || '');
  
  if (!issueDate) {
    errors.push('发证日期无效');
  }
  
  if (!expiryDate) {
    errors.push('到期日期无效');
  }
  
  if (issueDate && expiryDate && issueDate >= expiryDate) {
    errors.push('发证日期必须早于到期日期');
  }
  
  return errors;
}

export function findConflicts(
  existing: Certificate,
  incoming: Partial<Certificate>
): FieldConflict[] {
  const conflicts: FieldConflict[] = [];
  const fieldsToCheck: (keyof Certificate)[] = [
    'type', 'name', 'holder', 'issueDate', 'expiryDate'
  ];

  for (const field of fieldsToCheck) {
    const incomingValue = incoming[field];
    if (incomingValue !== undefined && String(incomingValue) !== String(existing[field])) {
      conflicts.push({
        field,
        existingValue: String(existing[field]),
        newValue: String(incomingValue)
      });
    }
  }

  return conflicts;
}

export function parseJSON(data: string): any[] {
  const parsed = JSON.parse(data);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') return [parsed];
  return [];
}

export function parseCSV(data: string): any[] {
  const lines = data.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const result: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const obj: Record<string, string> = {};
    headers.forEach((header, index) => {
      obj[header.trim()] = values[index]?.trim() || '';
    });
    result.push(obj);
  }

  return result;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);

  return result.map(field => 
    field.startsWith('"') && field.endsWith('"') 
      ? field.slice(1, -1) 
      : field
  );
}

export function convertToCSV(certificates: Certificate[]): string {
  const headers = [
    '证照编号', '证照类型', '证照名称', '持证人/单位',
    '发证日期', '到期日期', '状态', '复核状态', '复核备注'
  ];

  const lines = [headers.join(',')];

  for (const cert of certificates) {
    const values = [
      `"${escapeCSVField(cert.certificateNumber)}"`,
      `"${escapeCSVField(getTypeName(cert.type))}"`,
      `"${escapeCSVField(cert.name)}"`,
      `"${escapeCSVField(cert.holder)}"`,
      cert.issueDate,
      cert.expiryDate,
      `"${escapeCSVField(getStatusName(cert.status))}"`,
      `"${escapeCSVField(getReviewStatusText(cert.reviewStatus))}"`,
      `"${escapeCSVField(cert.reviewComments || '')}"`
    ];
    lines.push(values.join(','));
  }

  return lines.join('\n');
}

function escapeCSVField(field: string): string {
  return field.replace(/"/g, '""');
}

export function getReviewStatusText(status: string): string {
  const map: Record<string, string> = {
    not_reviewed: '未复核',
    under_review: '复核中',
    approved: '已通过',
    rejected: '已驳回'
  };
  return map[status] || status;
}

export function getDaysUntilExpiry(expiryDate: string): number {
  const expiry = parseDate(expiryDate);
  if (!expiry) return -1;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function normalizeImportData(data: any): Partial<Certificate> {
  const result: Partial<Certificate> = {};

  const fieldMappings: Record<string, keyof Certificate> = {
    '证照编号': 'certificateNumber',
    'certificateNumber': 'certificateNumber',
    'number': 'certificateNumber',
    '证照类型': 'type',
    'type': 'type',
    '证照名称': 'name',
    'name': 'name',
    '持证人': 'holder',
    '持证人/单位': 'holder',
    'holder': 'holder',
    '发证日期': 'issueDate',
    'issueDate': 'issueDate',
    '到期日期': 'expiryDate',
    'expiryDate': 'expiryDate'
  };

  for (const [key, value] of Object.entries(data)) {
    const mappedKey = fieldMappings[key];
    if (mappedKey) {
      (result as any)[mappedKey] = value;
    } else {
      (result as any)[key] = value;
    }
  }

  return result;
}

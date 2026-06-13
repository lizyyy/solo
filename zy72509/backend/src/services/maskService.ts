export function maskPhone(phone: string): string {
  if (!phone) return '';
  const clean = phone.replace(/\D/g, '');
  if (clean.length < 7) return phone;
  return clean.slice(0, 3) + '****' + clean.slice(-4);
}

export function getPhoneLast4(phone: string): string {
  if (!phone) return '';
  const clean = phone.replace(/\D/g, '');
  if (clean.length < 4) return clean;
  return clean.slice(-4);
}

export function checkPhoneLeaked(text: string): boolean {
  if (!text) return false;
  return findAllPhones(text).length > 0;
}

export interface PhoneOccurrence {
  phone: string;
  masked: string;
  last4: string;
}

export function findAllPhones(text: string): PhoneOccurrence[] {
  if (!text) return [];
  const phonePattern = /1[3-9]\d{9}/g;
  const occurrences: PhoneOccurrence[] = [];
  let match;
  while ((match = phonePattern.exec(text)) !== null) {
    const phone = match[0];
    if (!phone.includes('*')) {
      occurrences.push({
        phone,
        masked: maskPhone(phone),
        last4: getPhoneLast4(phone),
      });
    }
  }
  return occurrences;
}

export interface RecordPhoneAudit {
  field: 'phone_number' | 'user_query' | 'annotator_comment' | 'model_output';
  fieldName: string;
  occurrences: PhoneOccurrence[];
}

export function auditRecordPhones(record: {
  phone_number?: string;
  user_query?: string;
  annotator_comment?: string;
  model_output?: string;
}): RecordPhoneAudit[] {
  const audits: RecordPhoneAudit[] = [];
  const fieldMap: Array<{ key: 'phone_number' | 'user_query' | 'annotator_comment' | 'model_output'; name: string }> = [
    { key: 'phone_number', name: '手机号字段' },
    { key: 'user_query', name: '用户问题' },
    { key: 'annotator_comment', name: '标注员留言' },
    { key: 'model_output', name: '模型输出' },
  ];

  fieldMap.forEach(({ key, name }) => {
    const text = record[key] || '';
    const occurrences = findAllPhones(text);
    if (occurrences.length > 0) {
      audits.push({ field: key, fieldName: name, occurrences });
    }
  });

  return audits;
}

export function maskText(text: string): string {
  if (!text) return '';
  return text.replace(/1[3-9]\d{9}/g, (match) => maskPhone(match));
}

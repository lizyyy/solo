export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 6);
  return `${prefix}_${timestamp}_${random}`;
}

export function generateManualCounterExampleId(): string {
  return generateId('mce');
}

export function generateQuestionnaireRowId(): string {
  return generateId('qr');
}

export function generateBoundarySampleId(): string {
  return generateId('bs');
}

export function generateReportId(): string {
  return generateId('report');
}

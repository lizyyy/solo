export function maskPhone(phone: string): string {
  if (!phone) return '';
  const clean = phone.replace(/\D/g, '');
  if (clean.length < 7) return phone;
  return clean.slice(0, 3) + '****' + clean.slice(-4);
}

export function checkPhoneLeaked(text: string): boolean {
  if (!text) return false;
  const phonePattern = /1[3-9]\d{9}/g;
  const matches = text.match(phonePattern);
  if (!matches) return false;
  return matches.some(phone => !phone.includes('*') && phone.length === 11);
}

export function maskText(text: string): string {
  if (!text) return '';
  return text.replace(/1[3-9]\d{9}/g, (match) => maskPhone(match));
}

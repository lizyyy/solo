import type { SKU } from '../types';

export function getDaysUntilExpiry(expiryDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export function isExpiringSoon(expiryDate: string, daysThreshold: number): boolean {
  return getDaysUntilExpiry(expiryDate) <= daysThreshold;
}

export function getExpiryStatus(expiryDate: string): 'expired' | 'critical' | 'warning' | 'normal' {
  const days = getDaysUntilExpiry(expiryDate);
  if (days < 0) return 'expired';
  if (days <= 7) return 'critical';
  if (days <= 30) return 'warning';
  return 'normal';
}

export function getExpiryColor(expiryDate: string): string {
  const status = getExpiryStatus(expiryDate);
  switch (status) {
    case 'expired':
      return '#dc2626';
    case 'critical':
      return '#ef4444';
    case 'warning':
      return '#f59e0b';
    default:
      return '#22c55e';
  }
}

export function filterSKUsByExpiry(skus: SKU[], daysThreshold: number): SKU[] {
  return skus.filter((sku) => isExpiringSoon(sku.expiryDate, daysThreshold));
}

export function countExpiringSKUs(skus: SKU[], daysThreshold: number): number {
  return skus.filter((sku) => isExpiringSoon(sku.expiryDate, daysThreshold)).length;
}

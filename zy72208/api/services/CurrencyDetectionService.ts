import type { MixedCurrencyDetectionResult } from '../../shared/types.js';

export class CurrencyDetectionService {
  private hkdPatterns = /HKD|HK\$|港币|港幣|HK\s*元|HK/i;
  private cnyPatterns = /CNY|RMB|¥|￥|人民币|人民幣|元/i;

  detectMixedCurrency(rawCurrency: string): MixedCurrencyDetectionResult {
    const hasHKD = this.hkdPatterns.test(rawCurrency);
    const hasCNY = this.cnyPatterns.test(rawCurrency);
    
    const detected: string[] = [];
    if (hasHKD) detected.push('HKD');
    if (hasCNY) detected.push('CNY');
    
    if (detected.length > 1) {
      return {
        hasMixed: true,
        detectedCurrencies: detected,
        normalized: 'MIXED'
      };
    }
    
    return {
      hasMixed: false,
      detectedCurrencies: detected,
      normalized: detected[0] || 'UNKNOWN'
    };
  }

  extractAmount(rawCurrency: string): { amount: number; currencyText: string } {
    const cleaned = rawCurrency.replace(/[,\s]/g, '');
    const amountMatch = cleaned.match(/([\d.]+)/);
    const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;
    const currencyText = cleaned.replace(/[\d.]/g, '').trim();
    return { amount, currencyText };
  }

  normalizeCurrency(currency: string): string {
    if (this.hkdPatterns.test(currency)) return 'HKD';
    if (this.cnyPatterns.test(currency)) return 'CNY';
    return currency.toUpperCase();
  }
}

export default new CurrencyDetectionService();

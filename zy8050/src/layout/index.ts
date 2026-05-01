import { Product, Locales, DeviceProfiles, Issue, MergedProduct, SubsetFontManifest, FontCoverage } from '../types';
import { mergeProductWithLocales } from '../validators';

export function estimatePixelWidth(text: string, charWidth: number): number {
  let width = 0;
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code >= 0x4E00 && code <= 0x9FFF || 
        code >= 0x3000 && code <= 0x303F || 
        code >= 0xFF00 && code <= 0xFFEF) {
      width += charWidth;
    } else {
      width += Math.ceil(charWidth * 0.6);
    }
  }
  return width;
}

export function checkPixelOverflow(
  products: Product[],
  locales: Locales,
  deviceProfiles: DeviceProfiles
): Issue[] {
  const issues: Issue[] = [];

  products.forEach(product => {
    const profile = deviceProfiles[product.device_profile];
    if (!profile) return;

    const merged = mergeProductWithLocales(product, locales);
    
    Object.entries(merged.locales).forEach(([localeKey, localized]) => {
      const texts = [localized.name, product.price];
      if (product.original_price) texts.push(product.original_price);
      texts.push(...localized.tags);

      const fullText = texts.join(' ');
      const estimatedWidth = estimatePixelWidth(fullText, profile.char_width);

      if (estimatedWidth > profile.max_pixel_width) {
        issues.push({
          sku: product.sku,
          severity: 'warning',
          category: 'pixel_overflow',
          locale: localeKey,
          message: `文本可能溢出: 估算 ${estimatedWidth}px / ${profile.max_pixel_width}px`,
          details: `在 ${localeKey} 下文本可能超出屏幕宽度`
        });
      }
    });
  });

  return issues;
}

export function generateSubsetManifest(
  products: Product[],
  locales: Locales,
  fontCoverage: FontCoverage
): SubsetFontManifest[] {
  const manifest: SubsetFontManifest[] = [];

  products.forEach(product => {
    const merged = mergeProductWithLocales(product, locales);
    const allChars = new Set<string>();

    for (const char of product.name) allChars.add(char);
    for (const char of product.price) allChars.add(char);
    if (product.original_price) {
      for (const char of product.original_price) allChars.add(char);
    }
    
    Object.values(merged.locales).forEach(localized => {
      for (const char of localized.name) allChars.add(char);
      localized.tags.forEach(tag => {
        for (const char of tag) allChars.add(char);
      });
    });

    const supportedChars = fontCoverage.default_font.supported_chars;
    const requiredChars = Array.from(allChars).filter(char => supportedChars.includes(char)).join('');

    manifest.push({
      sku: product.sku,
      required_chars: requiredChars,
      locales: Object.keys(merged.locales)
    });
  });

  return manifest;
}

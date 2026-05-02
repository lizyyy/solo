import { Product, Locales, FontCoverage, DeviceProfiles, Issue, MergedProduct } from '../types';

export function checkDuplicateSkus(products: Product[]): Issue[] {
  const issues: Issue[] = [];
  const skuCounts: Record<string, number> = {};
  
  products.forEach(p => {
    skuCounts[p.sku] = (skuCounts[p.sku] || 0) + 1;
  });
  
  Object.entries(skuCounts).forEach(([sku, count]) => {
    if (count > 1) {
      issues.push({
        sku,
        severity: 'error',
        category: 'duplicate_sku',
        message: `SKU ${sku} 出现了 ${count} 次`,
        details: `找到 ${count} 个重复的 SKU`
      });
    }
  });
  
  return issues;
}

export function mergeProductWithLocales(product: Product, locales: Locales): MergedProduct {
  const merged: MergedProduct = {
    product,
    locales: {}
  };
  
  Object.entries(locales).forEach(([localeKey, locale]) => {
    const translatedTags = product.tags.map(tag => locale.translations[tag] || tag);
    merged.locales[localeKey] = {
      name: product.name,
      tags: translatedTags
    };
  });
  
  return merged;
}

export function checkMissingLocales(products: Product[], locales: Locales): Issue[] {
  const issues: Issue[] = [];
  
  products.forEach(product => {
    Object.entries(locales).forEach(([localeKey, locale]) => {
      product.tags.forEach(tag => {
        if (!locale.translations[tag]) {
          issues.push({
            sku: product.sku,
            severity: 'warning',
            category: 'missing_locale',
            locale: localeKey,
            message: `标签 "${tag}" 在 ${localeKey} 中缺少翻译`,
            details: `标签 "${tag}" 未在 ${locale.name} 中找到对应翻译`
          });
        }
      });
    });
  });
  
  return issues;
}

export function checkMissingChars(products: Product[], locales: Locales, fontCoverage: FontCoverage): Issue[] {
  const issues: Issue[] = [];
  const supportedChars = fontCoverage.default_font.supported_chars;
  
  products.forEach(product => {
    const textsToCheck: string[] = [product.name, product.price];
    if (product.original_price) textsToCheck.push(product.original_price);
    textsToCheck.push(...product.tags);
    
    Object.entries(locales).forEach(([localeKey, locale]) => {
      product.tags.forEach(tag => {
        if (locale.translations[tag]) {
          textsToCheck.push(locale.translations[tag]);
        }
      });
    });
    
    const allText = textsToCheck.join('');
    const missingChars = new Set<string>();
    
    for (const char of allText) {
      if (!supportedChars.includes(char)) {
        missingChars.add(char);
      }
    }
    
    if (missingChars.size > 0) {
      issues.push({
        sku: product.sku,
        severity: 'error',
        category: 'missing_chars',
        message: `字体缺少 ${missingChars.size} 个字符`,
        details: `缺失字符: ${Array.from(missingChars).join('')}`
      });
    }
  });
  
  return issues;
}

export function checkPriceFormat(products: Product[]): Issue[] {
  const issues: Issue[] = [];
  const priceRegex = /^[¥$€]?\d+(\.\d{1,2})?$/;
  
  products.forEach(product => {
    if (!priceRegex.test(product.price)) {
      issues.push({
        sku: product.sku,
        severity: 'error',
        category: 'invalid_price',
        message: `价格格式无效: ${product.price}`,
        details: '价格应符合格式: ¥19.9 或 19.99'
      });
    }
    
    if (product.original_price && !priceRegex.test(product.original_price)) {
      issues.push({
        sku: product.sku,
        severity: 'error',
        category: 'invalid_price',
        message: `原价格式无效: ${product.original_price}`,
        details: '原价应符合格式: ¥19.9 或 19.99'
      });
    }
  });
  
  return issues;
}

export function checkTemplateMatch(products: Product[], deviceProfiles: DeviceProfiles): Issue[] {
  const issues: Issue[] = [];
  
  products.forEach(product => {
    const profile = deviceProfiles[product.device_profile];
    if (!profile) {
      issues.push({
        sku: product.sku,
        severity: 'error',
        category: 'template_mismatch',
        message: `设备配置文件不存在: ${product.device_profile}`,
        details: `找不到设备配置 ${product.device_profile}`
      });
      return;
    }
    
    if (!profile.supported_templates.includes(product.template_id)) {
      issues.push({
        sku: product.sku,
        severity: 'error',
        category: 'template_mismatch',
        message: `模板 ${product.template_id} 不支持设备 ${product.device_profile}`,
        details: `设备 ${product.device_profile} 仅支持: ${profile.supported_templates.join(', ')}`
      });
    }
  });
  
  return issues;
}

export function checkColorModeSupport(products: Product[], deviceProfiles: DeviceProfiles): Issue[] {
  const issues: Issue[] = [];
  const redTags = ['促销', '特价', 'Sale', 'Special', 'セール', '特価'];
  
  products.forEach(product => {
    const profile = deviceProfiles[product.device_profile];
    if (!profile) return;
    
    const hasRedTag = product.tags.some(tag => redTags.includes(tag));
    
    if (hasRedTag && profile.color_mode === 'black_white') {
      issues.push({
        sku: product.sku,
        severity: 'warning',
        category: 'color_mode_unsupported',
        message: '三色标签在黑白设备上可能无法正常显示',
        details: `设备 ${product.device_profile} 仅支持黑白两色`
      });
    }
  });
  
  return issues;
}

export function runAllValidations(
  products: Product[],
  locales: Locales,
  fontCoverage: FontCoverage,
  deviceProfiles: DeviceProfiles
): Issue[] {
  const issues: Issue[] = [];
  
  issues.push(...checkDuplicateSkus(products));
  issues.push(...checkMissingLocales(products, locales));
  issues.push(...checkMissingChars(products, locales, fontCoverage));
  issues.push(...checkPriceFormat(products));
  issues.push(...checkTemplateMatch(products, deviceProfiles));
  issues.push(...checkColorModeSupport(products, deviceProfiles));
  
  return issues;
}

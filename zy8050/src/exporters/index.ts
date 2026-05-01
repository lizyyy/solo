import * as fs from 'fs';
import * as path from 'path';
import { createObjectCsvWriter } from 'csv-writer';
import { Issue, SubsetFontManifest, Product, Locales, DeviceProfiles } from '../types';
import { mergeProductWithLocales } from '../validators';

export async function exportIssuesCsv(issues: Issue[], outputDir: string): Promise<void> {
  const filePath = path.join(outputDir, 'issues.csv');
  
  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: [
      { id: 'sku', title: 'SKU' },
      { id: 'severity', title: 'Severity' },
      { id: 'category', title: 'Category' },
      { id: 'locale', title: 'Locale' },
      { id: 'message', title: 'Message' },
      { id: 'details', title: 'Details' }
    ]
  });
  
  await csvWriter.writeRecords(issues);
  console.log(`✓ 问题报告已导出到 ${filePath}`);
}

export function exportSubsetManifest(manifest: SubsetFontManifest[], outputDir: string): void {
  const filePath = path.join(outputDir, 'subset_manifest.json');
  fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2));
  console.log(`✓ 字体子集清单已导出到 ${filePath}`);
}

export function exportPreviewMd(
  products: Product[],
  locales: Locales,
  deviceProfiles: DeviceProfiles,
  issues: Issue[],
  outputDir: string
): void {
  const filePath = path.join(outputDir, 'preview.md');
  
  let markdown = '# 电子价签发布预检报告\n\n';
  
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  
  markdown += `## 摘要\n\n`;
  markdown += `- 产品数量: ${products.length}\n`;
  markdown += `- 错误: ${errorCount}\n`;
  markdown += `- 警告: ${warningCount}\n\n`;
  
  markdown += '## 问题列表\n\n';
  if (issues.length > 0) {
    markdown += '| SKU | Severity | Category | Message |\n';
    markdown += '|-----|----------|----------|---------|\n';
    issues.forEach(issue => {
      markdown += `| ${issue.sku} | ${issue.severity} | ${issue.category} | ${issue.message} |\n`;
    });
  } else {
    markdown += '无问题\n';
  }
  
  markdown += '\n## 产品预览\n\n';
  products.forEach(product => {
    markdown += `### ${product.sku}: ${product.name}\n\n`;
    markdown += `- 价格: ${product.price}\n`;
    if (product.original_price) markdown += `- 原价: ${product.original_price}\n`;
    markdown += `- 标签: ${product.tags.join(', ')}\n`;
    markdown += `- 模板: ${product.template_id}\n`;
    markdown += `- 设备: ${product.device_profile}\n\n`;
    
    const merged = mergeProductWithLocales(product, locales);
    Object.entries(merged.locales).forEach(([locale, localized]) => {
      markdown += `#### ${locale}\n`;
      markdown += `- 本地化标签: ${localized.tags.join(', ')}\n\n`;
    });
  });
  
  fs.writeFileSync(filePath, markdown);
  console.log(`✓ 预览报告已导出到 ${filePath}`);
}

export async function exportAll(
  products: Product[],
  locales: Locales,
  deviceProfiles: DeviceProfiles,
  issues: Issue[],
  subsetManifest: SubsetFontManifest[],
  outputDir: string
): Promise<void> {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  await exportIssuesCsv(issues, outputDir);
  exportSubsetManifest(subsetManifest, outputDir);
  exportPreviewMd(products, locales, deviceProfiles, issues, outputDir);
}

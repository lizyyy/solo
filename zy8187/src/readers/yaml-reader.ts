import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { ReceiptTemplate } from '../types';

export async function readYamlFile(filePath: string): Promise<ReceiptTemplate[]> {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const data = yaml.load(fileContent);
    
    if (Array.isArray(data)) {
      return validateAndTransformTemplates(data);
    } else if (data && typeof data === 'object') {
      if ('templates' in data && Array.isArray((data as any).templates)) {
        return validateAndTransformTemplates((data as any).templates);
      }
      return validateAndTransformTemplates([data as any]);
    }
    
    throw new Error('无效的 YAML 格式');
  } catch (error) {
    throw new Error(`读取 YAML 文件失败: ${(error as Error).message}`);
  }
}

function validateAndTransformTemplates(rawTemplates: any[]): ReceiptTemplate[] {
  return rawTemplates.map((raw, index) => {
    const template: ReceiptTemplate = {
      name: raw.name || `template_${index + 1}`,
      width: validateWidth(raw.width),
      header: validateSections(raw.header || []),
      items: validateItemsSection(raw.items || { columns: [] }),
      footer: validateSections(raw.footer || []),
      commands: validateCommands(raw.commands || {})
    };
    
    return template;
  });
}

function validateWidth(width: any): '58mm' | '80mm' {
  if (width === '58mm' || width === '80mm') {
    return width;
  }
  console.warn(`无效的宽度值: ${width}，默认使用 58mm`);
  return '58mm';
}

function validateSections(rawSections: any[]): any[] {
  return rawSections.map(section => {
    const validated: any = {
      type: section.type || 'text'
    };

    if (section.content !== undefined) validated.content = section.content;
    if (section.align !== undefined) validated.align = section.align;
    if (section.bold !== undefined) validated.bold = section.bold;
    if (section.size !== undefined) validated.size = section.size;
    if (section.lines !== undefined) validated.lines = section.lines;
    if (section.value !== undefined) validated.value = section.value;
    if (section.height !== undefined) validated.height = section.height;

    return validated;
  });
}

function validateItemsSection(rawItems: any): any {
  return {
    columns: (rawItems.columns || []).map((col: any) => ({
      key: col.key || '',
      label: col.label || '',
      width: col.width || 10,
      align: col.align || (col.key === 'quantity' || col.key === 'price' || col.key === 'subtotal' ? 'right' : 'left')
    })),
    separator: rawItems.separator !== false
  };
}

function validateCommands(rawCommands: any): any {
  return {
    cut: rawCommands.cut !== false,
    openDrawer: rawCommands.openDrawer !== false,
    beep: rawCommands.beep || false
  };
}
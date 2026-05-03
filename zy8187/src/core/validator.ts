import { 
  ReceiptTemplate, 
  Transaction, 
  PrinterProfile, 
  ValidationIssue,
  TemplateSection,
  TransactionItem
} from '../types';
import { calculateTextWidth, getWidthForPaperSize } from '../utils/text-width';

export function validateTemplates(
  templates: ReceiptTemplate[],
  transactions: Transaction[],
  printers: PrinterProfile[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const template of templates) {
    issues.push(...validateTemplateStructure(template));
    
    for (const transaction of transactions) {
      issues.push(...validateTemplateAgainstTransaction(template, transaction));
    }
    
    for (const printer of printers) {
      issues.push(...validateTemplateAgainstPrinter(template, printer));
    }
  }

  return issues;
}

function validateTemplateStructure(template: ReceiptTemplate): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const paperWidth = getWidthForPaperSize(template.width);

  issues.push(...validateSections(template.header, paperWidth, 'header', template.name));
  issues.push(...validateItemsSection(template.items, paperWidth, template.name));
  issues.push(...validateSections(template.footer, paperWidth, 'footer', template.name));

  return issues;
}

function validateSections(
  sections: TemplateSection[],
  paperWidth: number,
  sectionType: string,
  templateName: string
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    
    switch (section.type) {
      case 'text':
        issues.push(...validateTextSection(section, paperWidth, sectionType, i, templateName));
        break;
      case 'separator':
        issues.push(...validateSeparatorSection(section, paperWidth, sectionType, i, templateName));
        break;
      case 'barcode':
        issues.push(...validateBarcodeSection(section, paperWidth, sectionType, i, templateName));
        break;
      case 'qrcode':
        issues.push(...validateQRCodeSection(section, paperWidth, sectionType, i, templateName));
        break;
      case 'space':
        break;
    }
  }

  return issues;
}

function validateTextSection(
  section: TemplateSection,
  paperWidth: number,
  sectionType: string,
  index: number,
  templateName: string
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  if (!section.content) {
    issues.push({
      severity: 'warning',
      category: 'missing_content',
      field: 'content',
      message: `${sectionType} 第 ${index + 1} 个文本节缺少内容`,
      templateName
    });
    return issues;
  }

  const textWidth = calculateTextWidth(section.content);
  const maxWidth = section.size === 'double' ? Math.floor(paperWidth / 2) : paperWidth;

  if (textWidth > maxWidth) {
    issues.push({
      severity: 'error',
      category: 'width_overflow',
      field: 'content',
      message: `${sectionType} 第 ${index + 1} 个文本节内容超出宽度限制。内容宽度: ${textWidth}，最大宽度: ${maxWidth}。内容: "${section.content}"`,
      templateName
    });
  }

  return issues;
}

function validateSeparatorSection(
  section: TemplateSection,
  paperWidth: number,
  sectionType: string,
  index: number,
  templateName: string
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  if (section.content && section.content.length > paperWidth) {
    issues.push({
      severity: 'warning',
      category: 'width_overflow',
      field: 'content',
      message: `${sectionType} 第 ${index + 1} 个分隔符内容超出宽度限制`,
      templateName
    });
  }

  return issues;
}

function validateBarcodeSection(
  section: TemplateSection,
  paperWidth: number,
  sectionType: string,
  index: number,
  templateName: string
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  if (!section.value) {
    issues.push({
      severity: 'warning',
      category: 'missing_value',
      field: 'value',
      message: `${sectionType} 第 ${index + 1} 个条码节缺少值`,
      templateName
    });
  }

  if (section.height && (section.height < 10 || section.height > 200)) {
    issues.push({
      severity: 'warning',
      category: 'invalid_height',
      field: 'height',
      message: `${sectionType} 第 ${index + 1} 个条码节高度超出合理范围 (10-200)`,
      templateName
    });
  }

  return issues;
}

function validateQRCodeSection(
  section: TemplateSection,
  paperWidth: number,
  sectionType: string,
  index: number,
  templateName: string
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  if (!section.value) {
    issues.push({
      severity: 'warning',
      category: 'missing_value',
      field: 'value',
      message: `${sectionType} 第 ${index + 1} 个二维码节缺少值`,
      templateName
    });
  }

  return issues;
}

function validateItemsSection(
  itemsSection: any,
  paperWidth: number,
  templateName: string
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  if (!itemsSection.columns || itemsSection.columns.length === 0) {
    issues.push({
      severity: 'error',
      category: 'missing_columns',
      field: 'items.columns',
      message: '商品列表缺少列定义',
      templateName
    });
    return issues;
  }

  const totalWidth = itemsSection.columns.reduce((sum: number, col: any) => sum + (col.width || 0), 0);
  
  if (totalWidth > paperWidth) {
    issues.push({
      severity: 'error',
      category: 'width_overflow',
      field: 'items.columns',
      message: `商品列表列总宽度超出纸张宽度。总宽度: ${totalWidth}，纸张宽度: ${paperWidth}`,
      templateName
    });
  }

  for (let i = 0; i < itemsSection.columns.length; i++) {
    const col = itemsSection.columns[i];
    
    if (!col.key) {
      issues.push({
        severity: 'warning',
        category: 'missing_key',
        field: `items.columns[${i}].key`,
        message: `商品列表第 ${i + 1} 列缺少 key`,
        templateName
      });
    }

    if (!col.width || col.width <= 0) {
      issues.push({
        severity: 'warning',
        category: 'invalid_width',
        field: `items.columns[${i}].width`,
        message: `商品列表第 ${i + 1} 列宽度无效`,
        templateName
      });
    }
  }

  return issues;
}

function validateTemplateAgainstTransaction(
  template: ReceiptTemplate,
  transaction: Transaction
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const paperWidth = getWidthForPaperSize(template.width);

  issues.push(...validateVariableContent(template, transaction, paperWidth));
  issues.push(...validateItemsContent(template, transaction.items, paperWidth));
  issues.push(...validateAmountsAlignment(template, transaction, paperWidth));

  return issues;
}

function validateVariableContent(
  template: ReceiptTemplate,
  transaction: Transaction,
  paperWidth: number
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  const allSections = [...template.header, ...template.footer];
  
  for (let i = 0; i < allSections.length; i++) {
    const section = allSections[i];
    if (section.type === 'text' && section.content) {
      const variables = extractVariables(section.content);
      for (const variable of variables) {
        const value = getVariableValue(transaction, variable);
        if (value === undefined || value === null) {
          issues.push({
            severity: 'warning',
            category: 'missing_variable',
            field: variable,
            message: `模板中引用的变量 "${variable}" 在交易数据中不存在`,
            transactionId: transaction.id,
            templateName: template.name
          });
        } else {
          const valueStr = String(value);
          const valueWidth = calculateTextWidth(valueStr);
          const maxWidth = section.size === 'double' ? Math.floor(paperWidth / 2) : paperWidth;
          
          if (valueWidth > maxWidth) {
            issues.push({
              severity: 'error',
              category: 'width_overflow',
              field: variable,
              message: `变量 "${variable}" 的值 "${valueStr}" 超出宽度限制。宽度: ${valueWidth}，最大: ${maxWidth}`,
              transactionId: transaction.id,
              templateName: template.name
            });
          }
        }
      }
    }
  }

  return issues;
}

function validateItemsContent(
  template: ReceiptTemplate,
  items: TransactionItem[],
  paperWidth: number
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
    const item = items[itemIndex];
    
    for (const col of template.items.columns) {
      const value = getItemValue(item, col.key);
      if (value === undefined) {
        issues.push({
          severity: 'warning',
          category: 'missing_field',
          field: `items.${col.key}`,
          message: `商品 ${itemIndex + 1} 缺少字段 "${col.key}"`,
          templateName: template.name
        });
      } else {
        const valueStr = String(value);
        const valueWidth = calculateTextWidth(valueStr);
        
        if (valueWidth > col.width) {
          issues.push({
            severity: 'warning',
            category: 'width_overflow',
            field: `items.${col.key}`,
            message: `商品 ${itemIndex + 1} 的 "${col.key}" 值 "${valueStr}" 超出列宽限制。宽度: ${valueWidth}，列宽: ${col.width}`,
            templateName: template.name
          });
        }
      }
    }
  }

  return issues;
}

function validateAmountsAlignment(
  template: ReceiptTemplate,
  transaction: Transaction,
  paperWidth: number
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  const amountFields = ['subtotal', 'tax', 'discount', 'total'];
  
  for (const field of amountFields) {
    const value = (transaction as any)[field];
    if (value !== undefined && value !== null) {
      const formatted = formatAmount(value);
      const formattedWidth = calculateTextWidth(formatted);
      
      if (formattedWidth > paperWidth) {
        issues.push({
          severity: 'error',
          category: 'width_overflow',
          field,
          message: `金额 "${formatted}" 超出纸张宽度。宽度: ${formattedWidth}，纸张宽度: ${paperWidth}`,
          transactionId: transaction.id,
          templateName: template.name
        });
      }
    }
  }

  return issues;
}

function validateTemplateAgainstPrinter(
  template: ReceiptTemplate,
  printer: PrinterProfile
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (template.width !== printer.width) {
    issues.push({
      severity: 'warning',
      category: 'width_mismatch',
      message: `模板宽度 ${template.width} 与打印机 ${printer.model} 的宽度 ${printer.width} 不匹配`,
      templateName: template.name,
      printerModel: printer.model
    });
  }

  const allSections = [...template.header, ...template.footer];
  
  for (const section of allSections) {
    if (section.type === 'barcode' && !printer.supportsBarcode) {
      issues.push({
        severity: 'error',
        category: 'unsupported_feature',
        message: `打印机 ${printer.model} 不支持条码打印，但模板中包含条码`,
        templateName: template.name,
        printerModel: printer.model
      });
    }
    
    if (section.type === 'qrcode' && !printer.supportsQRCode) {
      issues.push({
        severity: 'error',
        category: 'unsupported_feature',
        message: `打印机 ${printer.model} 不支持二维码打印，但模板中包含二维码`,
        templateName: template.name,
        printerModel: printer.model
      });
    }

    if (section.type === 'barcode' && section.height && section.height > printer.maxBarcodeHeight) {
      issues.push({
        severity: 'warning',
        category: 'invalid_height',
        message: `条码高度 ${section.height} 超出打印机 ${printer.model} 最大支持高度 ${printer.maxBarcodeHeight}`,
        templateName: template.name,
        printerModel: printer.model
      });
    }
  }

  if (template.commands.cut && !printer.supportsCut) {
    issues.push({
      severity: 'error',
      category: 'unsupported_command',
      message: `打印机 ${printer.model} 不支持切纸命令，但模板中启用了切纸`,
      templateName: template.name,
      printerModel: printer.model
    });
  }

  if (template.commands.openDrawer && !printer.supportsOpenDrawer) {
    issues.push({
      severity: 'error',
      category: 'unsupported_command',
      message: `打印机 ${printer.model} 不支持开钱箱命令，但模板中启用了开钱箱`,
      templateName: template.name,
      printerModel: printer.model
    });
  }

  return issues;
}

function extractVariables(content: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const variables: string[] = [];
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    variables.push(match[1].trim());
  }
  
  return variables;
}

function getVariableValue(transaction: Transaction, variable: string): any {
  const parts = variable.split('.');
  let value: any = transaction;
  
  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = value[part];
    } else {
      return undefined;
    }
  }
  
  return value;
}

function getItemValue(item: TransactionItem, key: string): any {
  return (item as any)[key];
}

function formatAmount(amount: number): string {
  return amount.toFixed(2);
}
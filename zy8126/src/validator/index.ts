import {
  Transaction,
  TransactionItem,
  Template,
  TemplateElement,
  RenderedReceipt,
  RenderedLine,
  ValidationIssue,
  ValidationResult,
  IssueSeverity,
  PrinterProfile,
} from '../types';
import { LayoutEngine } from '../layout-engine';

export class Validator {
  private layoutEngine: LayoutEngine;
  private printerProfile: PrinterProfile;
  private issues: ValidationIssue[] = [];
  private issueIdCounter = 0;

  constructor(printerProfile: PrinterProfile) {
    this.printerProfile = printerProfile;
    this.layoutEngine = new LayoutEngine(printerProfile);
  }

  private createIssue(
    type: string,
    severity: IssueSeverity,
    message: string,
    options: {
      templateName?: string;
      transactionId?: string;
      elementIndex?: number;
      lineNumber?: number;
      field?: string;
      expected?: string;
      actual?: string;
      context?: Record<string, unknown>;
    } = {}
  ): ValidationIssue {
    return {
      id: `ISSUE-${++this.issueIdCounter}`,
      type,
      severity,
      message,
      ...options,
    };
  }

  validateAmountRounding(transaction: Transaction): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    const calculatedSubtotal = transaction.items.reduce(
      (sum, item) => sum + item.totalPrice,
      0
    );

    if (Math.abs(calculatedSubtotal - transaction.subtotal) > 0.001) {
      issues.push(
        this.createIssue(
          'AMOUNT_ROUNDING_ERROR',
          'error',
          `小计金额不匹配: 计算值 ${calculatedSubtotal.toFixed(2)} 与报表值 ${transaction.subtotal.toFixed(2)} 不一致`,
          {
            transactionId: transaction.id,
            field: 'subtotal',
            expected: calculatedSubtotal.toFixed(2),
            actual: transaction.subtotal.toFixed(2),
            context: {
              itemsCount: transaction.items.length,
            },
          }
        )
      );
    }

    for (let i = 0; i < transaction.items.length; i++) {
      const item = transaction.items[i];
      const calculatedTotal = item.unitPrice * item.quantity;

      if (Math.abs(calculatedTotal - item.totalPrice) > 0.001) {
        issues.push(
          this.createIssue(
            'AMOUNT_ROUNDING_ERROR',
            'error',
            `商品 "${item.name}" 金额不匹配: 单价 x 数量 = ${calculatedTotal.toFixed(2)}, 报表值 = ${item.totalPrice.toFixed(2)}`,
            {
              transactionId: transaction.id,
              field: `items[${i}].totalPrice`,
              expected: calculatedTotal.toFixed(2),
              actual: item.totalPrice.toFixed(2),
              context: {
                itemName: item.name,
                unitPrice: item.unitPrice,
                quantity: item.quantity,
              },
            }
          )
        );
      }
    }

    const calculatedGrandTotal =
      transaction.subtotal + transaction.taxTotal - transaction.discountTotal;

    if (Math.abs(calculatedGrandTotal - transaction.grandTotal) > 0.001) {
      issues.push(
        this.createIssue(
          'AMOUNT_ROUNDING_ERROR',
          'error',
          `总计金额不匹配: 计算值 ${calculatedGrandTotal.toFixed(2)} 与报表值 ${transaction.grandTotal.toFixed(2)} 不一致`,
          {
            transactionId: transaction.id,
            field: 'grandTotal',
            expected: calculatedGrandTotal.toFixed(2),
            actual: transaction.grandTotal.toFixed(2),
            context: {
              subtotal: transaction.subtotal,
              taxTotal: transaction.taxTotal,
              discountTotal: transaction.discountTotal,
            },
          }
        )
      );
    }

    const calculatedChange = transaction.paymentAmount - transaction.grandTotal;
    if (Math.abs(calculatedChange - transaction.changeAmount) > 0.001) {
      issues.push(
        this.createIssue(
          'AMOUNT_ROUNDING_ERROR',
          'error',
          `找零金额不匹配: 计算值 ${calculatedChange.toFixed(2)} 与报表值 ${transaction.changeAmount.toFixed(2)} 不一致`,
          {
            transactionId: transaction.id,
            field: 'changeAmount',
            expected: calculatedChange.toFixed(2),
            actual: transaction.changeAmount.toFixed(2),
          }
        )
      );
    }

    return issues;
  }

  validateTaxRates(transaction: Transaction): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const validTaxRates = [0, 0.06, 0.09, 0.13];

    let calculatedTaxTotal = 0;

    for (let i = 0; i < transaction.items.length; i++) {
      const item = transaction.items[i];

      if (item.taxRate === undefined || item.taxRate === null) {
        issues.push(
          this.createIssue(
            'MISSING_FIELD',
            'warning',
            `商品 "${item.name}" 缺少税率信息`,
            {
              transactionId: transaction.id,
              field: `items[${i}].taxRate`,
              context: { itemName: item.name },
            }
          )
        );
        continue;
      }

      if (!validTaxRates.includes(item.taxRate)) {
        issues.push(
          this.createIssue(
            'INVALID_TAX_RATE',
            'error',
            `商品 "${item.name}" 税率 ${item.taxRate * 100}% 不在有效范围内 (0%, 6%, 9%, 13%)`,
            {
              transactionId: transaction.id,
              field: `items[${i}].taxRate`,
              expected: '0, 0.06, 0.09, 0.13 之一',
              actual: String(item.taxRate),
              context: { itemName: item.name },
            }
          )
        );
      }

      const expectedTaxAmount = item.totalPrice * item.taxRate;
      if (item.taxAmount !== undefined) {
        calculatedTaxTotal += item.taxAmount;

        if (Math.abs(expectedTaxAmount - item.taxAmount) > 0.01) {
          issues.push(
            this.createIssue(
              'TAX_CALCULATION_ERROR',
              'error',
              `商品 "${item.name}" 税额计算错误: 预期 ${expectedTaxAmount.toFixed(2)}, 实际 ${item.taxAmount.toFixed(2)}`,
              {
                transactionId: transaction.id,
                field: `items[${i}].taxAmount`,
                expected: expectedTaxAmount.toFixed(2),
                actual: item.taxAmount.toFixed(2),
                context: {
                  itemName: item.name,
                  totalPrice: item.totalPrice,
                  taxRate: item.taxRate,
                },
              }
            )
          );
        }
      }
    }

    if (Math.abs(calculatedTaxTotal - transaction.taxTotal) > 0.01 && transaction.items.length > 0) {
      issues.push(
        this.createIssue(
          'TAX_SUMMARY_ERROR',
          'error',
          `税额汇总不匹配: 商品税额总和 ${calculatedTaxTotal.toFixed(2)} 与报表税额 ${transaction.taxTotal.toFixed(2)} 不一致`,
          {
            transactionId: transaction.id,
            field: 'taxTotal',
            expected: calculatedTaxTotal.toFixed(2),
            actual: transaction.taxTotal.toFixed(2),
          }
        )
      );
    }

    return issues;
  }

  validateTemplateElements(template: Template): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!template.elements || template.elements.length === 0) {
      issues.push(
        this.createIssue(
          'MISSING_FIELD',
          'error',
          '模板缺少元素列表',
          {
            templateName: template.name,
            field: 'elements',
          }
        )
      );
      return issues;
    }

    for (let i = 0; i < template.elements.length; i++) {
      const element = template.elements[i];

      switch (element.type) {
        case 'text':
        case 'section':
          if (!element.content) {
            issues.push(
              this.createIssue(
                'MISSING_FIELD',
                'warning',
                `文本元素缺少内容`,
                {
                  templateName: template.name,
                  elementIndex: i,
                  field: `elements[${i}].content`,
                }
              )
            );
          }
          break;

        case 'barcode':
          if (!this.printerProfile.hasBarcode) {
            issues.push(
              this.createIssue(
                'FEATURE_UNSUPPORTED',
                'warning',
                `打印机配置不支持条码，但模板包含条码元素`,
                {
                  templateName: template.name,
                  elementIndex: i,
                  field: `elements[${i}].type`,
                  context: { barcodeType: element.barcodeType },
                }
              )
            );
          }
          if (!element.barcodeData) {
            issues.push(
              this.createIssue(
                'MISSING_FIELD',
                'error',
                `条码元素缺少数据`,
                {
                  templateName: template.name,
                  elementIndex: i,
                  field: `elements[${i}].barcodeData`,
                }
              )
            );
          }
          break;

        case 'qrcode':
          if (!element.qrcodeData) {
            issues.push(
              this.createIssue(
                'MISSING_FIELD',
                'error',
                `二维码元素缺少数据`,
                {
                  templateName: template.name,
                  elementIndex: i,
                  field: `elements[${i}].qrcodeData`,
                }
              )
            );
          }
          break;

        case 'table':
          if (!element.columns || element.columns.length === 0) {
            issues.push(
              this.createIssue(
                'MISSING_FIELD',
                'warning',
                `表格元素缺少列定义`,
                {
                  templateName: template.name,
                  elementIndex: i,
                  field: `elements[${i}].columns`,
                }
              )
            );
          }
          break;

        case 'space':
          if (element.lines !== undefined && element.lines < 0) {
            issues.push(
              this.createIssue(
                'INVALID_VALUE',
                'error',
                `空行元素行数不能为负数`,
                {
                  templateName: template.name,
                  elementIndex: i,
                  field: `elements[${i}].lines`,
                  expected: '>= 0',
                  actual: String(element.lines),
                }
              )
            );
          }
          break;
      }
    }

    return issues;
  }

  validateCJKAndEmojiWidth(
    renderedReceipt: RenderedReceipt,
    templateName: string
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const maxWidth = this.printerProfile.charsPerLine;

    for (let lineIndex = 0; lineIndex < renderedReceipt.lines.length; lineIndex++) {
      const line = renderedReceipt.lines[lineIndex];
      const visualWidth = this.layoutEngine.calculateVisualWidth(line.text.trim());

      for (let charIndex = 0; charIndex < line.text.length; charIndex++) {
        const char = line.text[charIndex];
        const code = line.text.charCodeAt(charIndex);

        if (
          (code >= 0x1F600 && code <= 0x1F64F) ||
          (code >= 0x1F300 && code <= 0x1F5FF) ||
          (code >= 0x1F680 && code <= 0x1F6FF) ||
          (code >= 0x1F1E0 && code <= 0x1F1FF)
        ) {
          issues.push(
            this.createIssue(
              'EMOJI_DETECTED',
              'warning',
              `检测到 Emoji 字符，热敏打印机可能不支持: "${char}"`,
              {
                templateName,
                transactionId: renderedReceipt.transactionId,
                lineNumber: lineIndex + 1,
                context: {
                  character: char,
                  codePoint: code.toString(16),
                },
              }
            )
          );
        }
      }

      if (visualWidth > maxWidth) {
        issues.push(
          this.createIssue(
            'LINE_OVERFLOW',
            'error',
            `行内容超出纸宽限制: 视觉宽度 ${visualWidth} > 最大宽度 ${maxWidth}`,
            {
              templateName,
              transactionId: renderedReceipt.transactionId,
              lineNumber: lineIndex + 1,
              expected: `<= ${maxWidth}`,
              actual: String(visualWidth),
              context: {
                text: line.text.substring(0, 50),
              },
            }
          )
        );
      }
    }

    return issues;
  }

  validatePageBreakRisk(
    renderedReceipt: RenderedReceipt,
    templateName: string
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (this.printerProfile.maxLinesPerPage) {
      const maxLines = this.printerProfile.maxLinesPerPage;
      const totalLines = renderedReceipt.totalLines;

      if (totalLines > maxLines) {
        issues.push(
          this.createIssue(
            'PAGE_BREAK_RISK',
            'warning',
            `小票内容超过单页限制: ${totalLines} 行 > ${maxLines} 行，可能需要分页`,
            {
              templateName,
              transactionId: renderedReceipt.transactionId,
              expected: `<= ${maxLines}`,
              actual: String(totalLines),
              context: {
                overflow: totalLines - maxLines,
              },
            }
          )
        );
      }

      const linesPerPage = maxLines;
      const pages = Math.ceil(totalLines / linesPerPage);

      for (let page = 1; page < pages; page++) {
        const breakLine = page * linesPerPage;
        const beforeLine = renderedReceipt.lines[breakLine - 1];
        const afterLine = renderedReceipt.lines[breakLine];

        if (beforeLine && afterLine) {
          const beforeText = beforeLine.text.trim();
          const afterText = afterLine.text.trim();

          if (beforeText.includes('小计') || beforeText.includes('合计')) {
            issues.push(
              this.createIssue(
                'PAGE_BREAK_POSITION',
                'info',
                `分页位置靠近合计行 (第 ${breakLine} 行)，建议检查格式`,
                {
                  templateName,
                  transactionId: renderedReceipt.transactionId,
                  lineNumber: breakLine,
                  context: {
                    page,
                    pages,
                  },
                }
              )
            );
          }
        }
      }
    }

    return issues;
  }

  validateMissingFields(transaction: Transaction): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const requiredFields: Array<{ key: keyof Transaction; name: string }> = [
      { key: 'id', name: '交易ID' },
      { key: 'timestamp', name: '时间戳' },
      { key: 'type', name: '交易类型' },
      { key: 'items', name: '商品列表' },
      { key: 'subtotal', name: '小计' },
      { key: 'taxTotal', name: '税额' },
      { key: 'grandTotal', name: '总计' },
      { key: 'paymentMethod', name: '支付方式' },
      { key: 'paymentAmount', name: '支付金额' },
      { key: 'changeAmount', name: '找零' },
    ];

    for (const field of requiredFields) {
      const value = transaction[field.key];
      if (value === undefined || value === null) {
        issues.push(
          this.createIssue(
            'MISSING_FIELD',
            'error',
            `缺少必要字段: ${field.name}`,
            {
              transactionId: transaction.id,
              field: field.key,
            }
          )
        );
      }
    }

    if (transaction.items && transaction.items.length === 0) {
      issues.push(
        this.createIssue(
          'EMPTY_ITEMS',
          'error',
          '商品列表为空',
          {
            transactionId: transaction.id,
            field: 'items',
          }
        )
      );
    }

    for (let i = 0; i < transaction.items.length; i++) {
      const item = transaction.items[i];
      const requiredItemFields: Array<{ key: keyof TransactionItem; name: string }> = [
        { key: 'name', name: '商品名称' },
        { key: 'quantity', name: '数量' },
        { key: 'unitPrice', name: '单价' },
        { key: 'totalPrice', name: '总价' },
      ];

      for (const field of requiredItemFields) {
        const value = item[field.key];
        if (value === undefined || value === null) {
          issues.push(
            this.createIssue(
              'MISSING_FIELD',
              'error',
              `商品 ${i + 1} 缺少必要字段: ${field.name}`,
              {
                transactionId: transaction.id,
                field: `items[${i}].${field.key}`,
              }
            )
          );
        }
      }

      if (item.name && this.layoutEngine.calculateVisualWidth(item.name) > 24) {
        issues.push(
          this.createIssue(
            'PRODUCT_NAME_TOO_LONG',
            'warning',
            `商品名称过长，可能导致表格布局异常: "${item.name}" (视觉宽度: ${this.layoutEngine.calculateVisualWidth(item.name)})`,
            {
              transactionId: transaction.id,
              field: `items[${i}].name`,
              expected: '<= 24 个字符宽度',
              actual: String(this.layoutEngine.calculateVisualWidth(item.name)),
              context: { itemName: item.name },
            }
          )
        );
      }
    }

    return issues;
  }

  validate(
    template: Template,
    transaction: Transaction,
    renderedReceipt: RenderedReceipt
  ): ValidationResult {
    const allIssues: ValidationIssue[] = [];

    allIssues.push(...this.validateMissingFields(transaction));
    allIssues.push(...this.validateAmountRounding(transaction));
    allIssues.push(...this.validateTaxRates(transaction));
    allIssues.push(...this.validateTemplateElements(template));
    allIssues.push(...this.validateCJKAndEmojiWidth(renderedReceipt, template.name));
    allIssues.push(...this.validatePageBreakRisk(renderedReceipt, template.name));

    const errors = allIssues.filter((i) => i.severity === 'error').length;
    const warnings = allIssues.filter((i) => i.severity === 'warning').length;
    const infos = allIssues.filter((i) => i.severity === 'info').length;

    return {
      templateName: template.name,
      transactionId: transaction.id,
      issues: allIssues,
      statistics: {
        total: allIssues.length,
        errors,
        warnings,
        infos,
      },
    };
  }
}

import { 
  ReceiptTemplate, 
  Transaction, 
  PrinterProfile, 
  RenderedReceipt,
  RenderedLine,
  CommandInfo,
  TemplateSection
} from '../types';
import { calculateTextWidth, alignText, getWidthForPaperSize, truncateText } from '../utils/text-width';

export function renderReceipts(
  template: ReceiptTemplate,
  transactions: Transaction[],
  printers: PrinterProfile[]
): RenderedReceipt[] {
  return transactions.map(transaction => 
    renderReceipt(template, transaction, printers)
  );
}

function renderReceipt(
  template: ReceiptTemplate,
  transaction: Transaction,
  printers: PrinterProfile[]
): RenderedReceipt {
  const paperWidth = getWidthForPaperSize(template.width);
  const lines: RenderedLine[] = [];

  lines.push(...renderSections(template.header, transaction, paperWidth));
  lines.push(...renderItemsSection(template.items, transaction, paperWidth));
  lines.push(...renderSections(template.footer, transaction, paperWidth));

  const commands: CommandInfo[] = renderCommands(template, printers);

  return {
    transactionId: transaction.id,
    templateName: template.name,
    width: template.width,
    lines,
    commands
  };
}

function renderSections(
  sections: TemplateSection[],
  transaction: Transaction,
  paperWidth: number
): RenderedLine[] {
  const lines: RenderedLine[] = [];

  for (const section of sections) {
    switch (section.type) {
      case 'text':
        lines.push(...renderTextSection(section, transaction, paperWidth));
        break;
      case 'separator':
        lines.push(renderSeparatorSection(section, paperWidth));
        break;
      case 'barcode':
        lines.push(renderBarcodeSection(section, transaction, paperWidth));
        break;
      case 'qrcode':
        lines.push(renderQRCodeSection(section, transaction, paperWidth));
        break;
      case 'space':
        lines.push(...renderSpaceSection(section));
        break;
    }
  }

  return lines;
}

function renderTextSection(
  section: TemplateSection,
  transaction: Transaction,
  paperWidth: number
): RenderedLine[] {
  const lines: RenderedLine[] = [];
  
  if (!section.content) {
    return lines;
  }

  const processedContent = processVariables(section.content, transaction);
  const align = section.align || 'left';
  
  const textLines = wrapText(processedContent, paperWidth);
  
  for (const line of textLines) {
    lines.push({
      content: alignText(line, paperWidth, align),
      type: 'text',
      width: paperWidth,
      align
    });
  }

  return lines;
}

function renderSeparatorSection(
  section: TemplateSection,
  paperWidth: number
): RenderedLine {
  const separatorChar = section.content && section.content.length > 0 ? section.content[0] : '-';
  const content = separatorChar.repeat(paperWidth);
  
  return {
    content,
    type: 'separator',
    width: paperWidth,
    align: 'left'
  };
}

function renderBarcodeSection(
  section: TemplateSection,
  transaction: Transaction,
  paperWidth: number
): RenderedLine {
  const value = section.value ? processVariables(section.value, transaction) : 'BARCODE';
  
  return {
    content: value,
    type: 'barcode',
    width: paperWidth,
    align: 'center'
  };
}

function renderQRCodeSection(
  section: TemplateSection,
  transaction: Transaction,
  paperWidth: number
): RenderedLine {
  const value = section.value ? processVariables(section.value, transaction) : 'QRCODE';
  
  return {
    content: value,
    type: 'qrcode',
    width: paperWidth,
    align: 'center'
  };
}

function renderSpaceSection(section: TemplateSection): RenderedLine[] {
  const lines: RenderedLine[] = [];
  const lineCount = section.lines || 1;
  
  for (let i = 0; i < lineCount; i++) {
    lines.push({
      content: '',
      type: 'space',
      width: 0,
      align: 'left'
    });
  }
  
  return lines;
}

function renderItemsSection(
  itemsSection: any,
  transaction: Transaction,
  paperWidth: number
): RenderedLine[] {
  const lines: RenderedLine[] = [];
  
  if (!itemsSection.columns || itemsSection.columns.length === 0) {
    return lines;
  }

  const headerLine = renderItemsHeader(itemsSection.columns, paperWidth);
  lines.push(headerLine);

  if (itemsSection.separator !== false) {
    lines.push({
      content: '-'.repeat(paperWidth),
      type: 'separator',
      width: paperWidth,
      align: 'left'
    });
  }

  for (const item of transaction.items) {
    lines.push(...renderItemRow(item, itemsSection.columns, paperWidth));
  }

  return lines;
}

function renderItemsHeader(
  columns: any[],
  paperWidth: number
): RenderedLine {
  let content = '';
  
  for (const col of columns) {
    const label = col.label || col.key || '';
    const truncatedLabel = truncateText(label, col.width);
    const alignedLabel = alignText(truncatedLabel, col.width, col.align || 'left');
    content += alignedLabel;
  }

  return {
    content,
    type: 'text',
    width: paperWidth,
    align: 'left'
  };
}

function renderItemRow(
  item: any,
  columns: any[],
  paperWidth: number
): RenderedLine[] {
  const lines: RenderedLine[] = [];
  
  let rowContent = '';
  const wrappedColumns: string[][] = [];
  
  for (const col of columns) {
    const value = getItemValue(item, col.key);
    const valueStr = formatColumnValue(value, col.key);
    const wrapped = wrapTextToColumn(valueStr, col.width);
    wrappedColumns.push(wrapped);
  }
  
  const maxLines = Math.max(...wrappedColumns.map(c => c.length));
  
  for (let lineIndex = 0; lineIndex < maxLines; lineIndex++) {
    let lineContent = '';
    
    for (let colIndex = 0; colIndex < columns.length; colIndex++) {
      const col = columns[colIndex];
      const wrapped = wrappedColumns[colIndex];
      const cellValue = wrapped[lineIndex] || '';
      const alignedValue = alignText(cellValue, col.width, col.align || 'left');
      lineContent += alignedValue;
    }
    
    lines.push({
      content: lineContent,
      type: 'text',
      width: paperWidth,
      align: 'left'
    });
  }

  return lines;
}

function renderCommands(
  template: ReceiptTemplate,
  printers: PrinterProfile[]
): CommandInfo[] {
  const commands: CommandInfo[] = [];
  
  for (const printer of printers) {
    if (template.commands.cut) {
      commands.push({
        type: 'cut',
        supported: printer.supportsCut,
        printerModel: printer.model
      });
    }
    
    if (template.commands.openDrawer) {
      commands.push({
        type: 'openDrawer',
        supported: printer.supportsOpenDrawer,
        printerModel: printer.model
      });
    }
    
    if (template.commands.beep) {
      commands.push({
        type: 'beep',
        supported: true,
        printerModel: printer.model
      });
    }
  }

  return commands;
}

function processVariables(content: string, transaction: Transaction): string {
  return content.replace(/\{\{([^}]+)\}\}/g, (match, variable) => {
    const value = getVariableValue(transaction, variable.trim());
    return value !== undefined ? String(value) : match;
  });
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
  
  if (typeof value === 'number') {
    if (variable.includes('price') || variable.includes('subtotal') || 
        variable.includes('total') || variable.includes('tax') || 
        variable.includes('discount') || variable.includes('amount') ||
        variable.includes('change')) {
      return value.toFixed(2);
    }
  }
  
  return value;
}

function getItemValue(item: any, key: string): any {
  return (item as any)[key];
}

function formatColumnValue(value: any, key: string): string {
  if (value === undefined || value === null) {
    return '';
  }
  
  if (typeof value === 'number') {
    if (key === 'quantity') {
      return String(value);
    }
    if (key === 'price' || key === 'subtotal') {
      return value.toFixed(2);
    }
  }
  
  return String(value);
}

function wrapText(text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let currentLine = '';
  let currentWidth = 0;
  
  for (const char of text) {
    const charWidth = calculateTextWidth(char);
    
    if (char === '\n') {
      lines.push(currentLine);
      currentLine = '';
      currentWidth = 0;
      continue;
    }
    
    if (currentWidth + charWidth > maxWidth) {
      lines.push(currentLine);
      currentLine = char;
      currentWidth = charWidth;
    } else {
      currentLine += char;
      currentWidth += charWidth;
    }
  }
  
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }
  
  return lines.length > 0 ? lines : [''];
}

function wrapTextToColumn(text: string, columnWidth: number): string[] {
  const lines: string[] = [];
  const originalLines = wrapText(text, columnWidth);
  
  for (const line of originalLines) {
    const lineWidth = calculateTextWidth(line);
    if (lineWidth > columnWidth) {
      lines.push(truncateText(line, columnWidth));
    } else {
      lines.push(line);
    }
  }
  
  return lines;
}
import {
  Template,
  Transaction,
  TransactionItem,
  PrinterProfile,
  TemplateElement,
  RenderedLine,
  RenderedReceipt,
} from '../types';

export class LayoutEngine {
  private printerProfile: PrinterProfile;

  constructor(printerProfile: PrinterProfile) {
    this.printerProfile = printerProfile;
  }

  calculateVisualWidth(text: string): number {
    let width = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const code = text.charCodeAt(i);
      
      if (this.isCJKCharacter(char, code)) {
        width += 2;
      } else if (this.isEmoji(code)) {
        width += 2;
      } else if (this.isHalfWidthKatakana(char)) {
        width += 1;
      } else {
        width += 1;
      }
    }
    return width;
  }

  private isCJKCharacter(char: string, code: number): boolean {
    return (
      (code >= 0x4E00 && code <= 0x9FFF) ||
      (code >= 0x3040 && code <= 0x309F) ||
      (code >= 0x30A0 && code <= 0x30FF) ||
      (code >= 0xFF01 && code <= 0xFF5E) ||
      (code >= 0x3130 && code <= 0x318F) ||
      (code >= 0xAC00 && code <= 0xD7AF) ||
      char === '￥' ||
      char === '€'
    );
  }

  private isEmoji(code: number): boolean {
    return (
      (code >= 0x1F600 && code <= 0x1F64F) ||
      (code >= 0x1F300 && code <= 0x1F5FF) ||
      (code >= 0x1F680 && code <= 0x1F6FF) ||
      (code >= 0x1F1E0 && code <= 0x1F1FF) ||
      (code >= 0x2600 && code <= 0x26FF) ||
      (code >= 0x2700 && code <= 0x27BF)
    );
  }

  private isHalfWidthKatakana(char: string): boolean {
    const code = char.charCodeAt(0);
    return code >= 0xFF61 && code <= 0xFF9F;
  }

  padToWidth(text: string, width: number, align: 'left' | 'center' | 'right' = 'left'): string {
    const visualWidth = this.calculateVisualWidth(text);
    if (visualWidth >= width) {
      return this.truncateToWidth(text, width);
    }
    
    const padding = width - visualWidth;
    
    if (align === 'right') {
      return ' '.repeat(padding) + text;
    } else if (align === 'center') {
      const leftPadding = Math.floor(padding / 2);
      const rightPadding = padding - leftPadding;
      return ' '.repeat(leftPadding) + text + ' '.repeat(rightPadding);
    }
    
    return text + ' '.repeat(padding);
  }

  truncateToWidth(text: string, width: number): string {
    let result = '';
    let currentWidth = 0;
    
    for (let i = 0; i < text.length && currentWidth < width; i++) {
      const char = text[i];
      const charWidth = this.isCJKCharacter(char, text.charCodeAt(i)) || 
                         this.isEmoji(text.charCodeAt(i)) ? 2 : 1;
      
      if (currentWidth + charWidth > width) {
        break;
      }
      
      result += char;
      currentWidth += charWidth;
    }
    
    return result;
  }

  createSeparatorLine(character: string = '-'): string {
    return character.repeat(this.printerProfile.charsPerLine);
  }

  renderTextElement(element: TemplateElement, elementIndex: number): RenderedLine[] {
    const lines: RenderedLine[] = [];
    const content = element.content || '';
    const align = element.align || 'left';
    const maxWidth = this.printerProfile.charsPerLine;
    
    const paragraphs = content.split('\n');
    
    for (const paragraph of paragraphs) {
      if (paragraph === '') {
        lines.push({
          text: ' '.repeat(maxWidth),
          originalWidth: 0,
          visualWidth: maxWidth,
          align: 'left',
          style: {
            bold: element.bold,
            doubleWidth: element.doubleWidth,
            doubleHeight: element.doubleHeight,
          },
          elementIndex,
        });
        continue;
      }
      
      const wrappedLines = this.wrapText(paragraph, maxWidth);
      
      for (const line of wrappedLines) {
        const visualWidth = this.calculateVisualWidth(line);
        lines.push({
          text: this.padToWidth(line, maxWidth, align),
          originalWidth: line.length,
          visualWidth,
          align,
          style: {
            bold: element.bold,
            doubleWidth: element.doubleWidth,
            doubleHeight: element.doubleHeight,
          },
          elementIndex,
        });
      }
    }
    
    return lines;
  }

  private wrapText(text: string, maxWidth: number): string[] {
    const lines: string[] = [];
    let currentLine = '';
    let currentWidth = 0;
    
    const words = text.split(/(\s+)/);
    
    for (const word of words) {
      const wordWidth = this.calculateVisualWidth(word);
      
      if (wordWidth > maxWidth) {
        if (currentLine.length > 0) {
          lines.push(currentLine);
          currentLine = '';
          currentWidth = 0;
        }
        
        let remaining = word;
        while (remaining.length > 0) {
          const chunk = this.truncateToWidth(remaining, maxWidth);
          lines.push(chunk);
          const chunkWidth = this.calculateVisualWidth(chunk);
          remaining = remaining.substring(this.countCharsForWidth(remaining, chunkWidth));
        }
      } else if (currentWidth + wordWidth > maxWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = word;
        currentWidth = wordWidth;
      } else {
        currentLine += word;
        currentWidth += wordWidth;
      }
    }
    
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }
    
    return lines.length > 0 ? lines : [''];
  }

  private countCharsForWidth(text: string, targetWidth: number): number {
    let count = 0;
    let currentWidth = 0;
    
    for (let i = 0; i < text.length && currentWidth < targetWidth; i++) {
      const char = text[i];
      const charWidth = this.isCJKCharacter(char, text.charCodeAt(i)) || 
                         this.isEmoji(text.charCodeAt(i)) ? 2 : 1;
      currentWidth += charWidth;
      count++;
    }
    
    return count;
  }

  renderLineElement(element: TemplateElement, elementIndex: number): RenderedLine[] {
    const char = element.content || '-';
    const line = this.createSeparatorLine(char.charAt(0) || '-');
    
    return [{
      text: line,
      originalWidth: this.printerProfile.charsPerLine,
      visualWidth: this.printerProfile.charsPerLine,
      align: 'left',
      style: {},
      elementIndex,
    }];
  }

  renderSpaceElement(element: TemplateElement, elementIndex: number): RenderedLine[] {
    const lines: RenderedLine[] = [];
    const linesCount = element.lines || 1;
    
    for (let i = 0; i < linesCount; i++) {
      lines.push({
        text: ' '.repeat(this.printerProfile.charsPerLine),
        originalWidth: 0,
        visualWidth: this.printerProfile.charsPerLine,
        align: 'left',
        style: {},
        elementIndex,
      });
    }
    
    return lines;
  }

  renderTableElement(element: TemplateElement, elementIndex: number): RenderedLine[] {
    const lines: RenderedLine[] = [];
    const maxWidth = this.printerProfile.charsPerLine;
    
    if (!element.columns || !element.rows) {
      return lines;
    }
    
    const totalColumnWidth = element.columns.reduce((sum, col) => sum + col.width, 0);
    const columnSpacing = Math.max(0, maxWidth - totalColumnWidth) / (element.columns.length - 1 || 1);
    
    for (const row of element.rows) {
      let lineText = '';
      
      for (let colIndex = 0; colIndex < element.columns.length; colIndex++) {
        const column = element.columns[colIndex];
        const cellText = row[colIndex] || '';
        const paddedCell = this.padToWidth(cellText, column.width, column.align || 'left');
        
        lineText += paddedCell;
        
        if (colIndex < element.columns.length - 1) {
          lineText += ' '.repeat(Math.floor(columnSpacing));
        }
      }
      
      const visualWidth = this.calculateVisualWidth(lineText);
      lines.push({
        text: this.padToWidth(lineText, maxWidth, 'left'),
        originalWidth: lineText.length,
        visualWidth,
        align: 'left',
        style: {},
        elementIndex,
      });
    }
    
    return lines;
  }

  renderBarcodeElement(element: TemplateElement, elementIndex: number): RenderedLine[] {
    const lines: RenderedLine[] = [];
    const maxWidth = this.printerProfile.charsPerLine;
    const barcodeData = element.barcodeData || '';
    const barcodeType = element.barcodeType || 'CODE128';
    
    const placeholder = `[${barcodeType}: ${barcodeData}]`;
    const paddedPlaceholder = this.padToWidth(placeholder, maxWidth, 'center');
    
    lines.push({
      text: paddedPlaceholder,
      originalWidth: placeholder.length,
      visualWidth: this.calculateVisualWidth(placeholder),
      align: 'center',
      style: {},
      elementIndex,
    });
    
    const barcodeLine = this.padToWidth('█'.repeat(Math.min(30, maxWidth)), maxWidth, 'center');
    lines.push({
      text: barcodeLine,
      originalWidth: Math.min(30, maxWidth),
      visualWidth: maxWidth,
      align: 'center',
      style: {},
      elementIndex,
    });
    
    lines.push({
      text: this.padToWidth(barcodeData, maxWidth, 'center'),
      originalWidth: barcodeData.length,
      visualWidth: this.calculateVisualWidth(barcodeData),
      align: 'center',
      style: {},
      elementIndex,
    });
    
    return lines;
  }

  renderQRCodeElement(element: TemplateElement, elementIndex: number): RenderedLine[] {
    const lines: RenderedLine[] = [];
    const maxWidth = this.printerProfile.charsPerLine;
    const qrcodeData = element.qrcodeData || '';
    
    const placeholder = `[QR Code]`;
    const paddedPlaceholder = this.padToWidth(placeholder, maxWidth, 'center');
    
    lines.push({
      text: paddedPlaceholder,
      originalWidth: placeholder.length,
      visualWidth: this.calculateVisualWidth(placeholder),
      align: 'center',
      style: {},
      elementIndex,
    });
    
    const qrSize = 8;
    for (let i = 0; i < qrSize; i++) {
      const qrLine = '█ ▄ ▀ █'.repeat(Math.floor(qrSize / 2));
      const paddedQRLine = this.padToWidth(qrLine, maxWidth, 'center');
      lines.push({
        text: paddedQRLine,
        originalWidth: qrLine.length,
        visualWidth: maxWidth,
        align: 'center',
        style: {},
        elementIndex,
      });
    }
    
    const dataLine = this.padToWidth(qrcodeData.substring(0, 30), maxWidth, 'center');
    lines.push({
      text: dataLine,
      originalWidth: qrcodeData.length,
      visualWidth: this.calculateVisualWidth(dataLine),
      align: 'center',
      style: {},
      elementIndex,
    });
    
    return lines;
  }

  renderElement(element: TemplateElement, elementIndex: number): RenderedLine[] {
    switch (element.type) {
      case 'text':
      case 'section':
        return this.renderTextElement(element, elementIndex);
      case 'line':
        return this.renderLineElement(element, elementIndex);
      case 'space':
        return this.renderSpaceElement(element, elementIndex);
      case 'table':
        return this.renderTableElement(element, elementIndex);
      case 'barcode':
        return this.renderBarcodeElement(element, elementIndex);
      case 'qrcode':
        return this.renderQRCodeElement(element, elementIndex);
      default:
        return [];
    }
  }

  buildTransactionTable(items: TransactionItem[]): TemplateElement {
    const columns = [
      { key: 'name', width: 24, align: 'left' as const },
      { key: 'qty', width: 6, align: 'right' as const },
      { key: 'price', width: 10, align: 'right' as const },
      { key: 'total', width: 10, align: 'right' as const },
    ];
    
    const rows: string[][] = [
      ['商品', '数量', '单价', '金额'],
    ];
    
    for (const item of items) {
      rows.push([
        item.name,
        String(item.quantity),
        item.unitPrice.toFixed(2),
        item.totalPrice.toFixed(2),
      ]);
    }
    
    return {
      type: 'table',
      columns,
      rows,
    };
  }

  render(template: Template, transaction: Transaction): RenderedReceipt {
    const allLines: RenderedLine[] = [];
    let maxVisualWidth = 0;
    
    for (let i = 0; i < template.elements.length; i++) {
      const element = template.elements[i];
      
      if (element.type === 'table' && !element.rows) {
        const tableElement = this.buildTransactionTable(transaction.items);
        const tableLines = this.renderTableElement(tableElement, i);
        allLines.push(...tableLines);
        
        for (const line of tableLines) {
          if (line.visualWidth > maxVisualWidth) {
            maxVisualWidth = line.visualWidth;
          }
        }
      } else {
        const lines = this.renderElement(element, i);
        allLines.push(...lines);
        
        for (const line of lines) {
          if (line.visualWidth > maxVisualWidth) {
            maxVisualWidth = line.visualWidth;
          }
        }
      }
    }
    
    return {
      templateName: template.name,
      transactionId: transaction.id,
      paperWidth: this.printerProfile.paperWidth,
      charsPerLine: this.printerProfile.charsPerLine,
      lines: allLines,
      totalLines: allLines.length,
      totalVisualWidth: maxVisualWidth,
    };
  }
}

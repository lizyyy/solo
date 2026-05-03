export function calculateTextWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    const charCode = char.charCodeAt(0);
    if (charCode >= 0x4e00 && charCode <= 0x9fff || 
        charCode >= 0x3040 && charCode <= 0x30ff ||
        charCode >= 0xff00 && charCode <= 0xffef) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

export function truncateText(text: string, maxWidth: number, ellipsis: string = '...'): string {
  const ellipsisWidth = calculateTextWidth(ellipsis);
  if (ellipsisWidth >= maxWidth) {
    return text.substring(0, Math.floor(maxWidth / 2));
  }

  let currentWidth = 0;
  let result = '';
  
  for (const char of text) {
    const charWidth = calculateTextWidth(char);
    if (currentWidth + charWidth > maxWidth - ellipsisWidth) {
      break;
    }
    currentWidth += charWidth;
    result += char;
  }

  if (currentWidth < calculateTextWidth(text)) {
    return result + ellipsis;
  }

  return text;
}

export function alignText(text: string, width: number, align: 'left' | 'center' | 'right' = 'left'): string {
  const textWidth = calculateTextWidth(text);
  
  if (textWidth >= width) {
    return truncateText(text, width);
  }

  const padding = width - textWidth;
  
  switch (align) {
    case 'right':
      return ' '.repeat(padding) + text;
    case 'center':
      const leftPadding = Math.floor(padding / 2);
      const rightPadding = padding - leftPadding;
      return ' '.repeat(leftPadding) + text + ' '.repeat(rightPadding);
    case 'left':
    default:
      return text + ' '.repeat(padding);
  }
}

export function getWidthForPaperSize(width: '58mm' | '80mm'): number {
  return width === '58mm' ? 32 : 48;
}
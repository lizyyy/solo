export function getCodePoints(text: string): number[] {
  const codePoints: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const codeUnit = text.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDBFF && i + 1 < text.length) {
      const nextCodeUnit = text.charCodeAt(i + 1);
      if (nextCodeUnit >= 0xDC00 && nextCodeUnit <= 0xDFFF) {
        const codePoint = (codeUnit - 0xD800) * 0x400 + (nextCodeUnit - 0xDC00) + 0x10000;
        codePoints.push(codePoint);
        i++;
        continue;
      }
    }
    codePoints.push(codeUnit);
  }
  return codePoints;
}

export function isWhitespace(codePoint: number): boolean {
  return (
    codePoint === 0x0020 ||
    codePoint === 0x0009 ||
    codePoint === 0x000A ||
    codePoint === 0x000D ||
    codePoint === 0x000C ||
    codePoint === 0x00A0 ||
    codePoint === 0x1680 ||
    (codePoint >= 0x2000 && codePoint <= 0x200A) ||
    codePoint === 0x202F ||
    codePoint === 0x205F ||
    codePoint === 0x3000
  );
}

export function isControlCharacter(codePoint: number): boolean {
  return (
    (codePoint >= 0x0000 && codePoint <= 0x001F) ||
    (codePoint >= 0x0080 && codePoint <= 0x009F)
  );
}

export function isEmoji(codePoint: number): boolean {
  if (codePoint >= 0x1F600 && codePoint <= 0x1F64F) return true;
  if (codePoint >= 0x1F300 && codePoint <= 0x1F5FF) return true;
  if (codePoint >= 0x1F680 && codePoint <= 0x1F6FF) return true;
  if (codePoint >= 0x1F1E0 && codePoint <= 0x1F1FF) return true;
  if (codePoint >= 0x2600 && codePoint <= 0x26FF) return true;
  if (codePoint >= 0x2700 && codePoint <= 0x27BF) return true;
  if (codePoint >= 0x1F900 && codePoint <= 0x1F9FF) return true;
  if (codePoint >= 0x1FA70 && codePoint <= 0x1FAFF) return true;
  if (codePoint === 0x231A || codePoint === 0x231B) return true;
  if (codePoint === 0x23F0 || codePoint === 0x23F3) return true;
  if (codePoint >= 0x23E9 && codePoint <= 0x23EC) return true;
  if (codePoint === 0x23F8 || codePoint === 0x23FA) return true;
  if (codePoint === 0x2694 || codePoint === 0x269E || codePoint === 0x269F) return true;
  if (codePoint >= 0x26D4 && codePoint <= 0x26D5) return true;
  if (codePoint === 0x26EA) return true;
  if (codePoint >= 0x26F2 && codePoint <= 0x26F3) return true;
  if (codePoint === 0x26F5 || codePoint === 0x26FA || codePoint === 0x26FD) return true;
  if (codePoint === 0x2705) return true;
  if (codePoint >= 0x270A && codePoint <= 0x270B) return true;
  if (codePoint === 0x2728) return true;
  if (codePoint === 0x274C) return true;
  if (codePoint === 0x274E) return true;
  if (codePoint >= 0x2753 && codePoint <= 0x2755) return true;
  if (codePoint === 0x2757) return true;
  if (codePoint >= 0x2795 && codePoint <= 0x2797) return true;
  if (codePoint === 0x27B0 || codePoint === 0x27BF) return true;
  if (codePoint >= 0x2B05 && codePoint <= 0x2B07) return true;
  if (codePoint >= 0x2B1B && codePoint <= 0x2B1C) return true;
  if (codePoint === 0x2B50 || codePoint === 0x2B55) return true;
  if (codePoint === 0x23CF || codePoint === 0x23CD || codePoint === 0x23CE) return true;
  if (codePoint === 0x25FD || codePoint === 0x25FE) return true;
  if (codePoint === 0x2B1A) return true;
  if (codePoint === 0x200D || codePoint === 0xFE0F) return true;
  return false;
}

export function isArabic(codePoint: number): boolean {
  return (
    (codePoint >= 0x0600 && codePoint <= 0x06FF) ||
    (codePoint >= 0x0750 && codePoint <= 0x077F) ||
    (codePoint >= 0x08A0 && codePoint <= 0x08FF) ||
    (codePoint >= 0xFB50 && codePoint <= 0xFDFF) ||
    (codePoint >= 0xFE70 && codePoint <= 0xFEFF) ||
    (codePoint >= 0x1EE00 && codePoint <= 0x1EEFF)
  );
}

export function isHebrew(codePoint: number): boolean {
  return codePoint >= 0x0590 && codePoint <= 0x05FF;
}

export function isRightToLeft(codePoint: number): boolean {
  return isArabic(codePoint) || isHebrew(codePoint);
}

export function isLeftToRight(codePoint: number): boolean {
  if (isRightToLeft(codePoint)) return false;
  if (isNeutral(codePoint)) return false;
  return true;
}

export function isNeutral(codePoint: number): boolean {
  if (isWhitespace(codePoint)) return true;
  if (codePoint >= 0x0030 && codePoint <= 0x0039) return true;
  if (codePoint >= 0x0020 && codePoint <= 0x002F) return true;
  if (codePoint >= 0x003A && codePoint <= 0x0040) return true;
  if (codePoint >= 0x005B && codePoint <= 0x0060) return true;
  if (codePoint >= 0x007B && codePoint <= 0x007E) return true;
  return false;
}

export function codePointToString(codePoint: number): string {
  return String.fromCodePoint(codePoint);
}

export function codePointToHex(codePoint: number): string {
  return 'U+' + codePoint.toString(16).toUpperCase().padStart(4, '0');
}

export function getUnicodeName(codePoint: number): string {
  const names: Record<number, string> = {
    0x0020: 'SPACE',
    0x0009: 'CHARACTER TABULATION',
    0x000A: 'LINE FEED',
    0x000D: 'CARRIAGE RETURN',
    0x200D: 'ZERO WIDTH JOINER',
    0xFE0F: 'VARIATION SELECTOR-16',
  };

  if (names[codePoint]) {
    return names[codePoint];
  }

  if (codePoint >= 0x4E00 && codePoint <= 0x9FFF) {
    return 'CJK UNIFIED IDEOGRAPH-' + codePointToHex(codePoint).substring(2);
  }

  if (isEmoji(codePoint)) {
    return 'EMOJI-' + codePointToHex(codePoint).substring(2);
  }

  return 'UNKNOWN-' + codePointToHex(codePoint).substring(2);
}

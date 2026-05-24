"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateWidth = calculateWidth;
exports.getCharWidth = getCharWidth;
exports.getWidthExplanation = getWidthExplanation;
function calculateWidth(text) {
    let totalWidth = 0;
    const widthDetails = [];
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const codePoint = text.codePointAt(i);
        const width = getCharWidth(codePoint);
        totalWidth += width;
        widthDetails.push({ char, width, codePoint });
    }
    return {
        text,
        charWidth: totalWidth,
        charCount: text.length,
        widthDetails,
    };
}
function getCharWidth(codePoint) {
    if (codePoint < 0x20)
        return 0;
    if (codePoint < 0x7F)
        return 1;
    if (isFullwidthChar(codePoint)) {
        return 2;
    }
    if (isAmbiguousWidthChar(codePoint)) {
        return 2;
    }
    if (codePoint >= 0x1100 && codePoint <= 0x115F)
        return 2;
    if (codePoint >= 0x2329 && codePoint <= 0x232A)
        return 2;
    if (codePoint >= 0x2E80 && codePoint <= 0x303E)
        return 2;
    if (codePoint >= 0x3040 && codePoint <= 0xA4CF)
        return 2;
    if (codePoint >= 0xAC00 && codePoint <= 0xD7A3)
        return 2;
    if (codePoint >= 0xF900 && codePoint <= 0xFAFF)
        return 2;
    if (codePoint >= 0xFE10 && codePoint <= 0xFE19)
        return 2;
    if (codePoint >= 0xFE30 && codePoint <= 0xFE6F)
        return 2;
    if (codePoint >= 0xFF00 && codePoint <= 0xFF60)
        return 2;
    if (codePoint >= 0xFFE0 && codePoint <= 0xFFE6)
        return 2;
    if (codePoint >= 0x1F000 && codePoint <= 0x1FFFF)
        return 2;
    if (codePoint >= 0x20000 && codePoint <= 0x2FFFD)
        return 2;
    if (codePoint >= 0x30000 && codePoint <= 0x3FFFD)
        return 2;
    return 1;
}
function isFullwidthChar(codePoint) {
    if (codePoint >= 0xFF01 && codePoint <= 0xFF5E)
        return true;
    if (codePoint === 0x3000)
        return true;
    if (codePoint >= 0xFFE0 && codePoint <= 0xFFE6)
        return true;
    return false;
}
function isAmbiguousWidthChar(codePoint) {
    if (codePoint >= 0x00A1 && codePoint <= 0x00A4)
        return true;
    if (codePoint >= 0x00A7 && codePoint <= 0x00A8)
        return true;
    if (codePoint === 0x00AA)
        return true;
    if (codePoint >= 0x00AD && codePoint <= 0x00AE)
        return true;
    if (codePoint >= 0x00B0 && codePoint <= 0x00B4)
        return true;
    if (codePoint >= 0x00B6 && codePoint <= 0x00BA)
        return true;
    if (codePoint >= 0x00BC && codePoint <= 0x00BF)
        return true;
    if (codePoint >= 0x00C6 && codePoint <= 0x00C7)
        return true;
    if (codePoint >= 0x00D0 && codePoint <= 0x00D1)
        return true;
    if (codePoint >= 0x00D8 && codePoint <= 0x00D9)
        return true;
    if (codePoint === 0x00DC)
        return true;
    if (codePoint >= 0x00E0 && codePoint <= 0x00E1)
        return true;
    if (codePoint >= 0x00E6 && codePoint <= 0x00E7)
        return true;
    if (codePoint === 0x00E8)
        return true;
    if (codePoint >= 0x00EA && codePoint <= 0x00EB)
        return true;
    if (codePoint >= 0x00ED && codePoint <= 0x00EE)
        return true;
    if (codePoint === 0x00F0)
        return true;
    if (codePoint >= 0x00F2 && codePoint <= 0x00F3)
        return true;
    if (codePoint >= 0x00F8 && codePoint <= 0x00F9)
        return true;
    if (codePoint === 0x00FC)
        return true;
    if (codePoint === 0x00FE)
        return true;
    if (codePoint === 0x0101)
        return true;
    if (codePoint >= 0x0111 && codePoint <= 0x0113)
        return true;
    if (codePoint === 0x011B)
        return true;
    if (codePoint >= 0x0126 && codePoint <= 0x0127)
        return true;
    if (codePoint === 0x012B)
        return true;
    if (codePoint >= 0x0131 && codePoint <= 0x0133)
        return true;
    if (codePoint === 0x0138)
        return true;
    if (codePoint >= 0x013F && codePoint <= 0x0142)
        return true;
    if (codePoint >= 0x0144 && codePoint <= 0x014B)
        return true;
    if (codePoint === 0x014D)
        return true;
    if (codePoint >= 0x0152 && codePoint <= 0x0153)
        return true;
    if (codePoint >= 0x0166 && codePoint <= 0x0167)
        return true;
    if (codePoint === 0x016B)
        return true;
    if (codePoint === 0x01CE)
        return true;
    if (codePoint === 0x01D0)
        return true;
    if (codePoint === 0x01D2)
        return true;
    if (codePoint === 0x01D4)
        return true;
    if (codePoint >= 0x01D6 && codePoint <= 0x01D7)
        return true;
    if (codePoint === 0x01DA)
        return true;
    if (codePoint === 0x01DC)
        return true;
    if (codePoint >= 0x0251 && codePoint <= 0x0253)
        return true;
    if (codePoint === 0x025C)
        return true;
    if (codePoint === 0x025F)
        return true;
    if (codePoint === 0x0261)
        return true;
    if (codePoint >= 0x0298 && codePoint <= 0x029B)
        return true;
    if (codePoint === 0x029E)
        return true;
    if (codePoint === 0x02A0)
        return true;
    if (codePoint === 0x02A3)
        return true;
    if (codePoint === 0x02A5)
        return true;
    if (codePoint === 0x02A8)
        return true;
    if (codePoint === 0x02AB)
        return true;
    if (codePoint === 0x02AD)
        return true;
    if (codePoint === 0x0391)
        return true;
    if (codePoint >= 0x0394 && codePoint <= 0x039A)
        return true;
    if (codePoint >= 0x039C && codePoint <= 0x03A1)
        return true;
    if (codePoint >= 0x03A3 && codePoint <= 0x03A9)
        return true;
    if (codePoint >= 0x03B1 && codePoint <= 0x03B2)
        return true;
    if (codePoint >= 0x03B4 && codePoint <= 0x03B5)
        return true;
    if (codePoint === 0x03B7)
        return true;
    if (codePoint === 0x03B9)
        return true;
    if (codePoint >= 0x03BB && codePoint <= 0x03BC)
        return true;
    if (codePoint === 0x03BE)
        return true;
    if (codePoint === 0x03C0)
        return true;
    if (codePoint === 0x03C3)
        return true;
    if (codePoint === 0x03C6)
        return true;
    if (codePoint >= 0x0401 && codePoint <= 0x0410)
        return true;
    if (codePoint >= 0x0412 && codePoint <= 0x044F)
        return true;
    if (codePoint >= 0x0451 && codePoint <= 0x045F)
        return true;
    if (codePoint === 0x2010)
        return true;
    if (codePoint >= 0x2013 && codePoint <= 0x2016)
        return true;
    if (codePoint >= 0x2018 && codePoint <= 0x201D)
        return true;
    if (codePoint >= 0x2020 && codePoint <= 0x2022)
        return true;
    if (codePoint >= 0x2024 && codePoint <= 0x2027)
        return true;
    if (codePoint === 0x2030)
        return true;
    if (codePoint === 0x2032)
        return true;
    if (codePoint >= 0x2035 && codePoint <= 0x2037)
        return true;
    if (codePoint === 0x203B)
        return true;
    if (codePoint === 0x203E)
        return true;
    if (codePoint >= 0x2074 && codePoint <= 0x2079)
        return true;
    if (codePoint >= 0x2081 && codePoint <= 0x2084)
        return true;
    if (codePoint === 0x20A9)
        return true;
    if (codePoint >= 0x2103 && codePoint <= 0x2105)
        return true;
    if (codePoint === 0x2109)
        return true;
    if (codePoint === 0x2113)
        return true;
    if (codePoint >= 0x2116 && codePoint <= 0x2117)
        return true;
    if (codePoint >= 0x211E && codePoint <= 0x2122)
        return true;
    if (codePoint === 0x2126)
        return true;
    if (codePoint === 0x2128)
        return true;
    if (codePoint >= 0x212A && codePoint <= 0x212B)
        return true;
    if (codePoint === 0x2153)
        return true;
    if (codePoint >= 0x2155 && codePoint <= 0x215A)
        return true;
    if (codePoint >= 0x215C && codePoint <= 0x215E)
        return true;
    if (codePoint >= 0x2160 && codePoint <= 0x216B)
        return true;
    if (codePoint >= 0x2170 && codePoint <= 0x2179)
        return true;
    if (codePoint === 0x2189)
        return true;
    if (codePoint === 0x2190)
        return true;
    if (codePoint === 0x2192)
        return true;
    if (codePoint === 0x2196)
        return true;
    if (codePoint === 0x2200)
        return true;
    if (codePoint >= 0x2202 && codePoint <= 0x2203)
        return true;
    if (codePoint === 0x2207)
        return true;
    if (codePoint === 0x2209)
        return true;
    if (codePoint === 0x220F)
        return true;
    if (codePoint === 0x2211)
        return true;
    if (codePoint === 0x2215)
        return true;
    if (codePoint === 0x221A)
        return true;
    if (codePoint === 0x221D)
        return true;
    if (codePoint === 0x2220)
        return true;
    if (codePoint >= 0x2223 && codePoint <= 0x2225)
        return true;
    if (codePoint === 0x2227)
        return true;
    if (codePoint === 0x2228)
        return true;
    if (codePoint === 0x2229)
        return true;
    if (codePoint === 0x222A)
        return true;
    if (codePoint >= 0x222C && codePoint <= 0x222E)
        return true;
    if (codePoint === 0x2234)
        return true;
    if (codePoint >= 0x223C && codePoint <= 0x223D)
        return true;
    if (codePoint === 0x2248)
        return true;
    if (codePoint === 0x224C)
        return true;
    if (codePoint === 0x2252)
        return true;
    if (codePoint >= 0x2260 && codePoint <= 0x2261)
        return true;
    if (codePoint >= 0x2264 && codePoint <= 0x2267)
        return true;
    if (codePoint >= 0x226A && codePoint <= 0x226B)
        return true;
    if (codePoint >= 0x226E && codePoint <= 0x226F)
        return true;
    if (codePoint >= 0x2282 && codePoint <= 0x2283)
        return true;
    if (codePoint >= 0x2286 && codePoint <= 0x2287)
        return true;
    if (codePoint === 0x2295)
        return true;
    if (codePoint === 0x2299)
        return true;
    if (codePoint === 0x22A5)
        return true;
    if (codePoint === 0x22BF)
        return true;
    if (codePoint === 0x2312)
        return true;
    if (codePoint >= 0x2460 && codePoint <= 0x24FF)
        return true;
    if (codePoint >= 0x2500 && codePoint <= 0x2573)
        return true;
    if (codePoint >= 0x2592 && codePoint <= 0x2595)
        return true;
    if (codePoint >= 0x25A0 && codePoint <= 0x25A1)
        return true;
    if (codePoint >= 0x25A3 && codePoint <= 0x25A9)
        return true;
    if (codePoint >= 0x25B2 && codePoint <= 0x25B3)
        return true;
    if (codePoint >= 0x25B6 && codePoint <= 0x25B7)
        return true;
    if (codePoint >= 0x25BC && codePoint <= 0x25BD)
        return true;
    if (codePoint >= 0x25C0 && codePoint <= 0x25C1)
        return true;
    if (codePoint >= 0x25C6 && codePoint <= 0x25C8)
        return true;
    if (codePoint === 0x25CB)
        return true;
    if (codePoint >= 0x25CE && codePoint <= 0x25D1)
        return true;
    if (codePoint >= 0x25E2 && codePoint <= 0x25E5)
        return true;
    if (codePoint === 0x25EF)
        return true;
    if (codePoint >= 0x2605 && codePoint <= 0x2606)
        return true;
    if (codePoint === 0x2609)
        return true;
    if (codePoint >= 0x260E && codePoint <= 0x260F)
        return true;
    if (codePoint >= 0x261C && codePoint <= 0x261D)
        return true;
    if (codePoint === 0x261F)
        return true;
    if (codePoint === 0x262F)
        return true;
    if (codePoint >= 0x2640 && codePoint <= 0x2642)
        return true;
    if (codePoint >= 0x2660 && codePoint <= 0x2663)
        return true;
    if (codePoint === 0x2665)
        return true;
    if (codePoint === 0x2668)
        return true;
    if (codePoint >= 0x266B && codePoint <= 0x266F)
        return true;
    if (codePoint === 0x269E)
        return true;
    if (codePoint === 0x269F)
        return true;
    if (codePoint === 0x26BE)
        return true;
    if (codePoint === 0x26BF)
        return true;
    if (codePoint >= 0x26C4 && codePoint <= 0x26CD)
        return true;
    if (codePoint >= 0x26CF && codePoint <= 0x26E1)
        return true;
    if (codePoint >= 0x26E3 && codePoint <= 0x2712)
        return true;
    if (codePoint >= 0x2714 && codePoint <= 0x2715)
        return true;
    if (codePoint >= 0x2718 && codePoint <= 0x271D)
        return true;
    if (codePoint === 0x2720)
        return true;
    if (codePoint >= 0x2722 && codePoint <= 0x272F)
        return true;
    if (codePoint >= 0x2731 && codePoint <= 0x2746)
        return true;
    if (codePoint >= 0x274A && codePoint <= 0x2759)
        return true;
    if (codePoint >= 0x275B && codePoint <= 0x275E)
        return true;
    if (codePoint >= 0x2761 && codePoint <= 0x2767)
        return true;
    if (codePoint >= 0x2776 && codePoint <= 0x277F)
        return true;
    if (codePoint >= 0x2794 && codePoint <= 0x2799)
        return true;
    if (codePoint >= 0x27C0 && codePoint <= 0x27C4)
        return true;
    if (codePoint >= 0x27C7 && codePoint <= 0x27C9)
        return true;
    if (codePoint >= 0x27D0 && codePoint <= 0x27D5)
        return true;
    if (codePoint === 0x27E0)
        return true;
    if (codePoint >= 0x2800 && codePoint <= 0x28FF)
        return true;
    if (codePoint === 0x29BF)
        return true;
    if (codePoint === 0x2B56)
        return true;
    if (codePoint === 0x2B57)
        return true;
    if (codePoint === 0x3250)
        return true;
    if (codePoint >= 0xE000 && codePoint <= 0xF8FF)
        return true;
    if (codePoint >= 0xFE00 && codePoint <= 0xFE0F)
        return true;
    if (codePoint >= 0xFFFD && codePoint <= 0xFFFF)
        return true;
    if (codePoint >= 0x1F100 && codePoint <= 0x1F1FF)
        return true;
    if (codePoint >= 0xE0100 && codePoint <= 0xE01EF)
        return true;
    return false;
}
function getWidthExplanation(result) {
    const lines = [];
    lines.push(`文本: ${result.text}`);
    lines.push(`总宽度: ${result.charWidth} 单位 (${result.charCount} 字符)`);
    lines.push('逐字符分析:');
    for (const detail of result.widthDetails) {
        const type = detail.width === 2 ? '全角' : '半角';
        lines.push(`  '${detail.char}' (U+${detail.codePoint.toString(16).toUpperCase().padStart(4, '0')}) - ${detail.width} 单位 [${type}]`);
    }
    return lines.join('\n');
}
//# sourceMappingURL=widthCalculator.js.map
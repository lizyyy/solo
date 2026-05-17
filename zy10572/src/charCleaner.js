const INVISIBLE_CHARS = {
  '\x00': 'NULL',
  '\x01': 'SOH',
  '\x02': 'STX',
  '\x03': 'ETX',
  '\x04': 'EOT',
  '\x05': 'ENQ',
  '\x06': 'ACK',
  '\x07': 'BEL',
  '\x08': 'BS',
  '\x0B': 'VT',
  '\x0C': 'FF',
  '\x0E': 'SO',
  '\x0F': 'SI',
  '\x10': 'DLE',
  '\x11': 'DC1',
  '\x12': 'DC2',
  '\x13': 'DC3',
  '\x14': 'DC4',
  '\x15': 'NAK',
  '\x16': 'SYN',
  '\x17': 'ETB',
  '\x18': 'CAN',
  '\x19': 'EM',
  '\x1A': 'SUB',
  '\x1B': 'ESC',
  '\x1C': 'FS',
  '\x1D': 'GS',
  '\x1E': 'RS',
  '\x1F': 'US',
  '\x7F': 'DEL',
  '\u00A0': 'NBSP',
  '\u2000': 'EN_QUAD',
  '\u2001': 'EM_QUAD',
  '\u2002': 'EN_SPACE',
  '\u2003': 'EM_SPACE',
  '\u2004': 'THREE_PER_EM_SPACE',
  '\u2005': 'FOUR_PER_EM_SPACE',
  '\u2006': 'SIX_PER_EM_SPACE',
  '\u2007': 'FIGURE_SPACE',
  '\u2008': 'PUNCTUATION_SPACE',
  '\u2009': 'THIN_SPACE',
  '\u200A': 'HAIR_SPACE',
  '\u200B': 'ZERO_WIDTH_SPACE',
  '\u200C': 'ZERO_WIDTH_NON_JOINER',
  '\u200D': 'ZERO_WIDTH_JOINER',
  '\u200E': 'LRM',
  '\u200F': 'RLM',
  '\u2028': 'LINE_SEPARATOR',
  '\u2029': 'PARAGRAPH_SEPARATOR',
  '\u202A': 'LRE',
  '\u202B': 'RLE',
  '\u202C': 'PDF',
  '\u202D': 'LRO',
  '\u202E': 'RLO',
  '\uFEFF': 'BOM',
  '\uFFFE': 'INVALID_BOM',
  '\uFFFF': 'INVALID_CHAR'
};

const FULLWIDTH_TO_HALFWIDTH = {
  '０': '0', '１': '1', '２': '2', '３': '3', '４': '4',
  '５': '5', '６': '6', '７': '7', '８': '8', '９': '9',
  'ａ': 'a', 'ｂ': 'b', 'ｃ': 'c', 'ｄ': 'd', 'ｅ': 'e',
  'ｆ': 'f', 'ｇ': 'g', 'ｈ': 'h', 'ｉ': 'i', 'ｊ': 'j',
  'ｋ': 'k', 'ｌ': 'l', 'ｍ': 'm', 'ｎ': 'n', 'ｏ': 'o',
  'ｐ': 'p', 'ｑ': 'q', 'ｒ': 'r', 'ｓ': 's', 'ｔ': 't',
  'ｕ': 'u', 'ｖ': 'v', 'ｗ': 'w', 'ｘ': 'x', 'ｙ': 'y',
  'ｚ': 'z',
  'Ａ': 'A', 'Ｂ': 'B', 'Ｃ': 'C', 'Ｄ': 'D', 'Ｅ': 'E',
  'Ｆ': 'F', 'Ｇ': 'G', 'Ｈ': 'H', 'Ｉ': 'I', 'Ｊ': 'J',
  'Ｋ': 'K', 'Ｌ': 'L', 'Ｍ': 'M', 'Ｎ': 'N', 'Ｏ': 'O',
  'Ｐ': 'P', 'Ｑ': 'Q', 'Ｒ': 'R', 'Ｓ': 'S', 'Ｔ': 'T',
  'Ｕ': 'U', 'Ｖ': 'V', 'Ｗ': 'W', 'Ｘ': 'X', 'Ｙ': 'Y',
  'Ｚ': 'Z',
  '　': ' ',
  '，': ',', '．': '.', '、': ',', '。': '.',
  '：': ':', '；': ';', '？': '?', '！': '!',
  '＂': '"', '＇': "'", '｀': '`',
  '（': '(', '）': ')', '［': '[', '］': ']',
  '｛': '{', '｝': '}', '〈': '<', '〉': '>',
  '＠': '@', '＃': '#', '＄': '$', '％': '%',
  '＾': '^', '＆': '&', '＊': '*', '＋': '+',
  '－': '-', '＝': '=', '＿': '_', '～': '~',
  '｜': '|', '＼': '\\', '／': '/'
};

function findInvisibleChars(text) {
  const findings = [];
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (INVISIBLE_CHARS[char]) {
      findings.push({
        position: i,
        charCode: char.charCodeAt(0).toString(16).toUpperCase(),
        charName: INVISIBLE_CHARS[char],
        context: getContext(text, i)
      });
    }
  }
  return findings;
}

function findMojibake(text) {
  const findings = [];
  const mojibakePatterns = [
    /[�□]/g,
    /\uFFFD/g,
    /\u0080-\u009F/g
  ];
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const code = char.charCodeAt(0);
    if ((code >= 0xFFFD && code <= 0xFFFF) || 
        (code >= 0x0080 && code <= 0x009F) ||
        char === '�' || char === '□') {
      findings.push({
        position: i,
        charCode: code.toString(16).toUpperCase(),
        char: char,
        context: getContext(text, i)
      });
    }
  }
  return findings;
}

function getContext(text, position, windowSize = 10) {
  const start = Math.max(0, position - windowSize);
  const end = Math.min(text.length, position + windowSize + 1);
  return {
    before: text.substring(start, position),
    after: text.substring(position + 1, end)
  };
}

function replaceFullwidthChars(text) {
  let result = text;
  const replacements = [];
  
  for (const [fullwidth, halfwidth] of Object.entries(FULLWIDTH_TO_HALFWIDTH)) {
    const regex = new RegExp(fullwidth, 'g');
    let match;
    const tempText = result;
    let pos = 0;
    while ((match = regex.exec(tempText)) !== null) {
      replacements.push({
        position: match.index + pos,
        original: fullwidth,
        replacement: halfwidth
      });
    }
    result = result.replace(regex, halfwidth);
  }
  
  return { text: result, replacements };
}

function removeInvisibleChars(text, keepNewlines = true) {
  let result = text;
  const removals = [];
  
  for (const [char, name] of Object.entries(INVISIBLE_CHARS)) {
    if (keepNewlines && (char === '\n' || char === '\r')) continue;
    const regex = new RegExp(char, 'g');
    let match;
    while ((match = regex.exec(result)) !== null) {
      removals.push({
        position: match.index,
        charCode: char.charCodeAt(0).toString(16).toUpperCase(),
        charName: name
      });
    }
    result = result.replace(regex, '');
  }
  
  return { text: result, removals };
}

function replaceMojibake(text, replacement = '') {
  let result = text;
  const replacements = [];
  
  const mojibakeRegex = /[\uFFFD\u0080-\u009F�□]/g;
  let match;
  while ((match = mojibakeRegex.exec(result)) !== null) {
    replacements.push({
      position: match.index,
      original: match[0],
      charCode: match[0].charCodeAt(0).toString(16).toUpperCase()
    });
  }
  result = result.replace(mojibakeRegex, replacement);
  
  return { text: result, replacements };
}

function cleanText(text, options = {}) {
  const {
    fixFullwidth = true,
    removeInvisible = true,
    fixMojibake = true,
    keepNewlines = true
  } = options;
  
  const issues = {
    invisibleChars: findInvisibleChars(text),
    mojibake: findMojibake(text),
    fullwidthChars: []
  };
  
  let result = text;
  let fullwidthResult = { text: result, replacements: [] };
  let invisibleResult = { text: result, removals: [] };
  let mojibakeResult = { text: result, replacements: [] };
  
  if (fixFullwidth) {
    fullwidthResult = replaceFullwidthChars(result);
    result = fullwidthResult.text;
    issues.fullwidthChars = fullwidthResult.replacements;
  }
  
  if (removeInvisible) {
    invisibleResult = removeInvisibleChars(result, keepNewlines);
    result = invisibleResult.text;
  }
  
  if (fixMojibake) {
    mojibakeResult = replaceMojibake(result);
    result = mojibakeResult.text;
  }
  
  return {
    original: text,
    cleaned: result,
    issues,
    stats: {
      invisibleCount: issues.invisibleChars.length,
      mojibakeCount: issues.mojibake.length,
      fullwidthCount: issues.fullwidthChars.length
    }
  };
}

module.exports = {
  findInvisibleChars,
  findMojibake,
  replaceFullwidthChars,
  removeInvisibleChars,
  replaceMojibake,
  cleanText,
  INVISIBLE_CHARS,
  FULLWIDTH_TO_HALFWIDTH
};

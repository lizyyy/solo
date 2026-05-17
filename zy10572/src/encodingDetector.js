const chardet = require('chardet');
const fs = require('fs');
const iconv = require('iconv-lite');

const COMMON_ENCODINGS = [
  'UTF-8', 'GBK', 'GB2312', 'GB18030', 'BIG5',
  'UTF-16LE', 'UTF-16BE', 'ISO-8859-1', 'Windows-1252'
];

function detectEncoding(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const detected = chardet.detect(buffer);
    const encoding = detected || 'UTF-8';
    
    const candidates = [];
    if (encoding) candidates.push(encoding);
    COMMON_ENCODINGS.forEach(e => {
      if (e !== encoding && candidates.length < 5) candidates.push(e);
    });
    
    return {
      encoding: encoding,
      confidence: detected ? 0.85 : 0.5,
      candidates: candidates
    };
  } catch (error) {
    return {
      encoding: 'UTF-8',
      confidence: 0.3,
      candidates: ['UTF-8'],
      error: error.message
    };
  }
}

function readFileWithEncoding(filePath, encoding) {
  try {
    const buffer = fs.readFileSync(filePath);
    if (iconv.encodingExists(encoding)) {
      return iconv.decode(buffer, encoding);
    }
    return buffer.toString(encoding || 'utf8');
  } catch (error) {
    return fs.readFileSync(filePath, 'utf8');
  }
}

module.exports = {
  detectEncoding,
  readFileWithEncoding,
  COMMON_ENCODINGS
};

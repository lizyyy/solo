const fs = require('fs');

// 修复 test_full_verify.js
let tfv = fs.readFileSync('test_full_verify.js', 'utf8');
let lines = tfv.split('\n');

// 第26行 (索引25)
if (lines[25].indexOf('SENTENCE_BOUNDARY') >= 0) {
  lines[25] = '// SENTENCE_BOUNDARY removed - using indexOf instead';
  console.log('Line 26 fixed');
}

// 第46行 (索引45)
if (lines[45].indexOf('lastBdry = fullPfx.search') >= 0) {
  lines[45] = '  var lastBdry = Math.max(fullPfx.lastIndexOf(String.fromCharCode(0x3002)), fullPfx.lastIndexOf("!"), fullPfx.lastIndexOf("?"), fullPfx.lastIndexOf(";"), fullPfx.lastIndexOf("\\n"), fullPfx.lastIndexOf("\\r"));';
  console.log('Line 46 fixed');
}

// 第53行 (索引52)
if (lines[52].indexOf('firstBdry = fullSfx.search') >= 0) {
  lines[52] = '  var firstBdry = -1; var _bd = [String.fromCharCode(0x3002), "!", "?", ";", "\\n", "\\r"]; for (var _di = 0; _di < _bd.length; _di++) { var _fi = fullSfx.indexOf(_bd[_di]); if (_fi >= 0 && (firstBdry < 0 || _fi < firstBdry)) firstBdry = _fi; }';
  console.log('Line 53 fixed');
}

fs.writeFileSync('test_full_verify.js', lines.join('\n'));
console.log('test_full_verify.js saved');

// 修复 src/inspectionEngine.js
let ie = fs.readFileSync('src/inspectionEngine.js', 'utf8');
let ieLines = ie.split('\n');

for (let i = 0; i < ieLines.length; i++) {
  if (ieLines[i].indexOf('const SENTENCE_BOUNDARY') >= 0) {
    ieLines[i] = '  // SENTENCE_BOUNDARY removed - using indexOf instead';
    console.log('inspectionEngine.js line ' + (i+1) + ' fixed (SENTENCE_BOUNDARY)');
  }
  if (ieLines[i].indexOf('lastBoundary = fullPfx.search') >= 0) {
    ieLines[i] = '      let lastDot = Math.max(fullPfx.lastIndexOf(String.fromCharCode(0x3002)), fullPfx.lastIndexOf("!"), fullPfx.lastIndexOf("?"), fullPfx.lastIndexOf(";"), fullPfx.lastIndexOf("\\n"), fullPfx.lastIndexOf("\\r"));';
    ieLines[i+1] = '      if (lastDot >= 0) {';
    ieLines[i+2] = '        pfx = fullPfx.substring(lastDot + 1);';
    console.log('inspectionEngine.js line ' + (i+1) + ' fixed (lastBoundary)');
  }
  if (ieLines[i].indexOf('firstBoundary = fullSfx.search') >= 0) {
    ieLines[i] = '        let firstDot = -1; const dotsArr = [String.fromCharCode(0x3002), "!", "?", ";", "\\n", "\\r"]; for (let di = 0; di < dotsArr.length; di++) { const fi = fullSfx.indexOf(dotsArr[di]); if (fi >= 0 && (firstDot < 0 || fi < firstDot)) firstDot = fi; }';
    ieLines[i+1] = '        if (firstDot >= 0) {';
    ieLines[i+2] = '          sfx = fullSfx.substring(0, firstDot);';
    console.log('inspectionEngine.js line ' + (i+1) + ' fixed (firstBoundary)');
  }
}

fs.writeFileSync('src/inspectionEngine.js', ieLines.join('\n'));
console.log('inspectionEngine.js saved');

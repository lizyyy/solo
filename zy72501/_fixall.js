const fs = require("fs");

// ===== 修复 inspectionEngine.js - findValidRagMatches =====
let ie = fs.readFileSync("src/inspectionEngine.js", "utf8");

// 替换前缀检查：添加句子边界截断
var oldPfx = `      let negated = false;
      let negationReason = "";
      
      const pfx = text.substring(Math.max(0, m.index - 24), m.index);`;

var newPfx = `      let negated = false;
      let negationReason = "";
      
      const fullPfx = text.substring(Math.max(0, m.index - 24), m.index);
      let pfx = fullPfx;
      let lastDot = Math.max(fullPfx.lastIndexOf(String.fromCharCode(0x3002)), fullPfx.lastIndexOf("!"), fullPfx.lastIndexOf("?"), fullPfx.lastIndexOf(";"), fullPfx.lastIndexOf("\\n"), fullPfx.lastIndexOf("\\r"));
      if (lastDot >= 0) {
        pfx = fullPfx.substring(lastDot + 1);
      }`;

if (ie.includes(oldPfx)) {
  ie = ie.replace(oldPfx, newPfx);
  console.log("inspectionEngine.js: prefix check fixed");
} else {
  console.log("inspectionEngine.js: prefix pattern NOT FOUND");
}

// 替换后缀检查：添加句子边界截断
var oldSfx = `      if (!negated) {
        const sfx = text.substring(m[0].length + m.index, Math.min(text.length, m.index + m[0].length + 24));`;

var newSfx = `      if (!negated) {
        const fullSfx = text.substring(m[0].length + m.index, Math.min(text.length, m.index + m[0].length + 24));
        let sfx = fullSfx;
        let firstDot = -1;
        const dotsArr = [String.fromCharCode(0x3002), "!", "?", ";", "\\n", "\\r"];
        for (let di = 0; di < dotsArr.length; di++) {
          const fi = fullSfx.indexOf(dotsArr[di]);
          if (fi >= 0 && (firstDot < 0 || fi < firstDot)) firstDot = fi;
        }
        if (firstDot >= 0) {
          sfx = fullSfx.substring(0, firstDot);
        }`;

if (ie.includes(oldSfx)) {
  ie = ie.replace(oldSfx, newSfx);
  console.log("inspectionEngine.js: suffix check fixed");
} else {
  console.log("inspectionEngine.js: suffix pattern NOT FOUND");
}

fs.writeFileSync("src/inspectionEngine.js", ie);
console.log("inspectionEngine.js saved");

// ===== 修复 test_full_verify.js =====
let tfv = fs.readFileSync("test_full_verify.js", "utf8");

// 修复前缀检查：用 indexOf 替代 search(SENTENCE_BOUNDARY)
var oldPfx2 = `  var fullPfx = ft.substring(Math.max(0, mi - 24), mi);
  var pfx = fullPfx;
  var lastBdry = fullPfx.search(global.SENTENCE_BOUNDARY);
  if (lastBdry >= 0) pfx = fullPfx.substring(lastBdry + 1);`;

var newPfx2 = `  var fullPfx = ft.substring(Math.max(0, mi - 24), mi);
  var pfx = fullPfx;
  var lastBdry = Math.max(fullPfx.lastIndexOf(String.fromCharCode(0x3002)), fullPfx.lastIndexOf("!"), fullPfx.lastIndexOf("?"), fullPfx.lastIndexOf(";"), fullPfx.lastIndexOf("\\n"), fullPfx.lastIndexOf("\\r"));
  if (lastBdry >= 0) pfx = fullPfx.substring(lastBdry + 1);`;

if (tfv.includes(oldPfx2)) {
  tfv = tfv.replace(oldPfx2, newPfx2);
  console.log("test_full_verify.js: prefix check fixed");
} else {
  console.log("test_full_verify.js: prefix pattern NOT FOUND");
}

// 修复后缀检查：用 indexOf 替代 search(SENTENCE_BOUNDARY)
var oldSfx2 = `  var fullSfx = ft.substring(mt.length + mi, Math.min(ft.length, mi + mt.length + 24));
  var sfx = fullSfx;
  var firstBdry = fullSfx.search(global.SENTENCE_BOUNDARY);
  if (firstBdry >= 0) sfx = fullSfx.substring(0, firstBdry);`;

var newSfx2 = `  var fullSfx = ft.substring(mt.length + mi, Math.min(ft.length, mi + mt.length + 24));
  var sfx = fullSfx;
  var firstBdry = -1; var _bd = [String.fromCharCode(0x3002), "!", "?", ";", "\\n", "\\r"]; for (var _di = 0; _di < _bd.length; _di++) { var _fi = fullSfx.indexOf(_bd[_di]); if (_fi >= 0 && (firstBdry < 0 || _fi < firstBdry)) firstBdry = _fi; }
  if (firstBdry >= 0) sfx = fullSfx.substring(0, firstBdry);`;

if (tfv.includes(oldSfx2)) {
  tfv = tfv.replace(oldSfx2, newSfx2);
  console.log("test_full_verify.js: suffix check fixed");
} else {
  console.log("test_full_verify.js: suffix pattern NOT FOUND");
}

fs.writeFileSync("test_full_verify.js", tfv);
console.log("test_full_verify.js saved");

const fs = require("fs");
let c = fs.readFileSync("src/inspectionEngine.js", "utf8");

// Fix 1: Replace entire checkPhoneMasking function
const lines = c.split("\n");
let s=-1,e=-1;
for(let i=0;i<lines.length;i++){
  if(lines[i].startsWith("function checkPhoneMasking("))s=i;
  if(s>=0&&i>s&&lines[i].trim()==="}"&&e<0){
    if(i+1>=lines.length||lines[i+1].trim()===""||lines[i+1].startsWith("function "))e=i;
  }
}
console.log("checkPhoneMasking lines:",s+1,"-",e+1);
const nf = [];
nf.push("function checkPhoneMasking(text, sourceType, sourceId, sourceName, extraMeta) {");
nf.push("  extraMeta = extraMeta || {};");
nf.push("  const issues = [];");
nf.push("  const phones = detectPhoneNumbers(text);");
nf.push("  const uniquePhones = [...new Set(phones)];");
nf.push("  ");
nf.push("  uniquePhones.forEach(phone => {");
nf.push("    if (!isPhoneMasked(phone)) {");
nf.push("      let searchIdx = 0;");
nf.push("      while (true) {");
nf.push("        const phoneIdx = text.indexOf(phone, searchIdx);");
nf.push("        if (phoneIdx === -1) break;");
nf.push("        const context = getMatchContext(text, phoneIdx, phone.length, 40);");
nf.push("        issues.push({");
nf.push("          id: generateId(\"phone\"),");
nf.push("          phoneNumber: phone,");
nf.push("          phone: phone,");
nf.push("          sourceType,");
nf.push("          sourceId,");
nf.push("          sourceName,");
nf.push("          fieldName: extraMeta.fieldName || \"unknown\" ,");
nf.push("          status: \"pending_review\" ,");
nf.push("          detectedAt: new Date().toISOString(),");
nf.push("          note: \"手机号在导出中漏遮，留待算法同事复核，暂不归为正常\" ,");
nf.push("          rawMaterialSnapshot: {");
nf.push("            fullText: text,");
nf.push("            phoneContext: context,");
nf.push("            position: phoneIdx,");
nf.push("            fieldName: extraMeta.fieldName || \"unknown\"");
nf.push("          },");
nf.push("          context: context ? context.fullContext : \"\" ,");
nf.push("          traceId: generateId(\"trace\"),");
nf.push("          ...extraMeta");
nf.push("        });");
nf.push("        searchIdx = phoneIdx + 1;");
nf.push("      }");
nf.push("    }");
nf.push("  });");
nf.push("  ");
nf.push("  return issues;");
nf.push("}");

const result = lines.slice(0, s).concat(nf).concat(lines.slice(e + 1));
c = result.join("\n");
console.log("Fix 1 done");

fs.writeFileSync("src/inspectionEngine.js", c);
console.log("File written");

const fs = require('fs');
let c = fs.readFileSync('src/inspectionEngine.js', 'utf8');

// Fix 0: const -> let for allPhoneIssues
c = c.replace('const allPhoneIssues = [];', 'let allPhoneIssues = [];');
console.log('0: const->let');

// Fix 1: checkPhoneMasking function
const oldCheck = `function checkPhoneMasking(text, sourceType, sourceId, sourceName) {
  const issues = [];
  const phones = detectPhoneNumbers(text);
  
  phones.forEach(phone => {
    if (!isPhoneMasked(phone)) {
      const phoneIdx = text.indexOf(phone);
      issues.push({
        id: generateId('phone'),
        phoneNumber: phone,
        sourceType,
        sourceId,
        sourceName,
        status: 'pending_review',
        detectedAt: new Date().toISOString(),
        note: '手机号在导出中漏遮，留待算法同事复核，暂不归为正常',
        rawMaterialSnapshot: {
          fullText: text,
          phoneContext: getMatchContext(text, phoneIdx, phone.length, 40),
          position: phoneIdx
        },
        traceId: generateId('trace')
      });
    }
  });
  
  return issues;
}`;

const newCheck = `function checkPhoneMasking(text, sourceType, sourceId, sourceName, extraMeta) {
  extraMeta = extraMeta || {};
  const issues = [];
  const phones = detectPhoneNumbers(text);
  const uniquePhones = [...new Set(phones)];
  
  uniquePhones.forEach(phone => {
    if (!isPhoneMasked(phone)) {
      let searchIdx = 0;
      while (true) {
        const phoneIdx = text.indexOf(phone, searchIdx);
        if (phoneIdx === -1) break;
        const context = getMatchContext(text, phoneIdx, phone.length, 40);
        issues.push({
          id: generateId('phone'),
          phoneNumber: phone,
          phone: phone,
          sourceType,
          sourceId,
          sourceName,
          fieldName: extraMeta.fieldName || 'unknown',
          status: 'pending_review',
          detectedAt: new Date().toISOString(),
          note: '手机号在导出中漏遮，留待算法同事复核，暂不归为正常',
          rawMaterialSnapshot: {
            fullText: text,
            phoneContext: context,
            position: phoneIdx,
            fieldName: extraMeta.fieldName || 'unknown'
          },
          context: context ? context.fullContext : '',
          traceId: generateId('trace'),
          ...extraMeta
        });
        searchIdx = phoneIdx + 1;
      }
    }
  });
  
  return issues;
}`;

if (c.includes(oldCheck)) { c = c.replace(oldCheck, newCheck); console.log('1: checkPhoneMasking'); }
else { console.log('1: FAIL checkPhoneMasking'); process.exit(1); }

fs.writeFileSync('src/inspectionEngine.js', c, 'utf8');
console.log('Saved part 1');

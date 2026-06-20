import re

with open('src/inspectionEngine.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

NL = chr(10)

for i in range(len(lines)):
    lines[i] = lines[i].replace('const allPhoneIssues = [];', 'let allPhoneIssues = [];')

new_func_lines = [
    'function checkPhoneMasking(text, sourceType, sourceId, sourceName, extraMeta) {' + NL,
    '  extraMeta = extraMeta || {};' + NL,
    '  const issues = [];' + NL,
    '  const phones = detectPhoneNumbers(text);' + NL,
    '  const uniquePhones = [...new Set(phones)];' + NL,
    '  ' + NL,
    '  uniquePhones.forEach(phone => {' + NL,
    '    if (!isPhoneMasked(phone)) {' + NL,
    '      let searchIdx = 0;' + NL,
    '      while (true) {' + NL,
    '        const phoneIdx = text.indexOf(phone, searchIdx);' + NL,
    '        if (phoneIdx === -1) break;' + NL,
    '        const context = getMatchContext(text, phoneIdx, phone.length, 40);' + NL,
    '        issues.push({' + NL,
    '          id: generateId("phone"),' + NL,
    '          phoneNumber: phone,' + NL,
    '          phone: phone,' + NL,
    '          sourceType,' + NL,
    '          sourceId,' + NL,
    '          sourceName,' + NL,
    '          fieldName: extraMeta.fieldName || "unknown",' + NL,
    '          status: "pending_review",' + NL,
    '          detectedAt: new Date().toISOString(),' + NL,
    '          note: "手机号在导出中漏遮，留待算法同事复核，暂不归为正常",' + NL,
    '          rawMaterialSnapshot: {' + NL,
    '            fullText: text,' + NL,
    '            phoneContext: context,' + NL,
    '            position: phoneIdx,' + NL,
    '            fieldName: extraMeta.fieldName || "unknown"' + NL,
    '          },' + NL,
    '          context: context ? context.fullContext : "",' + NL,
    '          traceId: generateId("trace"),' + NL,
    '          ...extraMeta' + NL,
    '        });' + NL,
    '        searchIdx = phoneIdx + 1;' + NL,
    '      }' + NL,
    '    }' + NL,
    '  });' + NL,
    '  ' + NL,
    '  return issues;' + NL,
    '}' + NL
]

lines = lines[:254] + new_func_lines + lines[283:]

with open('src/inspectionEngine.js', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print('Fix 1 done')

#!/bin/bash
# 修改 inspection 对象
sed -i '' 's/    gaps: allCitationGaps,/    citationGaps: {
      gaps: allCitationGaps
    },
    gaps: allCitationGaps,/' src/inspectionEngine.js

# 修改 phoneIssues
sed -i '' 's/    phoneIssues: allPhoneIssues,/    phoneMaskIssues: {
      phoneIssues: allPhoneIssues
    },
    phoneIssues: allPhoneIssues,/' src/inspectionEngine.js
echo "Inspection object updated"

const fs=require("fs");let c=fs.readFileSync("src/inspectionEngine.js","utf8");if(!c.includes("citationGaps:")){c=c.replace("    gaps: allCitationGaps,","    citationGaps: {gaps: allCitationGaps},    gaps: allCitationGaps,");c=c.replace("    phoneIssues: allPhoneIssues,","    phoneMaskIssues: {phoneIssues: allPhoneIssues},    phoneIssues: allPhoneIssues,");}if(!c.includes("gapsSummary:")){const oldExp="  const exportResult = {
    id: generateId(\"export\"),
    inspectionId: inspection.id,
    type: \"inspection_export\",
    content: generateFriendlyReport(inspection),
    createdAt: new Date().toISOString(),
    status: \"generated\"
  };
  saveExportResult(exportResult);

  return {
    inspection,
    exportResult,
    friendlyReport: generateFriendlyReport(inspection)
  };";const newExp=`  const allPhoneMaskIssues = getPhoneMaskIssues();
  const pendingCount = allPhoneMaskIssues.filter(p => p.status === "pending_review").length;
  const confirmedCount = allPhoneMaskIssues.filter(p => p.status === "confirmed").length;
  const ragMissing = allCitationGaps.filter(g => g.type === "no_rag_evidence" || g.type === "batch_no_rag_evidence").length;
  const ragFound = allCitationGaps.filter(g => g.type === "rag_reference_found" || g.type === "batch_rag_reference_found").length;
  const other = allCitationGaps.filter(g => !g.type.includes("rag")).length;
  const gapsSummary = {ragMissing,ragFound,other,total: allCitationGaps.length};
  const phoneIssuesSummary = {pending: pendingCount,confirmed: confirmedCount,items: allPhoneMaskIssues.map(p => ({traceId: p.traceId,phoneNumber: p.phoneNumber,fieldName: p.fieldName,status: p.status,sourceName: p.sourceName,context: p.context || (p.rawMaterialSnapshot?.phoneContext?.fullContext || "")}))};
  const exportResult = {id: generateId("export"),inspectionId: inspection.id,type: "inspection_export",content: generateFriendlyReport(inspection),createdAt: new Date().toISOString(),status: "generated",gapsSummary: gapsSummary,phoneIssuesSummary: phoneIssuesSummary};
  saveExportResult(exportResult);
  return {inspection: inspection,exportResult: exportResult,friendlyReport: generateFriendlyReport(inspection)};`;c=c.replace(oldExp,newExp);}fs.writeFileSync("src/inspectionEngine.js",c);console.log("OK");

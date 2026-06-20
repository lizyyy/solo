const { clearAllData, importDesensitizationRule, addGrayBatch, getExportResults } = require('./src/models');
const { runInspection, findValidRagMatches } = require('./src/inspectionEngine');

clearAllData();

var ruleA = importDesensitizationRule({
  name: "Rule A",
  remark: "Main flow: basic. Note: /ref is just a path",
  mainProcess: "1.customer 2.record 3.desens 4./ref not RAG 5.store",
  content: "Desc: this rule lacks RAG reference. Test phone: 13600136000. Test phone 2: 13700137000"
}, "Op1");

var combined = (ruleA.remark||'') + "\n" + (ruleA.mainProcess||'') + "\n" + (ruleA.content||'');
var r = findValidRagMatches(combined);
console.log("validMatches count:", r.validMatches.length);
console.log("negatedMatches count:", r.negatedMatches.length);
r.negatedMatches.forEach(function(n){ console.log("  neg:", n.matchedText, n.negationReason); });

var r1 = runInspection("Admin");
console.log("gaps count:", r1.inspection.gaps.length);
r1.inspection.gaps.forEach(function(g){
  console.log("  gap type:", g.type, "ruleId:", g.ruleId||'none', "hasSnap:", !!g.rawMaterialSnapshot);
  if (g.rawMaterialSnapshot) {
    console.log("    neg in snap:", g.rawMaterialSnapshot.negatedMatches ? g.rawMaterialSnapshot.negatedMatches.length : "MISSING");
  }
});

console.log("phones count:", r1.inspection.phoneIssues.length);
r1.inspection.phoneIssues.forEach(function(p){
  console.log("  phone:", p.phoneNumber, "topField:", p.fieldName, "snapField:", p.rawMaterialSnapshot ? p.rawMaterialSnapshot.fieldName : "NO_SNAP");
});

console.log("exportResult keys:", Object.keys(r1.exportResult));
console.log("has gapsSummary:", r1.exportResult.gapsSummary !== undefined);

var ae = getExportResults();
console.log("getExportResults count:", ae.length);
ae.forEach(function(e, i){
  console.log("  export", i, "gapsSummary:", e.gapsSummary !== undefined);
});

console.log("\n--- Now adding batches ---");
var b002 = addGrayBatch({
  batchNo: "B-002", relatedRuleId: ruleA.id,
  sceneStatement: "Scene: test phone 13900139000 not masked. RAG ref to be added.",
  content: "Content: phone 13911139111 leak."
}, "Op2");

var r2 = runInspection("Op2");
console.log("gaps2 count:", r2.inspection.gaps.length);
var g002 = r2.inspection.gaps.find(function(g){ return g.batchId === b002.id && g.type === "batch_no_rag_evidence"; });
console.log("g002 batch_no_rag_evidence:", g002 !== undefined);
if (g002) {
  console.log("  has snap:", !!g002.rawMaterialSnapshot);
  if (g002.rawMaterialSnapshot) {
    console.log("  neg count:", g002.rawMaterialSnapshot.negatedMatches ? g002.rawMaterialSnapshot.negatedMatches.length : "MISSING");
  }
}
console.log("phones2 count:", r2.inspection.phoneIssues.length);
r2.inspection.phoneIssues.forEach(function(p){
  console.log("  phone:", p.phoneNumber, "snapField:", p.rawMaterialSnapshot ? p.rawMaterialSnapshot.fieldName : "NO_SNAP");
});

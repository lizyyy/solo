var fs = require("fs");
var content = fs.readFileSync("frontend/index.html", "utf8");

var replacements = {
  'id="newRenameBatchName"': 'id="newBatchNameInput"',
  'id="confirmCreateBatch"': 'id="confirmCreateBatchBtn"',
  'id="confirmRenameBatch"': 'id="confirmRenameBtn"',
  'id="clearSelectionBtn"': 'id="cancelSelectBtn"',
  'id="userIdSearch"': 'id="userIdFilter"',
  'id="recordsBody"': 'id="recordsTableBody"',
  'id="selfCheckBtn"': 'id="checkBtn"',
  'id="recalcBtn"': 'id="recheckBtn"',
  'id="operatorName"': 'id="operator"',
  'id="confirmMergeBtn"': 'id="confirmMerge"',
  'id="mergeModal"': 'id="mergeTargetModal"',
  'id="batchFileInfo"': 'id="batchFile"',
  'id="batchCreateTime"': 'id="batchTime"'
};

for (var old in replacements) {
  if (content.indexOf(old) >= 0) {
    content = content.split(old).join(replacements[old]);
    console.log("OK:", old, "->", replacements[old]);
  } else {
    console.log("NOT FOUND:", old);
  }
}

fs.writeFileSync("frontend/index.html", content);
console.log("Done. Size:", content.length);

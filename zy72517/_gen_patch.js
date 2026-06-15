var fs = require("fs");

var selfCheckContent = fs.readFileSync("backend/services/selfCheck.js", "utf8");
var batchesContent = fs.readFileSync("backend/routes/batches.js", "utf8");
var indexHtmlContent = fs.readFileSync("frontend/index.html", "utf8");
var appJsContent = fs.readFileSync("frontend/app.js", "utf8");

console.log("selfCheck lines:", selfCheckContent.split("\n").length);
console.log("batches lines:", batchesContent.split("\n").length);
console.log("index.html lines:", indexHtmlContent.split("\n").length);
console.log("app.js lines:", appJsContent.split("\n").length);

function escapeForJsString(str) {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, "\\\"")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

var patchContent = 'var fs = require("fs");\n';
patchContent += 'var path = require("path");\n\n';
patchContent += 'var baseDir = "/Users/lzy/pro/solo/workspaces/zy72517";\n\n';
patchContent += 'function countLines(str) { return str.split("\\n").length; }\n\n';
patchContent += 'var selfCheckContent = "' + escapeForJsString(selfCheckContent) + '";\n\n';
patchContent += 'var batchesContent = "' + escapeForJsString(batchesContent) + '";\n\n';
patchContent += 'var indexHtmlContent = "' + escapeForJsString(indexHtmlContent) + '";\n\n';
patchContent += 'var appJsContent = "' + escapeForJsString(appJsContent) + '";\n\n';
patchContent += 'fs.writeFileSync(baseDir + "/backend/services/selfCheck.js", selfCheckContent);\n';
patchContent += 'console.log("1. backend/services/selfCheck.js: " + countLines(selfCheckContent) + " lines");\n\n';
patchContent += 'fs.writeFileSync(baseDir + "/backend/routes/batches.js", batchesContent);\n';
patchContent += 'console.log("2. backend/routes/batches.js: " + countLines(batchesContent) + " lines");\n\n';
patchContent += 'fs.writeFileSync(baseDir + "/frontend/index.html", indexHtmlContent);\n';
patchContent += 'console.log("3. frontend/index.html: " + countLines(indexHtmlContent) + " lines");\n\n';
patchContent += 'fs.writeFileSync(baseDir + "/frontend/app.js", appJsContent);\n';
patchContent += 'console.log("4. frontend/app.js: " + countLines(appJsContent) + " lines");\n\n';
patchContent += 'console.log("done");\n';

fs.writeFileSync("patch.js", patchContent);
console.log("patch.js generated, lines:", patchContent.split("\n").length);

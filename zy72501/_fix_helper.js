const fs = require("fs");
let c = fs.readFileSync("src/inspectionEngine.js", "utf8");

// Fix 0
c = c.replace("const allPhoneIssues = [];", "let allPhoneIssues = [];");

fs.writeFileSync("src/inspectionEngine.js", c);
console.log("Fix 0 done");

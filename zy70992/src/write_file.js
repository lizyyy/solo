const fs = require("fs");
const content = process.argv[1];
fs.appendFileSync("batchService.js", content);
console.log("done");

const fs = require("fs");
const p = "src/inspectionEngine.js";
let c = fs.readFileSync(p, "utf8");
// Step 1: Insert RAG helpers after PHONE_REGEX line
const ragBlock = `

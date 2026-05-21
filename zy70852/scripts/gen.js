const fs = require("fs");
const path = require("path");

const importPath = path.join(__dirname, "../src/services/importService.js");
let content = fs.readFileSync(importPath, "utf-8");

const closeBrace = content.lastIndexOf("}");
const beforeClose = content.substring(0, closeBrace);
const afterClose = content.substring(closeBrace);

const newMethods = `
  async listBatches(page, pageSize) {
    const offset = (page - 1) * pageSize;
    const batches = await db.all(
      "SELECT * FROM batches ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [pageSize, offset]
    );
    const totalResult = await db.get("SELECT COUNT(*) as count FROM batches");
    return {
      list: batches,
      total: totalResult.count,
      page,
      pageSize
    };
  }
`;

content = beforeClose + newMethods + "\n" + afterClose;
fs.writeFileSync(importPath, content);
console.log("Added listBatches method");

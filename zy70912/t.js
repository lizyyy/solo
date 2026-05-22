const fs = require("fs");
const csv = require("csv-parser");

const results = [];
fs.createReadStream("./data/sample_claims.csv")
  .pipe(csv())
  .on("data", (r) => results.push(r))
  .on("end", () => {
    console.log("CSV导入成功，记录数:", results.length);
    console.log("");
    results.forEach((r, i) => {
      const amt = parseFloat(r["申诉金额"] || 0);
      const level = amt <= 500 ? "A" : amt <= 2000 ? "B" : amt <= 5000 ? "C" : "D";
      const flag = amt > 5000 ? " *需人工审核" : "";
      console.log((i+1) + ". " + r["行李牌号"] + " - " + r["旅客姓名"] + " - ¥" + r["申诉金额"] + " - 等级" + level + flag);
    });
  });

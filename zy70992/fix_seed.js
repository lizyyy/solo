const fs = require("fs");
let content = fs.readFileSync("src/seed.js", "utf8");

const oldCode = `  var OPERATOR = "审核员-王老师";

  processCard(1, "approve", "正常刷卡，补贴内", 5.0, OPERATOR);
  processCard(2, "approve", "正常刷卡，补贴内", 12.0, OPERATOR);
  processCard(3, "return", "金额异常偏高，请核实当日菜品", null, OPERATOR);
  processCard(4, "approve", "正常刷卡", 8.0, OPERATOR);
  processCard(5, "approve", "正常刷卡", 9.5, OPERATOR);
  processCard(6, "approve", "正常刷卡", 4.5, OPERATOR);
  processCard(7, "approve", "正常刷卡，补贴内", 18.0, OPERATOR);
  processCard(8, "approve", "正常刷卡", 11.0, OPERATOR);
  processCard(9, "approve", "正常刷卡", 13.0, OPERATOR);
  processCard(10, "reject", "重复领取：同日同餐已存在记录#9", null, OPERATOR);
  processCard(11, "reject", "学生不在补贴名单中，不予补贴", null, OPERATOR);
  processCard(12, "return", "金额为零，疑似系统故障或测试记录，请核实", null, OPERATOR);
  processCard(13, "reject", "学号无效，无法匹配学生信息", null, OPERATOR);
  processCard(14, "return", "超出单日补贴上限20元，需特殊审批", null, OPERATOR);`;

const newCode = `  var OPERATOR = "审核员-王老师";
  var cards = db.prepare("SELECT * FROM card_records WHERE batch_id = ? ORDER BY id").all(batchId);

  processCard(cards[0].id, "approve", "正常刷卡，补贴内", 5.0, OPERATOR);
  processCard(cards[1].id, "approve", "正常刷卡，补贴内", 12.0, OPERATOR);
  processCard(cards[2].id, "return", "金额异常偏高，请核实当日菜品", null, OPERATOR);
  processCard(cards[3].id, "approve", "正常刷卡", 8.0, OPERATOR);
  processCard(cards[4].id, "approve", "正常刷卡", 9.5, OPERATOR);
  processCard(cards[5].id, "approve", "正常刷卡", 4.5, OPERATOR);
  processCard(cards[6].id, "approve", "正常刷卡，补贴内", 18.0, OPERATOR);
  processCard(cards[7].id, "approve", "正常刷卡", 11.0, OPERATOR);
  processCard(cards[8].id, "approve", "正常刷卡", 13.0, OPERATOR);
  processCard(cards[9].id, "reject", "重复领取：同日同餐已存在记录#9", null, OPERATOR);
  processCard(cards[10].id, "reject", "学生不在补贴名单中，不予补贴", null, OPERATOR);
  processCard(cards[11].id, "return", "金额为零，疑似系统故障或测试记录，请核实", null, OPERATOR);
  processCard(cards[12].id, "reject", "学号无效，无法匹配学生信息", null, OPERATOR);
  processCard(cards[13].id, "return", "超出单日补贴上限20元，需特殊审批", null, OPERATOR);`;

content = content.replace(oldCode, newCode);
fs.writeFileSync("src/seed.js", content, "utf8");
console.log("修改完成，位置:", content.indexOf(newCode));

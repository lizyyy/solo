const fs = require('fs');
let content = fs.readFileSync('src/server.js', 'utf8');

// 查找并替换第一个异常检测块
let old1 = `      if (hasPayment && !hasChargerLog) {
        checks.push({
          type: "uninitiated_charge",
          description: "未启动扣费检测：有支付记录但无充电日志",
          suggestion: "建议核实是否实际充电，考虑全额退款"
        });
      }`;

let new1 = `      if (hasPayment && !hasChargerLog) {
        const exceptionType = "uninitiated_charge";
        const description = "未启动扣费检测：有支付记录但无充电日志";
        checks.push({
          type: exceptionType,
          description: description,
          suggestion: "建议核实是否实际充电，考虑全额退款"
        });
        await runInsert(
          "INSERT INTO exception_records (id, order_id, batch_id, exception_type, description, handler, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [uuidv4(), order.id, batch_id, exceptionType, description, operator || "system", "open"]
        );
      }`;

content = content.replace(old1, new1);
console.log('Replaced block 1:', content.includes(new1));

// 查找并替换第二个异常检测块
let old2 = `      if (refundRecords.length > 1) {
        checks.push({
          type: "duplicate_refund",
          description: "重复退款检测：同一订单多次退款记录",
          suggestion: "退款次数: " + refundRecords.length + "次，建议核查"
        });
      }`;

let new2 = `      if (refundRecords.length > 1) {
        const exceptionType = "duplicate_refund";
        const description = "重复退款检测：同一订单" + refundRecords.length + "次退款记录";
        checks.push({
          type: exceptionType,
          description: description,
          suggestion: "建议核查重复退款原因"
        });
        await runInsert(
          "INSERT INTO exception_records (id, order_id, batch_id, exception_type, description, handler, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [uuidv4(), order.id, batch_id, exceptionType, description, operator || "system", "open"]
        );
      }`;

content = content.replace(old2, new2);
console.log('Replaced block 2:', content.includes(new2));

// 查找并替换第三个异常检测块
let old3 = `      if (hasPayment && !paymentChannelMatch && validChannels.length > 0) {
        checks.push({
          type: "cross_platform_mismatch",
          description: "跨平台订单检测：平台与支付渠道不匹配",
          suggestion: "订单平台: " + order.platform + ", 实际支付渠道: " + (paymentReceipts[0]?.payment_method || "未知")
        });
      }`;

let new3 = `      if (hasPayment && !paymentChannelMatch && validChannels.length > 0) {
        const exceptionType = "cross_platform_mismatch";
        const description = "跨平台订单检测：订单平台" + order.platform + "与实际支付渠道" + (paymentReceipts[0]?.payment_method || "未知") + "不匹配";
        checks.push({
          type: exceptionType,
          description: description,
          suggestion: "建议核实支付渠道有效性"
        });
        await runInsert(
          "INSERT INTO exception_records (id, order_id, batch_id, exception_type, description, handler, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [uuidv4(), order.id, batch_id, exceptionType, description, operator || "system", "open"]
        );
      }`;

content = content.replace(old3, new3);
console.log('Replaced block 3:', content.includes(new3));

// 更新操作日志和响应
content = content.replace(
  `    await logOperation(operator || "system", "refund_recalculate", "batch", batch_id, "重新计算退款审核: " + orders.length + "条订单");
    res.json({ success: true, data: results, total: orders.length });`,
  `    await logOperation(operator || "system", "refund_recalculate", "batch", batch_id, "重新计算退款审核: " + orders.length + "条订单，异常已持久化");
    res.json({ success: true, data: results, total: orders.length, persisted: true });`
);
console.log('Replaced response:', content.includes('persisted: true'));

fs.writeFileSync('src/server.js', content);
console.log('File saved');

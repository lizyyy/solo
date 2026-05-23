const http = require("http");

function post(path, data) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: "localhost",
      port: 3000,
      path: path,
      method: "POST",
      headers: { "Content-Type": "application/json" }
    }, (res) => {
      let body = "";
      res.on("data", c => body += c);
      res.on("end", () => resolve(JSON.parse(body)));
    });
    req.on("error", reject);
    req.write(JSON.stringify(data));
    req.end();
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    http.get("http://localhost:3000" + path, (res) => {
      let b = "";
      res.on("data", c => b += c);
      res.on("end", () => resolve(JSON.parse(b)));
    }).on("error", reject);
  });
}

async function test() {
  console.log("=== 测试：重复交易编号拦截 ===");
  console.log("");

  console.log("1. 创建批次");
  const batch = await post("/api/batches", {
    store_code: "SH001",
    store_name: "上海浦东店",
    operator: "测试员"
  });
  console.log("   批次ID:", batch.data.id);
  console.log("");

  console.log("2. 登记数据（TXN001 重复3次，TXN002 正常）");
  const r = await post("/api/points/" + batch.data.id + "/register", {
    data: [
      { member_phone: "13800000001", transaction_no: "TXN001", transaction_time: "2024-05-01 10:30:00", points: 100 },
      { member_phone: "13800000002", transaction_no: "TXN001", transaction_time: "2024-05-02 10:30:00", points: 200 },
      { member_phone: "13800000003", transaction_no: "TXN002", transaction_time: "2024-05-03 10:30:00", points: 300 },
      { member_phone: "13800000004", transaction_no: "TXN001", transaction_time: "2024-05-04 10:30:00", points: 400 }
    ]
  });
  console.log("   统计：Total=" + r.data.total + ", Normal=" + r.data.normal + ", Pending=" + r.data.pending + ", Blocked=" + r.data.blocked);
  console.log("");

  console.log("3. 明细详情（含原始行号）：");
  for (const d of r.data.details) {
    console.log("   行" + d.line_number + ": " + d.status + " - " + d.reasons.join("; "));
  }
  console.log("");

  console.log("4. 验证：Blocked 状态的明细能否回溯原始行号");
  const blocked = r.data.details.filter(d => d.status === "blocked");
  if (blocked.length > 0) {
    console.log("   Blocked 明细数量: " + blocked.length);
    for (const b of blocked) {
      const detail = await get("/api/points/detail/" + b.detail_id);
      console.log("   - 明细ID: " + b.detail_id);
      console.log("     原始行号: " + detail.data.line_number);
      console.log("     原始数据: " + JSON.stringify(detail.data.raw_data));
      const traces = await get("/api/points/detail/" + b.detail_id + "/traces");
      console.log("     处理轨迹: " + traces.data[0].remark);
    }
  } else {
    console.log("   ❌ 错误：没有 blocked 明细！");
  }
  console.log("");

  console.log("5. 验证：错误明细报告包含 blocked 数据");
  const errors = await get("/api/points/" + batch.data.id + "/errors");
  console.log("   错误明细数量: " + errors.data.length);
  for (const e of errors.data) {
    if (e.status === "blocked") {
      console.log("   - 行" + e.line_number + ": status=" + e.status + ", reason=" + e.status_reason);
    }
  }
  console.log("");

  if (r.data.blocked >= 2 && blocked.length >= 2) {
    console.log("✅ 测试通过！同一批次内的重复交易编号被正确拦截为 blocked 状态！");
  } else {
    console.log("❌ 测试失败！期望至少2条blocked，实际：" + r.data.blocked);
  }
}

test().catch(console.error);

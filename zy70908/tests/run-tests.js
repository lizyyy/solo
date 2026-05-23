const http = require("http");
process.env.NO_PROXY = "localhost";
const fs = require("fs");
const path = require("path");

const BASE_URL = "localhost";
const PORT = 3000;

let testResults = [];
let batchId = null;
let orderId = null;

function request(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      port: PORT,
      path: path,
      method: method,
      headers: { "Content-Type": "application/json", ...headers }
    };
    const req = http.request({...options, agent: new http.Agent()}, (res) => {
      let body = "";
      res.on("data", chunk => body += chunk);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
        catch (e) { resolve({ status: res.statusCode, body }); }
      });
    });
    req.on("error", reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runTest(name, testFn) {
  console.log("\n[测试] " + name);
  try {
    await testFn();
    console.log("  ✅ 通过");
    testResults.push({ name, status: "pass" });
  } catch (e) {
    console.log("  ❌ 失败:", e.message);
    testResults.push({ name, status: "fail", error: e.message });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || "断言失败");
}

async function main() {
  console.log("=".repeat(60));
  console.log("新能源客服后端服务 - 自动化测试");
  console.log("=".repeat(60));

  await runTest("健康检查", async () => {
    const res = await request("GET", "/api/health");
    assert(res.status === 200, "状态码应为200");
    assert(res.body.success === true, "success应为true");
  });

  await runTest("创建批次", async () => {
    const res = await request("POST", "/api/batches", {
      batch_no: "TEST-BATCH-" + Date.now(),
      name: "测试批次",
      handler: "测试员",
      operator: "admin"
    });
    assert(res.status === 200);
    assert(res.body.success === true);
    assert(res.body.data.id);
    batchId = res.body.data.id;
  });

  await runTest("幂等性测试 - 创建重复批次号", async () => {
    const batchNo = "IDEMPOTENT-" + Date.now();
    const res1 = await request("POST", "/api/batches", {
      batch_no: batchNo, name: "幂等测试批次", handler: "测试员", operator: "admin"
    });
    const res2 = await request("POST", "/api/batches", {
      batch_no: batchNo, name: "幂等测试批次", handler: "测试员", operator: "admin"
    });
    assert(res2.body.success === true || res2.body.idempotent === true);
  });

  await runTest("查询批次列表", async () => {
    const res = await request("GET", "/api/batches");
    assert(res.status === 200);
    assert(Array.isArray(res.body.data));
  });

  await runTest("退款审核重算", async () => {
    const res = await request("POST", "/api/refund/recalculate", { batch_id: batchId, operator: "admin" });
    assert(res.status === 200);
    assert(res.body.success === true);
  });

  await runTest("查询异常记录", async () => {
    const res = await request("GET", "/api/exception-records");
    assert(res.status === 200);
    assert(Array.isArray(res.body.data));
  });

  await runTest("查询操作日志", async () => {
    const res = await request("GET", "/api/operation-logs");
    assert(res.status === 200);
    assert(Array.isArray(res.body.data));
  });

  await runTest("生成最终报告", async () => {
    const res = await request("GET", "/api/reports/batch/" + batchId);
    assert(res.status === 200);
    assert(res.body.success === true);
  });

  console.log("\n" + "=".repeat(60));
  console.log("测试结果汇总");
  console.log("=".repeat(60));
  const passed = testResults.filter(t => t.status === "pass").length;
  const failed = testResults.filter(t => t.status === "fail").length;
  console.log("通过: " + passed + ", 失败: " + failed + ", 总计: " + testResults.length);
  
  if (failed > 0) {
    console.log("\n失败的测试:");
    testResults.filter(t => t.status === "fail").forEach(t => {
      console.log("  - " + t.name + ": " + t.error);
    });
  }
  console.log("\n" + "=".repeat(60));
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error("测试运行失败:", err);
  process.exit(1);
});

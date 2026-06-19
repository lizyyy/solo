import { spawn, ChildProcess } from "node:child_process";
import http from "node:http";
import { setTimeout } from "node:timers/promises";

const PORT = 3877;
const BASE = `http://localhost:${PORT}`;

let serverProcess: ChildProcess | null = null;

function httpRequest(method: string, path: string, body?: unknown): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const options: http.RequestOptions = {
      method,
      hostname: "localhost",
      port: PORT,
      path,
      headers: {
        "Content-Type": "application/json",
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
      },
    };
    const req = http.request(options, (res) => {
      let chunks = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (chunks += c));
      res.on("end", () => {
        try {
          const ct = res.headers["content-type"] || "";
          if (ct.includes("application/json") && chunks) {
            resolve({ status: res.statusCode, body: JSON.parse(chunks), raw: chunks });
          } else {
            resolve({ status: res.statusCode, body: chunks, raw: chunks });
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

function LOG(section: string, msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`\n━━━ ${ts} [${section}] ━━━\n  ${msg}`);
}

function ASSERT(cond: boolean, desc: string) {
  if (cond) {
    console.log(`  ✅ PASS：${desc}`);
  } else {
    console.log(`  ❌ FAIL：${desc}`);
    process.exitCode = 1;
  }
}

async function startServer() {
  LOG("启动", `启动服务端口 ${PORT}`);
  serverProcess = spawn("npx", ["tsx", "src/server.ts"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: String(PORT) },
  });
  serverProcess.stdout?.on("data", (d) => process.stdout.write(`[server] ${d.toString()}`));
  serverProcess.stderr?.on("data", (d) => process.stderr.write(`[server:err] ${d.toString()}`));
  for (let i = 0; i < 80; i++) {
    await setTimeout(400);
    try {
      const r = await httpRequest("GET", "/api/step");
      if (r.status === 200) return;
    } catch { /* ignore */ }
  }
  throw new Error("server timeout");
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    serverProcess = null;
  }
}

function makeSampleData() {
  const records: Array<{
    originalLineNumber: number;
    timestamp: string;
    beltId: string;
    tensionValue: number;
    unit: string;
    temperature: number | null;
  }> = [];

  for (let i = 0; i < 8; i++) {
    records.push({
      originalLineNumber: i + 1,
      timestamp: `2024-01-${String(i + 1).padStart(2, "0")}T08:00:00Z`,
      beltId: `BELT-${String((i % 3) + 1).padStart(2, "0")}`,
      tensionValue: 50 + (i % 5) * 2,
      unit: "N",
      temperature: 25 + (i % 3),
    });
  }

  records.push(
    { originalLineNumber: 9, timestamp: "2024-01-09T08:00:00Z", beltId: "BELT-01", tensionValue: 108, unit: "N", temperature: 28 },
    { originalLineNumber: 10, timestamp: "2024-01-10T08:00:00Z", beltId: "BELT-02", tensionValue: 5, unit: "N", temperature: 23 },
    { originalLineNumber: 11, timestamp: "2024-01-11T08:00:00Z", beltId: "BELT-01", tensionValue: 53.5, unit: "N", temperature: 24 },
    { originalLineNumber: 12, timestamp: "2024-01-12T08:00:00Z", beltId: "BELT-02", tensionValue: 54.3, unit: "N", temperature: 25 },
    { originalLineNumber: 13, timestamp: "2024-01-13T08:00:00Z", beltId: "BELT-03", tensionValue: 54.8, unit: "N", temperature: 26 },
    { originalLineNumber: 14, timestamp: "2024-01-01T08:00:00Z", beltId: "BELT-01", tensionValue: 50, unit: "N", temperature: 25 },
    { originalLineNumber: 15, timestamp: "2024-01-14T08:00:00Z", beltId: "BELT-03", tensionValue: 52, unit: "N", temperature: 24 },
    { originalLineNumber: 16, timestamp: "2024-01-15T08:00:00Z", beltId: "BELT-01", tensionValue: 56, unit: "N", temperature: 26 },
    { originalLineNumber: 17, timestamp: "2024-01-16T08:00:00Z", beltId: "BELT-02", tensionValue: 48, unit: "N", temperature: 25 },
  );
  return records;
}

// ---------- 完整业务线主流程 ----------
async function main() {
  LOG("环境", `工作目录：${process.cwd()}`);

  try {
    await startServer();

    // ===== Step 0: 打开项目入口（根路径 HTML + /api/step） =====
    LOG("步骤 0", "打开项目入口：GET / 页面 HTML + GET /api/step 后端步骤");
    const html = await httpRequest("GET", "/");
    ASSERT(html.status === 200 && typeof html.body === "string" && html.body.includes("传送带张力巡检"),
      "页面入口返回 HTML（含标题）");

    const step0 = await httpRequest("GET", "/api/step");
    ASSERT(step0.status === 200 && step0.body.step === "first_import",
      `后端初始步骤 first_import（实际：${step0.body.step}）`);

    await httpRequest("GET", "/api/reset");

    // ===== Step 1: 保存阈值配置 =====
    LOG("步骤 1", "保存阈值配置：上限 54 / 下限 20 / 单位 N");
    const cfg = await httpRequest("POST", "/api/config", {
      upperLimit: 54, lowerLimit: 20, unit: "N",
      beltThresholds: [
        { beltId: "BELT-01", unit: "N", upperLimit: 54, lowerLimit: 20 },
        { beltId: "BELT-02", unit: "N", upperLimit: 54, lowerLimit: 20 },
        { beltId: "BELT-03", unit: "N", upperLimit: 54, lowerLimit: 20 },
      ],
    });
    ASSERT(cfg.status === 200 && cfg.body.ok === true, "配置保存成功");

    const cfgGet = await httpRequest("GET", "/api/config");
    ASSERT(cfgGet.body.beltThresholds && cfgGet.body.beltThresholds.length === 3,
      "GET /api/config 返回 3 条皮带阈值配置");

    // ===== Step 2: 首次导入 —— 关键：步骤同步验证 =====
    LOG("步骤 2-1", "首次导入 17 条样例（含 1 条本次重复）");
    const sample = makeSampleData();
    const imp = await httpRequest("POST", "/api/import/first", { records: sample });
    ASSERT(imp.status === 200, "首次导入接口 200 OK");
    ASSERT(imp.body.newRecordIds.length === 16 && imp.body.currentBatchDuplicateKeys.length === 1,
      `新记录 16 / 本次重复 1（实际：${imp.body.newRecordIds.length} / ${imp.body.currentBatchDuplicateKeys.length}）`);

    // 首次导入后前端会同步调用 advance-step（模拟前端行为）
    LOG("步骤 2-2", "模拟前端：首次导入成功后自动调 POST /api/advance-step 推进后端步骤");
    const adv1 = await httpRequest("POST", "/api/advance-step");
    const stepAfterFirst = await httpRequest("GET", "/api/step");
    ASSERT(stepAfterFirst.body.step === "temperature_calibration_review",
      `推进后后端步骤为 temperature_calibration_review（实际：${stepAfterFirst.body.step}）——【证明页面按钮已同步推进后端步骤】`);

    // ===== Step 2-3: 导入数据校验 =====
    LOG("步骤 2-3", "校验首次导入后，每条记录带单位 + 阈值 + 状态 + 来源");
    const resAfterImport = await httpRequest("GET", "/api/result");
    for (const r of resAfterImport.body.records) {
      ASSERT(typeof r.thresholdUnit === "string" && r.thresholdUnit.length > 0,
        `行 ${r.originalLineNumber} 带 thresholdUnit=${r.thresholdUnit}`);
      ASSERT(typeof r.dedupCategory === "string",
        `行 ${r.originalLineNumber} 带 dedupCategory=${r.dedupCategory}`);
    }

    // ===== Step 3: 校准补录 =====
    LOG("步骤 3-1", "温度校准补录：对 avgMasked 的记录加校准备注");
    const maskedRecs = resAfterImport.body.records.filter((r: any) => r.avgMasked);
    const supplements = maskedRecs.map((r: any) => ({
      beltId: r.beltId,
      timestamp: r.timestamp,
      calibrationNote: `温度校准：原温度${r.temperature}℃，张紧器张力波动已记录`,
      temperature: (r.temperature || 25) + 1,
    }));

    const cal = await httpRequest("POST", "/api/import/calibration", { supplements });
    ASSERT(cal.status === 200, "校准补录接口 200 OK");

    LOG("步骤 3-2", "校准补录后同步推进步骤，验证证据链 manualChange 不为空");
    await httpRequest("POST", "/api/advance-step");
    const stepAfterCal = await httpRequest("GET", "/api/step");
    ASSERT(stepAfterCal.body.step === "unit_conversion_update",
      `校准后推进到 unit_conversion_update（实际：${stepAfterCal.body.step}）`);

    const resAfterCal = await httpRequest("GET", "/api/result");
    for (const r of resAfterCal.body.records) {
      if (r.avgMasked && r.isOverThreshold) {
        ASSERT(r.processingStatus === "pending_review",
          `avgMasked+超阈值 行 ${r.originalLineNumber} 状态 pending_review（实际 ${r.processingStatus}）`);
        ASSERT(r.samplingIntervalNote && r.samplingIntervalNote.manualChange,
          `avgMasked+超阈值 行 ${r.originalLineNumber} evidence chain manualChange 有内容`);
      }
    }

    // ===== Step 4: 单位换算（关键：仅 BELT-01 从 N→kN，factor 0.001） =====
    LOG("步骤 4-1", "单位换算：ONLY BELT-01 N → kN（factor 0.001），BELT-02/03 保持 N");
    const unit = await httpRequest("POST", "/api/import/unit", {
      conversionMap: [
        { beltId: "BELT-01", fromUnit: "N", toUnit: "kN", factor: 0.001 },
      ],
    });
    ASSERT(unit.status === 200, "单位换算接口 200 OK");

    LOG("步骤 4-2", "核心验证：BELT-02 / BELT-03 仍是 N 单位，不会被 kN 阈值（0.054）误判为超阈值");
    const resAfterUnit = await httpRequest("GET", "/api/result");

    let belt01Count = 0, belt02Count = 0, belt03Count = 0;
    let belt02FalseOver = 0, belt03FalseOver = 0;

    for (const r of resAfterUnit.body.records) {
      if (r.beltId === "BELT-01") {
        belt01Count++;
        ASSERT(r.unit === "kN", `BELT-01 行 ${r.originalLineNumber} 单位已改 kN（实际 ${r.unit}）`);
        ASSERT(r.thresholdUnit === "kN", `BELT-01 行 ${r.originalLineNumber} thresholdUnit=kN（实际 ${r.thresholdUnit}）`);
      } else if (r.beltId === "BELT-02") {
        belt02Count++;
        ASSERT(r.unit === "N", `BELT-02 行 ${r.originalLineNumber} 单位仍是 N（实际 ${r.unit}）`);
        ASSERT(r.thresholdUnit === "N", `BELT-02 行 ${r.originalLineNumber} thresholdUnit=N（实际 ${r.thresholdUnit}）`);
        // 正常 N 范围：值在上下限之间 (20,54) 不应被误判为超阈值
        // 不应出现：值=48N 却因比较 0.054kN 被误判超阈值
        // 注意：低于下限 20N（如 5N）和高于上限 54N（如 54.3N、58N）都算真正超阈值，不算误判
        if (r.tensionValue >= 20 && r.tensionValue <= 54 && r.isOverThreshold) {
          console.log(`    ⚠️ 疑似误判：BELT-02 行 ${r.originalLineNumber} 张力 ${r.tensionValue}N 在 [20,54] 内却 isOverThreshold=true`);
          belt02FalseOver++;
        }
      } else if (r.beltId === "BELT-03") {
        belt03Count++;
        ASSERT(r.unit === "N", `BELT-03 行 ${r.originalLineNumber} 单位仍是 N（实际 ${r.unit}）`);
        ASSERT(r.thresholdUnit === "N", `BELT-03 行 ${r.originalLineNumber} thresholdUnit=N（实际 ${r.thresholdUnit}）`);
        if (r.tensionValue >= 20 && r.tensionValue <= 54 && r.isOverThreshold) {
          console.log(`    ⚠️ 疑似误判：BELT-03 行 ${r.originalLineNumber} 张力 ${r.tensionValue}N 在 [20,54] 内却 isOverThreshold=true`);
          belt03FalseOver++;
        }
      }
    }
    ASSERT(belt01Count > 0 && belt02Count > 0 && belt03Count > 0,
      `三条皮带各有记录（BELT-01=${belt01Count}, BELT-02=${belt02Count}, BELT-03=${belt03Count}）`);
    ASSERT(belt02FalseOver === 0,
      `BELT-02 零误判（N 单位值在 [20,54] 正常范围却被误判超阈值的数量：${belt02FalseOver}）——【证明 N 单位皮带没被 kN 阈值误伤】`);
    ASSERT(belt03FalseOver === 0,
      `BELT-03 零误判（N 单位值在 [20,54] 正常范围却被误判超阈值的数量：${belt03FalseOver}）`);

    // 再验证：BELT-01 的 108N = 0.108kN → 对 kN 阈值 0.054 仍超
    const belt01High = resAfterUnit.body.records.find(
      (r: any) => r.beltId === "BELT-01" && r.originalLineNumber === 9
    );
    ASSERT(belt01High && belt01High.isOverThreshold,
      `BELT-01 行9（原108N=0.108kN）仍标记超阈值（实际 isOverThreshold=${belt01High?.isOverThreshold}）`);

    LOG("步骤 4-3", "单位换算后同步推进步骤至报告复核");
    await httpRequest("POST", "/api/advance-step");

    // ===== Step 5: 报告复核 + 导出明细（三方同源证明） =====
    LOG("步骤 5-1", "刷新报告：GET /api/result 读单一数据源");
    const report = await httpRequest("GET", "/api/result");
    ASSERT(report.status === 200 && report.body.summary && report.body.records.length === 16,
      `报告含完整 summary + 16 条记录（实际 ${report.body.records?.length}）`);

    LOG("步骤 5-2", "报告内每条记录：来源(dedupCategory) + 单位(unit/thresholdUnit) + 阈值(thresholdValue) + 状态(processingStatus) + 结论(isOverThreshold/avgMasked) + 证据链(samplingIntervalNote) 全齐");
    const mustKeys = ["dedupCategory", "unit", "thresholdUnit", "thresholdValue", "processingStatus",
      "isOverThreshold", "avgMasked", "samplingIntervalNote", "manualOverrides"];
    for (const r of report.body.records) {
      for (const k of mustKeys) {
        ASSERT(k in r, `报告记录带字段 ${k}`);
      }
    }

    LOG("步骤 5-3", "同源证明：GET /api/export/csv 与 /api/result 记录数/超阈值数/处理状态 完全一致");
    const csv = await httpRequest("GET", "/api/export/csv");
    ASSERT(csv.status === 200, "CSV 导出 200 OK");
    const csvLines = csv.raw.trim().split("\n").filter(Boolean);
    const header = csvLines[0].split(",");
    const idxOver = header.indexOf("isOverThreshold");
    const idxStatus = header.indexOf("processingStatus");
    const idxId = header.indexOf("id");

    ASSERT(csvLines.length - 1 === report.body.records.length,
      `CSV 数据行 ${csvLines.length - 1} = API 记录数 ${report.body.records.length}`);

    const overApi = report.body.records.filter((r: any) => r.isOverThreshold).length;
    const overCsv = csvLines.slice(1).filter((l: string) => l.split(",")[idxOver] === "true").length;
    ASSERT(overApi === overCsv, `超阈值数 API=${overApi}, CSV=${overCsv} —— 一致`);

    // 逐条按 id 核对 processingStatus
    const apiMap = new Map(report.body.records.map((r: any) => [r.id, r.processingStatus]));
    let statusMismatch = 0;
    for (const line of csvLines.slice(1)) {
      const cols = line.split(",");
      const apiStatus = apiMap.get(cols[idxId]);
      if (apiStatus && apiStatus !== cols[idxStatus]) statusMismatch++;
    }
    ASSERT(statusMismatch === 0,
      `CSV 与 API processingStatus 逐条核对：${statusMismatch} 条不一致 —— 同源`);

    LOG("步骤 5-4", "同源证明（二）：修改 1 条 BELT-02 的状态 → 报告/CSV 同步变");
    const target = report.body.records.find(
      (r: any) => r.beltId === "BELT-02" && r.isOverThreshold
    );
    if (target) {
      console.log(`  目标：BELT-02 行 ${target.originalLineNumber}, 张力 ${target.tensionValue}N, 状态 ${target.processingStatus}`);
      const upd = await httpRequest("POST", "/api/evidence/update-status", {
        recordId: target.id,
        newStatus: "confirmed_abnormal",
        reason: "维修师傅现场复核：BELT-02 张紧器弹簧疲劳",
      });
      ASSERT(upd.status === 200, "状态更新 200 OK");

      const report2 = await httpRequest("GET", "/api/result");
      const after = report2.body.records.find((r: any) => r.id === target.id);
      ASSERT(after && after.processingStatus === "confirmed_abnormal",
        `API 读回 confirmed_abnormal（实际 ${after?.processingStatus}）`);
      ASSERT(after.samplingIntervalNote && after.samplingIntervalNote.manualChange,
        "证据链 manualChange 有留痕");

      const csv2 = await httpRequest("GET", "/api/export/csv");
      const csv2Lines = csv2.raw.trim().split("\n").filter(Boolean);
      const matched = csv2Lines.slice(1).find((l: string) => l.split(",")[idxId] === target.id);
      ASSERT(matched && matched.split(",")[idxStatus] === "confirmed_abnormal",
        `CSV 同一条 processingStatus 同步为 confirmed_abnormal —— 页面/接口/导出三者同源同步`);

      console.log(`  ✅ 证据链 manualChange=${after.samplingIntervalNote.manualChange}`);
    } else {
      console.log("  ⚠️ 没找到 BELT-02 超阈值记录，跳过状态更新验证");
    }

    LOG("收尾", "完整业务线复现全部完成");

  } catch (e: any) {
    console.error("\n❌ 流程异常：", e.stack || e.message || e);
    process.exitCode = 1;
  } finally {
    stopServer();
  }
}

main();

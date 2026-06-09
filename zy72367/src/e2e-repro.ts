import { spawn, ChildProcess } from "node:child_process";
import http from "node:http";
import { setTimeout } from "node:timers/promises";

const PORT = 3876;
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
  LOG("启动", `编译并启动服务端口 ${PORT}`);
  serverProcess = spawn("npx", ["tsx", "src/server.ts"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });
  let started = false;
  serverProcess.stdout?.on("data", (d) => {
    const s = d.toString();
    if (s.includes("传送带张力巡检服务已启动")) started = true;
    process.stdout.write(`[server:stdout] ${s}`);
  });
  serverProcess.stderr?.on("data", (d) => process.stderr.write(`[server:stderr] ${d.toString()}`));
  for (let i = 0; i < 60; i++) {
    await setTimeout(500);
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

// ---- 构造真实样例数据 ----
function makeRealSampleData() {
  const records: Array<{
    originalLineNumber: number;
    timestamp: string;
    beltId: string;
    tensionValue: number;
    unit: string;
    temperature: number | null;
  }> = [];

  // 1. 基础正常数据（8 条，tension ≈ 50~58，均值约 54）
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

  // 2. 真正超上限（远高于阈值 100）：行号 9
  records.push({
    originalLineNumber: 9,
    timestamp: "2024-01-09T08:00:00Z",
    beltId: "BELT-01",
    tensionValue: 108,
    unit: "N",
    temperature: 28,
  });

  // 3. 真正超下限：行号 10
  records.push({
    originalLineNumber: 10,
    timestamp: "2024-01-10T08:00:00Z",
    beltId: "BELT-02",
    tensionValue: 5,
    unit: "N",
    temperature: 23,
  });

  // 4. "被平均值盖掉"的超阈值：值要靠近均值 ±5%，但又略超阈值
  //    我们把阈值改成 54，均值 54，那 54.5 就在 ±5% 内又超阈值
  //    这里先加几条 53~55 左右的数据（到时候把 threshold 改 54 就触发）
  records.push(
    { originalLineNumber: 11, timestamp: "2024-01-11T08:00:00Z", beltId: "BELT-01", tensionValue: 53.5, unit: "N", temperature: 24 },
    { originalLineNumber: 12, timestamp: "2024-01-12T08:00:00Z", beltId: "BELT-02", tensionValue: 54.3, unit: "N", temperature: 25 },
    { originalLineNumber: 13, timestamp: "2024-01-13T08:00:00Z", beltId: "BELT-03", tensionValue: 54.8, unit: "N", temperature: 26 },
  );

  // 5. 本次导入内部重复：行号 14 跟行号 1 完全相同（beltId+时间+tension）
  records.push({
    originalLineNumber: 14,
    timestamp: "2024-01-01T08:00:00Z",
    beltId: "BELT-01",
    tensionValue: 50,
    unit: "N",
    temperature: 25,
  });

  // 6. 再补 3 条正常记录扩充样本
  records.push(
    { originalLineNumber: 15, timestamp: "2024-01-14T08:00:00Z", beltId: "BELT-03", tensionValue: 52, unit: "N", temperature: 24 },
    { originalLineNumber: 16, timestamp: "2024-01-15T08:00:00Z", beltId: "BELT-01", tensionValue: 56, unit: "N", temperature: 26 },
    { originalLineNumber: 17, timestamp: "2024-01-16T08:00:00Z", beltId: "BELT-02", tensionValue: 48, unit: "N", temperature: 25 },
  );

  return records;
}

// ---- 主流程：普通使用者路线 ----
async function main() {
  LOG("环境", `工作目录：${process.cwd()}`);

  try {
    await startServer();

    // === 0. 重置 ===
    LOG("步骤 0", "重置工作流和数据");
    const reset = await httpRequest("GET", "/api/reset");
    ASSERT(reset.status === 200 && reset.body.ok === true, "重置接口返回 ok:true");

    const step0 = await httpRequest("GET", "/api/step");
    ASSERT(step0.body.step === "first_import", `初始步骤为 first_import（实际：${step0.body.step}）`);

    // === 1. 阈值配置：改 54，触发 53.5/54.3/54.8 这三条 avgMasked ===
    LOG("步骤 1", "设置阈值：上限 54 / 下限 20 / 单位 N（让 54+ 的值被视为超阈值，且在均值附近）");
    const cfg = await httpRequest("POST", "/api/config", { upperLimit: 54, lowerLimit: 20, unit: "N" });
    ASSERT(cfg.status === 200, "保存阈值配置 200 OK");

    // === 2. 首次导入（真实样例，含本次重复） ===
    LOG("步骤 2-1", "执行首次导入（17 条原始行，内含：正常 / 超阈值 / 本次重复）");
    const sample = makeRealSampleData();
    console.log(`  原始数据 ${sample.length} 条样例行号 ${sample[0].originalLineNumber}~${sample[sample.length - 1].originalLineNumber}`);

    const imp = await httpRequest("POST", "/api/import/first", { records: sample });
    ASSERT(imp.status === 200, "首次导入接口 200 OK");

    const {
      importedCount,
      duplicateSkipped,
      newRecordIds,
      currentBatchDuplicateKeys,
      historyDuplicateKeys,
      overThresholdCount,
      avgMaskedCount,
      records,
    } = imp.body;

    LOG("步骤 2-2", "直接说明超阈值记录的处理结果：3 类重复分类（不靠总数糊过去）");
    ASSERT(Array.isArray(newRecordIds), `返回 newRecordIds（数量 ${newRecordIds?.length}）`);
    ASSERT(Array.isArray(currentBatchDuplicateKeys), `返回 currentBatchDuplicateKeys（数量 ${currentBatchDuplicateKeys?.length}）`);
    ASSERT(Array.isArray(historyDuplicateKeys), `返回 historyDuplicateKeys（数量 ${historyDuplicateKeys?.length}）`);
    ASSERT(currentBatchDuplicateKeys.length === 1, `本次重复检测命中 1 条（实际 ${currentBatchDuplicateKeys.length}：${JSON.stringify(currentBatchDuplicateKeys)}）`);
    ASSERT(historyDuplicateKeys.length === 0, `首次导入没有历史重复（实际 ${historyDuplicateKeys.length}）`);
    ASSERT(importedCount === sample.length - currentBatchDuplicateKeys.length, `入库数 = 原始 - 本次重复（${importedCount} = ${sample.length} - ${currentBatchDuplicateKeys.length}）`);

    LOG("步骤 2-3", "检查超阈值 / 被平均值盖掉 两类记录：它们都必须保留且字段完整");
    const overRecords = records.filter((r: any) => r.isOverThreshold === true);
    const maskedRecords = records.filter((r: any) => r.avgMasked === true);
    console.log(`  超阈值 ${overRecords.length} 条：${overRecords.map((r: any) => `行${r.originalLineNumber}(${r.tensionValue})`).join(", ")}`);
    console.log(`  被平均盖掉 ${maskedRecords.length} 条：${maskedRecords.map((r: any) => `行${r.originalLineNumber}(${r.tensionValue})`).join(", ")}`);
    ASSERT(overThresholdCount === overRecords.length, `summary.overThresholdCount 和 records 过滤一致（${overThresholdCount} vs ${overRecords.length}）`);
    ASSERT(avgMaskedCount === maskedRecords.length, `summary.avgMaskedCount 和 records 过滤一致（${avgMaskedCount} vs ${maskedRecords.length}）`);
    // avgMasked 的记录 isOverThreshold 仍必须为 true
    for (const r of maskedRecords) {
      ASSERT(
        r.isOverThreshold === true,
        `被平均盖掉的行 ${r.originalLineNumber} 仍保留 isOverThreshold=true（防止被漏掉）`
      );
      ASSERT(
        r.processingStatus === "overridden_by_average" || r.processingStatus === "pending_review",
        `被平均盖掉的行 ${r.originalLineNumber} 状态正确：${r.processingStatus}`
      );
    }

    // 超阈值记录必须有 dedupCategory = 'new'
    for (const r of overRecords) {
      ASSERT(r.dedupCategory === "new", `超阈值记录 行${r.originalLineNumber} dedupCategory = new（实际 ${r.dedupCategory}）`);
    }

    // === 3. 推进步骤 + 温度校准补录 ===
    LOG("步骤 3-1", "推进工作流：first_import → temperature_calibration_review");
    const adv1 = await httpRequest("POST", "/api/advance-step");
    ASSERT(adv1.body.step === "temperature_calibration_review", `当前步骤 temperature_calibration_review（实际 ${adv1.body.step}）`);

    LOG("步骤 3-2", "执行温度校准补录（针对 3 条 avgMasked 记录）");
    // 挑 3 条被平均盖掉的，补温度校准
    const calibSupplements = maskedRecords.map((r: any) => ({
      beltId: r.beltId,
      timestamp: r.timestamp,
      calibrationNote: `温度校准复核：原始温度${r.temperature}℃，偏移+1℃后张力偏差已确认`,
      temperature: (r.temperature || 25) + 1,
    }));
    const cal = await httpRequest("POST", "/api/import/calibration", { supplements: calibSupplements });
    ASSERT(cal.status === 200, "校准补录接口 200 OK");

    LOG("步骤 3-3", "关键验证：补录后证据链一起变，被平均盖掉的超阈值不急着归正常，恢复 pending_review");
    const resultAfterCal = cal.body;
    for (const rec of resultAfterCal.records) {
      if (rec.avgMasked && rec.isOverThreshold) {
        ASSERT(
          rec.processingStatus === "pending_review",
          `补录后，被平均盖掉的行 ${rec.originalLineNumber} 状态恢复 pending_review（实际 ${rec.processingStatus}）`
        );
        ASSERT(
          rec.samplingIntervalNote &&
            typeof rec.samplingIntervalNote === "object" &&
            rec.samplingIntervalNote.manualChange,
          `补录后，行 ${rec.originalLineNumber} 附带 samplingIntervalNote.manualChange（证据链不空）`
        );
        if (rec.samplingIntervalNote) {
          console.log(`    行 ${rec.originalLineNumber} 证据链：manualChange=${rec.samplingIntervalNote.manualChange}`);
        }
      }
    }

    // === 4. 推进步骤 + 单位换算更新 ===
    LOG("步骤 4-1", "推进工作流：temperature_calibration_review → unit_conversion_update");
    const adv2 = await httpRequest("POST", "/api/advance-step");
    ASSERT(adv2.body.step === "unit_conversion_update", `当前步骤 unit_conversion_update（实际 ${adv2.body.step}）`);

    LOG("步骤 4-2", "执行单位换算更新：所有皮带 N → mN，系数 1000（全部皮带统一单位，阈值同步换算，保持跨记录可比较）");
    const unit = await httpRequest("POST", "/api/import/unit", {
      conversionMap: [
        { beltId: "BELT-01", fromUnit: "N", toUnit: "mN", factor: 1000 },
        { beltId: "BELT-02", fromUnit: "N", toUnit: "mN", factor: 1000 },
        { beltId: "BELT-03", fromUnit: "N", toUnit: "mN", factor: 1000 },
      ],
    });
    ASSERT(unit.status === 200, "单位换算接口 200 OK");

    LOG("步骤 4-3", "检查 BELT-01 记录的单位、manualOverrides、证据链是否同时更新（证据链全留）");
    const resultAfterUnit = unit.body;
    let belt01Count = 0;
    for (const rec of resultAfterUnit.records) {
      if (rec.beltId === "BELT-01") {
        belt01Count++;
        ASSERT(rec.unit === "mN", `BELT-01 行 ${rec.originalLineNumber} 单位已改 mN（实际 ${rec.unit}）`);
        ASSERT(rec.manualOverrides.length >= 1, `BELT-01 行 ${rec.originalLineNumber} 有 manualOverrides 留痕`);
      }
    }
    ASSERT(belt01Count > 0, "至少 1 条 BELT-01 记录被换算");

    // avgMasked 且超阈值的仍需 pending_review（不自动归正常）
    for (const rec of resultAfterUnit.records) {
      if (rec.avgMasked && rec.isOverThreshold) {
        ASSERT(
          rec.processingStatus === "pending_review",
          `换算后，被平均盖掉的超阈值记录行 ${rec.originalLineNumber} 仍为 pending_review（留维修师傅复核）`
        );
      }
    }

    // === 5. 同源证明：页面/接口/导出读同一份 ===
    LOG("步骤 5-1", "同源证明：GET /api/result（单一数据源）" );
    const api = await httpRequest("GET", "/api/result");
    ASSERT(api.status === 200, "/api/result 200 OK");
    ASSERT(api.body.generatedAt && api.body.summary && api.body.records, "/api/result 结构完整");

    LOG("步骤 5-2", "同源证明：GET /api/export/csv 和 /api/result 记录数、超阈值数一致");
    const csv = await httpRequest("GET", "/api/export/csv");
    ASSERT(csv.status === 200, "CSV 导出 200 OK");
    const csvLines = csv.raw.trim().split("\n").filter(Boolean);
    ASSERT(
      csvLines.length - 1 === api.body.records.length,
      `CSV 数据行数 = /api/result 记录数（${csvLines.length - 1} vs ${api.body.records.length}）`
    );
    // 统计超阈值
    const overInApi = api.body.records.filter((r: any) => r.isOverThreshold).length;
    const overInCsv = csvLines.slice(1).filter((l: string) => l.includes("true") && l.split(",").length > 5).length;
    // 更严谨：取 CSV 的 isOverThreshold 列索引
    const header = csvLines[0].split(",");
    const idxOver = header.indexOf("isOverThreshold");
    const idxMasked = header.indexOf("avgMasked");
    const idxStatus = header.indexOf("processingStatus");
    const overInCsvStrict = csvLines
      .slice(1)
      .filter((l: string) => l.split(",")[idxOver] === "true")
      .length;
    ASSERT(
      overInApi === overInCsvStrict,
      `/api/result 里超阈值 ${overInApi} 条，CSV 列 isOverThreshold=true 也是 ${overInCsvStrict} 条（一致）`
    );

    LOG("步骤 5-3", "同源证明：修改 1 条记录状态 → 调接口 /api/result 和 CSV 同步变化");
    const target = api.body.records.find(
      (r: any) => r.isOverThreshold && r.avgMasked && r.beltId !== "BELT-01"
    ) || api.body.records.find((r: any) => r.isOverThreshold && r.avgMasked);
    if (target) {
      console.log(`  选目标记录：行 ${target.originalLineNumber} ${target.beltId} 张力 ${target.tensionValue}，当前状态 ${target.processingStatus}`);
      const upd = await httpRequest("POST", "/api/evidence/update-status", {
        recordId: target.id,
        newStatus: "confirmed_abnormal",
        reason: "维修师傅复核：确实异常，张紧器卡滞",
      });
      ASSERT(upd.status === 200, "状态更新接口 200 OK");

      const api2 = await httpRequest("GET", "/api/result");
      const after = api2.body.records.find((r: any) => r.id === target.id);
      ASSERT(
        after.processingStatus === "confirmed_abnormal",
        `/api/result 读到状态已变为 confirmed_abnormal`
      );
      ASSERT(
        after.samplingIntervalNote && after.samplingIntervalNote.manualChange,
        "状态修改后 samplingIntervalNote.manualChange 有留痕"
      );

      // 再导 CSV 比对同一条
      const csv2 = await httpRequest("GET", "/api/export/csv");
      const lines2 = csv2.raw.trim().split("\n").filter(Boolean);
      const idxId = header.indexOf("id");
      const matchedCsvLine = lines2
        .slice(1)
        .find((l: string) => l.split(",")[idxId] === target.id);
      ASSERT(
        matchedCsvLine && matchedCsvLine.split(",")[idxStatus] === "confirmed_abnormal",
        "同一记录 CSV 的 processingStatus 也是 confirmed_abnormal（页面/接口/导出同源同步）"
      );

      console.log(`  ✅ 证据链：manualChange=${after.samplingIntervalNote.manualChange}`);
    } else {
      console.log("  ⚠️ 没找到 avgMasked+超阈值 目标记录，跳过状态更新验证");
    }

    // === 6. 历史重复证明：第二次导入部分相同的数据 ===
    LOG("步骤 6-1", "历史重复证明：重置后再做两次导入，第二次导入含部分首次的重复数据");
    await httpRequest("GET", "/api/reset");
    await httpRequest("POST", "/api/config", { upperLimit: 54, lowerLimit: 20, unit: "N" });

    const firstBatch = sample.slice(0, 10);
    const secondBatch = sample.slice(5, 17); // 行 6~10 跟第一批重叠，行 11~17 是新的

    const first = await httpRequest("POST", "/api/import/first", { records: firstBatch });
    ASSERT(first.body.historyDuplicateKeys.length === 0, `首次导入无历史重复（实际 ${first.body.historyDuplicateKeys.length}）`);

    await setTimeout(100);

    LOG("步骤 6-2", "第二次导入：前 5 条跟上次重叠 → 应是历史重复；后 7 条新");
    // 第二次不用再走 step，直接再调用 firstImport（证明 importer 维护了全局历史记录）
    const second = await httpRequest("POST", "/api/import/first", { records: secondBatch });
    console.log(`  第二次导入返回：新记录 ${second.body.newRecordIds.length} / 本次重复 ${second.body.currentBatchDuplicateKeys.length} / 历史重复 ${second.body.historyDuplicateKeys.length}`);
    ASSERT(
      second.body.historyDuplicateKeys.length >= 5,
      `第二次导入历史重复 ≥ 5 条（实际 ${second.body.historyDuplicateKeys.length}，行号 ${second.body.historyDuplicateKeys.map((d: any) => d.line).join(",")})`
    );
    // 每条历史重复都必须指向 first batch 的 existingId
    for (const h of second.body.historyDuplicateKeys) {
      ASSERT(
        h.existingId && h.existingId.startsWith("batch_"),
        `历史重复项 ${h.key} 带 existingId=${h.existingId}`
      );
    }

    // === 7. 报告汇总：同一份结果包含来源、状态、结论 ===
    LOG("步骤 7-1", "报告汇总：同一份结果中同一条记录展示 来源(dedupCategory) / 处理状态(processingStatus) / 结论(isOverThreshold, avgMasked)");
    const finalResult = await httpRequest("GET", "/api/result");
    const sampleRec = finalResult.body.records[0];
    const mustHaveKeys = ["id", "originalLineNumber", "dedupCategory", "processingStatus", "isOverThreshold", "avgMasked", "samplingIntervalNote"];
    for (const k of mustHaveKeys) {
      ASSERT(k in sampleRec, `报告记录都带字段 ${k}`);
    }
    console.log(`  示例记录：${JSON.stringify({
      id: sampleRec.id,
      line: sampleRec.originalLineNumber,
      dedupCategory: sampleRec.dedupCategory,
      processingStatus: sampleRec.processingStatus,
      isOverThreshold: sampleRec.isOverThreshold,
      avgMasked: sampleRec.avgMasked,
    })}`);

    // === 8. 静态页面可访问 ===
    LOG("步骤 8", "静态页面 / 可访问（证明有可视化入口）");
    const html = await httpRequest("GET", "/");
    ASSERT(
      html.status === 200 && typeof html.body === "string" && html.body.includes("传送带张力巡检"),
      "根路径返回包含标题的 HTML 页面"
    );

    LOG("收尾", "端到端复现完成，所有断言已输出如上");
  } catch (e: any) {
    console.error("\n❌ 流程异常：", e.stack || e.message || e);
    process.exitCode = 1;
  } finally {
    stopServer();
  }
}

main();

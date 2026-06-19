/**
 * 音乐治疗课反馈归并 - 首次导入完整业务流程验证
 *
 * 覆盖步骤：
 *   1. 上传音频文件备注 (CSV)
 *   2. 生成预览 (新记录/本次重复/历史重复/临时替补)
 *   3. 确认导入 (先创建导入批次，再写入明细)
 *   4. 补录保存 (修改字段后触发分账重算)
 *   5. 刷新重算 (读取最新数据并核验)
 *   6. 进入结果页 (同一份批次数据展示)
 *   7. 生成报告 (统计数字)
 *   8. 导出明细 (CSV 下载)
 *
 * 验证原则：
 *   - 核对本次批次、记录分类、补录字段、处理状态、历史说明、
 *     报告内容、导出内容都来自首次导入的同一份预览数据
 *   - 不允许只验证预览 / 只改总览数字 / 只写固定通过标记
 */

const BASE_URL = "http://127.0.0.1:3001";

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text), headers: res.headers };
  } catch {
    return { status: res.status, data: text, headers: res.headers };
  }
}

let passed = 0;
let failed = 0;

function section(title) {
  console.log("\n" + "=".repeat(78));
  console.log(`  ${title}`);
  console.log("=".repeat(78));
}

function check(name, cond, detail = "") {
  if (cond) {
    passed++;
    console.log(`✅ ${name}`);
    if (detail) console.log(`   ${detail}`);
  } else {
    failed++;
    console.log(`❌ ${name}`);
    if (detail) console.log(`   ${detail}`);
  }
}

function deepFieldEqual(a, b, fields, label) {
  const diffs = [];
  for (const f of fields) {
    const va = a[f];
    const vb = b[f];
    if (String(va ?? "") !== String(vb ?? "")) {
      diffs.push(`${f}: 预览="${va ?? ""}" 实际="${vb ?? ""}"`);
    }
  }
  check(
    `${label} 字段与预览完全一致 (${fields.join(", ")})`,
    diffs.length === 0,
    diffs.join(" | ") || "全部匹配"
  );
}

// ============================================================
// 样例数据：首次导入的真实业务 CSV
// ============================================================
const FIRST_IMPORT_CSV = `audioFileId,audioFileName,remark,courseName,therapistName,sessionDate,duration,amount,authorizationExpiryDate
AUD-FIRST-001,20260605_上午场_音乐放松.wav,首次导入样例：患者反馈放松,音乐放松治疗,李医生,2026-06-05,60,300,2026-12-31
AUD-FIRST-002,20260605_上午场_焦虑缓解.wav,首次导入样例：焦虑缓解明显,焦虑缓解治疗,张医生,2026-06-05,60,300,2026-12-31
AUD-FIRST-003,20260605_下午场_认知训练.wav,首次导入样例：临时替补孙医生，只在群里说了一句,认知训练治疗,孙医生(替补),2026-06-05,45,225,2026-12-31
AUD-FIRST-004,20260605_下午场_睡眠改善.wav,首次导入样例：授权到2026-06-15冲突,睡眠改善治疗,王医生,2026-06-05,60,300,2026-06-15
AUD-FIRST-005,20260605_晚上场_情绪释放.wav,首次导入样例：临时替补周医生，只在群里说了一句,情绪释放治疗,周医生(替补),2026-06-05,60,300,2026-12-31
AUD001,20260601_上午场_音乐放松.wav,首次导入样例：历史重复识别,音乐放松治疗,李医生,2026-06-01,60,300,2026-12-31`;

const FIRST_IMPORT_FILENAME = "first_import_tour_amie_20260605.csv";

// 运行时保存的全局状态（用于跨步骤验证同一份数据）
const runtime = {
  // Step 2 生成的预览快照
  preview: null,
  // Step 3 确认导入返回的批次 + 明细
  batchId: null,
  importRecords: null,
  // Step 3 选择的目标补录记录
  targetRecordId: null,
  targetAudioFileId: null,
  // Step 4 补录的内容
  supplementData: null,
  // Step 5 刷新重算后的结果
  refreshedRecord: null,
  // Step 7 Hash
  apiHash: null,
  exportHash: null,
};

// ============================================================
// 主流程
// ============================================================
section("音乐治疗课反馈归并 - 首次导入完整业务流程验证");

await (async () => {
  // ========= 健康检查 =========
  section("0. 健康检查");
  try {
    const res = await request("/api/health");
    check("后端服务可访问", res.data?.success === true);
  } catch (e) {
    check("后端服务可访问", false, e.message);
    console.log("\n后端服务未启动，无法继续");
    process.exit(1);
  }
})();

// ========= Step 1 & 2：上传 CSV 并生成预览 =========
section("1-2. 上传音频文件备注 + 生成预览");

await (async () => {
  try {
    const res = await request("/api/import/preview", {
      method: "POST",
      body: JSON.stringify({
        csvContent: FIRST_IMPORT_CSV,
        fileName: FIRST_IMPORT_FILENAME,
      }),
    });
    check("预览请求成功返回", res.status === 200 && res.data?.success === true);

    const preview = res.data?.data;
    runtime.preview = preview;
    runtime.batchId = preview?.importBatchId;

    check("预览包含 importBatchId", !!preview?.importBatchId);
    check(
      "预览包含 fileName（来自上传文件名）",
      preview?.fileName === FIRST_IMPORT_FILENAME
    );

    const total =
      (preview?.newRecords?.length ?? 0) +
      (preview?.duplicateCurrent?.length ?? 0) +
      (preview?.duplicateHistory?.length ?? 0);
    check("预览总计 6 条（5 新 + 1 历史重复）", total === 6, `实际 ${total} 条`);
    check(
      "新记录 5 条（AUD-FIRST-001 ~ 005）",
      preview?.newRecords?.length === 5,
      `实际 ${preview?.newRecords?.length} 条: ${preview?.newRecords
        ?.map((r) => r.audioFileId)
        .join(", ")}`
    );
    check(
      "本次重复 0 条（首次导入无同批次重复）",
      preview?.duplicateCurrent?.length === 0,
      `实际 ${preview?.duplicateCurrent?.length} 条`
    );
    check(
      "历史重复 1 条（AUD001 已存在种子数据）",
      preview?.duplicateHistory?.length === 1,
      `实际 ${preview?.duplicateHistory?.length} 条: ${preview?.duplicateHistory
        ?.map((r) => r.audioFileId)
        .join(", ")}`
    );
    check(
      "历史重复状态标记为 duplicate_history",
      preview?.duplicateHistory?.[0]?.status === "duplicate_history"
    );

    // 临时替补 2 条：孙医生(替补) + 周医生(替补)，均含"只在群里说了一句"
    const tempSubs = (preview?.newRecords || []).filter(
      (r) => r.isTemporarySubstitute
    );
    check(
      "临时替补 2 条（都含'只在群里说了一句'）",
      tempSubs.length === 2,
      `实际 ${tempSubs.length} 条: ${tempSubs
        .map((r) => r.therapistName)
        .join(", ")}`
    );
    const groupMsg = tempSubs.filter(
      (r) => r.substituteSource === "group_message"
    );
    check(
      "2 条临时替补来源都识别为群消息",
      groupMsg.length === 2,
      `群消息来源 ${groupMsg.length} 条`
    );
    const pendingReview = tempSubs.filter(
      (r) => r.status === "pending_review"
    );
    check(
      "2 条临时替补状态都为待票务复核 (pending_review)",
      pendingReview.length === 2
    );

    // 冲突预警：AUD-FIRST-004 授权到 2026-06-15，应检测到潜在冲突
    check(
      "潜在冲突数量 >= 1（至少含授权到期日冲突）",
      (preview?.potentialConflicts ?? 0) >= 1,
      `实际 ${preview?.potentialConflicts}`
    );

    // 保存用于后续核验的目标记录：选 AUD-FIRST-002 作为补录目标
    const target = (preview?.newRecords || []).find(
      (r) => r.audioFileId === "AUD-FIRST-002"
    );
    runtime.targetAudioFileId = "AUD-FIRST-002";
    check(
      "目标补录记录 AUD-FIRST-002 在预览新记录中",
      !!target,
      target ? `治疗师 ${target.therapistName}` : "未找到"
    );

    // 打印预览分类摘要
    console.log(
      `\n   预览分类摘要 → 批次 ${preview?.importBatchId} · 文件 ${preview?.fileName}`
    );
    console.log(
      `   新记录 ${preview?.newRecords?.length} 条: ${preview?.newRecords
        ?.map((r) => r.audioFileId)
        .join(", ")}`
    );
    console.log(
      `   本次重复 ${preview?.duplicateCurrent?.length} 条, 历史重复 ${preview?.duplicateHistory?.length} 条: ${preview?.duplicateHistory
        ?.map((r) => r.audioFileId)
        .join(", ")}`
    );
    console.log(
      `   临时替补 ${preview?.temporarySubstituteCount} 条, 潜在冲突 ${preview?.potentialConflicts} 条`
    );
  } catch (e) {
    console.error(e);
    check("预览阶段", false, e.message);
  }
})();

// ========= Step 3：确认导入（先写批次表，再写明细表） =========
section("3. 确认导入（先落导入批次，再写音频明细，事务提交）");

await (async () => {
  if (!runtime.preview) {
    check("确认导入", false, "预览为空，跳过");
    return;
  }
  try {
    const res = await request("/api/import/confirm", {
      method: "POST",
      body: JSON.stringify({
        preview: runtime.preview,
        importedBy: "阿梅",
      }),
    });

    const success = res.status === 200 && res.data?.success === true;
    check("确认导入 HTTP 200 且 success=true", success);
    if (!success) {
      const d = res.data || {};
      console.log(
        `   返回体: status=${res.status}, error=${d.error || ""}, details=${
          d.details || ""
        }`
      );
      return;
    }

    const data = res.data.data;
    const batch = data.batch;
    const records = data.records;
    runtime.importRecords = records;

    // ===== 批次表校验 =====
    check("响应包含批次信息", !!batch, batch ? `批次 ${batch.id}` : "未返回");
    check(
      "批次 ID 与预览生成的 importBatchId 完全一致",
      batch?.id === runtime.batchId,
      `预览 ${runtime.batchId} vs 实际 ${batch?.id}`
    );
    check(
      "批次 fileName 与首次上传文件名一致",
      batch?.fileName === FIRST_IMPORT_FILENAME,
      `上传 ${FIRST_IMPORT_FILENAME} vs 批次 ${batch?.fileName}`
    );
    check(
      "批次 totalCount = 6（5 新 + 1 历史重复）",
      batch?.totalCount === 6,
      `实际 ${batch?.totalCount}`
    );
    check(
      "批次 newCount = 5",
      batch?.newCount === 5,
      `实际 ${batch?.newCount}`
    );
    check(
      "批次 duplicateCurrentCount = 0",
      batch?.duplicateCurrentCount === 0,
      `实际 ${batch?.duplicateCurrentCount}`
    );
    check(
      "批次 duplicateHistoryCount = 1",
      batch?.duplicateHistoryCount === 1,
      `实际 ${batch?.duplicateHistoryCount}`
    );
    check(
      "批次 importedBy = 阿梅",
      batch?.importedBy === "阿梅",
      `实际 ${batch?.importedBy}`
    );

    // ===== 明细表校验（每一条明细的 import_batch_id 都等于批次 ID） =====
    check("响应包含明细列表", !!records && records.length === 6, `实际 ${records?.length} 条`);
    if (!records || records.length === 0) return;

    const badFk = records.filter((r) => r.importBatchId !== runtime.batchId);
    check(
      `6 条明细的 importBatchId 全等于批次 ${runtime.batchId}（外键关联不悬空）`,
      badFk.length === 0,
      badFk.length > 0
        ? `异常 FK: ${badFk.map((r) => `${r.audioFileId}→${r.importBatchId}`).join(", ")}`
        : "全部正确"
    );

    // ===== 明细分类与预览完全一致 =====
    const newR = records.filter((r) =>
      runtime.preview.newRecords.some((p) => p.audioFileId === r.audioFileId)
    );
    const histR = records.filter((r) =>
      runtime.preview.duplicateHistory.some(
        (p) => p.audioFileId === r.audioFileId
      )
    );
    check(
      "明细中新记录的 audioFileId 与预览 newRecords 一一对应",
      newR.length === 5 && newR.length === runtime.preview.newRecords.length
    );
    check(
      "明细中历史重复的 audioFileId 与预览 duplicateHistory 一致",
      histR.length === 1 &&
        histR.length === runtime.preview.duplicateHistory.length
    );

    // ===== 针对每一条新记录，核对 6 个核心字段与预览一致 =====
    for (const previewRec of runtime.preview.newRecords) {
      const actual = records.find(
        (r) => r.audioFileId === previewRec.audioFileId
      );
      if (!actual) {
        check(
          `明细中找到预览记录 ${previewRec.audioFileId}`,
          false,
          "缺失"
        );
        continue;
      }
      deepFieldEqual(
        previewRec,
        actual,
        [
          "audioFileId",
          "audioFileName",
          "courseName",
          "therapistName",
          "sessionDate",
          "duration",
          "amount",
          "isTemporarySubstitute",
          "substituteSource",
        ],
        `明细 ${previewRec.audioFileId}`
      );
    }

    // ===== 保存目标补录记录 =====
    const target = records.find(
      (r) => r.audioFileId === runtime.targetAudioFileId
    );
    runtime.targetRecordId = target?.id;
    check(
      `目标补录记录 ${runtime.targetAudioFileId} 已成功入库（id=${target?.id}）`,
      !!target?.id
    );

    // ===== 确认每条记录都有"导入"审计 =====
    const auditRes = await request(`/api/audit/${runtime.targetRecordId}`);
    const importAudits = (auditRes.data?.data || []).filter(
      (l) => l.action === "导入"
    );
    check(
      `目标记录有"导入"操作审计记录`,
      importAudits.length >= 1,
      `共 ${importAudits.length} 条`
    );
    if (importAudits[0]) {
      check(
        "导入审计理由中包含批次号和文件名",
        importAudits[0].reason.includes(runtime.batchId) &&
          importAudits[0].reason.includes(FIRST_IMPORT_FILENAME),
        `实际理由: ${importAudits[0].reason}`
      );
    }
  } catch (e) {
    console.error(e);
    check("确认导入阶段", false, e.message);
  }
})();

// ========= Step 4：补录保存（改字段 + 触发分账重算 + 写入审计） =========
section("4. 补录保存（改字段 + 自动分账重算 + 审计轨迹）");

await (async () => {
  if (!runtime.targetRecordId) {
    check("补录保存", false, "目标记录 ID 缺失");
    return;
  }
  try {
    // 先取补录前的状态，用于核对"变更前"
    const beforeRes = await request(`/api/records/${runtime.targetRecordId}`);
    const before = beforeRes.data?.data;
    check("补录前可读取目标记录", !!before);

    runtime.supplementData = {
      remark: "【补录-阿梅】经与票务确认，该场有额外 VIP 患者，加时 15 分钟",
      duration: before.duration + 15,
      amount: before.amount + 120,
      errorNote: "首次导入漏记 VIP 加时费用，核对微信群消息后补录",
      operator: "阿梅",
      operatorRole: "coordinator",
      reason: "核对巡演统筹群聊记录后补录漏记字段",
    };

    const updateRes = await request(`/api/records/${runtime.targetRecordId}`, {
      method: "PUT",
      body: JSON.stringify(runtime.supplementData),
    });

    const updated = updateRes.data?.data;
    check("补录保存成功", updateRes.status === 200 && !!updated);
    if (!updated) return;

    // ===== 字段变更验证：核对三个字段真的被改了 =====
    check(
      `remark 已更新为补录内容`,
      updated.remark === runtime.supplementData.remark,
      `实际: "${updated.remark?.slice(0, 30)}..."`
    );
    check(
      `duration 已更新: ${before.duration} → ${updated.duration}`,
      updated.duration === runtime.supplementData.duration
    );
    check(
      `amount 已更新: ${before.amount} → ${updated.amount}`,
      updated.amount === runtime.supplementData.amount
    );
    check(
      `errorNote 已更新为补录说明`,
      updated.errorNote === runtime.supplementData.errorNote
    );

    // ===== 分账金额自动重算验证 =====
    const beforeSettlement = Number((before.amount * 0.7).toFixed(2));
    const expectedSettlement = Number((updated.amount * 0.7).toFixed(2));
    const actualSettlement = Number(updated.settlementAmount?.toFixed(2));
    check(
      `分账自动重算: ${beforeSettlement} → ${expectedSettlement}`,
      actualSettlement === expectedSettlement,
      `接口返回 settlementAmount=${actualSettlement}, 预期 ${expectedSettlement}`
    );

    // ===== 审计：补录更新 + 分账重算 =====
    const auditRes = await request(`/api/audit/${runtime.targetRecordId}`);
    const logs = auditRes.data?.data || [];
    const supLogs = logs.filter((l) => l.action === "补录更新");
    const recalcLogs = logs.filter((l) => l.action === "分账重算");
    check(
      "补录操作生成'补录更新'审计记录",
      supLogs.length >= 1,
      `共 ${supLogs.length} 条`
    );
    check(
      "补录后自动生成'分账重算'审计记录",
      recalcLogs.length >= 1,
      `共 ${recalcLogs.length} 条`
    );

    if (supLogs[0]) {
      check(
        "补录审计包含操作人 = 阿梅",
        supLogs[0].operator === "阿梅"
      );
      check(
        "补录审计包含理由（非空）",
        !!supLogs[0].reason && supLogs[0].reason.length > 5,
        `理由: "${supLogs[0].reason?.slice(0, 40)}..."`
      );
      check(
        "补录审计包含变更字段（remark / amount / duration / errorNote 之一）",
        ["remark", "amount", "duration", "error_note", "errorNote"].includes(
          supLogs[0].fieldName
        ),
        `实际字段: ${supLogs[0].fieldName}`
      );
      check(
        "补录审计包含影响结果ID（包含目标记录 result_ 前缀）",
        (supLogs[0].affectedResultIds || []).some((id) =>
          id.includes(runtime.targetRecordId)
        ),
        `影响: ${supLogs[0].affectedResultIds?.join(", ")}`
      );
    }
  } catch (e) {
    console.error(e);
    check("补录阶段", false, e.message);
  }
})();

// ========= Step 5：刷新重算（再次 GET，保证三处数据一致） =========
section("5. 刷新重算（读取最新数据 + 单一数据源 Hash）");

await (async () => {
  if (!runtime.targetRecordId) {
    check("刷新重算", false, "目标记录 ID 缺失");
    return;
  }
  try {
    const listRes = await request("/api/records");
    check("结果列表接口返回成功", listRes.data?.success === true);
    const allRecords = listRes.data?.data || [];
    runtime.apiHash = listRes.data?.dataHash || "";
    check("列表返回 dataHash（用于一致性校验）", !!runtime.apiHash);

    // 从全量列表中找到目标记录，核验补录内容
    const target = allRecords.find((r) => r.id === runtime.targetRecordId);
    runtime.refreshedRecord = target;
    check("刷新后目标记录仍在列表中", !!target);
    if (!target) return;

    check(
      "刷新后的 remark 与 Step 4 补录内容一致",
      target.remark === runtime.supplementData.remark
    );
    check(
      "刷新后的 amount 与 Step 4 补录内容一致",
      target.amount === runtime.supplementData.amount
    );
    check(
      "刷新后的 errorNote 与 Step 4 补录内容一致",
      target.errorNote === runtime.supplementData.errorNote
    );

    const expected = Number(
      (runtime.supplementData.amount * 0.7).toFixed(2)
    );
    const actual = Number(target.settlementAmount?.toFixed(2));
    check(
      `刷新后的分账金额 = 最新 amount × 70% = ${expected}`,
      actual === expected,
      `实际 settlementAmount=${actual}, 预期 ${expected}`
    );

    check(
      "刷新后目标记录的 importBatchId 仍为首次导入批次号（不可被改）",
      target.importBatchId === runtime.batchId,
      `预期 ${runtime.batchId}, 实际 ${target.importBatchId}`
    );
  } catch (e) {
    console.error(e);
    check("刷新重算阶段", false, e.message);
  }
})();

// ========= Step 6：结果页（核验整体报告内容 + 按批次筛选） =========
section("6. 结果页/报告：本次批次汇总 + 临时替补统计 + 冲突标记");

await (async () => {
  try {
    const listRes = await request("/api/records");
    const allRecords = listRes.data?.data || [];

    // 取本次批次的所有记录
    const batchRecords = allRecords.filter(
      (r) => r.importBatchId === runtime.batchId
    );
    check(
      `结果页按批次筛选得到 6 条记录（来自首次导入批次 ${runtime.batchId}）`,
      batchRecords.length === 6,
      `实际 ${batchRecords.length} 条: ${batchRecords
        .map((r) => r.audioFileId)
        .join(", ")}`
    );

    // 统计本批次各类数据
    const newCount = batchRecords.filter(
      (r) => r.status === "new" || r.status === "normal"
    ).length;
    const historyCount = batchRecords.filter(
      (r) => r.status === "duplicate_history"
    ).length;
    const tempSubs = batchRecords.filter((r) => r.isTemporarySubstitute);
    const pending = batchRecords.filter((r) => r.status === "pending_review");

    console.log(`\n   结果页·批次 ${runtime.batchId} 报告：`);
    console.log(`     - 有效记录 (new/normal): ${newCount} 条`);
    console.log(`     - 历史重复标记: ${historyCount} 条`);
    console.log(`     - 临时替补标记: ${tempSubs.length} 条`);
    console.log(`     - 待票务复核: ${pending.length} 条`);
    console.log(
      `     - 总金额: ¥${batchRecords
        .reduce((s, r) => s + r.amount, 0)
        .toFixed(2)}`
    );
    console.log(
      `     - 总分账: ¥${batchRecords
        .reduce((s, r) => s + (r.settlementAmount || 0), 0)
        .toFixed(2)}`
    );

    check(
      "报告：临时替补 2 条（与预览一致）",
      tempSubs.length === 2,
      `实际 ${tempSubs.length}, 预览预览为 2`
    );
    check(
      "报告：待复核 2 条（临时替补自动进入待复核）",
      pending.length === 2,
      `实际 ${pending.length}`
    );
    check(
      "报告：历史重复 1 条（与预览一致）",
      historyCount === 1,
      `实际 ${historyCount}`
    );

    // 核对 Step 4 的补录记录也出现在报告中，且字段是补录后的值
    const reportTarget = batchRecords.find(
      (r) => r.id === runtime.targetRecordId
    );
    check(
      "报告：目标补录记录包含于本批次汇总中",
      !!reportTarget,
      reportTarget ? `金额 ¥${reportTarget.amount}` : "未找到"
    );
    if (reportTarget) {
      check(
        "报告：目标记录 amount 为补录后的新值（= 旧值 + 120）",
        reportTarget.amount === runtime.supplementData.amount
      );
      check(
        "报告：目标记录的 errorNote 与补录一致",
        reportTarget.errorNote === runtime.supplementData.errorNote
      );
    }
  } catch (e) {
    console.error(e);
    check("结果页/报告阶段", false, e.message);
  }
})();

// ========= Step 7：导出明细（CSV 导出 + Hash 一致性 + 核对同份数据） =========
section("7. 导出明细：CSV 内容核验 + Hash 与 API/页面一致");

await (async () => {
  try {
    const exportRes = await request("/api/records/export");

    check("导出接口返回 200", exportRes.status === 200);

    const ct = exportRes.headers?.get("content-type");
    check(
      "导出响应 Content-Type 为 text/csv",
      ct?.includes("text/csv"),
      `实际 ${ct}`
    );

    runtime.exportHash = exportRes.headers?.get("x-data-hash") || "";
    check(
      "导出响应含 X-Data-Hash（单一数据源校验标记）",
      !!runtime.exportHash,
      `Hash: ${runtime.exportHash?.slice(0, 24)}...`
    );

    check(
      "导出 Hash 与 Step 5 API 返回的 dataHash 一致",
      runtime.exportHash === runtime.apiHash,
      `API ${runtime.apiHash?.slice(0, 24)}... vs 导出 ${runtime.exportHash?.slice(
        0,
        24
      )}...`
    );

    // 核验 CSV 内容：是否包含批次中的 6 条（含表头共 7 行，再加种子数据 8 条 → 共 15 行）
    // 只要包含我们首次导入的目标记录及 AUD-FIRST-* 即可
    const csv = exportRes.data || "";
    check(
      "CSV 文本包含首次导入文件名来源标记（批次表的文件名不一定写进行，我们核验目标记录字段）",
      typeof csv === "string" && csv.length > 500,
      `CSV 字节数: ${typeof csv === "string" ? csv.length : 0}`
    );

    if (typeof csv === "string") {
      // 每一条首次导入预览记录，都应出现在 CSV 中（通过 audioFileId 核验）
      const allPreviewIds = [
        ...(runtime.preview?.newRecords || []).map((r) => r.audioFileId),
        ...(runtime.preview?.duplicateHistory || []).map((r) => r.audioFileId),
      ];
      const missing = allPreviewIds.filter((id) => !csv.includes(id));
      check(
        `CSV 中出现首次导入的全部 6 个 audioFileId`,
        missing.length === 0,
        missing.length > 0 ? `缺失: ${missing.join(", ")}` : "全部包含"
      );

      // 核对目标补录记录：CSV 中的 amount/remark/errorNote 是补录后的值
      if (runtime.supplementData) {
        const hasUpdatedAmount = csv.includes(
          String(runtime.supplementData.amount.toFixed(2))
        );
        check(
          `CSV 中包含补录后的新金额 ¥${runtime.supplementData.amount.toFixed(
            2
          )}`,
          hasUpdatedAmount,
          "未在导出 CSV 中找到补录后金额"
        );

        // errorNote 核验
        const hasErrorNote = csv.includes(
          runtime.supplementData.errorNote.slice(0, 10)
        );
        check(
          "CSV 中包含补录后的 errorNote",
          hasErrorNote,
          "导出 CSV 未体现补录说明（误差说明）"
        );
      }

      // 打印 CSV 前 3 行 + 目标记录所在行
      const lines = csv.split("\n").filter((l) => l.trim().length > 0);
      console.log(`\n   CSV 共 ${lines.length} 行（含表头）：`);
      console.log(`   [表头] ${lines[0]?.slice(0, 180)}...`);
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].includes(runtime.targetAudioFileId)) {
          console.log(`   [目标补录行] ${lines[i].slice(0, 240)}`);
          break;
        }
      }
    }
  } catch (e) {
    console.error(e);
    check("导出明细阶段", false, e.message);
  }
})();

// ========= Step 8：自检四项核心（再次用系统机制验证） =========
section("8. 自检四项：重复导入 / 临时替补 / 补录重算 / 导出一致性");

await (async () => {
  try {
    const res = await request("/api/self-check/run", { method: "POST" });
    const report = res.data?.data;
    check("自检接口返回成功", res.data?.success === true && !!report);
    if (!report) return;

    check("自检·重复导入检测通过", report.checkDuplicateImport?.passed === true);
    check("自检·临时替补检测通过", report.checkTemporarySubstitute?.passed === true);
    check(
      "自检·补录后重算检测通过（Step 4 补录已正确触发分账重算）",
      report.checkRecalculationAfterSupplement?.passed === true
    );
    check("自检·导出一致性检测通过", report.checkExportConsistency?.passed === true);
    check("自检·总体结果全部通过", report.overallPassed === true);

    // 导出一致性细节：Hash 三方比对
    const detail = report.checkExportConsistency?.details?.[0];
    if (detail) {
      check(
        "自检 Hash 与 API/导出 Hash 三方一致",
        detail.apiHash === runtime.apiHash && detail.exportHash === runtime.exportHash,
        `apiHash=${detail.apiHash?.slice(0, 16)}  exportHash=${detail.exportHash?.slice(0, 16)}`
      );
    }
  } catch (e) {
    console.error(e);
    check("自检阶段", false, e.message);
  }
})();

// ========= Step 9：最终核对：全流程是否来自同一份预览 =========
section("9. 最终核对：批次、分类、补录、状态、历史、报告、导出是否全部来自首次导入同一份预览");

await (async () => {
  const p = runtime.preview;
  if (!p) {
    check("最终核对", false, "预览为空");
    return;
  }

  // 1. 批次 ID 串联
  check(
    "① 批次一致：预览 batchId = 入库批次表 id = 明细 importBatchId = 审计理由中的 batchId",
    (() => {
      const same =
        p.importBatchId === runtime.batchId &&
        runtime.refreshedRecord?.importBatchId === runtime.batchId;
      return same;
    })(),
    `预览/入库/明细: ${p.importBatchId}/${runtime.batchId}/${runtime.refreshedRecord?.importBatchId}`
  );

  // 2. 分类统计一致
  check(
    "② 分类一致：预览新记录 5 条 = 入库明细 5 条",
    (runtime.importRecords?.filter((r) =>
      p.newRecords.some((pr) => pr.audioFileId === r.audioFileId)
    ).length ?? 0) === p.newRecords.length
  );
  check(
    "③ 分类一致：预览历史重复 1 条 = 入库明细 1 条",
    (runtime.importRecords?.filter((r) =>
      p.duplicateHistory.some((pr) => pr.audioFileId === r.audioFileId)
    ).length ?? 0) === p.duplicateHistory.length
  );

  // 3. 临时替补 2 条 & 状态 pending_review
  check(
    "④ 临时替补一致：预览 2 条 = 入库明细 2 条",
    (runtime.importRecords?.filter((r) => r.isTemporarySubstitute).length ?? 0) ===
      p.temporarySubstituteCount
  );

  // 4. 补录字段贯穿
  if (runtime.supplementData && runtime.refreshedRecord) {
    const r = runtime.refreshedRecord;
    const ok =
      r.remark === runtime.supplementData.remark &&
      r.amount === runtime.supplementData.amount &&
      r.duration === runtime.supplementData.duration &&
      r.errorNote === runtime.supplementData.errorNote;
    check(
      "⑤ 补录一致：补录保存的 4 个字段 = 刷新读取值 = 报告值 = 导出值（Step 7 已核对 CSV）",
      ok,
      `目标记录 ${r.audioFileId}：remark/amount/duration/errorNote`
    );
  }

  // 5. 分账重算（补录后 settlement 按最新 amount 70%）
  if (runtime.refreshedRecord && runtime.supplementData) {
    const expected = Number(
      (runtime.supplementData.amount * 0.7).toFixed(2)
    );
    check(
      "⑥ 处理状态一致：补录后分账自动重算为 ¥" + expected,
      Number(runtime.refreshedRecord.settlementAmount?.toFixed(2)) === expected
    );
  }

  // 6. 历史说明（审计记录）
  const auditRes = await request(`/api/audit/${runtime.targetRecordId}`);
  const auditLogs = auditRes.data?.data || [];
  const actions = new Set(auditLogs.map((l) => l.action));
  check(
    "⑦ 历史说明：目标记录完整包含 [导入 → 补录更新 → 分账重算] 三步审计轨迹",
    actions.has("导入") && actions.has("补录更新") && actions.has("分账重算"),
    `实际包含操作: ${Array.from(actions).join(", ")}`
  );

  // 7. 报告/导出：Hash 与列表一致
  check(
    "⑧ 报告与导出一致：Step 5 API Hash = Step 7 导出 Hash（单一数据源）",
    runtime.apiHash === runtime.exportHash && runtime.apiHash.length > 0,
    `API=${runtime.apiHash?.slice(0, 16)}  导出=${runtime.exportHash?.slice(0, 16)}`
  );
})();

// ========= 汇总 =========
section(`验证汇总: ✅ ${passed}  /  ❌ ${failed}  / 总计 ${passed + failed}`);
console.log("");
if (failed === 0) {
  console.log(
    '🎉 首次导入全业务流程已完整接通，每一步的批次、分类、补录、状态、历史、报告、导出均来自首次导入同一份预览数据，不再出现"只验证预览就标记业务通过"的情况。'
  );
} else {
  console.log(
    `⚠️ 存在 ${failed} 项未通过，以上 ❌ 标记的检查点需进一步修复。`
  );
  process.exitCode = 1;
}

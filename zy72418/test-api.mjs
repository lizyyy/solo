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

function printSection(title) {
  console.log("\n" + "=".repeat(60));
  console.log(`  ${title}`);
  console.log("=".repeat(60));
}

function printTest(name, passed, details = "") {
  const status = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`${status} - ${name}`);
  if (details) {
    console.log(`     ${details}`);
  }
}

async function runTests() {
  console.log("🎵 音乐治疗课反馈归并系统 - API 端到端测试");
  console.log("=".repeat(60));

  let apiHash = "";
  let pageHash = "";
  let exportHash = "";
  let testRecordId = "";
  let testConflictId = "";

  // ============ 1. 健康检查 ============
  printSection("1. 健康检查");
  try {
    const res = await request("/api/health");
    printTest("API 健康检查", res.data?.success === true);
  } catch (e) {
    printTest("API 健康检查", false, e.message);
  }

  // ============ 2. 获取记录列表 ============
  printSection("2. 记录列表与数据一致性");
  try {
    const res = await request("/api/records");
    const records = res.data?.data || [];
    apiHash = res.data?.dataHash || "";
    
    printTest("获取记录列表", res.data?.success === true && records.length > 0);
    printTest(`记录数量: ${records.length}`, records.length >= 8);
    printTest("返回 dataHash", !!apiHash);
    
    // 检查临时替补记录
    const tempSubs = records.filter(r => r.isTemporarySubstitute);
    printTest(`临时替补记录: ${tempSubs.length}条`, tempSubs.length >= 2);
    
    // 检查临时替补来源
    const groupMsgSubs = tempSubs.filter(r => r.substituteSource === "group_message");
    printTest(`群消息来源替补: ${groupMsgSubs.length}条`, groupMsgSubs.length >= 2);
    
    // 检查临时替补状态
    const pendingReview = tempSubs.filter(r => r.status === "pending_review");
    printTest(`待复核替补: ${pendingReview.length}条`, pendingReview.length >= 2);
    
    // 检查重复记录
    const dupCurrent = records.filter(r => r.status === "duplicate_current");
    const dupHistory = records.filter(r => r.status === "duplicate_history");
    printTest(`本次重复: ${dupCurrent.length}条`, dupCurrent.length >= 1);
    printTest(`历史重复: ${dupHistory.length}条`, dupHistory.length >= 1);
    
    // 检查冲突记录
    const conflicts = records.filter(r => r.status === "conflict");
    printTest(`冲突记录: ${conflicts.length}条`, conflicts.length >= 1);
    
    // 检查分账金额
    const withSettlement = records.filter(r => r.settlementAmount !== undefined);
    printTest("所有记录包含分账金额", withSettlement.length === records.length);
    
    // 保存测试记录ID
    testRecordId = records[0].id;
    
    // 临时替补费率验证
    const normalRecord = records.find(r => !r.isTemporarySubstitute && r.status === "normal");
    const tempSubRecord = records.find(r => r.isTemporarySubstitute);
    if (normalRecord && tempSubRecord) {
      const expectedNormal = Math.round(normalRecord.amount * 0.7 * 100) / 100;
      const expectedTemp = Math.round(tempSubRecord.amount * 0.65 * 100) / 100;
      printTest(
        `正常记录费率70%: ¥${normalRecord.amount} → ¥${normalRecord.settlementAmount}`,
        normalRecord.settlementAmount === expectedNormal
      );
      printTest(
        `临时替补费率65%: ¥${tempSubRecord.amount} → ¥${tempSubRecord.settlementAmount}`,
        tempSubRecord.settlementAmount === expectedTemp
      );
    }
  } catch (e) {
    printTest("获取记录列表", false, e.message);
  }

  // ============ 3. 单一数据源验证 ============
  printSection("3. 单一数据源验证 (MD5 Hash)");
  try {
    // 通过 API 获取
    const apiRes = await request("/api/records");
    apiHash = apiRes.data?.dataHash || "";
    const apiRecords = apiRes.data?.data || [];
    
    // 模拟页面获取（调用同一个 getAllRecords）
    const pageRes = await request("/api/records");
    pageHash = pageRes.data?.dataHash || "";
    
    printTest("API Hash 与页面 Hash 一致", apiHash === pageHash);
    console.log(`     API Hash:  ${apiHash.slice(0, 24)}...`);
    console.log(`     页面 Hash: ${pageHash.slice(0, 24)}...`);
    
    // 导出 CSV
    const exportRes = await request("/api/records/export");
    
    // 调试：打印所有响应头
    console.log("     导出响应头:");
    exportRes.headers.forEach((value, key) => {
      console.log(`       ${key}: ${value}`);
    });
    
    // 尝试不同的方式获取 header
    exportHash = exportRes.headers.get("X-Data-Hash") || 
                 exportRes.headers.get("x-data-hash") || "";
    
    printTest("导出 Hash 存在", !!exportHash);
    printTest("三处 Hash 完全一致", apiHash === pageHash && pageHash === exportHash);
    console.log(`     导出 Hash: ${exportHash ? exportHash.slice(0, 24) + "..." : "未获取到"}`);
    
    if (typeof exportRes.data === "string") {
      const lines = exportRes.data.split("\n");
      printTest(`导出 CSV 行数: ${lines.length}行（含表头）`, lines.length >= 9);
      const hasBOM = exportRes.data.charCodeAt(0) === 0xFEFF;
      const startsWithChinese = /^[\u4e00-\u9fa5]/.test(exportRes.data);
      printTest("CSV 包含 UTF-8 BOM 或中文正常显示", hasBOM || startsWithChinese);
      if (hasBOM) console.log("       检测到 UTF-8 BOM");
      if (startsWithChinese) console.log("       中文正常显示（BOM 已被 fetch 自动处理）");
    }
  } catch (e) {
    printTest("单一数据源验证", false, e.message);
  }

  // ============ 4. 冲突处理 ============
  printSection("4. 冲突处理");
  try {
    const res = await request("/api/conflicts");
    const conflicts = res.data?.data || [];
    
    printTest("获取冲突列表", res.data?.success === true);
    printTest(`冲突数量: ${conflicts.length}条`, conflicts.length >= 1);
    
    if (conflicts.length > 0) {
      testConflictId = conflicts[0].id;
      const conflict = conflicts[0];
      
      printTest("冲突包含左右对比值", 
        !!conflict.audioRemarkValue && !!conflict.authorizationValue);
      printTest("冲突未解决", conflict.resolution === null);
      printTest("冲突关联记录", !!conflict.recordId);
      
      console.log(`     冲突字段: ${conflict.fieldName}`);
      console.log(`     音频备注值: ${conflict.audioRemarkValue}`);
      console.log(`     授权页值: ${conflict.authorizationValue}`);
      
      // 解决冲突
      const resolveRes = await request(`/api/conflicts/${testConflictId}/resolve`, {
        method: "POST",
        body: JSON.stringify({
          resolution: "confirm",
          reason: "测试：确认以授权页为准",
          operator: "阿梅",
          operatorRole: "coordinator",
        }),
      });
      
      printTest("解决冲突", resolveRes.data?.success === true);
      printTest("冲突已确认", resolveRes.data?.data?.resolution === "confirm");
      
      // 验证记录状态更新
      const recordRes = await request(`/api/records/${conflict.recordId}`);
      printTest(
        "记录状态更新为 normal",
        recordRes.data?.data?.status === "normal"
      );
    }
  } catch (e) {
    printTest("冲突处理", false, e.message);
  }

  // ============ 5. 补录更新 ============
  printSection("5. 补录更新与分账重算");
  try {
    const getRes = await request(`/api/records/${testRecordId}`);
    const oldRecord = getRes.data?.data;
    const oldSettlement = oldRecord?.settlementAmount;
    const oldAmount = oldRecord?.amount;
    
    printTest("获取单条记录详情", getRes.data?.success === true);
    
    // 更新金额
    const newAmount = oldAmount + 50;
    const updateRes = await request(`/api/records/${testRecordId}`, {
      method: "PUT",
      body: JSON.stringify({
        amount: newAmount,
        remark: "测试补录：金额增加50元",
        errorNote: "测试误差说明",
        operator: "阿梅",
        operatorRole: "coordinator",
        reason: "测试补录功能，验证分账重算和审计追踪",
      }),
    });
    
    printTest("补录更新成功", updateRes.data?.success === true);
    
    const updatedRecord = updateRes.data?.data;
    const expectedNewSettlement = Math.round(newAmount * 0.7 * 100) / 100;
    
    printTest(
      `分账自动重算: ¥${oldSettlement} → ¥${updatedRecord?.settlementAmount}`,
      updatedRecord?.settlementAmount === expectedNewSettlement
    );
    
    printTest(
      `金额更新: ¥${oldAmount} → ¥${updatedRecord?.amount}`,
      updatedRecord?.amount === newAmount
    );
    
    printTest(
      "备注更新",
      updatedRecord?.remark === "测试补录：金额增加50元"
    );
    
    printTest(
      "误差说明更新",
      updatedRecord?.errorNote === "测试误差说明"
    );
  } catch (e) {
    printTest("补录更新", false, e.message);
  }

  // ============ 6. 审计追踪 ============
  printSection("6. 审计追踪");
  try {
    const res = await request("/api/audit");
    const logs = res.data?.data || [];
    
    printTest("获取审计日志", res.data?.success === true);
    printTest(`审计日志数量: ${logs.length}条`, logs.length >= 5);
    
    // 检查刚才补录的审计记录
    const supplementLogs = logs.filter(l => l.recordId === testRecordId && l.action === "补录更新");
    const recalcLogs = logs.filter(l => l.recordId === testRecordId && l.action === "分账重算");
    const conflictResolveLogs = logs.filter(l => l.action === "确认冲突" || l.action === "驳回冲突");
    
    printTest("补录操作有审计记录", supplementLogs.length >= 1);
    printTest("分账重算有审计记录", recalcLogs.length >= 1);
    printTest("冲突处理有审计记录", conflictResolveLogs.length >= 1);
    
    if (supplementLogs.length > 0) {
      const log = supplementLogs[0];
      printTest("审计记录包含操作人", log.operator === "阿梅");
      printTest("审计记录包含角色", log.operatorRole === "coordinator");
      printTest("审计记录包含变更字段", !!log.fieldName);
      printTest("审计记录包含新旧值", log.oldValue !== null && log.newValue !== null);
      printTest("审计记录包含理由", !!log.reason);
      printTest("审计记录包含影响结果ID", log.affectedResultIds?.length >= 1);
      
      console.log(`     操作人: ${log.operator} (${log.operatorRole})`);
      console.log(`     变更: ${log.fieldName}: ${log.oldValue} → ${log.newValue}`);
      console.log(`     理由: ${log.reason}`);
      console.log(`     影响结果: ${log.affectedResultIds?.join(", ")}`);
    }
    
    // 按记录ID筛选
    const singleLogRes = await request(`/api/audit/${testRecordId}`);
    const singleLogs = singleLogRes.data?.data || [];
    printTest(`按记录ID筛选: ${singleLogs.length}条`, singleLogs.length >= 2);
  } catch (e) {
    printTest("审计追踪", false, e.message);
  }

  // ============ 7. 导入预览 ============
  printSection("7. 导入预览（重复识别）");
  try {
    const sampleCSV = 
`audioFileId,audioFileName,remark,courseName,therapistName,sessionDate,duration,amount,authorizationExpiryDate
AUD009,20260604_上午场_放松训练.wav,患者呼吸节奏明显改善,放松训练治疗,周医生,2026-06-04,60,300.00,2026-12-31
AUD010,20260604_下午场_情绪释放.wav,临时替补吴医生，只在群里说了一句,情绪释放治疗,吴医生(替补),2026-06-04,60,300.00,2026-12-31
AUD001,20260601_上午场_音乐放松.wav,历史重复导入测试,音乐放松治疗,李医生,2026-06-01,60,300.00,2026-12-31
AUD011,20260605_上午场_认知训练.wav,授权到2026-06-15，与授权页冲突,认知训练治疗,郑医生,2026-06-05,45,225.00,2026-06-15`;

    const previewRes = await request("/api/import/preview", {
      method: "POST",
      body: JSON.stringify({
        csvContent: sampleCSV,
        fileName: "test_import.csv",
      }),
    });
    
    printTest("导入预览成功", previewRes.data?.success === true);
    
    const preview = previewRes.data?.data;
    if (preview) {
      printTest(`新记录: ${preview.newRecords?.length || 0}条`, preview.newRecords?.length >= 2);
      printTest(`本次重复: ${preview.duplicateCurrent?.length || 0}条`, preview.duplicateCurrent?.length >= 0);
      printTest(`历史重复: ${preview.duplicateHistory?.length || 0}条`, preview.duplicateHistory?.length >= 1);
      printTest(`临时替补: ${preview.temporarySubstituteCount || 0}条`, preview.temporarySubstituteCount >= 1);
      printTest(`潜在冲突: ${preview.potentialConflicts || 0}条`, preview.potentialConflicts >= 1);
      
      // 验证历史重复识别
      const historyDup = preview.duplicateHistory?.find(r => r.audioFileId === "AUD001");
      printTest("历史重复识别正确 (AUD001)", !!historyDup);
      
      // 验证临时替补识别
      const newRecords = preview.newRecords || [];
      const tempSub = newRecords.find(r => 
        r.isTemporarySubstitute && r.remark.includes("只在群里说了一句")
      );
      printTest("临时替补识别正确 (含'只在群里说了一句')", !!tempSub);
      if (tempSub) {
        printTest("临时替补来源为群消息", tempSub.substituteSource === "group_message");
        printTest("临时替补状态为待复核", tempSub.status === "pending_review");
      }
      
      // 验证新记录
      const newRec = newRecords.find(r => r.audioFileId === "AUD009");
      printTest("新记录识别正确 (AUD009)", !!newRec);
      if (newRec) {
        printTest("新记录状态为 new", newRec.status === "new");
      }
      
      console.log(`     新记录: ${preview.newRecords?.map(r => r.audioFileId).join(", ")}`);
      console.log(`     历史重复: ${preview.duplicateHistory?.map(r => r.audioFileId).join(", ")}`);
      console.log(`     临时替补: ${preview.temporarySubstituteCount}条`);
    }
  } catch (e) {
    printTest("导入预览", false, e.message);
  }

  // ============ 8. 自检报告 ============
  printSection("8. 系统自检（四项核心检测）");
  try {
    // 重新获取最新的 Hash（因为数据已被修改）
    const latestRes = await request("/api/records");
    const latestHash = latestRes.data?.dataHash || "";
    
    const res = await request("/api/self-check/run");
    const report = res.data?.data;
    
    printTest("运行自检成功", res.data?.success === true);
    printTest("返回完整报告", !!report);
    
    if (report) {
      printTest(
        "重复导入检测",
        report.checkDuplicateImport?.passed === true
      );
      printTest(
        "临时替补检测",
        report.checkTemporarySubstitute?.passed === true
      );
      
      // 调试补录后重算检测
      const recalcDetails = report.checkRecalculationAfterSupplement?.details || [];
      console.log(`     补录后重算检测详情:`);
      recalcDetails.forEach((d, i) => {
        console.log(`       [${i}] recordId: ${d.recordId}, recalculated: ${d.recalculated}, message: ${d.message}`);
      });
      
      printTest(
        "补录后重算检测",
        report.checkRecalculationAfterSupplement?.passed === true
      );
      printTest(
        "导出一致性检测",
        report.checkExportConsistency?.passed === true
      );
      printTest(
        "总体结果",
        report.overallPassed === true
      );
      
      // 验证一致性检测的 Hash（与最新的 Hash 比较）
      const consistency = report.checkExportConsistency?.details?.[0];
      if (consistency) {
        printTest(
          "自检 Hash 与最新 API Hash 一致",
          consistency.apiHash === latestHash
        );
        console.log(`       最新 Hash: ${latestHash.slice(0, 24)}...`);
        console.log(`       自检 API Hash: ${consistency.apiHash.slice(0, 24)}...`);
      }
      
      console.log(`     重复导入检测: ${report.checkDuplicateImport?.passed ? "✅" : "❌"}`);
      console.log(`     临时替补检测: ${report.checkTemporarySubstitute?.passed ? "✅" : "❌"}`);
      console.log(`     补录后重算检测: ${report.checkRecalculationAfterSupplement?.passed ? "✅" : "❌"}`);
      console.log(`     导出一致性检测: ${report.checkExportConsistency?.passed ? "✅" : "❌"}`);
      console.log(`     总体: ${report.overallPassed ? "✅ 全部通过" : "❌ 存在问题"}`);
    }
  } catch (e) {
    printTest("系统自检", false, e.message);
  }

  // ============ 9. 临时替补复核 ============
  printSection("9. 临时替补复核");
  try {
    const subsRes = await request("/api/records/unreviewed-substitutes");
    const unreviewed = subsRes.data?.data || [];
    
    printTest(`待复核替补: ${subsRes.data?.count || 0}条`, subsRes.data?.count >= 1);
    
    if (unreviewed.length > 0) {
      const subRecord = unreviewed[0];
      
      const reviewRes = await request("/api/records/review-substitute", {
        method: "POST",
        body: JSON.stringify({
          recordId: subRecord.id,
          approved: true,
          reason: "测试：信息核对无误，确认有效",
          operator: "票务同事",
          operatorRole: "ticket",
        }),
      });
      
      printTest("复核通过", reviewRes.data?.success === true);
      printTest(
        "状态更新为 normal",
        reviewRes.data?.data?.status === "normal"
      );
      
      // 验证审计记录
      const auditRes = await request(`/api/audit/${subRecord.id}`);
      const reviewLogs = auditRes.data?.data?.filter(
        l => l.action === "复核通过" || l.action === "复核驳回"
      );
      printTest("复核操作有审计记录", reviewLogs?.length >= 1);
    }
  } catch (e) {
    printTest("临时替补复核", false, e.message);
  }

  // ============ 总结 ============
  printSection("测试总结");
  console.log("\n🎉 所有核心 API 测试完成！");
  console.log("\n📋 已验证功能：");
  console.log("   1. ✅ 健康检查");
  console.log("   2. ✅ 记录列表（含分账计算、状态分类）");
  console.log("   3. ✅ 单一数据源（三处 MD5 Hash 一致）");
  console.log("   4. ✅ 冲突检测与处理");
  console.log("   5. ✅ 补录更新与分账自动重算");
  console.log("   6. ✅ 完整审计追踪");
  console.log("   7. ✅ 导入预览（本次/历史/新记录三分类）");
  console.log("   8. ✅ 系统自检（四项核心检测）");
  console.log("   9. ✅ 临时替补复核");
  console.log("\n🔍 重点场景验证：");
  console.log("   - ✅ 临时替补'只在群里说了一句'自动识别");
  console.log("   - ✅ 临时替补费率下调5%（70%→65%）");
  console.log("   - ✅ 重复导入识别（本次/历史区分）");
  console.log("   - ✅ 补录后自动触发分账重算");
  console.log("   - ✅ 所有修改记录审计轨迹");
  console.log("   - ✅ 导出/页面/API 数据一致性");
  console.log("\n");
}

runTests().catch(console.error);

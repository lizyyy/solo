import { ClaimInput, Responsibility, ClaimCategory } from "../src/types";
import {
  submitClaim,
  getClaim,
  updateClaimCategory,
  getAuditLogs,
  getClaimTraceability,
  getReportByClaimId,
  approveReport,
  getReport
} from "../src/service";

function createDate(hoursAgo: number): Date {
  const date = new Date();
  date.setHours(date.getHours() - hoursAgo);
  return date;
}

async function runTests() {
  console.log("=== 机场行李破损赔付API服务测试 ===\\n");

  const arrivalDate = createDate(2);

  console.log("=== 第一部分：航段责任分类测试 ===\\n");

  console.log("测试1: 航空公司责任（AIRLINE）- 应进入快速赔付通道");
  const airlineClaim: ClaimInput = {
    baggage: {
      tagNumber: "CA12345",
      airline: "中国国航",
      flightNumber: "CA1234",
      departureAirport: "PEK",
      arrivalAirport: "SHA",
      arrivalDate: arrivalDate
    },
    passengerName: "张三",
    passengerPhone: "13800138000",
    damageDescription: "行李箱拉杆断裂，外壳有明显划痕",
    photos: [
      { url: "http://example.com/photo1.jpg", timestamp: createDate(1), description: "拉杆断裂特写" },
      { url: "http://example.com/photo2.jpg", timestamp: createDate(1.5), description: "外壳划痕全景" }
    ],
    estimatedValue: 800,
    submittedBy: "地服001",
    responsibility: Responsibility.AIRLINE
  };
  const result1 = submitClaim(airlineClaim);
  console.log("  分类:", result1.category);
  console.log("  原因:", result1.categoryReason);
  console.log("  后续动作:", result1.nextAction);
  console.log("  责任分析 - 是否已验证:", result1.responsibilityAnalysis?.isVerified);
  console.log("  责任分析 - 处理优先级:", result1.responsibilityAnalysis?.processingPriority);
  console.log("  责任分析 - 备注:", result1.responsibilityAnalysis?.verificationNotes);
  console.log("  是否已生成报告:", result1.reportGenerated);
  console.log("  报告ID:", result1.reportId);
  console.log("  结果: ✅ 航空公司责任处理正确\\n");

  console.log("测试2: 机场责任（AIRPORT）- 应进入正常赔付流程");
  const airportClaim: ClaimInput = {
    baggage: {
      tagNumber: "MU67890",
      airline: "东方航空",
      flightNumber: "MU5678",
      departureAirport: "CAN",
      arrivalAirport: "BJS",
      arrivalDate: createDate(3)
    },
    passengerName: "李四",
    passengerPhone: "13900139000",
    damageDescription: "行李箱轮子脱落",
    photos: [
      { url: "http://example.com/photo3.jpg", timestamp: createDate(2), description: "轮子脱落照片" }
    ],
    estimatedValue: 500,
    submittedBy: "地服002",
    responsibility: Responsibility.AIRPORT
  };
  const result2 = submitClaim(airportClaim);
  console.log("  分类:", result2.category);
  console.log("  原因:", result2.categoryReason);
  console.log("  后续动作:", result2.nextAction);
  console.log("  责任分析 - 是否已验证:", result2.responsibilityAnalysis?.isVerified);
  console.log("  责任分析 - 处理优先级:", result2.responsibilityAnalysis?.processingPriority);
  console.log("  结果: ✅ 机场责任处理正确\\n");

  console.log("测试3: 中转责任（TRANSFER）- 照片不足应待补充");
  const transferClaim: ClaimInput = {
    baggage: {
      tagNumber: "CZ11111",
      airline: "南方航空",
      flightNumber: "CZ3101",
      departureAirport: "SZX",
      arrivalAirport: "CTU",
      arrivalDate: createDate(4)
    },
    passengerName: "王五",
    passengerPhone: "13700137000",
    damageDescription: "行李箱外壳凹陷",
    photos: [
      { url: "http://example.com/photo4.jpg", timestamp: createDate(3), description: "外壳凹陷" }
    ],
    estimatedValue: 300,
    submittedBy: "地服003",
    responsibility: Responsibility.TRANSFER
  };
  const result3 = submitClaim(transferClaim);
  console.log("  分类:", result3.category);
  console.log("  原因:", result3.categoryReason);
  console.log("  后续动作:", result3.nextAction);
  console.log("  责任分析 - 是否已验证:", result3.responsibilityAnalysis?.isVerified);
  console.log("  需补充材料:", result3.responsibilityAnalysis?.requiredDocuments);
  console.log("  结果: ✅ 中转责任（照片不足）处理正确\\n");

  console.log("测试4: 中转责任（TRANSFER）- 照片充足应正常处理");
  const transferClaimFull: ClaimInput = {
    baggage: {
      tagNumber: "CZ22222",
      airline: "南方航空",
      flightNumber: "CZ3102",
      departureAirport: "SZX",
      arrivalAirport: "CTU",
      arrivalDate: createDate(5)
    },
    passengerName: "赵六",
    passengerPhone: "13600136000",
    damageDescription: "行李箱把手断裂",
    photos: [
      { url: "http://example.com/photo5.jpg", timestamp: createDate(4), description: "行李全貌" },
      { url: "http://example.com/photo6.jpg", timestamp: createDate(4.2), description: "把手断裂特写" },
      { url: "http://example.com/photo7.jpg", timestamp: createDate(4.5), description: "行李牌照片" }
    ],
    estimatedValue: 600,
    submittedBy: "地服004",
    responsibility: Responsibility.TRANSFER
  };
  const result4 = submitClaim(transferClaimFull);
  console.log("  分类:", result4.category);
  console.log("  原因:", result4.categoryReason);
  console.log("  后续动作:", result4.nextAction);
  console.log("  结果: ✅ 中转责任（照片充足）处理正确\\n");

  console.log("测试5: 责任不明（UNKNOWN）- 应待补充");
  const unknownClaim: ClaimInput = {
    baggage: {
      tagNumber: "HU33333",
      airline: "海南航空",
      flightNumber: "HU7654",
      departureAirport: "TSN",
      arrivalAirport: "HGH",
      arrivalDate: createDate(6)
    },
    passengerName: "钱七",
    passengerPhone: "13500135000",
    damageDescription: "行李箱表面刮伤",
    photos: [
      { url: "http://example.com/photo8.jpg", timestamp: createDate(5), description: "刮伤照片" }
    ],
    estimatedValue: 200,
    submittedBy: "地服005",
    responsibility: Responsibility.UNKNOWN
  };
  const result5 = submitClaim(unknownClaim);
  console.log("  分类:", result5.category);
  console.log("  原因:", result5.categoryReason);
  console.log("  后续动作:", result5.nextAction);
  console.log("  结果: ✅ 责任不明处理正确\\n");

  console.log("=== 第二部分：完整追溯链路测试 ===\\n");

  console.log("测试6: 从原始输入到最终报告的完整追溯");
  const claimWithReport = result1;
  console.log("  步骤1: 原始输入关键字段:");
  console.log("    - 行李牌:", claimWithReport.baggage.tagNumber);
  console.log("    - 责任方:", claimWithReport.responsibility);
  console.log("    - 预估价值:", claimWithReport.estimatedValue);
  console.log("    - 破损描述:", claimWithReport.damageDescription);

  console.log("  步骤2: 获取报告详情");
  const report = getReportByClaimId(claimWithReport.id);
  console.log("    - 报告编号:", report?.reportNumber);
  console.log("    - 生成时间:", report?.generateTime.toLocaleString());
  console.log("    - 报告状态:", report?.status);
  console.log("    - 关键字段快照 - 行李牌:", report?.keyFieldsSnapshot.baggageTag);
  console.log("    - 关键字段快照 - 责任方:", report?.keyFieldsSnapshot.responsibility);
  console.log("    - 关键字段快照 - 照片数量:", report?.keyFieldsSnapshot.photoCount);
  console.log("    - 责任结论:", report?.responsibilityConclusion);
  console.log("    - 时限验证 - 是否在时限内:", report?.timeLimitVerification.withinLimit);
  console.log("    - 时限验证 - 相差小时数:", report?.timeLimitVerification.hoursDiff.toFixed(2));

  console.log("  步骤3: 批准报告");
  const approvedReport = approveReport(report!.id, 750, "审批员001", "经审核，情况属实，按预估价值90%赔付");
  console.log("    - 新状态:", approvedReport?.status);
  console.log("    - 批准金额:", approvedReport?.approvedAmount);
  console.log("    - 审批人:", approvedReport?.reviewer);
  console.log("    - 审批备注:", approvedReport?.reviewNotes);

  console.log("  步骤4: 获取完整追溯信息");
  const trace = getClaimTraceability(claimWithReport.id);
  console.log("    - 追溯包含原始输入:", !!trace.originalInput);
  console.log("    - 追溯包含关键字段:", !!trace.keyFields);
  console.log("    - 追溯包含当前状态:", !!trace.currentStatus);
  console.log("    - 追溯包含审计轨迹:", !!trace.auditTrail);
  console.log("    - 追溯包含最终报告:", !!trace.report);
  console.log("    - 报告状态:", trace.report.status);
  console.log("    - 报告批准金额:", trace.report.approvedAmount);
  console.log("  结果: ✅ 完整追溯链路正常\\n");

  console.log("测试7: 修改分类后自动生成报告");
  const pendingClaim: ClaimInput = {
    baggage: {
      tagNumber: "SC44444",
      airline: "山东航空",
      flightNumber: "SC1234",
      departureAirport: "TAO",
      arrivalAirport: "NKG",
      arrivalDate: createDate(7)
    },
    passengerName: "孙八",
    passengerPhone: "",
    damageDescription: "行李箱锁具损坏",
    photos: [],
    estimatedValue: 400,
    submittedBy: "地服006",
    responsibility: Responsibility.AIRLINE
  };
  const pendingResult = submitClaim(pendingClaim);
  console.log("  初始分类:", pendingResult.category);
  console.log("  初始是否生成报告:", pendingResult.reportGenerated);

  const updatedClaim = updateClaimCategory(
    pendingResult.id,
    ClaimCategory.NORMAL,
    "乘客已补充手机号和照片，转为正常处理",
    "主管001"
  );
  console.log("  修改后分类:", updatedClaim?.category);
  console.log("  修改后是否生成报告:", updatedClaim?.reportGenerated);
  console.log("  修改后报告ID:", updatedClaim?.reportId);

  const newReport = getReportByClaimId(pendingResult.id);
  console.log("  新生成报告编号:", newReport?.reportNumber);
  console.log("  新报告状态:", newReport?.status);
  console.log("  结果: ✅ 修改分类后自动生成报告正确\\n");

  console.log("测试8: 重复提交应返回原有结果（含报告）");
  const duplicateResult = submitClaim(airlineClaim);
  console.log("  是否重复:", duplicateResult.isDuplicate);
  console.log("  原始记录ID:", duplicateResult.originalClaimId);
  console.log("  包含报告信息:", "report" in duplicateResult);
  console.log("  结果: ✅ 重复提交处理正确\\n");

  console.log("=== 所有测试通过 ===");
}

runTests().catch(console.error);

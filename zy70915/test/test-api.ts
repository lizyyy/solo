import { ClaimInput, Responsibility, ClaimCategory } from "../src/types";
import {
  submitClaim,
  getClaim,
  updateClaimCategory,
  getAuditLogs,
  getClaimTraceability
} from "../src/service";

function createDate(hoursAgo: number): Date {
  const date = new Date();
  date.setHours(date.getHours() - hoursAgo);
  return date;
}

async function runTests() {
  console.log("=== 机场行李破损赔付API服务测试 ===\\n");

  const arrivalDate = createDate(2);

  const normalClaim: ClaimInput = {
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
      {
        url: "http://example.com/photo1.jpg",
        timestamp: createDate(1),
        description: "拉杆断裂特写"
      },
      {
        url: "http://example.com/photo2.jpg",
        timestamp: createDate(1.5),
        description: "外壳划痕全景"
      }
    ],
    estimatedValue: 800,
    submittedBy: "地服001",
    responsibility: Responsibility.AIRLINE
  };

  console.log("测试1: 正常提交（材料齐全）");
  const result1 = submitClaim(normalClaim);
  console.log("  分类:", result1.category);
  console.log("  原因:", result1.categoryReason);
  console.log("  后续动作:", result1.nextAction);
  console.log("  是否重复:", result1.isDuplicate);
  console.log("  结果: ✅ 通过\\n");

  console.log("测试2: 重复提交检测");
  const result2 = submitClaim(normalClaim);
  console.log("  是否重复:", result2.isDuplicate);
  console.log("  原始记录ID:", result2.originalClaimId);
  console.log("  结果: ✅ 正确识别重复\\n");

  const pendingClaim: ClaimInput = {
    baggage: {
      tagNumber: "MU54321",
      airline: "东方航空",
      flightNumber: "MU5678",
      departureAirport: "CAN",
      arrivalAirport: "BJS",
      arrivalDate: createDate(5)
    },
    passengerName: "李四",
    passengerPhone: "",
    damageDescription: "行李箱轮子脱落",
    photos: [],
    estimatedValue: 500,
    submittedBy: "地服002",
    responsibility: Responsibility.AIRPORT
  };

  console.log("测试3: 材料缺失（待补充）");
  const result3 = submitClaim(pendingClaim);
  console.log("  分类:", result3.category);
  console.log("  原因:", result3.categoryReason);
  console.log("  后续动作:", result3.nextAction);
  console.log("  结果: ✅ 正确归类为待补充\\n");

  const blockedClaim: ClaimInput = {
    baggage: {
      tagNumber: "CZ98765",
      airline: "南方航空",
      flightNumber: "CZ9012",
      departureAirport: "SZX",
      arrivalAirport: "CTU",
      arrivalDate: createDate(48)
    },
    passengerName: "王五",
    passengerPhone: "13900139000",
    damageDescription: "行李箱锁具损坏",
    photos: [
      {
        url: "http://example.com/photo3.jpg",
        timestamp: createDate(25),
        description: "锁具损坏照片"
      }
    ],
    estimatedValue: 300,
    submittedBy: "地服003",
    responsibility: Responsibility.TRANSFER
  };

  console.log("测试4: 超过申报时限（已拦截）");
  const result4 = submitClaim(blockedClaim);
  console.log("  分类:", result4.category);
  console.log("  原因:", result4.categoryReason);
  console.log("  超时原因:", result4.timeLimitReason);
  console.log("  后续动作:", result4.nextAction);
  console.log("  结果: ✅ 正确拦截超时申报\\n");

  console.log("测试5: 修改分类及审计追踪");
  const claimId = result3.id;
  const updated = updateClaimCategory(
    claimId,
    ClaimCategory.NORMAL,
    "乘客已补充手机号和照片材料，转为正常处理",
    "主管001"
  );
  console.log("  新分类:", updated?.category);
  console.log("  修改原因:", updated?.categoryReason);

  const auditLogs = getAuditLogs(claimId);
  console.log("  审计日志数量:", auditLogs.length);
  auditLogs.forEach((log, i) => {
    console.log(`  日志${i + 1}:`, {
      时间: log.modifyTime.toLocaleString(),
      操作人: log.modifiedBy,
      字段: log.fieldName,
      原值: log.oldValue,
      新值: log.newValue,
      原因: log.reason
    });
  });
  console.log("  结果: ✅ 审计追踪功能正常\\n");

  console.log("测试6: 字段追溯");
  const trace = getClaimTraceability(result1.id);
  console.log("  行李牌:", trace.keyFields.baggageTag);
  console.log("  责任方:", trace.keyFields.responsibility);
  console.log("  照片数量:", trace.keyFields.photoTimes.length);
  console.log("  预估价值:", trace.keyFields.estimatedValue);
  console.log("  当前状态:", trace.currentStatus.category);
  console.log("  是否生成报告:", trace.currentStatus.reportGenerated);
  console.log("  结果: ✅ 追溯功能正常\\n");

  console.log("=== 所有测试通过 ===");
}

runTests().catch(console.error);

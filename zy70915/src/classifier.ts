import { ClaimInput, CategoryResult, ClaimCategory } from "./types";

const REPORTING_TIME_LIMIT_HOURS = 24;

export function checkTimeLimit(input: ClaimInput): { exceeded: boolean; reason: string } {
  const arrivalTime = new Date(input.baggage.arrivalDate).getTime();
  const photoTimes = input.photos.map(p => new Date(p.timestamp).getTime());
  const latestPhotoTime = photoTimes.length > 0 ? Math.max(...photoTimes) : Date.now();
  const hoursSinceArrival = (latestPhotoTime - arrivalTime) / (1000 * 60 * 60);

  if (hoursSinceArrival > REPORTING_TIME_LIMIT_HOURS) {
    return {
      exceeded: true,
      reason: `超过申报时限：航班到达后${REPORTING_TIME_LIMIT_HOURS}小时内申报。实际申报距到达${hoursSinceArrival.toFixed(1)}小时`
    };
  }

  return { exceeded: false, reason: "" };
}

export function classifyClaim(input: ClaimInput): CategoryResult {
  const requiredFields = [
    "baggage.tagNumber",
    "baggage.flightNumber",
    "baggage.arrivalDate",
    "passengerName",
    "passengerPhone",
    "damageDescription",
    "responsibility"
  ];

  const missingFields: string[] = [];
  for (const field of requiredFields) {
    const parts = field.split(".");
    let value: any = input;
    for (const part of parts) {
      value = value?.[part];
    }
    if (!value) {
      missingFields.push(field);
    }
  }

  if (input.photos.length === 0) {
    missingFields.push("photos");
  }

  if (missingFields.length > 0) {
    return {
      category: ClaimCategory.PENDING_SUPPLEMENT,
      reason: `缺少必填字段：${missingFields.join("、")}`,
      nextAction: "请地服人员联系乘客补充上述缺失材料后重新提交"
    };
  }

  const timeCheck = checkTimeLimit(input);
  if (timeCheck.exceeded) {
    return {
      category: ClaimCategory.BLOCKED,
      reason: timeCheck.reason,
      nextAction: "申报已超时，系统自动拦截。如需特殊处理，请提交主管审批"
    };
  }

  if (!input.baggage.tagNumber.match(/^[A-Z0-9]{5,10}$/)) {
    return {
      category: ClaimCategory.PENDING_SUPPLEMENT,
      reason: "行李牌格式不正确，应为5-10位大写字母和数字组合",
      nextAction: "请核对行李牌信息后重新提交"
    };
  }

  if (input.estimatedValue <= 0 || input.estimatedValue > 10000) {
    return {
      category: ClaimCategory.PENDING_SUPPLEMENT,
      reason: "预估价值不合理，应在0-10000元范围内",
      nextAction: "请重新评估行李价值后提交"
    };
  }

  const earliestPhoto = new Date(Math.min(...input.photos.map(p => new Date(p.timestamp).getTime())));
  const arrivalDate = new Date(input.baggage.arrivalDate);
  if (earliestPhoto < arrivalDate) {
    return {
      category: ClaimCategory.BLOCKED,
      reason: "照片拍摄时间早于航班到达时间，存在伪造嫌疑",
      nextAction: "已自动拦截，需人工审核照片真实性"
    };
  }

  return {
    category: ClaimCategory.NORMAL,
    reason: "材料齐全、格式正确、时限内申报，进入正常赔付流程",
    nextAction: "系统将生成赔付报告，预计3个工作日内完成审核"
  };
}

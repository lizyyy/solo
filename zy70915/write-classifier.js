const fs = require('fs');

const classifierContent = `import { ClaimInput, CategoryResult, ClaimCategory, Responsibility, ResponsibilityAnalysis } from "./types";

const REPORTING_TIME_LIMIT_HOURS = 24;

export function checkTimeLimit(input: ClaimInput): { exceeded: boolean; reason: string; hoursDiff: number } {
  const arrivalTime = new Date(input.baggage.arrivalDate).getTime();
  const photoTimes = input.photos.map(p => new Date(p.timestamp).getTime());
  const latestPhotoTime = photoTimes.length > 0 ? Math.max(...photoTimes) : Date.now();
  const hoursSinceArrival = (latestPhotoTime - arrivalTime) / (1000 * 60 * 60);

  if (hoursSinceArrival > REPORTING_TIME_LIMIT_HOURS) {
    return {
      exceeded: true,
      reason: "超过申报时限：航班到达后" + REPORTING_TIME_LIMIT_HOURS + "小时内申报。实际申报距到达" + hoursSinceArrival.toFixed(1) + "小时",
      hoursDiff: hoursSinceArrival
    };
  }

  return { exceeded: false, reason: "", hoursDiff: hoursSinceArrival };
}

export function analyzeResponsibility(input: ClaimInput): ResponsibilityAnalysis {
  const { responsibility, baggage } = input;

  switch (responsibility) {
    case Responsibility.AIRLINE:
      return {
        responsibility: Responsibility.AIRLINE,
        isVerified: true,
        verificationNotes: "航空公司责任：航班" + baggage.flightNumber + "运输途中损坏",
        requiredDocuments: ["行李牌照片", "损坏照片", "登机牌"],
        processingPriority: 'high'
      };

    case Responsibility.AIRPORT:
      return {
        responsibility: Responsibility.AIRPORT,
        isVerified: true,
        verificationNotes: "机场责任：" + baggage.arrivalAirport + "机场装卸或存储过程中损坏",
        requiredDocuments: ["行李牌照片", "损坏照片", "机场地服确认单"],
        processingPriority: 'medium'
      };

    case Responsibility.TRANSFER:
      return {
        responsibility: Responsibility.TRANSFER,
        isVerified: false,
        verificationNotes: "中转责任：需核实中转环节具体责任方（航空公司/机场/第三方）",
        requiredDocuments: ["行李牌照片", "损坏照片", "中转行李交接记录", "两程登机牌"],
        processingPriority: 'low'
      };

    case Responsibility.UNKNOWN:
    default:
      return {
        responsibility: Responsibility.UNKNOWN,
        isVerified: false,
        verificationNotes: "责任方未明确，需进一步调查",
        requiredDocuments: ["行李牌照片", "损坏照片", "完整行程单", "情况说明"],
        processingPriority: 'low'
      };
  }
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
      reason: "缺少必填字段：" + missingFields.join("、"),
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

  const responsibilityAnalysis = analyzeResponsibility(input);

  if (input.responsibility === Responsibility.UNKNOWN) {
    return {
      category: ClaimCategory.PENDING_SUPPLEMENT,
      reason: "责任方未明确，需补充责任判定材料",
      nextAction: "请地服人员核实并明确损坏责任方后重新提交",
      responsibilityAnalysis
    };
  }

  if (input.responsibility === Responsibility.TRANSFER) {
    const hasEnoughPhotos = input.photos.length >= 3;
    if (!hasEnoughPhotos) {
      return {
        category: ClaimCategory.PENDING_SUPPLEMENT,
        reason: "中转行李破损需至少3张不同角度的照片（行李全貌、损坏特写、行李牌）",
        nextAction: "请补充照片材料后重新提交",
        responsibilityAnalysis
      };
    }
  }

  let finalReason = "材料齐全、格式正确、时限内申报";
  if (responsibilityAnalysis.responsibility === Responsibility.AIRLINE) {
    finalReason += "，航空公司责任，进入快速赔付通道";
  } else if (responsibilityAnalysis.responsibility === Responsibility.AIRPORT) {
    finalReason += "，机场责任，进入正常赔付流程";
  } else if (responsibilityAnalysis.responsibility === Responsibility.TRANSFER) {
    finalReason += "，中转责任，需进一步核实后赔付";
  }

  let nextAction = "";
  if (responsibilityAnalysis.responsibility === Responsibility.AIRLINE) {
    nextAction = "进入航空公司快速赔付通道，预计1个工作日内完成审核";
  } else if (responsibilityAnalysis.responsibility === Responsibility.AIRPORT) {
    nextAction = "进入机场正常赔付流程，预计3个工作日内完成审核";
  } else {
    nextAction = "进入中转调查流程，预计5个工作日内完成责任核实";
  }

  return {
    category: ClaimCategory.NORMAL,
    reason: finalReason,
    nextAction: nextAction,
    responsibilityAnalysis
  };
}
`;

fs.writeFileSync('src/classifier.ts', classifierContent);
console.log('classifier.ts written successfully');

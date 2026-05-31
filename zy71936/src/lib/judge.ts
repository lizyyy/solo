import type { PhotoRecord, MarkStatus } from "./types"

export interface JudgeResult {
  markStatus: MarkStatus
  markReason: string
  nextStep: string
}

export function judgeRecord(record: PhotoRecord, projectSpecVersion: string): JudgeResult {
  if (record.authorizationStatus === "过期") {
    return {
      markStatus: "授权过期",
      markReason: `授权已于 ${record.authorizationExpiry || "未知日期"} 过期，来源：${record.sourceType}`,
      nextStep: record.authorizationContact
        ? `请联系 ${record.authorizationContact} 补充授权`
        : "请联系相关负责人补充授权",
    }
  }

  if (record.specVersion && record.specVersion !== projectSpecVersion && projectSpecVersion) {
    return {
      markStatus: "待复核",
      markReason: `规格版本不一致：记录版本 ${record.specVersion}，项目版本 ${projectSpecVersion}`,
      nextStep: "请品牌设计师复核确认该记录的规格版本",
    }
  }

  if (record.authorizationStatus === "未知") {
    return {
      markStatus: "待复核",
      markReason: "授权状态未知，需要人工确认",
      nextStep: "请确认该记录的授权状态",
    }
  }

  if (!record.reviewOpinion || record.reviewOpinion.trim() === "") {
    return {
      markStatus: "待复核",
      markReason: "尚未填写审稿意见",
      nextStep: "请品牌设计师填写审稿意见",
    }
  }

  return {
    markStatus: "已确认",
    markReason: "授权有效，规格一致，审稿意见已填写",
    nextStep: "可直接纳入导出",
  }
}

export function judgeRecords(records: PhotoRecord[], projectSpecVersion: string): PhotoRecord[] {
  return records.map((record) => {
    const result = judgeRecord(record, projectSpecVersion)
    return {
      ...record,
      markStatus: result.markStatus,
      markReason: result.markReason,
      nextStep: result.nextStep,
      updatedAt: Date.now(),
    }
  })
}

import type { Sample, ReviewRecord } from "@/types"

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function exportToJSON(samples: Sample[], reviews: ReviewRecord[]): string {
  const data = samples.map((sample) => {
    const sampleReviews = reviews.filter((r) => r.sampleId === sample.id)
    return {
      ...sample,
      reviews: sampleReviews,
    }
  })
  return JSON.stringify(data, null, 2)
}

export function exportToCSV(samples: Sample[], reviews: ReviewRecord[]): string {
  const headers = [
    "样本ID",
    "来源",
    "来源编号",
    "内容",
    "原始标签",
    "模型标签",
    "最终标签",
    "状态",
    "回放原因",
    "导入时间",
    "处理时间",
    "是否重复",
    "标签冲突",
    "样本泄漏",
    "重复来源ID",
    "修正原因",
    "修正人",
    "修正时间",
  ]

  const rows = samples.map((sample) => {
    const latestReview = reviews
      .filter((r) => r.sampleId === sample.id)
      .sort((a, b) => new Date(b.reviewedAt).getTime() - new Date(a.reviewedAt).getTime())[0]

    return [
      sample.id,
      sample.source,
      sample.sourceId,
      sample.content,
      sample.originalLabel,
      sample.modelLabel ?? "",
      sample.finalLabel ?? "",
      sample.status,
      sample.replayReason,
      sample.importedAt,
      sample.processedAt ?? "",
      sample.isDuplicate ? "是" : "否",
      sample.hasConflict ? "是" : "否",
      sample.hasLeakage ? "是" : "否",
      sample.duplicateOf ?? "",
      latestReview?.correctionReason ?? "",
      latestReview?.reviewer ?? "",
      latestReview?.reviewedAt ?? "",
    ].map(escapeCSV)
  })

  return [headers.map(escapeCSV).join(","), ...rows.map((r) => r.join(","))].join("\n")
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob(["\uFEFF" + content], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

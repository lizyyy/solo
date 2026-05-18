import { ClassifiedDamage } from "./types";

class Logger {
  private verbose: boolean = false;

  setVerbose(verbose: boolean): void {
    this.verbose = verbose;
  }

  info(message: string): void {
    console.log(`[INFO] ${message}`);
  }

  warn(message: string): void {
    console.warn(`[WARN] ${message}`);
  }

  error(message: string): void {
    console.error(`[ERROR] ${message}`);
  }

  success(message: string): void {
    console.log(`[SUCCESS] ${message}`);
  }

  detail(message: string): void {
    if (this.verbose) {
      console.log(`[DETAIL] ${message}`);
    }
  }

  logDamageClassification(damage: ClassifiedDamage, index: number): void {
    if (this.verbose) {
      console.log(`
[DETAIL] 记录 #${index + 1}:
  ID: ${damage.id}
  装备ID: ${damage.equipmentId}
  装备类型: ${damage.equipmentType}
  损伤描述: ${damage.description}
  归类: ${damage.category}
  严重程度: ${damage.severity}
  置信度: ${(damage.classificationConfidence * 100).toFixed(1)}%
  旧伤复现: ${damage.isOldDamageRecurrence ? "是" : "否"}
  照片角度缺失: ${damage.hasMissingPhotoAngles ? "是" : "否"}
  备注: ${damage.notes.join("; ")}
`);
    }
  }

  logSummary(summary: {
    total: number;
    success: number;
    partial: number;
    failed: number;
    oldDamageRecurrences: number;
    missingPhotoAngles: number;
  }): void {
    console.log(`
=== 滑雪装备损伤归类 汇总报告
========================================
  总记录数: ${summary.total}
  完全成功: ${summary.success}
  部分成功: ${summary.partial}
  失败: ${summary.failed}
  旧伤复现: ${summary.oldDamageRecurrences}
  照片角度缺失: ${summary.missingPhotoAngles}
========================================
`);
  }
}

export const logger = new Logger();

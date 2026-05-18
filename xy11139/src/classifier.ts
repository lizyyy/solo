import {
  DamageRecord,
  ClassifiedDamage,
  ClassifierConfig,
  ClassificationResult,
  DamageCategory,
  DamageSeverity,
  PhotoAngle,
} from "./types";
import { logger } from "./logger";

export class DamageClassifier {
  private config: ClassifierConfig;

  constructor(config: ClassifierConfig) {
    this.config = config;
  }

  classify(records: DamageRecord[]): ClassificationResult {
    const result: ClassificationResult = {
      totalRecords: records.length,
      successfullyClassified: 0,
      partiallyClassified: 0,
      failedRecords: 0,
      oldDamageRecurrences: 0,
      missingPhotoAngleCases: 0,
      results: [],
      warnings: [],
      errors: [],
    };

    records.forEach((record, index) => {
      try {
        const classified = this.classifySingle(record);
        result.results.push(classified);

        if (classified.isOldDamageRecurrence) {
          result.oldDamageRecurrences++;
        }

        if (classified.hasMissingPhotoAngles) {
          result.missingPhotoAngleCases++;
        }

        if (classified.category === DamageCategory.UNKNOWN) {
          result.partiallyClassified++;
        } else if (classified.hasMissingPhotoAngles || classified.isOldDamageRecurrence) {
          result.partiallyClassified++;
        } else {
          result.successfullyClassified++;
        }

        logger.logDamageClassification(classified, index);
      } catch (error) {
        result.failedRecords++;
        result.errors.push(`记录 ${record.id} 处理失败: ${(error as Error).message}`);
        logger.error(`记录 ${record.id} 处理失败: ${(error as Error).message}`);
      }
    });

    return result;
  }

  private classifySingle(record: DamageRecord): ClassifiedDamage {
    const notes: string[] = [];
    let bestCategory = DamageCategory.UNKNOWN;
    let bestSeverity = DamageSeverity.MINOR;
    let bestConfidence = this.config.defaultConfidence;

    for (const rule of this.config.rules) {
      const matchResult = this.matchRule(record, rule);
      if (matchResult.matched && matchResult.confidence > bestConfidence) {
        bestCategory = rule.category;
        bestSeverity = rule.severity;
        bestConfidence = matchResult.confidence;
        notes.push(`匹配规则: ${rule.name}`);
      }
    }

    if (bestCategory === DamageCategory.UNKNOWN) {
      notes.push("未能匹配到具体分类规则");
    }

    const isOldDamageRecurrence = this.checkOldDamageRecurrence(record);
    if (isOldDamageRecurrence) {
      notes.push("检测到旧伤复现");
    }

    const { hasMissingAngles, missingAngles } = this.checkPhotoAngles(record);
    if (hasMissingAngles) {
      notes.push(`缺失必要照片角度: ${missingAngles.join(", ")}`);
    }

    return {
      ...record,
      category: bestCategory,
      severity: bestSeverity,
      isOldDamageRecurrence,
      hasMissingPhotoAngles: hasMissingAngles,
      missingPhotoAngles: missingAngles,
      classificationConfidence: bestConfidence,
      notes,
    };
  }

  private matchRule(
    record: DamageRecord,
    rule: any
  ): { matched: boolean; confidence: number } {
    const description = record.description.toLowerCase();
    const location = record.location.toLowerCase();
    let matchedDescKeywords = 0;
    let matchedLocKeywords = 0;

    for (const keyword of rule.keywords) {
      if (description.includes(keyword.toLowerCase())) {
        matchedDescKeywords++;
      }
    }

    if (rule.locationKeywords) {
      for (const keyword of rule.locationKeywords) {
        if (location.includes(keyword.toLowerCase())) {
          matchedLocKeywords++;
        }
      }
    }

    const totalKeywords = rule.keywords.length + (rule.locationKeywords?.length || 0);
    const totalMatched = matchedDescKeywords + matchedLocKeywords;

    if (matchedDescKeywords === 0) {
      return { matched: false, confidence: 0 };
    }

    const keywordRatio = totalMatched / Math.max(totalKeywords, 1);
    const confidence = rule.confidence * (0.5 + 0.5 * Math.min(keywordRatio, 1));

    return { matched: true, confidence };
  }

  private checkOldDamageRecurrence(record: DamageRecord): boolean {
    if (record.previousDamageIds && record.previousDamageIds.length > 0) {
      return true;
    }

    const description = record.description.toLowerCase();
    for (const keyword of this.config.oldDamageRecurrenceKeywords) {
      if (description.includes(keyword.toLowerCase())) {
        return true;
      }
    }

    return false;
  }

  private checkPhotoAngles(record: DamageRecord): {
    hasMissingAngles: boolean;
    missingAngles: PhotoAngle[];
  } {
    const missingAngles: PhotoAngle[] = [];

    for (const requiredAngle of this.config.requiredPhotoAngles) {
      if (!record.photoAngles.includes(requiredAngle)) {
        missingAngles.push(requiredAngle);
      }
    }

    return {
      hasMissingAngles: missingAngles.length > 0,
      missingAngles,
    };
  }
}

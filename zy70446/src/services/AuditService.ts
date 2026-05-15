import { v4 as uuidv4 } from 'uuid';
import {
  AuditItem,
  AuditResult,
  ModelResult,
  RuleResult,
  PreviewResult
} from '../types';

export class AuditService {
  private models = [
    { name: 'SafetyModel-A', provider: 'Vendor-A', version: 'v2.1' },
    { name: 'ContentShield-B', provider: 'Vendor-B', version: 'v1.5' },
    { name: 'HarmDetector-C', provider: 'Vendor-C', version: 'v3.0' }
  ];

  private rules = [
    { id: 'R001', name: '敏感词检测', severity: 'high' as const },
    { id: 'R002', name: '暴力内容规则', severity: 'high' as const },
    { id: 'R003', name: '广告内容检测', severity: 'medium' as const },
    { id: 'R004', name: '联系方式提取', severity: 'low' as const },
    { id: 'R005', name: '政治敏感词', severity: 'high' as const }
  ];

  private sensitiveWords = ['敏感词1', '敏感词2', '违禁词', '违法', '暴力', '赌博', '诈骗', '反动', '邪教'];
  private adWords = ['微信', 'qq', '加群', '联系我', '电话', 'vx', 'V信', '扣扣'];
  private politicalWords = ['敏感政治词', '反动言论'];

  async auditItem(item: AuditItem): Promise<AuditResult> {
    const modelResults = await this.runModelAnalysis(item);
    const ruleResults = this.runRuleDetection(item);

    const overallDecision = this.calculateDecision(modelResults, ruleResults);
    const overallConfidence = this.calculateConfidence(modelResults, ruleResults);

    return {
      itemId: item.id,
      item,
      modelResults,
      ruleResults,
      overallDecision,
      overallConfidence,
      timestamp: Date.now()
    };
  }

  async previewAudit(items: AuditItem[]): Promise<PreviewResult> {
    const previewItems = await Promise.all(
      items.map(async (item) => {
        const result = await this.auditItem(item);
        return {
          item,
          prediction: result.overallDecision
        };
      })
    );

    return {
      totalItems: items.length,
      estimatedReject: previewItems.filter(i => i.prediction === 'reject').length,
      estimatedReview: previewItems.filter(i => i.prediction === 'review').length,
      estimatedPass: previewItems.filter(i => i.prediction === 'pass').length,
      items: previewItems
    };
  }

  private async runModelAnalysis(item: AuditItem): Promise<ModelResult[]> {
    return Promise.all(
      this.models.map(async (model) => {
        const baseScore = this.calculateModelScore(item);
        const variance = Math.random() * 0.2 - 0.1;
        const score = Math.min(1, Math.max(0, baseScore + variance));

        let label = 'normal';
        if (score > 0.7) label = 'high_risk';
        else if (score > 0.4) label = 'medium_risk';
        else if (score > 0.15) label = 'low_risk';

        await new Promise(resolve => setTimeout(resolve, 10));

        return {
          modelName: model.name,
          score: Math.round(score * 1000) / 1000,
          label,
          confidence: Math.round((0.7 + Math.random() * 0.3) * 1000) / 1000,
          details: {
            provider: model.provider,
            version: model.version,
            categories: {
              violence: score * 0.3,
              adult: score * 0.25,
              political: score * 0.2,
              fraud: score * 0.15,
              other: score * 0.1
            },
            contentAnalyzed: item.contentType,
            metadataUsed: item.metadata ? Object.keys(item.metadata) : []
          }
        };
      })
    );
  }

  private calculateModelScore(item: AuditItem): number {
    let score = 0;
    const lowerContent = item.content.toLowerCase();

    for (const word of this.sensitiveWords) {
      if (lowerContent.includes(word)) {
        score += 0.3;
      }
    }

    for (const word of this.adWords) {
      if (lowerContent.includes(word)) {
        score += 0.1;
      }
    }

    for (const word of this.politicalWords) {
      if (lowerContent.includes(word)) {
        score += 0.4;
      }
    }

    if (item.contentType === 'image' && item.metadata) {
      score += this.calculateImageMetadataScore(item.metadata);
    }

    if (item.content.length > 500) {
      score += 0.05;
    }

    if (item.content.includes('http') || item.content.includes('www')) {
      score += 0.05;
    }

    return Math.min(1, score);
  }

  private calculateImageMetadataScore(metadata: Record<string, any>): number {
    let score = 0;

    if (metadata.detectionTags && Array.isArray(metadata.detectionTags)) {
      for (const tag of metadata.detectionTags) {
        const lowerTag = tag.toLowerCase();
        if (lowerTag.includes('violence') || lowerTag.includes('暴力') || lowerTag.includes('bloody') || lowerTag.includes('weapon') || lowerTag.includes('weapon')) {
          score += 0.4;
        }
        if (lowerTag.includes('sensitive') || lowerTag.includes('敏感')) {
          score += 0.3;
        }
        if (lowerTag.includes('adult') || lowerTag.includes('色情')) {
          score += 0.35;
        }
        if (lowerTag.includes('brand-unauthorized') || lowerTag.includes('侵权')) {
          score += 0.25;
        }
      }
    }

    if (metadata.description && typeof metadata.description === 'string') {
      const lowerDesc = metadata.description.toLowerCase();
      for (const word of this.sensitiveWords) {
        if (lowerDesc.includes(word)) {
          score += 0.3;
        }
      }
      if (lowerDesc.includes('暴力') || lowerDesc.includes('违法') || lowerDesc.includes('违规')) {
        score += 0.35;
      }
    }

    if (metadata.extractedText && typeof metadata.extractedText === 'string') {
      const lowerText = metadata.extractedText.toLowerCase();
      for (const word of this.adWords) {
        if (lowerText.includes(word)) {
          score += 0.15;
        }
      }
      const phoneMatch = metadata.extractedText.match(/1[3-9]\d{9}/);
      if (phoneMatch) {
        score += 0.1;
      }
    }

    return score;
  }

  private runRuleDetection(item: AuditItem): RuleResult[] {
    const results: RuleResult[] = [];
    const content = item.content.toLowerCase();

    const allTextToCheck = [content];
    if (item.contentType === 'image' && item.metadata) {
      if (item.metadata.description && typeof item.metadata.description === 'string') {
        allTextToCheck.push(item.metadata.description.toLowerCase());
      }
      if (item.metadata.extractedText && typeof item.metadata.extractedText === 'string') {
        allTextToCheck.push(item.metadata.extractedText.toLowerCase());
      }
    }

    const textContains = (word: string): boolean => {
      return allTextToCheck.some(text => text.includes(word));
    };

    for (const word of this.sensitiveWords) {
      if (textContains(word)) {
        results.push({
          ruleId: 'R001',
          ruleName: '敏感词检测',
          matched: true,
          matchContent: word,
          severity: 'high'
        });
        break;
      }
    }

    if (textContains('暴力') || textContains('打') || textContains('杀')) {
      results.push({
        ruleId: 'R002',
        ruleName: '暴力内容规则',
        matched: true,
        matchContent: '图片包含暴力相关标识',
        severity: 'high'
      });
    }

    if (item.contentType === 'image' && item.metadata?.detectionTags && Array.isArray(item.metadata.detectionTags)) {
      const tags = item.metadata.detectionTags.map((t: string) => t.toLowerCase());
      if (tags.some((tag: string) => tag.includes('violence') || tag.includes('暴力') || tag.includes('bloody') || tag.includes('weapon'))) {
        if (!results.find(r => r.ruleId === 'R002')) {
          results.push({
            ruleId: 'R002',
            ruleName: '暴力内容规则',
            matched: true,
            matchContent: '图片检测标签：暴力相关',
            severity: 'high'
          });
        }
      }
      if (tags.some((tag: string) => tag.includes('sensitive') || tag.includes('敏感'))) {
        if (!results.find(r => r.ruleId === 'R001')) {
          results.push({
            ruleId: 'R001',
            ruleName: '敏感词检测',
            matched: true,
            matchContent: '图片检测标签：敏感标识',
            severity: 'high'
          });
        }
      }
    }

    let adMatched = false;
    for (const word of this.adWords) {
      if (textContains(word)) {
        adMatched = true;
        results.push({
          ruleId: 'R003',
          ruleName: '广告内容检测',
          matched: true,
          matchContent: word,
          severity: 'medium'
        });
        break;
      }
    }

    let phoneFound = false;
    for (const text of allTextToCheck) {
      const phoneMatch = text.match(/1[3-9]\d{9}/);
      if (phoneMatch && !phoneFound) {
        phoneFound = true;
        results.push({
          ruleId: 'R004',
          ruleName: '联系方式提取',
          matched: true,
          matchContent: phoneMatch[0],
          severity: 'low'
        });
        break;
      }
    }

    for (const word of this.politicalWords) {
      if (textContains(word)) {
        results.push({
          ruleId: 'R005',
          ruleName: '政治敏感词',
          matched: true,
          matchContent: word,
          severity: 'high'
        });
        break;
      }
    }

    for (const rule of this.rules) {
      if (!results.find(r => r.ruleId === rule.id)) {
        results.push({
          ruleId: rule.id,
          ruleName: rule.name,
          matched: false,
          severity: rule.severity
        });
      }
    }

    return results;
  }

  private calculateDecision(
    modelResults: ModelResult[],
    ruleResults: RuleResult[]
  ): 'pass' | 'reject' | 'review' {
    const highRiskRules = ruleResults.filter(r => r.matched && r.severity === 'high');
    if (highRiskRules.length > 0) {
      return 'reject';
    }

    const avgModelScore = modelResults.reduce((sum, m) => sum + m.score, 0) / modelResults.length;
    const mediumRiskRules = ruleResults.filter(r => r.matched && r.severity === 'medium');

    if (avgModelScore > 0.6 || mediumRiskRules.length > 0) {
      return 'review';
    }

    if (avgModelScore > 0.3) {
      return 'review';
    }

    return 'pass';
  }

  private calculateConfidence(
    modelResults: ModelResult[],
    ruleResults: RuleResult[]
  ): number {
    const modelConfidence = modelResults.reduce((sum, m) => sum + m.confidence, 0) / modelResults.length;
    const ruleCount = ruleResults.filter(r => r.matched).length;
    const ruleFactor = Math.max(0, 1 - ruleCount * 0.1);

    return Math.round(modelConfidence * ruleFactor * 1000) / 1000;
  }

  detectRuleOverreach(ruleResults: RuleResult[]): { overreached: boolean; reason?: string } {
    const matchedRules = ruleResults.filter(r => r.matched);
    
    if (matchedRules.length > 3) {
      return {
        overreached: true,
        reason: '匹配规则过多（>3），可能存在规则过宽问题'
      };
    }

    const lowSeverityMatches = matchedRules.filter(r => r.severity === 'low');
    if (lowSeverityMatches.length > 0 && matchedRules.length === lowSeverityMatches.length) {
      return {
        overreached: true,
        reason: '仅匹配低严重度规则，建议检查是否误判'
      };
    }

    return { overreached: false };
  }
}

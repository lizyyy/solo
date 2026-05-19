import { TranscriptRepository } from "../repositories/TranscriptRepository";
import { SensitiveWordRepository } from "../repositories/SensitiveWordRepository";
import { QualityIssueRepository } from "../repositories/QualityIssueRepository";
import { Transcript } from "../models/Transcript";
import { IssueType, IssueSeverity, IssueStatus } from "../models/QualityIssue";

export interface QualityCheckResult {
  transcriptId: string;
  callId: string;
  hasApology: boolean;
  hasRefundPromise: boolean;
  hasSensitiveWords: boolean;
  issueCount: number;
  issues: Array<{
    type: IssueType;
    severity: IssueSeverity;
    description: string;
    matchedContent?: string;
    segmentIndex?: number;
  }>;
}

export class QualityCheckService {
  private transcriptRepo = new TranscriptRepository();
  private sensitiveWordRepo = new SensitiveWordRepository();
  private issueRepo = new QualityIssueRepository();

  private apologyPatterns = [
    /抱歉/i,
    /对不起/i,
    /不好意思/i,
    /道歉/i,
    /深表歉意/i,
    /给您带来不便/i,
    /sorry/i,
    /apologize/i,
  ];

  private refundPromisePatterns = [
    /退款/i,
    /退钱/i,
    /返还/i,
    /赔付/i,
    /赔偿/i,
    /补款/i,
    /refund/i,
    /reimburse/i,
    /给您退回/i,
    /帮您申请/i,
    /可以退款/i,
    /同意退款/i,
  ];

  async processBatch(batchId: string): Promise<QualityCheckResult[]> {
    const callIds = await this.transcriptRepo.getCallIdsByBatch(batchId);
    const results: QualityCheckResult[] = [];

    for (const callId of callIds) {
      const result = await this.processTranscript(callId);
      results.push(result);
    }

    return results;
  }

  async processTranscript(callId: string): Promise<QualityCheckResult> {
    const transcript = await this.transcriptRepo.findByCallId(callId);
    if (!transcript) {
      throw new Error(`Transcript not found: ${callId}`);
    }

    const issues: QualityCheckResult["issues"] = [];

    const hasApology = this.checkApology(transcript);
    const hasRefundPromise = this.checkRefundPromise(transcript);
    const sensitiveWordIssues = await this.checkSensitiveWords(transcript);

    if (!hasApology) {
      issues.push({
        type: "missing_apology",
        severity: "medium",
        description: "对话中未检测到客服道歉用语",
        ruleName: "必须包含道歉",
      });
    }

    if (!hasRefundPromise) {
      issues.push({
        type: "missing_refund_promise",
        severity: "high",
        description: "对话中未检测到明确的退款承诺",
        ruleName: "必须包含退款承诺",
      });
    }

    issues.push(...sensitiveWordIssues);

    await this.issueRepo.deleteByTranscriptId(transcript.id);

    if (issues.length > 0) {
      await this.issueRepo.bulkCreate(
        issues.map((issue) => ({
          ...issue,
          transcriptId: transcript.id,
          status: "open" as IssueStatus,
        }))
      );
    }

    await this.transcriptRepo.update(transcript.id, {
      hasApology,
      hasRefundPromise,
      hasSensitiveWords: sensitiveWordIssues.length > 0,
      issueCount: issues.length,
      status: "processed",
    });

    return {
      transcriptId: transcript.id,
      callId: transcript.callId,
      hasApology,
      hasRefundPromise,
      hasSensitiveWords: sensitiveWordIssues.length > 0,
      issueCount: issues.length,
      issues,
    };
  }

  private checkApology(transcript: Transcript): boolean {
    const fullText = transcript.fullText || transcript.rawContent;
    if (!fullText) return false;

    const agentTexts = this.extractAgentTexts(transcript);
    const allAgentText = agentTexts.join(" ");

    for (const pattern of this.apologyPatterns) {
      if (pattern.test(allAgentText)) {
        return true;
      }
    }

    return false;
  }

  private checkRefundPromise(transcript: Transcript): boolean {
    const fullText = transcript.fullText || transcript.rawContent;
    if (!fullText) return false;

    const agentTexts = this.extractAgentTexts(transcript);
    const allAgentText = agentTexts.join(" ");

    for (const pattern of this.refundPromisePatterns) {
      if (pattern.test(allAgentText)) {
        return true;
      }
    }

    return false;
  }

  private async checkSensitiveWords(
    transcript: Transcript
  ): Promise<QualityCheckResult["issues"]> {
    const issues: QualityCheckResult["issues"] = [];
    const sensitiveWords = await this.sensitiveWordRepo.getActiveWords();

    if (sensitiveWords.length === 0) {
      return issues;
    }

    const segments = transcript.segments || [];
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      for (const word of sensitiveWords) {
        if (segment.text.toLowerCase().includes(word.word.toLowerCase())) {
          issues.push({
            type: "sensitive_word",
            severity: this.getSeverityLevel(word.severity),
            description: `检测到敏感词: ${word.word}`,
            matchedContent: segment.text,
            segmentIndex: i,
            ruleName: word.category,
          });
        }
      }
    }

    return issues;
  }

  private extractAgentTexts(transcript: Transcript): string[] {
    if (!transcript.segments) {
      return [transcript.fullText || transcript.rawContent];
    }

    return transcript.segments
      .filter((s) => s.role === "agent")
      .map((s) => s.text);
  }

  private getSeverityLevel(severity: number): IssueSeverity {
    if (severity >= 3) return "critical";
    if (severity >= 2) return "high";
    if (severity >= 1) return "medium";
    return "low";
  }

  async getIssuesByTranscript(transcriptId: string) {
    return this.issueRepo.findByTranscriptId(transcriptId);
  }

  async markIssueConfirmed(issueId: string) {
    await this.issueRepo.updateStatus(issueId, "confirmed");
  }

  async markIssueFalsePositive(issueId: string) {
    await this.issueRepo.updateStatus(issueId, "false_positive");
  }

  async getIssueStatistics() {
    return {
      total: await this.issueRepo.count(),
      open: await this.issueRepo.count(undefined, "open"),
      confirmed: await this.issueRepo.count(undefined, "confirmed"),
      falsePositive: await this.issueRepo.count(undefined, "false_positive"),
      missingApology: await this.issueRepo.count("missing_apology"),
      missingRefundPromise: await this.issueRepo.count("missing_refund_promise"),
      sensitiveWord: await this.issueRepo.count("sensitive_word"),
    };
  }
}

import * as fs from "fs";
import * as path from "path";
import * as fastcsv from "fast-csv";
import { TranscriptRepository } from "../repositories/TranscriptRepository";
import { QualityIssueRepository } from "../repositories/QualityIssueRepository";
import { ReviewRecordRepository } from "../repositories/ReviewRecordRepository";
import { CallRecordRepository } from "../repositories/CallRecordRepository";
import { TranscriptStatus } from "../models/Transcript";
import { IssueStatus } from "../models/QualityIssue";

export interface ExportFilter {
  status?: TranscriptStatus;
  hasIssues?: boolean;
  batchId?: string;
  startDate?: Date;
  endDate?: Date;
}

export class ExportService {
  private transcriptRepo = new TranscriptRepository();
  private issueRepo = new QualityIssueRepository();
  private reviewRepo = new ReviewRecordRepository();
  private callRecordRepo = new CallRecordRepository();

  async exportTranscriptsToCsv(filter: ExportFilter, outputPath: string): Promise<string> {
    const transcripts = await this.transcriptRepo.list(filter);
    const rows: any[] = [];

    for (const transcript of transcripts) {
      const callRecord = await this.callRecordRepo.findByCallId(transcript.callId);
      const issues = await this.issueRepo.findByTranscriptId(transcript.id);
      const reviews = await this.reviewRepo.findByTranscriptId(transcript.id);
      const latestReview = reviews[0];

      rows.push({
        callId: transcript.callId,
        agentName: callRecord?.agentName || "",
        agentId: callRecord?.agentId || "",
        customerPhone: callRecord?.customerPhone || "",
        callStartTime: callRecord?.startTime?.toISOString() || "",
        duration: callRecord?.duration || "",
        transcriptStatus: transcript.status,
        hasApology: transcript.hasApology ? "是" : "否",
        hasRefundPromise: transcript.hasRefundPromise ? "是" : "否",
        hasSensitiveWords: transcript.hasSensitiveWords ? "是" : "否",
        issueCount: transcript.issueCount,
        issueTypes: issues.map((i) => i.type).join("; "),
        reviewResult: latestReview?.result || "",
        reviewScore: latestReview?.score || "",
        reviewComments: latestReview?.comments || "",
        reviewedAt: latestReview?.reviewedAt?.toISOString() || "",
        importedAt: transcript.createdAt.toISOString(),
      });
    }

    return this.writeCsv(outputPath, rows);
  }

  async exportIssuesToCsv(status?: IssueStatus, outputPath?: string): Promise<string> {
    const issues = await this.issueRepo.list(undefined, status);
    const rows: any[] = [];

    for (const issue of issues) {
      const transcript = await this.transcriptRepo.findById(issue.transcriptId);
      const callRecord = transcript
        ? await this.callRecordRepo.findByCallId(transcript.callId)
        : null;

      rows.push({
        issueId: issue.id,
        callId: transcript?.callId || "",
        agentName: callRecord?.agentName || "",
        issueType: issue.type,
        severity: issue.severity,
        status: issue.status,
        description: issue.description,
        matchedContent: issue.matchedContent || "",
        segmentIndex: issue.segmentIndex ?? "",
        ruleName: issue.ruleName || "",
        suggestion: issue.suggestion || "",
        createdAt: issue.createdAt.toISOString(),
      });
    }

    const finalPath = outputPath || path.join(process.cwd(), "data", "exports", `issues_${Date.now()}.csv`);
    return this.writeCsv(finalPath, rows);
  }

  async exportReviewsToCsv(outputPath?: string): Promise<string> {
    const reviews = await this.reviewRepo.list();
    const rows: any[] = [];

    for (const review of reviews) {
      const transcript = await this.transcriptRepo.findById(review.transcriptId);
      const callRecord = transcript
        ? await this.callRecordRepo.findByCallId(transcript.callId)
        : null;

      rows.push({
        reviewId: review.id,
        callId: transcript?.callId || "",
        agentName: callRecord?.agentName || "",
        reviewerName: review.reviewerName || "",
        reviewerId: review.reviewerId || "",
        result: review.result,
        score: review.score,
        comments: review.comments || "",
        correctionNotes: review.correctionNotes || "",
        status: review.status,
        reviewedAt: review.reviewedAt?.toISOString() || "",
        createdAt: review.createdAt.toISOString(),
      });
    }

    const finalPath = outputPath || path.join(process.cwd(), "data", "exports", `reviews_${Date.now()}.csv`);
    return this.writeCsv(finalPath, rows);
  }

  async exportStatisticsToJson(outputPath?: string): Promise<string> {
    const transcriptCount = await this.transcriptRepo.count();
    const issueCount = await this.issueRepo.count();
    const reviewCount = await this.reviewRepo.count();

    const stats = {
      generatedAt: new Date().toISOString(),
      transcripts: {
        total: transcriptCount,
        byStatus: {
          pending: await this.transcriptRepo.count({ status: "pending" }),
          processed: await this.transcriptRepo.count({ status: "processed" }),
          reviewed: await this.transcriptRepo.count({ status: "reviewed" }),
        },
        issues: {
          missingApology: await this.transcriptRepo.count({ hasApology: false }),
          missingRefundPromise: await this.transcriptRepo.count({ hasRefundPromise: false }),
          withSensitiveWords: await this.transcriptRepo.count({ hasSensitiveWords: true }),
        },
      },
      issues: {
        total: issueCount,
        byType: {
          missing_apology: await this.issueRepo.count("missing_apology"),
          missing_refund_promise: await this.issueRepo.count("missing_refund_promise"),
          sensitive_word: await this.issueRepo.count("sensitive_word"),
        },
        byStatus: {
          open: await this.issueRepo.count(undefined, "open"),
          confirmed: await this.issueRepo.count(undefined, "confirmed"),
          false_positive: await this.issueRepo.count(undefined, "false_positive"),
        },
      },
      reviews: {
        total: reviewCount,
        byResult: {
          pass: await this.reviewRepo.count(undefined, "pass"),
          fail: await this.reviewRepo.count(undefined, "fail"),
          need_review: await this.reviewRepo.count(undefined, "need_review"),
        },
      },
    };

    const finalPath =
      outputPath || path.join(process.cwd(), "data", "exports", `statistics_${Date.now()}.json`);

    this.ensureDirectoryExists(path.dirname(finalPath));
    fs.writeFileSync(finalPath, JSON.stringify(stats, null, 2), "utf-8");

    return finalPath;
  }

  private async writeCsv(filePath: string, rows: any[]): Promise<string> {
    this.ensureDirectoryExists(path.dirname(filePath));

    return new Promise((resolve, reject) => {
      const ws = fs.createWriteStream(filePath);
      fastcsv
        .write(rows, { headers: true })
        .on("finish", () => resolve(filePath))
        .on("error", reject)
        .pipe(ws);
    });
  }

  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  async generateFullExport(exportDir?: string): Promise<{
    transcripts: string;
    issues: string;
    reviews: string;
    statistics: string;
  }> {
    const baseDir = exportDir || path.join(process.cwd(), "data", "exports", `export_${Date.now()}`);

    this.ensureDirectoryExists(baseDir);

    const [transcriptsPath, issuesPath, reviewsPath, statisticsPath] = await Promise.all([
      this.exportTranscriptsToCsv({}, path.join(baseDir, "transcripts.csv")),
      this.exportIssuesToCsv(undefined, path.join(baseDir, "issues.csv")),
      this.exportReviewsToCsv(path.join(baseDir, "reviews.csv")),
      this.exportStatisticsToJson(path.join(baseDir, "statistics.json")),
    ]);

    return {
      transcripts: transcriptsPath,
      issues: issuesPath,
      reviews: reviewsPath,
      statistics: statisticsPath,
    };
  }
}

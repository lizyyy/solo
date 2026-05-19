#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import "reflect-metadata";
import { initDatabase } from "../config/database";
import { QualityCheckService } from "../services/QualityCheckService";
import { ReviewService } from "../services/ReviewService";

const program = new Command();

program
  .name("quality-review")
  .description("客服质检复核管理")
  .version("1.0.0");

program
  .command("list")
  .description("列出待复核的通话")
  .option("-l, --limit <number>", "数量限制", "50")
  .action(async (options) => {
    try {
      await initDatabase();
      const reviewService = new ReviewService();

      const transcripts = await reviewService.getPendingReviews(parseInt(options.limit));

      console.log(chalk.cyan(`\n待复核通话 (共 ${transcripts.length} 条):`));
      transcripts.forEach((t, index) => {
        console.log(chalk.white(`  ${index + 1}. CallID: ${t.callId}`));
        console.log(chalk.gray(`     ID: ${t.id}`));
        console.log(chalk.gray(`     问题数: ${t.issueCount}`));
        console.log(
          chalk.gray(
            `     标记: ${!t.hasApology ? chalk.red("缺少道歉") : ""} ${
              !t.hasRefundPromise ? chalk.red("缺少退款承诺") : ""
            } ${t.hasSensitiveWords ? chalk.red("含敏感词") : ""}`
          )
        );
      });
    } catch (error: any) {
      console.error(chalk.red(`查询失败: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command("issues <transcriptId>")
  .description("查看通话的质检问题")
  .action(async (transcriptId: string) => {
    try {
      await initDatabase();
      const qualityService = new QualityCheckService();

      const issues = await qualityService.getIssuesByTranscript(transcriptId);

      console.log(chalk.cyan(`\n通话 ID: ${transcriptId}`));
      console.log(chalk.cyan(`发现 ${issues.length} 个问题:\n`));

      issues.forEach((issue, index) => {
        const severityColor =
          issue.severity === "critical"
            ? chalk.red.bold
            : issue.severity === "high"
            ? chalk.red
            : issue.severity === "medium"
            ? chalk.yellow
            : chalk.gray;

        console.log(severityColor(`  ${index + 1}. [${issue.severity.toUpperCase()}] ${issue.type}`));
        console.log(chalk.white(`     ID: ${issue.id}`));
        console.log(chalk.white(`     状态: ${issue.status}`));
        console.log(chalk.white(`     描述: ${issue.description}`));
        if (issue.matchedContent) {
          console.log(chalk.gray(`     匹配内容: ${issue.matchedContent}`));
        }
      });
    } catch (error: any) {
      console.error(chalk.red(`查询失败: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command("submit")
  .description("提交复核结果")
  .requiredOption("-t, --transcript <id>", "通话记录ID")
  .requiredOption("-r, --result <result>", "复核结果: pass/fail/need_review")
  .requiredOption("-s, --score <number>", "评分 0-100")
  .option("-c, --comments <text>", "复核评语")
  .option("-n, --correction <text>", "纠正说明")
  .option("--reviewer <name>", "复核人姓名")
  .action(async (options) => {
    try {
      await initDatabase();
      const reviewService = new ReviewService();

      const review = await reviewService.submitReview({
        transcriptId: options.transcript,
        result: options.result,
        score: parseInt(options.score),
        comments: options.comments,
        correctionNotes: options.correction,
        reviewerName: options.reviewer,
      });

      console.log(chalk.green("\n复核提交成功!"));
      console.log(chalk.cyan(`复核ID: ${review.id}`));
      console.log(chalk.cyan(`结果: ${review.result}`));
      console.log(chalk.cyan(`评分: ${review.score}`));
    } catch (error: any) {
      console.error(chalk.red(`提交失败: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command("stats")
  .description("查看质检统计")
  .action(async () => {
    try {
      await initDatabase();
      const qualityService = new QualityCheckService();
      const reviewService = new ReviewService();

      const issueStats = await qualityService.getIssueStatistics();
      const reviewStats = await reviewService.getSummary();

      console.log(chalk.cyan("\n=== 质检统计 ===\n"));

      console.log(chalk.white("问题统计:"));
      console.log(chalk.cyan(`  总问题数: ${issueStats.total}`));
      console.log(chalk.yellow(`  待确认: ${issueStats.open}`));
      console.log(chalk.green(`  已确认: ${issueStats.confirmed}`));
      console.log(chalk.gray(`  误报: ${issueStats.falsePositive}`));
      console.log();
      console.log(chalk.red(`  缺少道歉: ${issueStats.missingApology}`));
      console.log(chalk.red(`  缺少退款承诺: ${issueStats.missingRefundPromise}`));
      console.log(chalk.red(`  敏感词问题: ${issueStats.sensitiveWord}`));

      console.log(chalk.white("\n复核统计:"));
      console.log(chalk.cyan(`  总复核数: ${reviewStats.total}`));
      console.log(chalk.yellow(`  待复核: ${reviewStats.pending}`));
      console.log(chalk.green(`  已完成: ${reviewStats.completed}`));
      console.log(chalk.green(`  通过率: ${reviewStats.passRate}%`));
      console.log(chalk.blue(`  平均分: ${reviewStats.averageScore}`));
    } catch (error: any) {
      console.error(chalk.red(`查询失败: ${error.message}`));
      process.exit(1);
    }
  });

program.parseAsync(process.argv);

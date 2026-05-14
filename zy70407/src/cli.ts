#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { ApprovalProcessor } from './core/processor';
import { createDefaultRules } from './core/rule-engine';
import { createReviewRecord } from './core/result-manager';
import { generateSampleLogs, generateSampleTickets, generateSampleTicketForDuplicate } from './sample-data';
import { ApprovalStatus } from './types';

const program = new Command();
const processor = new ApprovalProcessor();

program
  .name('approval-analyzer')
  .description('Approval Log Timeline Analyzer')
  .version('1.0.0');

program
  .command('run')
  .description('Run approval log analysis')
  .option('-l, --logs <path>', 'Log file path (JSON)')
  .option('-t, --tickets <path>', 'Ticket file path (JSON)')
  .option('-r, --rules <path>', 'Rule file path (JSON)')
  .option('-d, --date <date>', 'Evaluation date for rule version (YYYY-MM-DD)')
  .option('-o, --output <path>', 'Report output path')
  .option('-f, --format <format>', 'Output format: text|json|table', 'text')
  .option('--sample', 'Use built-in sample data')
  .option('--test-duplicate', 'Test duplicate submission detection')
  .action(async (options) => {
    console.log(chalk.blue('='.repeat(60)));
    console.log(chalk.blue.bold('Approval Log Timeline Analyzer'));
    console.log(chalk.blue('='.repeat(60)));
    console.log();

    let logs, tickets;
    
    if (options.sample) {
      console.log(chalk.yellow('Using built-in sample data...'));
      logs = generateSampleLogs();
      tickets = generateSampleTickets();
    } else {
      if (options.logs) {
        const logsContent = fs.readFileSync(options.logs, 'utf-8');
        logs = JSON.parse(logsContent);
        console.log(chalk.green('Loaded log file: ' + options.logs + ' (' + logs.length + ' records)'));
      } else {
        console.log(chalk.red('Please specify log file path or use --sample parameter'));
        process.exit(1);
      }

      if (options.tickets) {
        const ticketsContent = fs.readFileSync(options.tickets, 'utf-8');
        tickets = JSON.parse(ticketsContent);
        console.log(chalk.green('Loaded ticket file: ' + options.tickets + ' (' + tickets.length + ' tickets)'));
      } else {
        console.log(chalk.red('Please specify ticket file path or use --sample parameter'));
        process.exit(1);
      }
    }

    let rules;
    if (options.rules) {
      const rulesContent = fs.readFileSync(options.rules, 'utf-8');
      rules = JSON.parse(rulesContent);
      console.log(chalk.green('Loaded rule file: ' + options.rules + ' (' + rules.length + ' rules)'));
    } else {
      rules = createDefaultRules();
      console.log(chalk.yellow('Using default rule configuration (' + rules.length + ' rules)'));
    }

    processor.loadLogs(logs);
    processor.loadRules(rules);

    const evaluationDate = options.date ? new Date(options.date) : undefined;
    if (evaluationDate) {
      console.log(chalk.cyan('Using rule version of: ' + evaluationDate.toLocaleDateString()));
    }

    console.log();
    console.log(chalk.blue('Starting approval process...'));

    const results = processor.processBatches(tickets, evaluationDate);

    if (options.testDuplicate) {
      console.log();
      console.log(chalk.yellow('Testing duplicate submission detection...'));
      const duplicateTicket = generateSampleTicketForDuplicate();
      const duplicateResult = processor.processBatch(duplicateTicket, evaluationDate);
      results.push(duplicateResult);
    }

    console.log(chalk.green('Process completed, total ' + results.length + ' batches'));
    console.log();

    const report = processor.getReport(results);
    let reportContent;

    if (options.format === 'json') {
      reportContent = JSON.stringify(report, null, 2);
    } else if (options.format === 'table') {
      reportContent = processor.formatReport(report, 'table');
    } else {
      reportContent = processor.formatReport(report, 'text');
    }

    console.log(reportContent);

    if (options.output) {
      const outputPath = path.resolve(options.output);
      processor.exportReport(report, outputPath, options.format === 'json' ? 'json' : 'text');
      console.log();
      console.log(chalk.green('Report exported to: ' + outputPath));
    }

    const resultsPath = options.output 
      ? path.join(path.dirname(options.output), 'processing-results.json')
      : 'processing-results.json';
    processor.exportResults(resultsPath);
    console.log(chalk.green('Processing results saved to: ' + resultsPath));
  });

program
  .command('show-timeline')
  .description('Show timeline for specified batch')
  .argument('<batchId>', 'Batch ID')
  .option('-l, --logs <path>', 'Log file path (JSON)')
  .option('--sample', 'Use built-in sample data')
  .action(async (batchId, options) => {
    let logs;
    
    if (options.sample) {
      logs = generateSampleLogs();
    } else if (options.logs) {
      const logsContent = fs.readFileSync(options.logs, 'utf-8');
      logs = JSON.parse(logsContent);
    } else {
      console.log(chalk.red('Please specify log file path or use --sample parameter'));
      process.exit(1);
    }

    processor.loadLogs(logs);
    processor.loadRules(createDefaultRules());

    const ticket = {
      ticketId: 'TEMP',
      batchId,
      requestId: 'TEMP',
      requestType: 'temporary_permission',
      requesterId: 'EMP-001',
      requesterName: 'Temp',
      requesterDepartment: 'Temp',
      requestTitle: 'Temp',
      requestDescription: 'Temp',
      requestedAt: new Date(),
      currentStatus: ApprovalStatus.IN_PROGRESS,
      approvalChain: [],
      completedApprovals: [],
      attachedDocuments: [],
      escalationLevel: 0,
      relatedTicketIds: []
    };

    const result = processor.processBatch(ticket);

    console.log(chalk.blue('Timeline Details - Batch ' + batchId));
    console.log(chalk.gray('='.repeat(60)));

    for (const event of result.timeline.events) {
      const timeStr = event.timestamp.toLocaleString();
      const actorStr = event.actor.name + ' (' + event.actor.role + ')';
      
      let statusColor = chalk.white;
      if (event.eventType === 'approve') statusColor = chalk.green;
      if (event.eventType === 'reject') statusColor = chalk.red;
      if (event.eventType === 'comment') statusColor = chalk.blue;

      console.log();
      console.log(chalk.gray(timeStr));
      console.log('  ' + statusColor(event.action) + ' - ' + actorStr);
      if (event.approvalComment) {
        console.log('    ' + chalk.cyan('Approval Comment:') + ' ' + event.approvalComment);
      } else if (event.eventType === 'approve' && !event.approvalComment) {
        console.log('    ' + chalk.red('Missing approval comment!'));
      }
      if (event.details) {
        console.log('    ' + chalk.gray(event.details));
      }
    }
  });

program
  .command('review')
  .description('Add manual review comment')
  .argument('<batchId>', 'Batch ID')
  .argument('<reviewerId>', 'Reviewer ID')
  .argument('<reviewerName>', 'Reviewer Name')
  .argument('<comment>', 'Review Comment')
  .option('--decision <decision>', 'Review decision: uphold|override|escalate', 'uphold')
  .option('--escalation-ticket <ticketId>', 'Escalation ticket number')
  .option('--import <path>', 'Import existing results file path')
  .action(async (batchId, reviewerId, reviewerName, comment, options) => {
    if (options.import) {
      processor.importResults(options.import);
    }

    const result = processor.getResult(batchId);
    if (!result) {
      console.log(chalk.red('Batch ' + batchId + ' not found'));
      process.exit(1);
    }

    const review = createReviewRecord(
      batchId,
      reviewerId,
      reviewerName,
      comment,
      options.decision as any,
      result.batchId,
      undefined,
      options.escalationTicket
    );

    processor.addReview(review);

    console.log(chalk.green('Review comment added'));
    console.log('  Batch: ' + batchId);
    console.log('  Reviewer: ' + reviewerName + ' (' + reviewerId + ')');
    const decisionText = options.decision === 'uphold' ? 'Uphold original decision' : 
                        options.decision === 'override' ? 'Override original decision' : 'Escalate for review';
    console.log('  Decision: ' + decisionText);
    console.log('  Comment: ' + comment);
    if (options.escalationTicket) {
      console.log('  Related escalation ticket: ' + options.escalationTicket);
    }

    if (options.import) {
      processor.exportResults(options.import);
      console.log(chalk.green('Results updated to: ' + options.import));
    }
  });

program
  .command('export-sample')
  .description('Export sample data files')
  .option('-o, --output-dir <dir>', 'Output directory', '.')
  .action(async (options) => {
    const outputDir = path.resolve(options.outputDir);
    
    const logs = generateSampleLogs();
    const tickets = generateSampleTickets();
    const rules = createDefaultRules();

    fs.writeFileSync(
      path.join(outputDir, 'sample-logs.json'),
      JSON.stringify(logs, null, 2)
    );
    console.log(chalk.green('Sample logs exported: sample-logs.json'));

    fs.writeFileSync(
      path.join(outputDir, 'sample-tickets.json'),
      JSON.stringify(tickets, null, 2)
    );
    console.log(chalk.green('Sample tickets exported: sample-tickets.json'));

    fs.writeFileSync(
      path.join(outputDir, 'default-rules.json'),
      JSON.stringify(rules, null, 2)
    );
    console.log(chalk.green('Default rules exported: default-rules.json'));

    console.log();
    console.log(chalk.blue('Tip: You can run analysis with the following command:'));
    console.log(chalk.cyan('  npm start -- run -l sample-logs.json -t sample-tickets.json'));
  });

program
  .command('explain')
  .description('Explain blocking reasons and recommendations')
  .argument('<batchId>', 'Batch ID')
  .option('--import <path>', 'Import existing results file path')
  .action(async (batchId, options) => {
    if (options.import) {
      processor.importResults(options.import);
    }

    const result = processor.getResult(batchId);
    if (!result) {
      console.log(chalk.red('Batch ' + batchId + ' not found'));
      process.exit(1);
    }

    console.log(chalk.blue('Approval Analysis Report - Batch ' + batchId));
    console.log(chalk.gray('='.repeat(60)));
    console.log('Ticket ID: ' + result.ticketId);
    console.log('Processed At: ' + result.processedAt.toLocaleString());
    console.log('Original Status: ' + result.originalStatus);
    console.log('Final Status: ' + result.finalStatus);
    console.log('Rule Version: ' + result.ruleSnapshotVersion);

    if (result.isDuplicate) {
      console.log(chalk.yellow('Duplicate Submission: Reused conclusion from batch ' + result.duplicateOfBatchId));
    }

    if (result.blockReasons.length > 0) {
      console.log(chalk.red('Blocking Reasons:'));
      for (let i = 0; i < result.blockExplanations.length; i++) {
        console.log();
        console.log('  ' + (i + 1) + '. ' + chalk.red(result.blockReasons[i]));
        console.log('     ' + chalk.gray(result.blockExplanations[i]));
      }
    }

    if (result.nextSteps.length > 0) {
      console.log(chalk.green('Next Steps:'));
      for (let i = 0; i < result.nextSteps.length; i++) {
        console.log('  ' + (i + 1) + '. ' + result.nextSteps[i]);
      }
    }

    if (result.hasConflicts && result.conflictDetails) {
      console.log(chalk.yellow('Conflict Detection:'));
      for (const conflict of result.conflictDetails) {
        console.log('  - ' + conflict);
      }
    }

    const reviews = processor.getReviews(batchId);
    if (reviews.length > 0) {
      console.log(chalk.blue('Review Records:'));
      for (const review of reviews) {
        const decisionTextReview = review.reviewDecision === 'uphold' ? 'Uphold original decision' :
                                  review.reviewDecision === 'override' ? 'Override original decision' : 'Escalate for review';
        console.log('  ' + review.reviewedAt.toLocaleString() + ' - ' + review.reviewerName + ' [' + decisionTextReview + ']');
        console.log('    Comment: ' + review.reviewComment);
        if (review.escalationTicketId) {
          console.log('    Related escalation ticket: ' + review.escalationTicketId);
        }
      }
    }

    console.log();
  });

program.parseAsync(process.argv).catch(console.error);

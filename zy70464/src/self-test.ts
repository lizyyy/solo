#!/usr/bin/env node

import chalk = require('chalk');
import { MeetingMinutesProcessor } from './core/processor';
import { ReportGenerator } from './core/report-generator';
import { sampleMeetings } from './data/sample-data';

class TestSuite {
  processor: MeetingMinutesProcessor;
  reportGenerator: ReportGenerator;
  private passed: number = 0;
  private failed: number = 0;
  private errors: string[] = [];

  constructor() {
    this.processor = new MeetingMinutesProcessor();
    this.reportGenerator = new ReportGenerator();
  }

  test(name: string, fn: () => boolean): void {
    try {
      const result = fn();
      if (result) {
        this.passed++;
        console.log(chalk.green(`  ✓ ${name}`));
      } else {
        this.failed++;
        this.errors.push(name);
        console.log(chalk.red(`  ✗ ${name}`));
      }
    } catch (error) {
      this.failed++;
      this.errors.push(`${name}: ${(error as Error).message}`);
      console.log(chalk.red(`  ✗ ${name} - ${(error as Error).message}`));
    }
  }

  section(name: string): void {
    console.log(`\n${chalk.bold.cyan(`【${name}】`)}`);
  }

  summary(): void {
    console.log(`\n${chalk.bold('=== 测试总结 ===')}`);
    console.log(`通过: ${chalk.green(this.passed)} 项`);
    console.log(`失败: ${chalk.red(this.failed)} 项`);
    console.log(`总计: ${this.passed + this.failed} 项`);

    if (this.errors.length > 0) {
      console.log(`\n${chalk.red('失败的测试:')}`);
      this.errors.forEach((e, i) => {
        console.log(`  ${i + 1}. ${e}`);
      });
    }

    const success = this.failed === 0;
    console.log(
      `\n${success ? chalk.green('✓ 所有测试通过!') : chalk.red('✗ 部分测试失败，请检查代码')}`
    );
    process.exit(success ? 0 : 1);
  }
}

function runTests(): void {
  console.log(chalk.bold.cyan('='.repeat(60)));
  console.log(chalk.bold.cyan('        会议纪要补录处理工具 - 自检脚本'));
  console.log(chalk.bold.cyan('='.repeat(60)));

  const suite = new TestSuite();

  suite.section('基础功能测试');

  suite.test('创建会议纪要', () => {
    const meeting = suite.processor.createMeetingMinutes(
      '测试会议',
      '2024-01-01',
      '测试部门',
      ['测试人员']
    );
    return meeting.id !== undefined && meeting.meetingTitle === '测试会议';
  });

  suite.test('获取会议信息', () => {
    const meeting = suite.processor.createMeetingMinutes(
      '获取测试',
      '2024-01-01',
      '测试部门',
      ['测试人员']
    );
    const retrieved = suite.processor.getMeeting(meeting.id);
    return retrieved !== undefined && retrieved.meetingTitle === '获取测试';
  });

  suite.test('获取不存在的会议返回undefined', () => {
    const retrieved = suite.processor.getMeeting('non-existent-id');
    return retrieved === undefined;
  });

  suite.section('附件补录功能测试');

  suite.test('添加附件成功', () => {
    const meeting = suite.processor.createMeetingMinutes(
      '附件测试会议',
      '2024-01-01',
      '测试部门',
      ['测试人员']
    );
    const result = suite.processor.addAttachment(
      meeting.id,
      '测试附件.pdf',
      'application/pdf',
      '测试上传者',
      '测试内容',
      { source: 'test', verified: true }
    );
    return (
      result.success &&
      meeting.attachments.length === 1 &&
      meeting.attachments[0].fileName === '测试附件.pdf'
    );
  });

  suite.test('附件保留原始输入数据', () => {
    const meeting = suite.processor.createMeetingMinutes(
      '原始输入测试',
      '2024-01-01',
      '测试部门',
      ['测试人员']
    );
    const originalInput = {
      source: 'OA系统',
      approvalId: 'OA-12345',
      amount: 1000000,
      nested: { value: 'test' },
    };
    suite.processor.addAttachment(
      meeting.id,
      '测试附件.pdf',
      'application/pdf',
      '测试上传者',
      '测试内容',
      originalInput
    );
    const retrieved = suite.processor.getOriginalInput(
      meeting.id,
      meeting.attachments[0].id
    );
    return (
      retrieved !== null &&
      retrieved.source === 'OA系统' &&
      retrieved.approvalId === 'OA-12345' &&
      retrieved.nested.value === 'test'
    );
  });

  suite.test('附件内容哈希计算正确', () => {
    const meeting = suite.processor.createMeetingMinutes(
      '哈希测试',
      '2024-01-01',
      '测试部门',
      ['测试人员']
    );
    suite.processor.addAttachment(
      meeting.id,
      '测试附件.pdf',
      'application/pdf',
      '测试上传者',
      '相同内容',
      {}
    );
    suite.processor.addAttachment(
      meeting.id,
      '测试附件2.pdf',
      'application/pdf',
      '测试上传者',
      '相同内容',
      {}
    );
    return (
      meeting.attachments[0].contentHash ===
      meeting.attachments[1].contentHash
    );
  });

  suite.test('向不存在的会议添加附件失败', () => {
    const result = suite.processor.addAttachment(
      'non-existent',
      '测试附件.pdf',
      'application/pdf',
      '测试上传者',
      '测试内容',
      {}
    );
    return !result.success;
  });

  suite.section('证据链完整性测试');

  suite.test('新建会议证据链默认为complete', () => {
    const meeting = suite.processor.createMeetingMinutes(
      '证据链测试',
      '2024-01-01',
      '测试部门',
      ['测试人员']
    );
    return meeting.evidenceChain.status === 'complete';
  });

  suite.test('添加附件后证据链保持完整', () => {
    const meeting = suite.processor.createMeetingMinutes(
      '证据链完整测试',
      '2024-01-01',
      '测试部门',
      ['测试人员']
    );
    suite.processor.addAttachment(
      meeting.id,
      '测试附件.pdf',
      'application/pdf',
      '测试上传者',
      '测试内容',
      {}
    );
    return meeting.evidenceChain.status === 'complete';
  });

  suite.test('证据链项目正确记录', () => {
    const meeting = suite.processor.createMeetingMinutes(
      '证据链项目测试',
      '2024-01-01',
      '测试部门',
      ['测试人员']
    );
    const initialCount = meeting.evidenceChain.items.length;
    suite.processor.addAttachment(
      meeting.id,
      '测试附件.pdf',
      'application/pdf',
      '测试上传者',
      '测试内容',
      {}
    );
    return meeting.evidenceChain.items.length === initialCount + 1;
  });

  suite.test('证据链项目标记为已验证', () => {
    const meeting = suite.processor.createMeetingMinutes(
      '证据链验证测试',
      '2024-01-01',
      '测试部门',
      ['测试人员']
    );
    suite.processor.addAttachment(
      meeting.id,
      '测试附件.pdf',
      'application/pdf',
      '测试上传者',
      '测试内容',
      {}
    );
    const lastItem =
      meeting.evidenceChain.items[meeting.evidenceChain.items.length - 1];
    return lastItem.verified === true;
  });

  suite.test('模拟证据链断开功能正常', () => {
    const meeting = suite.processor.createMeetingMinutes(
      '证据链断开测试',
      '2024-01-01',
      '测试部门',
      ['测试人员']
    );
    suite.processor.simulateBrokenEvidenceChain(
      meeting.id,
      '测试断开原因'
    );
    return (
      meeting.evidenceChain.status === 'broken' &&
      meeting.evidenceChain.brokenReason === '测试断开原因'
    );
  });

  suite.section('人工修正功能测试');

  suite.test('人工修正应用成功', () => {
    const meeting = suite.processor.createMeetingMinutes(
      '修正测试',
      '2024-01-01',
      '测试部门',
      ['测试人员']
    );
    const result = suite.processor.applyManualCorrection(
      meeting.id,
      'meetingTitle',
      '修正后的标题',
      '测试修正原因',
      '测试修正人'
    );
    return result.success && meeting.meetingTitle === '修正后的标题';
  });

  suite.test('人工修正保留原始系统判断', () => {
    const meeting = suite.processor.createMeetingMinutes(
      '保留原始值测试',
      '2024-01-01',
      '测试部门',
      ['测试人员']
    );
    const originalTitle = meeting.meetingTitle;
    suite.processor.applyManualCorrection(
      meeting.id,
      'meetingTitle',
      '修正后的标题',
      '测试修正原因',
      '测试修正人'
    );
    const correction = meeting.corrections[0];
    return correction.systemJudgment === originalTitle;
  });

  suite.test('人工修正记录完整信息', () => {
    const meeting = suite.processor.createMeetingMinutes(
      '修正记录测试',
      '2024-01-01',
      '测试部门',
      ['测试人员']
    );
    suite.processor.applyManualCorrection(
      meeting.id,
      'department',
      '修正后的部门',
      '部门名称需要更新',
      '张三'
    );
    const correction = meeting.corrections[0];
    return (
      correction.fieldName === 'department' &&
      correction.reason === '部门名称需要更新' &&
      correction.corrector === '张三' &&
      correction.correctedValue === '修正后的部门'
    );
  });

  suite.test('人工修正添加证据链项目', () => {
    const meeting = suite.processor.createMeetingMinutes(
      '修正证据链测试',
      '2024-01-01',
      '测试部门',
      ['测试人员']
    );
    const beforeCount = meeting.evidenceChain.items.length;
    suite.processor.applyManualCorrection(
      meeting.id,
      'meetingTitle',
      '修正后的标题',
      '测试修正原因',
      '测试修正人'
    );
    return meeting.evidenceChain.items.length === beforeCount + 1;
  });

  suite.test('多次修正累计记录', () => {
    const meeting = suite.processor.createMeetingMinutes(
      '多次修正测试',
      '2024-01-01',
      '测试部门',
      ['测试人员']
    );
    suite.processor.applyManualCorrection(
      meeting.id,
      'meetingTitle',
      '第一次修正',
      '原因1',
      '修正人1'
    );
    suite.processor.applyManualCorrection(
      meeting.id,
      'department',
      '第二次修正',
      '原因2',
      '修正人2'
    );
    return meeting.corrections.length === 2;
  });

  suite.section('搜索词报告功能测试');

  suite.test('生成搜索词报告成功', () => {
    const meeting = suite.processor.createMeetingMinutes(
      '搜索测试',
      '2024-01-01',
      '测试部门',
      ['测试人员']
    );
    const report = suite.processor.generateSearchTermReport(
      meeting.id,
      '测试',
      '这是测试内容，包含测试关键词'
    );
    return report !== null && report.searchTerm === '测试';
  });

  suite.test('搜索词出现次数统计正确', () => {
    const meeting = suite.processor.createMeetingMinutes(
      '搜索次数测试',
      '2024-01-01',
      '测试部门',
      ['测试人员']
    );
    const report = suite.processor.generateSearchTermReport(
      meeting.id,
      '预算',
      '预算报告中包含预算数据，预算总额为100万'
    );
    return report !== null && report.occurrences === 3;
  });

  suite.test('搜索词报告保留复核样例', () => {
    const meeting = suite.processor.createMeetingMinutes(
      '复核样例测试',
      '2024-01-01',
      '测试部门',
      ['测试人员']
    );
    const content = '这是一行包含测试关键词的内容';
    const report = suite.processor.generateSearchTermReport(
      meeting.id,
      '测试',
      content
    );
    return (
      report !== null &&
      report.reviewSample.context !== '' &&
      report.reviewSample.verified === false
    );
  });

  suite.section('统一查询入口测试');

  suite.test('查询所有会议', () => {
    const all = suite.processor.getAllMeetings();
    return all.length > 0;
  });

  suite.test('按部门过滤查询', () => {
    suite.processor.createMeetingMinutes(
      '部门过滤测试',
      '2024-01-01',
      '唯一部门名称',
      ['测试人员']
    );
    const results = suite.processor.queryMeetings({
      department: '唯一部门名称',
    });
    return results.length === 1;
  });

  suite.test('按证据链断开状态过滤', () => {
    const m1 = suite.processor.createMeetingMinutes(
      '完整链测试',
      '2024-01-01',
      '测试部门',
      ['测试人员']
    );
    const m2 = suite.processor.createMeetingMinutes(
      '断开链测试',
      '2024-01-01',
      '测试部门',
      ['测试人员']
    );
    suite.processor.simulateBrokenEvidenceChain(m2.id, '测试断开');
    const broken = suite.processor.queryMeetings({ hasBrokenChain: true });
    const complete = suite.processor.queryMeetings({ hasBrokenChain: false });
    return broken.length > 0 && complete.length > 0;
  });

  suite.test('按有人工修正状态过滤', () => {
    const m = suite.processor.createMeetingMinutes(
      '修正过滤测试',
      '2024-01-01',
      '测试部门',
      ['测试人员']
    );
    suite.processor.applyManualCorrection(
      m.id,
      'meetingTitle',
      '测试',
      '测试',
      '测试'
    );
    const withCorrections = suite.processor.queryMeetings({
      hasCorrections: true,
    });
    const withoutCorrections = suite.processor.queryMeetings({
      hasCorrections: false,
    });
    return withCorrections.length > 0 && withoutCorrections.length > 0;
  });

  suite.section('导出摘要测试');

  suite.test('生成导出摘要成功', () => {
    const meeting = suite.processor.createMeetingMinutes(
      '导出摘要测试',
      '2024-01-01',
      '测试部门',
      ['测试人员']
    );
    const summary = suite.processor.generateExportSummary(meeting.id);
    return summary !== null && summary.input.meetingId === meeting.id;
  });

  suite.test('导出摘要包含输入信息', () => {
    const meeting = suite.processor.createMeetingMinutes(
      '输入信息测试',
      '2024-01-01',
      '测试部门',
      ['测试人员']
    );
    suite.processor.addAttachment(
      meeting.id,
      '测试附件.pdf',
      'application/pdf',
      '测试上传者',
      '测试内容',
      {}
    );
    const summary = suite.processor.generateExportSummary(meeting.id);
    return summary !== null && summary.input.attachments.includes('测试附件.pdf');
  });

  suite.test('导出摘要包含操作记录', () => {
    const meeting = suite.processor.createMeetingMinutes(
      '操作记录测试',
      '2024-01-01',
      '测试部门',
      ['测试人员']
    );
    const summary = suite.processor.generateExportSummary(meeting.id);
    return summary !== null && summary.actions.length > 0;
  });

  suite.test('导出摘要包含结论信息', () => {
    const meeting = suite.processor.createMeetingMinutes(
      '结论信息测试',
      '2024-01-01',
      '测试部门',
      ['测试人员']
    );
    suite.processor.applyManualCorrection(
      meeting.id,
      'meetingTitle',
      '测试',
      '测试',
      '测试'
    );
    const summary = suite.processor.generateExportSummary(meeting.id);
    return (
      summary !== null &&
      summary.conclusion.status !== undefined &&
      summary.conclusion.correctionsCount === 1
    );
  });

  suite.section('模板渲染测试');

  suite.test('生成单会议报告', () => {
    const meeting = suite.processor.createMeetingMinutes(
      '报告测试',
      '2024-01-01',
      '测试部门',
      ['测试人员']
    );
    suite.processor.addAttachment(
      meeting.id,
      '测试附件.pdf',
      'application/pdf',
      '测试上传者',
      '测试内容',
      { source: 'test' }
    );
    suite.processor.applyManualCorrection(
      meeting.id,
      'meetingTitle',
      '修正后的报告测试',
      '测试修正',
      '测试人'
    );
    suite.processor.generateSearchTermReport(
      meeting.id,
      '测试',
      '测试内容'
    );
    const summary = suite.processor.generateExportSummary(meeting.id);
    if (!summary) return false;
    const report = suite.reportGenerator.generateMeetingReport(
      meeting,
      summary
    );
    return (
      report.includes('会议纪要补录报告') &&
      report.includes('报告测试') &&
      report.includes('测试附件.pdf') &&
      report.includes('人工修正记录') &&
      report.includes('搜索词报告')
    );
  });

  suite.test('生成汇总报告', () => {
    const meetings = suite.processor.getAllMeetings();
    const report = suite.reportGenerator.generateSummaryReport(
      meetings,
      '测试汇总'
    );
    return (
      report.includes('会议纪要汇总报告') &&
      report.includes('统计概览') &&
      report.includes('会议列表')
    );
  });

  suite.test('审计追踪生成完整', () => {
    const meeting = suite.processor.createMeetingMinutes(
      '审计追踪测试',
      '2024-01-01',
      '测试部门',
      ['测试人员']
    );
    suite.processor.addAttachment(
      meeting.id,
      '测试附件.pdf',
      'application/pdf',
      '测试上传者',
      '测试内容',
      {}
    );
    suite.processor.simulateBrokenEvidenceChain(
      meeting.id,
      '测试断开原因'
    );
    const audit = suite.reportGenerator.generateAuditTrail(meeting);
    return (
      audit.includes('审计追踪') &&
      audit.includes('证据链') &&
      audit.includes('测试断开原因')
    );
  });

  suite.section('真实部门样例数据测试');

  suite.test('加载样例数据成功', () => {
    return sampleMeetings.length === 4;
  });

  suite.test('样例数据包含成功路径', () => {
    return sampleMeetings.filter((m) => !m.hasBrokenChain).length >= 3;
  });

  suite.test('样例数据包含异常路径（证据链断开）', () => {
    return sampleMeetings.filter((m) => m.hasBrokenChain).length === 1;
  });

  suite.test('样例数据包含人工修正', () => {
    return sampleMeetings.some((m) => m.corrections && m.corrections.length > 0);
  });

  suite.test('样例数据附件包含真实原始输入结构', () => {
    const meeting = sampleMeetings[0];
    const attachment = meeting.attachments[0];
    return (
      attachment.originalInput.source !== undefined &&
      attachment.originalInput.approvalId !== undefined &&
      attachment.originalInput.approver !== undefined
    );
  });

  suite.test('样例数据包含搜索词配置', () => {
    return sampleMeetings.every(
      (m) => m.searchTerms && m.searchTerms.length > 0
    );
  });

  suite.test('处理样例数据完整流程', () => {
    const sample = sampleMeetings[0];
    const meeting = suite.processor.createMeetingMinutes(
      sample.title,
      sample.date,
      sample.department,
      sample.attendees
    );

    meeting.topics = sample.topics;
    meeting.decisions = sample.decisions;

    sample.attachments.forEach((att) => {
      suite.processor.addAttachment(
        meeting.id,
        att.fileName,
        att.fileType,
        att.uploader,
        att.content,
        att.originalInput
      );
    });

    if (sample.corrections) {
      sample.corrections.forEach((corr) => {
        suite.processor.applyManualCorrection(
          meeting.id,
          corr.field,
          corr.value,
          corr.reason,
          corr.corrector
        );
      });
    }

    if (sample.searchTerms) {
      sample.searchTerms.forEach((st) => {
        suite.processor.generateSearchTermReport(
          meeting.id,
          st.term,
          st.content
        );
      });
    }

    const summary = suite.processor.generateExportSummary(meeting.id);
    if (!summary) return false;
    const report = suite.reportGenerator.generateMeetingReport(
      meeting,
      summary
    );

    return (
      meeting.attachments.length === sample.attachments.length &&
      meeting.corrections.length === (sample.corrections?.length || 0) &&
      meeting.searchTermReports.length === (sample.searchTerms?.length || 0) &&
      meeting.evidenceChain.status === 'complete' &&
      report.length > 0
    );
  });

  suite.section('边界情况测试');

  suite.test('空附件内容处理', () => {
    const meeting = suite.processor.createMeetingMinutes(
      '空内容测试',
      '2024-01-01',
      '测试部门',
      ['测试人员']
    );
    const result = suite.processor.addAttachment(
      meeting.id,
      '空文件.pdf',
      'application/pdf',
      '测试上传者',
      '',
      {}
    );
    return result.success;
  });

  suite.test('复杂嵌套原始输入', () => {
    const meeting = suite.processor.createMeetingMinutes(
      '嵌套输入测试',
      '2024-01-01',
      '测试部门',
      ['测试人员']
    );
    const complexInput = {
      level1: {
        level2: {
          level3: {
            value: 'deep nested',
            array: [1, 2, 3],
          },
        },
      },
      metadata: {
        created: new Date().toISOString(),
        version: '1.0.0',
      },
    };
    suite.processor.addAttachment(
      meeting.id,
      '复杂文件.pdf',
      'application/pdf',
      '测试上传者',
      '内容',
      complexInput
    );
    const retrieved = suite.processor.getOriginalInput(
      meeting.id,
      meeting.attachments[0].id
    );
    return (
      retrieved !== null &&
      retrieved.level1.level2.level3.value === 'deep nested' &&
      retrieved.level1.level2.level3.array.length === 3
    );
  });

  suite.test('中文搜索词正确匹配', () => {
    const meeting = suite.processor.createMeetingMinutes(
      '中文搜索测试',
      '2024-01-01',
      '测试部门',
      ['测试人员']
    );
    const report = suite.processor.generateSearchTermReport(
      meeting.id,
      '预算',
      '预算报告中预算总额预算执行率预算审核预算审批'
    );
    return report !== null && report.occurrences === 5;
  });

  suite.test('同一字段多次修正保留历史', () => {
    const meeting = suite.processor.createMeetingMinutes(
      '多次同字段修正',
      '2024-01-01',
      '测试部门',
      ['测试人员']
    );
    suite.processor.applyManualCorrection(
      meeting.id,
      'meetingTitle',
      '第一次修正',
      '原因1',
      '人1'
    );
    suite.processor.applyManualCorrection(
      meeting.id,
      'meetingTitle',
      '第二次修正',
      '原因2',
      '人2'
    );
    return (
      meeting.corrections.length === 2 &&
      meeting.corrections[0].systemJudgment === '多次同字段修正' &&
      meeting.corrections[1].systemJudgment === '第一次修正'
    );
  });

  suite.test('证据链断开后仍可查询和生成报告', () => {
    const meeting = suite.processor.createMeetingMinutes(
      '断开链报告测试',
      '2024-01-01',
      '测试部门',
      ['测试人员']
    );
    suite.processor.addAttachment(
      meeting.id,
      '测试附件.pdf',
      'application/pdf',
      '测试上传者',
      '测试内容',
      {}
    );
    suite.processor.simulateBrokenEvidenceChain(
      meeting.id,
      '测试断开原因'
    );
    const summary = suite.processor.generateExportSummary(meeting.id);
    if (!summary) return false;
    const report = suite.reportGenerator.generateMeetingReport(
      meeting,
      summary
    );
    return (
      meeting.evidenceChain.status === 'broken' &&
      report.includes('证据链已断开') &&
      summary.conclusion.evidenceChainIntact === false
    );
  });

  suite.test('同时包含完整链和断开链的查询结果', () => {
    const all = suite.processor.queryMeetings({});
    const broken = suite.processor.queryMeetings({ hasBrokenChain: true });
    const complete = suite.processor.queryMeetings({ hasBrokenChain: false });
    return all.length === broken.length + complete.length;
  });

  suite.test('报告中显示复核样例部分', () => {
    const meeting = suite.processor.createMeetingMinutes(
      '复核样例报告测试',
      '2024-01-01',
      '测试部门',
      ['测试人员']
    );
    suite.processor.generateSearchTermReport(
      meeting.id,
      '关键词',
      '这是包含关键词的内容行'
    );
    const summary = suite.processor.generateExportSummary(meeting.id);
    if (!summary) return false;
    const report = suite.reportGenerator.generateMeetingReport(
      meeting,
      summary
    );
    return (
      report.includes('复核样例') &&
      report.includes('包含关键词的内容行')
    );
  });

  suite.summary();
}

runTests();

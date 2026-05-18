'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const PermissionAuditScanner = require('../src/scanner');

const TEST_DATE = '2026-05-18';
const EXAMPLES_DIR = path.join(__dirname, '..', 'examples');

describe('权限审计日志临权到期巡检 - 自动化测试', () => {

  describe('1. 空目录扫描测试', () => {
    it('应该正确处理空目录并发出警告', async () => {
      const scanner = new PermissionAuditScanner({ auditDate: TEST_DATE });
      const report = await scanner.scanDirectory(path.join(EXAMPLES_DIR, 'empty'));

      assert.strictEqual(report.summary.工具名称, '权限审计日志临权到期巡检');
      assert.strictEqual(report.summary.处理文件数, 0);
      assert.strictEqual(report.summary.跳过文件数, 0);
      assert.strictEqual(report.summary.过期仍访问用户数, 0);
      assert.strictEqual(report['处理警告'].length, 1);
      assert.match(report['处理警告'][0].警告信息, /未找到CSV文件/);
    });
  });

  describe('2. 缺少必需列测试', () => {
    it('应该检测到缺少必需列并发出警告', async () => {
      const scanner = new PermissionAuditScanner({ auditDate: TEST_DATE });
      const report = await scanner.scanDirectory(path.join(EXAMPLES_DIR, 'missing-column'));

      assert.strictEqual(report.summary.工具名称, '权限审计日志临权到期巡检');
      assert.strictEqual(report.summary.处理文件数, 1);
      assert.strictEqual(report.summary.警告数, 1);
      assert.match(report['处理警告'][0].警告信息, /缺少必需列/);
      assert.match(report['处理警告'][0].警告信息, /部门/);
    });
  });

  describe('3. 重复行检测测试', () => {
    it('应该检测到重复行并记录问题', async () => {
      const scanner = new PermissionAuditScanner({ auditDate: TEST_DATE });
      const report = await scanner.scanDirectory(path.join(EXAMPLES_DIR, 'duplicate-rows'));

      assert.strictEqual(report.summary.工具名称, '权限审计日志临权到期巡检');
      assert.strictEqual(report.summary.发现问题数, 2);

      const duplicateIssues = report['数据问题详情'].filter(i => i.问题类型 === '重复行');
      assert.strictEqual(duplicateIssues.length, 2);

      const userIds = duplicateIssues.map(i => i.用户ID);
      assert.ok(userIds.includes('U001'), '应该检测到U001的重复行');
      assert.ok(userIds.includes('U002'), '应该检测到U002的重复行');
    });
  });

  describe('4. 部分损坏文件处理测试', () => {
    it('应该处理损坏文件并检测数据校验问题', async () => {
      const scanner = new PermissionAuditScanner({ auditDate: TEST_DATE });
      const report = await scanner.scanDirectory(path.join(EXAMPLES_DIR, 'corrupted-file'));

      assert.strictEqual(report.summary.工具名称, '权限审计日志临权到期巡检');
      assert.ok(report.summary.发现问题数 > 0, '应该检测到数据问题');

      const dateIssues = report['数据问题详情'].filter(i => 
        i.问题类型 === '权限到期时间格式无效' || 
        i.问题类型 === '最后访问时间格式无效' ||
        i.问题类型 === '数据校验失败'
      );
      assert.ok(dateIssues.length > 0, '应该检测到日期格式或数据校验问题');
    });
  });

  describe('5. 正常扫描流程测试', () => {
    it('应该正确扫描正常数据并识别过期仍访问用户', async () => {
      const scanner = new PermissionAuditScanner({ auditDate: TEST_DATE });
      const report = await scanner.scanDirectory(path.join(EXAMPLES_DIR, 'normal'));

      assert.strictEqual(report.summary.工具名称, '权限审计日志临权到期巡检');
      assert.strictEqual(report.summary.处理文件数, 2);
      assert.strictEqual(report.summary.发现问题数, 0);
      assert.ok(report.summary.过期仍访问用户数 > 0, '应该检测到过期仍访问用户');

      const userNames = report['过期仍访问用户列表'].map(u => u.用户名);
      assert.ok(userNames.includes('张三'), '应该检测到张三');
      assert.ok(userNames.includes('李四'), '应该检测到李四');
      assert.ok(userNames.includes('赵六'), '应该检测到赵六');
    });

    it('应该正确计算过期天数和过期后访问天数', async () => {
      const scanner = new PermissionAuditScanner({ auditDate: TEST_DATE });
      const report = await scanner.scanDirectory(path.join(EXAMPLES_DIR, 'normal'));

      const zhangsan = report['过期仍访问用户列表'].find(u => u.用户ID === 'U001');
      assert.ok(zhangsan, '应该找到张三的记录');
      assert.strictEqual(zhangsan.部门, '技术部');
      assert.strictEqual(zhangsan.权限来源, '直接分配');
      assert.ok(zhangsan.过期天数 > 0, '过期天数应该大于0');
      assert.ok(zhangsan.过期后访问天数 > 0, '过期后访问天数应该大于0');
    });
  });

  describe('6. 报告格式化测试', () => {
    it('应该正确生成文本格式报告', async () => {
      const scanner = new PermissionAuditScanner({ auditDate: TEST_DATE });
      const report = await scanner.scanDirectory(path.join(EXAMPLES_DIR, 'normal'));
      const textOutput = scanner.formatReport(report, 'text');

      assert.match(textOutput, /权限审计日志临权到期巡检报告/);
      assert.match(textOutput, /扫描日期: 2026-05-18/);
      assert.match(textOutput, /工具名称: 权限审计日志临权到期巡检/);
      assert.match(textOutput, /过期仍访问用户列表/);
      assert.match(textOutput, /张三/);
      assert.match(textOutput, /报告结束 - 权限审计日志临权到期巡检/);
    });

    it('应该正确生成JSON格式报告', async () => {
      const scanner = new PermissionAuditScanner({ auditDate: TEST_DATE });
      const report = await scanner.scanDirectory(path.join(EXAMPLES_DIR, 'normal'));
      const jsonOutput = scanner.formatReport(report, 'json');

      const parsed = JSON.parse(jsonOutput);
      assert.strictEqual(parsed.summary.工具名称, '权限审计日志临权到期巡检');
      assert.strictEqual(parsed.summary.扫描日期, TEST_DATE);
      assert.ok(Array.isArray(parsed['过期仍访问用户列表']));
    });
  });

  describe('7. 业务规则验证测试', () => {
    it('应该只标记权限已过期且过期后有访问的用户', async () => {
      const scanner = new PermissionAuditScanner({ auditDate: TEST_DATE });
      const report = await scanner.scanDirectory(path.join(EXAMPLES_DIR, 'normal'));

      report['过期仍访问用户列表'].forEach(user => {
        const expireDate = new Date(user.权限到期时间);
        const lastAccessDate = new Date(user.最后访问时间);
        const auditDate = new Date(TEST_DATE);

        assert.ok(expireDate < auditDate, `权限应该已过期: ${user.用户名}`);
        assert.ok(lastAccessDate > expireDate, `过期后应该有访问: ${user.用户名}`);
      });
    });

    it('不应该标记权限未过期的用户', async () => {
      const scanner = new PermissionAuditScanner({ auditDate: TEST_DATE });
      const report = await scanner.scanDirectory(path.join(EXAMPLES_DIR, 'normal'));

      const userIds = report['过期仍访问用户列表'].map(u => u.用户ID);
      assert.ok(!userIds.includes('U003'), '不应该包含权限未过期的王五');
    });
  });

  describe('8. 报告差异对比功能测试', () => {
    let oldReportPath, newReportPath;

    before(async () => {
      const scanner = new PermissionAuditScanner({ auditDate: '2026-01-01' });
      const oldReport = await scanner.scanDirectory(path.join(EXAMPLES_DIR, 'normal'));
      oldReportPath = path.join(__dirname, 'old-test-report.json');
      fs.writeFileSync(oldReportPath, JSON.stringify(oldReport), 'utf-8');

      const scanner2 = new PermissionAuditScanner({ auditDate: TEST_DATE });
      const newReport = await scanner2.scanDirectory(path.join(EXAMPLES_DIR, 'normal'));
      newReportPath = path.join(__dirname, 'new-test-report.json');
      fs.writeFileSync(newReportPath, JSON.stringify(newReport), 'utf-8');
    });

    after(() => {
      if (fs.existsSync(oldReportPath)) fs.unlinkSync(oldReportPath);
      if (fs.existsSync(newReportPath)) fs.unlinkSync(newReportPath);
    });

    it('应该能够正确读取和解析报告JSON文件', async () => {
      const oldReport = JSON.parse(fs.readFileSync(oldReportPath, 'utf-8'));
      const newReport = JSON.parse(fs.readFileSync(newReportPath, 'utf-8'));

      assert.strictEqual(oldReport.summary.工具名称, '权限审计日志临权到期巡检');
      assert.strictEqual(newReport.summary.工具名称, '权限审计日志临权到期巡检');
      assert.notStrictEqual(
        oldReport.summary.过期仍访问用户数,
        newReport.summary.过期仍访问用户数,
        '不同日期的报告应该有不同的用户数'
      );
    });

    it('应该能够检测出新增和移除的用户', async () => {
      const oldReport = JSON.parse(fs.readFileSync(oldReportPath, 'utf-8'));
      const newReport = JSON.parse(fs.readFileSync(newReportPath, 'utf-8'));

      const oldUsers = new Map(oldReport['过期仍访问用户列表'].map(u => [u.用户ID, u]));
      const newUsers = new Map(newReport['过期仍访问用户列表'].map(u => [u.用户ID, u]));

      const added = [...newUsers.keys()].filter(id => !oldUsers.has(id));
      const removed = [...oldUsers.keys()].filter(id => !newUsers.has(id));

      assert.ok(added.length > 0 || removed.length > 0, '应该有用户数量变化');
    });
  });

  describe('9. 输出验证测试', () => {
    it('应该在输出中包含"权限审计日志临权到期巡检"字样', async () => {
      const scanner = new PermissionAuditScanner({ auditDate: TEST_DATE });
      const report = await scanner.scanDirectory(path.join(EXAMPLES_DIR, 'normal'));
      const textOutput = scanner.formatReport(report, 'text');

      const occurrences = (textOutput.match(/权限审计日志临权到期巡检/g) || []).length;
      assert.ok(occurrences >= 3, `输出中应该多次包含工具名称，实际出现 ${occurrences} 次`);
    });

    it('应该包含具体的用户信息而不只是通用编号', async () => {
      const scanner = new PermissionAuditScanner({ auditDate: TEST_DATE });
      const report = await scanner.scanDirectory(path.join(EXAMPLES_DIR, 'normal'));
      const textOutput = scanner.formatReport(report, 'text');

      assert.match(textOutput, /用户名: 张三/);
      assert.match(textOutput, /用户ID: U001/);
      assert.match(textOutput, /部门: 技术部/);
      assert.match(textOutput, /权限令牌: TOKEN-001/);
      assert.match(textOutput, /权限来源: 直接分配/);
    });
  });
});

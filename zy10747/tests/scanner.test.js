const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const ExamRetakeScanner = require('../src/scanner');

describe('ExamRetakeScanner - 补考资格扫描器', () => {
  const testDir = path.join(__dirname, 'test-data');
  const samplesDir = path.join(__dirname, '..', 'samples');

  before(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  after(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('核心业务规则', () => {
    it('应正确判定可补考资格 - 全部条件满足', () => {
      const scanner = new ExamRetakeScanner({ currentDate: '2026-05-18' });
      const record = {
        examId: 'EXAM001',
        studentId: 'STU001',
        subject: '高等数学',
        status: 'failed',
        certDate: '2025-06-01',
        retakeCount: 0,
        hasRetaken: false
      };
      const result = scanner.isEligibleForRetake(record, [record]);
      assert.strictEqual(result.eligible, true);
      assert.strictEqual(result.reasons.length, 0);
    });

    it('应正确判定不可补考 - 证明已过期', () => {
      const scanner = new ExamRetakeScanner({ currentDate: '2026-05-18' });
      const record = {
        examId: 'EXAM001',
        studentId: 'STU001',
        subject: '高等数学',
        status: 'failed',
        certDate: '2024-01-01',
        retakeCount: 0,
        hasRetaken: false
      };
      const result = scanner.isEligibleForRetake(record, [record]);
      assert.strictEqual(result.eligible, false);
      assert.ok(result.reasons.includes('证明已过期'));
    });

    it('应正确判定不可补考 - 已补考', () => {
      const scanner = new ExamRetakeScanner({ currentDate: '2026-05-18' });
      const record1 = {
        examId: 'EXAM001',
        studentId: 'STU001',
        subject: '高等数学',
        status: 'failed',
        certDate: '2025-06-01',
        retakeCount: 1,
        hasRetaken: false
      };
      const record2 = {
        ...record1,
        retakeCount: 0,
        hasRetaken: true
      };
      
      const result1 = scanner.isEligibleForRetake(record1, [record1]);
      const result2 = scanner.isEligibleForRetake(record2, [record2]);
      
      assert.strictEqual(result1.eligible, false);
      assert.ok(result1.reasons.includes('已补考'));
      assert.strictEqual(result2.eligible, false);
      assert.ok(result2.reasons.includes('已补考'));
    });

    it('应正确判定不可补考 - 科目冲突', () => {
      const scanner = new ExamRetakeScanner({ currentDate: '2026-05-18' });
      const failedRecord = {
        examId: 'EXAM001',
        studentId: 'STU001',
        subject: '高等数学',
        status: 'failed',
        certDate: '2025-06-01',
        retakeCount: 0,
        hasRetaken: false
      };
      const passedRecord = {
        examId: 'EXAM002',
        studentId: 'STU001',
        subject: '高等数学',
        status: 'passed',
        certDate: '2025-06-01',
        retakeCount: 0,
        hasRetaken: false
      };
      const allRecords = [failedRecord, passedRecord];
      
      const result = scanner.isEligibleForRetake(failedRecord, allRecords);
      assert.strictEqual(result.eligible, false);
      assert.ok(result.reasons.includes('科目冲突（该科目已通过）'));
    });

    it('应正确判定不可补考 - 考试状态非不及格', () => {
      const scanner = new ExamRetakeScanner({ currentDate: '2026-05-18' });
      const record = {
        examId: 'EXAM001',
        studentId: 'STU001',
        subject: '高等数学',
        status: 'passed',
        certDate: '2025-06-01',
        retakeCount: 0,
        hasRetaken: false
      };
      const result = scanner.isEligibleForRetake(record, [record]);
      assert.strictEqual(result.eligible, false);
      assert.ok(result.reasons.includes('考试状态非不及格'));
    });

    it('应正确判定不可补考 - 多个原因', () => {
      const scanner = new ExamRetakeScanner({ currentDate: '2026-05-18' });
      const record = {
        examId: 'EXAM001',
        studentId: 'STU001',
        subject: '高等数学',
        status: 'passed',
        certDate: '2024-01-01',
        retakeCount: 1,
        hasRetaken: true
      };
      const result = scanner.isEligibleForRetake(record, [record]);
      assert.strictEqual(result.eligible, false);
      assert.ok(result.reasons.length >= 2);
    });
  });

  describe('文件加载', () => {
    it('应正确加载 JSON 文件', () => {
      const scanner = new ExamRetakeScanner();
      const records = scanner.loadRecordsFromFile(path.join(samplesDir, 'batch1.json'));
      assert.strictEqual(records.length, 4);
      assert.strictEqual(records[0].studentName, '张三');
    });

    it('应正确加载 CSV 文件', () => {
      const scanner = new ExamRetakeScanner();
      const records = scanner.loadRecordsFromFile(path.join(samplesDir, 'batch2.csv'));
      assert.strictEqual(records.length, 4);
      assert.strictEqual(records[0].studentName, '李四');
    });

    it('应记录加载错误但不抛出异常', () => {
      const invalidFile = path.join(testDir, 'invalid.json');
      fs.writeFileSync(invalidFile, 'not valid json', 'utf-8');
      
      const scanner = new ExamRetakeScanner();
      const records = scanner.loadRecordsFromFile(invalidFile);
      
      assert.strictEqual(records.length, 0);
      assert.strictEqual(scanner.errors.length, 1);
    });
  });

  describe('排序功能', () => {
    it('应按学号、科目、考试编号稳定排序', () => {
      const scanner = new ExamRetakeScanner();
      const unsorted = [
        { studentId: 'STU002', subject: 'B', examId: 'EXAM002' },
        { studentId: 'STU001', subject: 'B', examId: 'EXAM001' },
        { studentId: 'STU001', subject: 'A', examId: 'EXAM001' },
      ];
      
      const sorted = scanner.sortResults(unsorted);
      
      assert.strictEqual(sorted[0].studentId, 'STU001');
      assert.strictEqual(sorted[0].subject, 'A');
      assert.strictEqual(sorted[1].studentId, 'STU001');
      assert.strictEqual(sorted[1].subject, 'B');
      assert.strictEqual(sorted[2].studentId, 'STU002');
    });
  });

  describe('报告生成', () => {
    it('文本报告应包含特定标题', () => {
      const scanner = new ExamRetakeScanner({ currentDate: '2026-05-18' });
      const results = scanner.scan(samplesDir);
      const report = scanner.generateReport(results);
      
      assert.ok(report.includes('考试记录补考资格扫描报告'));
      assert.ok(report.includes('可恢复补考资格列表'));
      assert.ok(report.includes('不可补考明细'));
    });

    it('文本报告应包含具体学生信息', () => {
      const scanner = new ExamRetakeScanner({ currentDate: '2026-05-18' });
      const results = scanner.scan(samplesDir);
      const report = scanner.generateReport(results);
      
      assert.ok(report.includes('张三'));
      assert.ok(report.includes('STU001'));
      assert.ok(report.includes('高等数学'));
      assert.ok(report.includes('分数: 45'));
    });

    it('文本报告应包含不可补考原因分类', () => {
      const scanner = new ExamRetakeScanner({ currentDate: '2026-05-18' });
      const results = scanner.scan(samplesDir);
      const report = scanner.generateReport(results);
      
      assert.ok(report.includes('证明已过期'));
      assert.ok(report.includes('已补考'));
      assert.ok(report.includes('科目冲突'));
      assert.ok(report.includes('考试状态非不及格'));
    });

    it('JSON 报告应包含完整结构', () => {
      const scanner = new ExamRetakeScanner({ currentDate: '2026-05-18' });
      const results = scanner.scan(samplesDir);
      const report = scanner.generateJSONReport(results);
      
      assert.ok(report.generatedAt);
      assert.ok(report.summary);
      assert.ok(report.results);
      assert.strictEqual(typeof report.summary.total, 'number');
    });
  });

  describe('异常路径', () => {
    it('扫描不存在的目录应抛出异常', () => {
      const scanner = new ExamRetakeScanner();
      assert.throws(() => {
        scanner.scan('/nonexistent/path');
      }, /目录不存在/);
    });

    it('扫描空目录应返回空结果', () => {
      const emptyDir = path.join(testDir, 'empty');
      if (!fs.existsSync(emptyDir)) {
        fs.mkdirSync(emptyDir);
      }
      
      const scanner = new ExamRetakeScanner();
      const results = scanner.scan(emptyDir);
      
      assert.strictEqual(results.length, 0);
    });

    it('处理无效日期应视为过期', () => {
      const scanner = new ExamRetakeScanner({ currentDate: '2026-05-18' });
      const record = {
        examId: 'EXAM001',
        studentId: 'STU001',
        subject: '高等数学',
        status: 'failed',
        certDate: 'invalid-date',
        retakeCount: 0,
        hasRetaken: false
      };
      const result = scanner.isEligibleForRetake(record, [record]);
      assert.strictEqual(result.eligible, false);
      assert.ok(result.reasons.includes('证明已过期'));
    });
  });

  describe('验收测试', () => {
    it('正常路径 - 扫描样例目录应返回预期结果数量', () => {
      const scanner = new ExamRetakeScanner({ currentDate: '2026-05-18' });
      const results = scanner.scan(samplesDir);
      
      assert.strictEqual(results.length, 8);
      
      const eligible = results.filter(r => r.eligibleForRetake);
      assert.strictEqual(eligible.length, 2);
      
      const studentNames = eligible.map(r => r.studentName);
      assert.ok(studentNames.includes('张三'));
      assert.ok(studentNames.includes('李四'));
    });

    it('输出中应明确标识"考试记录补考资格扫描"相关内容', () => {
      const scanner = new ExamRetakeScanner({ currentDate: '2026-05-18' });
      const results = scanner.scan(samplesDir);
      const report = scanner.generateReport(results);
      
      assert.ok(report.includes('考试记录补考资格扫描报告'));
      assert.ok(report.includes('可恢复补考资格列表'));
      
      const eligible = results.filter(r => r.eligibleForRetake);
      eligible.forEach(r => {
        assert.ok(r.studentId, '每条记录应有学号');
        assert.ok(r.studentName, '每条记录应有姓名');
        assert.ok(r.subject, '每条记录应有科目');
        assert.ok(r.sourceFile, '每条记录应有来源文件');
      });
    });

    it('规则变更后 diff 可见 - 修改有效期应影响结果', () => {
      const scanner1 = new ExamRetakeScanner({ currentDate: '2026-05-18', certExpireDays: 365 });
      const results1 = scanner1.scan(samplesDir);
      const eligible1 = results1.filter(r => r.eligibleForRetake).length;

      const scanner2 = new ExamRetakeScanner({ currentDate: '2026-05-18', certExpireDays: 1000 });
      const results2 = scanner2.scan(samplesDir);
      const eligible2 = results2.filter(r => r.eligibleForRetake).length;

      assert.notStrictEqual(eligible1, eligible2, '修改有效期应改变可补考人数');
    });

    it('排序稳定 - 两次扫描结果顺序一致', () => {
      const scanner = new ExamRetakeScanner({ currentDate: '2026-05-18' });
      const results1 = scanner.scan(samplesDir);
      const results2 = scanner.scan(samplesDir);
      
      const order1 = results1.map(r => `${r.studentId}-${r.subject}-${r.examId}`).join(',');
      const order2 = results2.map(r => `${r.studentId}-${r.subject}-${r.examId}`).join(',');
      
      assert.strictEqual(order1, order2, '两次扫描结果顺序应完全一致');
    });
  });
});

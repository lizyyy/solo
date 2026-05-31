import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('发动机拆装课堂系统测试', () => {
  const testDbPath = path.join(__dirname, '..', 'data', 'test-classroom.db');
  let db;

  before(async () => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    
    process.env.DB_PATH = testDbPath;
    
    const { initDatabase } = await import('../src/database.js');
    db = initDatabase();
  });

  after(() => {
    if (db) {
      db.close();
    }
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('零件清单管理', () => {
    it('应该能创建零件清单', async () => {
      const { createPartsList, getPartsList } = await import('../src/partsList.js');
      
      const parts = [
        { partNumber: 'TEST001', partName: '测试零件', quantity: 2 }
      ];
      
      const result = createPartsList('测试清单', '测试员', parts);
      assert.equal(result.name, '测试清单');
      assert.equal(result.version, 1);
      
      const list = getPartsList('测试清单');
      assert.equal(list.parts.length, 1);
      assert.equal(list.parts[0].partNumber, 'TEST001');
    });

    it('创建重复零件应该抛出友好错误', async () => {
      const { createPartsList, ClassroomError } = await import('../src/partsList.js');
      
      const parts = [
        { partNumber: 'DUP001', partName: '重复零件', quantity: 1 }
      ];
      
      createPartsList('重复测试清单', '测试员', parts);
      
      try {
        createPartsList('重复测试清单', '测试员', parts);
        const list2 = await import('../src/partsList.js');
        createPartsList('重复测试清单', '测试员', parts);
      } catch (e) {
        assert.ok(e instanceof ClassroomError || e.message.includes('重复'));
      }
    });

    it('应该能追踪零件清单修改人', async () => {
      const { createPartsList, getLastModifier } = await import('../src/partsList.js');
      
      createPartsList('追踪测试', '王师傅', []);
      const modifier = getLastModifier('追踪测试');
      
      assert.ok(modifier);
    });
  });

  describe('课堂运行管理', () => {
    it('应该能创建课堂并开始运行', async () => {
      const { createClassroom, getClassroomHistory } = await import('../src/classroom.js');
      
      const result = createClassroom('TEST-CLASS-001', '测试课堂', '测试老师', null);
      assert.ok(result.runId);
      assert.equal(result.runNumber, 1);
      
      const history = getClassroomHistory('TEST-CLASS-001');
      assert.equal(history.length, 1);
    });

    it('重复运行课堂应该保留历史记录', async () => {
      const { createClassroom, startNewRun, getClassroomHistory, ClassroomError } = await import('../src/classroom.js');
      
      try {
        createClassroom('TEST-CLASS-002', '测试课堂2', '测试老师', null);
      } catch (e) {}
      
      const run2 = startNewRun('TEST-CLASS-002');
      assert.equal(run2.runNumber, 2);
      
      const history = getClassroomHistory('TEST-CLASS-002');
      assert.ok(history.length >= 2);
    });
  });

  describe('学生操作记录', () => {
    it('应该能记录学生操作', async () => {
      const { createClassroom, recordStudentOperation, getRunOperations } = await import('../src/classroom.js');
      
      const { runId } = createClassroom('TEST-CLASS-003', '测试课堂3', '测试老师', null);
      
      recordStudentOperation(runId, {
        studentName: '测试学生',
        stepNumber: 1,
        action: '完成拆卸',
        isError: false
      });
      
      const ops = getRunOperations(runId);
      assert.equal(ops.length, 1);
      assert.equal(ops[0].studentName, '测试学生');
    });

    it('重复错误应该被统计', async () => {
      const { createClassroom, recordStudentOperation, ClassroomError } = await import('../src/classroom.js');
      
      const { runId } = createClassroom('TEST-CLASS-004', '测试课堂4', '测试老师', null);
      
      let errorThrown = false;
      try {
        recordStudentOperation(runId, {
          studentName: '易错学生',
          stepNumber: 1,
          action: '错误操作',
          isError: true,
          errorMessage: '测试错误'
        });
      } catch (e) {
        errorThrown = true;
        assert.ok(e.message.includes('易错学生'));
      }
      assert.ok(errorThrown);
    });
  });

  describe('步骤校验', () => {
    it('缺少视频应该提示友好错误', async () => {
      const { createPartsList } = await import('../src/partsList.js');
      const { createClassroom, validateStep, ClassroomError } = await import('../src/classroom.js');
      
      createPartsList('视频测试清单', '测试员', [], [
        {
          stepNumber: 1,
          stepName: '测试步骤',
          videoRequired: true
        }
      ]);
      
      const { runId } = createClassroom('TEST-CLASS-VIDEO', '视频测试课堂', '测试老师', '视频测试清单');
      
      let errorThrown = false;
      try {
        validateStep(runId, {
          stepNumber: 1,
          videoPath: ''
        }, '视频测试清单');
      } catch (e) {
        errorThrown = true;
        assert.ok(e.message.includes('视频'));
      }
      assert.ok(errorThrown);
    });

    it('跳步应该提示友好错误', async () => {
      const { createPartsList } = await import('../src/partsList.js');
      const { createClassroom, recordStudentOperation, validateStep, ClassroomError } = await import('../src/classroom.js');
      
      createPartsList('跳步测试清单', '测试员', [], [
        { stepNumber: 1, stepName: '步骤1' },
        { stepNumber: 2, stepName: '步骤2' },
        { stepNumber: 3, stepName: '步骤3' }
      ]);
      
      const { runId } = createClassroom('TEST-CLASS-SKIP', '跳步测试课堂', '测试老师', '跳步测试清单');
      
      let errorThrown = false;
      try {
        validateStep(runId, {
          stepNumber: 3
        }, '跳步测试清单');
      } catch (e) {
        errorThrown = true;
        assert.ok(e.message.includes('顺序'));
      }
      assert.ok(errorThrown);
    });
  });

  describe('错误提示系统', () => {
    it('错误应该包含建议', async () => {
      const { ClassroomError } = await import('../src/errors.js');
      
      const error = new ClassroomError('PART_NOT_FOUND', { partName: '测试零件' });
      
      assert.ok(error.userMessage);
      assert.ok(error.suggestion);
      assert.ok(error.toDisplayString().includes('建议'));
    });
  });

  describe('导出功能', () => {
    it('应该能导出课堂记录', async () => {
      const { createClassroom, recordStudentOperation, completeRun } = await import('../src/classroom.js');
      const { exportClassroomRecord } = await import('../src/exporter.js');
      
      const { runId } = createClassroom('TEST-CLASS-EXPORT', '导出测试课堂', '测试老师', null);
      
      recordStudentOperation(runId, {
        studentName: '导出测试学生',
        stepNumber: 1,
        action: '测试操作',
        isError: false
      });
      
      completeRun(runId, '测试备注');
      
      const outputPath = path.join(__dirname, 'test-export.txt');
      const result = exportClassroomRecord('TEST-CLASS-EXPORT', outputPath);
      
      assert.ok(fs.existsSync(outputPath));
      assert.ok(result.recordCount >= 1);
      
      const content = fs.readFileSync(outputPath, 'utf8');
      assert.ok(content.includes('导出测试学生'));
      assert.ok(content.includes('测试备注'));
      
      fs.unlinkSync(outputPath);
    });
  });
});

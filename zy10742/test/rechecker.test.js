import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Rechecker } from '../src/rechecker.js';

describe('客服质检导出复议改分核对', () => {
  let rechecker;

  beforeEach(() => {
    rechecker = new Rechecker();
  });

  describe('正常路径测试', () => {
    it('有复议时 - 最终得分等于复议得分，扣分项同步', async () => {
      rechecker.records = [
        {
          质检编号: 'QC-001',
          客服工号: 'CS001',
          原始得分: 85,
          复议得分: 90,
          最终得分: 90,
          复议状态: 'approved',
          复议轮次: 1,
          原始扣分项: ['服务态度', '响应超时'],
          复议扣分项: ['服务态度'],
          最终扣分项: ['服务态度']
        }
      ];

      const results = rechecker.run();

      assert.equal(results.length, 1);
      assert.equal(results[0].通过, true);
      assert.equal(results[0].得分核对, true);
      assert.equal(results[0].扣分项核对, true);
      assert.equal(rechecker.summary.通过率, '100.00%');
    });

    it('无复议时 - 最终得分等于原始得分', async () => {
      rechecker.records = [
        {
          质检编号: 'QC-002',
          客服工号: 'CS002',
          原始得分: 95,
          复议得分: null,
          最终得分: 95,
          复议状态: 'pending',
          复议轮次: 1,
          原始扣分项: [],
          复议扣分项: [],
          最终扣分项: []
        }
      ];

      const results = rechecker.run();

      assert.equal(results[0].通过, true);
      assert.equal(results[0].得分核对, true);
      assert.equal(results[0].扣分项核对, true);
    });

    it('多轮复议 - 原始分正确继承上轮最终分', async () => {
      rechecker.records = [
        {
          质检编号: 'QC-003',
          客服工号: 'CS003',
          原始得分: 70,
          复议得分: 75,
          最终得分: 75,
          复议轮次: 1,
          原始扣分项: ['A', 'B'],
          复议扣分项: ['A'],
          最终扣分项: ['A']
        },
        {
          质检编号: 'QC-003',
          客服工号: 'CS003',
          原始得分: 75,
          复议得分: 82,
          最终得分: 82,
          复议轮次: 2,
          原始扣分项: ['A'],
          复议扣分项: [],
          最终扣分项: []
        }
      ];

      const results = rechecker.run();

      assert.equal(results.length, 2);
      assert.equal(results[0].通过, true);
      assert.equal(results[1].通过, true);
      assert.equal(rechecker.summary.多轮复议记录数, 1);
    });

    it('复议删除多个扣分项 - 最终扣分项同步删除', async () => {
      rechecker.records = [
        {
          质检编号: 'QC-004',
          原始得分: 82,
          复议得分: 90,
          最终得分: 90,
          复议轮次: 1,
          原始扣分项: ['话术不规范', '流程违规', '服务态度'],
          复议扣分项: ['服务态度'],
          最终扣分项: ['服务态度']
        }
      ];

      const results = rechecker.run();

      assert.equal(results[0].通过, true);
      assert.equal(results[0].扣分项核对, true);
    });
  });

  describe('异常路径测试', () => {
    it('得分不一致 - 复议后最终得分未更新', async () => {
      rechecker.records = [
        {
          质检编号: 'QC-005',
          原始得分: 80,
          复议得分: 88,
          最终得分: 80,
          复议轮次: 1,
          原始扣分项: ['A'],
          复议扣分项: ['A'],
          最终扣分项: ['A']
        }
      ];

      const results = rechecker.run();

      assert.equal(results[0].通过, false);
      assert.equal(results[0].得分核对, false);
      assert.equal(results[0].得分问题.length, 1);
      assert.match(results[0].得分问题[0], /复议后最终得分与复议得分不一致/);
    });

    it('得分不一致 - 无复议时最终得分不等于原始分', async () => {
      rechecker.records = [
        {
          质检编号: 'QC-006',
          原始得分: 75,
          复议得分: null,
          最终得分: 80,
          复议轮次: 1,
          原始扣分项: [],
          复议扣分项: [],
          最终扣分项: []
        }
      ];

      const results = rechecker.run();

      assert.equal(results[0].通过, false);
      assert.equal(results[0].得分核对, false);
      assert.match(results[0].得分问题[0], /无复议时最终得分与原始得分不一致/);
    });

    it('扣分项不同步 - 复议删除的扣分项未同步删除', async () => {
      rechecker.records = [
        {
          质检编号: 'QC-007',
          原始得分: 80,
          复议得分: 88,
          最终得分: 88,
          复议轮次: 1,
          原始扣分项: ['话术不规范', '信息错误'],
          复议扣分项: ['话术不规范'],
          最终扣分项: ['话术不规范', '信息错误']
        }
      ];

      const results = rechecker.run();

      assert.equal(results[0].通过, false);
      assert.equal(results[0].扣分项核对, false);
      assert.equal(results[0].扣分项问题.length, 1);
      assert.match(results[0].扣分项问题[0], /复议删除扣分项.*未同步到最终扣分项/);
    });

    it('扣分项不同步 - 最终扣分项有无来源的项', async () => {
      rechecker.records = [
        {
          质检编号: 'QC-008',
          原始得分: 75,
          复议得分: null,
          最终得分: 75,
          复议轮次: 1,
          原始扣分项: ['服务态度'],
          复议扣分项: [],
          最终扣分项: ['服务态度', '流程违规']
        }
      ];

      const results = rechecker.run();

      assert.equal(results[0].通过, false);
      assert.equal(results[0].扣分项核对, false);
      assert.equal(results[0].扣分项问题.length, 2);
      assert.match(results[0].扣分项问题[0], /复议删除扣分项.*未同步到最终扣分项/);
      assert.match(results[0].扣分项问题[1], /最终扣分项.*无来源/);
    });

    it('轮次继承错误 - 第2轮原始分未继承第1轮最终分', async () => {
      rechecker.records = [
        {
          质检编号: 'QC-009',
          原始得分: 70,
          复议得分: 78,
          最终得分: 78,
          复议轮次: 1,
          原始扣分项: ['A', 'B'],
          复议扣分项: ['B'],
          最终扣分项: ['B']
        },
        {
          质检编号: 'QC-009',
          原始得分: 70,
          复议得分: 85,
          最终得分: 85,
          复议轮次: 2,
          原始扣分项: ['B'],
          复议扣分项: [],
          最终扣分项: []
        }
      ];

      const results = rechecker.run();

      assert.equal(results[1].通过, false);
      assert.ok(results[1].轮次继承问题);
      assert.equal(results[1].轮次继承问题.length, 1);
      assert.match(results[1].轮次继承问题[0], /第2轮复议原始得分未继承上轮最终得分/);
    });

    it('同时存在得分问题和扣分项问题', async () => {
      rechecker.records = [
        {
          质检编号: 'QC-010',
          原始得分: 80,
          复议得分: 88,
          最终得分: 80,
          复议轮次: 1,
          原始扣分项: ['A', 'B'],
          复议扣分项: ['A'],
          最终扣分项: ['A', 'B']
        }
      ];

      const results = rechecker.run();

      assert.equal(results[0].通过, false);
      assert.equal(results[0].得分核对, false);
      assert.equal(results[0].扣分项核对, false);
      assert.equal(results[0].得分问题.length, 1);
      assert.equal(results[0].扣分项问题.length, 1);
    });
  });

  describe('汇总统计测试', () => {
    it('正确统计通过和未通过数量', async () => {
      rechecker.records = [
        {
          质检编号: 'QC-011',
          原始得分: 85,
          复议得分: 90,
          最终得分: 90,
          复议轮次: 1,
          原始扣分项: ['A'],
          复议扣分项: ['A'],
          最终扣分项: ['A']
        },
        {
          质检编号: 'QC-012',
          原始得分: 80,
          复议得分: 88,
          最终得分: 80,
          复议轮次: 1,
          原始扣分项: ['A'],
          复议扣分项: ['A'],
          最终扣分项: ['A']
        }
      ];

      rechecker.run();

      assert.equal(rechecker.summary.总记录数, 2);
      assert.equal(rechecker.summary.通过数, 1);
      assert.equal(rechecker.summary.未通过数, 1);
      assert.equal(rechecker.summary.通过率, '50.00%');
    });

    it('正确统计问题类型数量', async () => {
      rechecker.records = [
        {
          质检编号: 'QC-013',
          原始得分: 80,
          复议得分: 88,
          最终得分: 80,
          复议轮次: 1,
          原始扣分项: ['A', 'B'],
          复议扣分项: ['A'],
          最终扣分项: ['A', 'B']
        }
      ];

      rechecker.run();

      assert.equal(rechecker.summary.问题统计.得分不一致问题, 1);
      assert.equal(rechecker.summary.问题统计.扣分项同步问题, 1);
    });

    it('未通过编号列表正确', async () => {
      rechecker.records = [
        {
          质检编号: 'QC-014',
          原始得分: 85,
          复议得分: 90,
          最终得分: 90,
          复议轮次: 1,
          原始扣分项: ['A'],
          复议扣分项: ['A'],
          最终扣分项: ['A']
        },
        {
          质检编号: 'QC-015',
          原始得分: 80,
          复议得分: 88,
          最终得分: 80,
          复议轮次: 1,
          原始扣分项: ['A'],
          复议扣分项: ['A'],
          最终扣分项: ['A']
        }
      ];

      rechecker.run();

      assert.deepEqual(rechecker.summary.未通过编号列表, ['QC-015']);
    });
  });

  describe('Diffable 结果测试', () => {
    it('生成可用于diff对比的结果', async () => {
      rechecker.records = [
        {
          质检编号: 'QC-016',
          客服工号: 'CS001',
          原始得分: 85,
          复议得分: 90,
          最终得分: 90,
          复议状态: 'approved',
          复议轮次: 1,
          原始扣分项: ['A'],
          复议扣分项: ['A'],
          最终扣分项: ['A']
        }
      ];

      rechecker.run();
      const diffable = rechecker.getDiffableResults();

      assert.equal(diffable.length, 1);
      assert.equal(diffable[0].质检编号, 'QC-016');
      assert.equal(diffable[0].客服工号, 'CS001');
      assert.equal(diffable[0].复议轮次, 1);
      assert.equal(diffable[0].复议状态, 'approved');
      assert.equal(diffable[0].通过, true);
      assert.equal(diffable[0].得分核对, true);
      assert.equal(diffable[0].扣分项核对, true);
      assert.equal(diffable[0].问题数, 0);
    });
  });
});

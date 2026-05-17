import { db } from '../store/database';
import { articleService } from '../services/articleService';
import { rollbackService } from '../services/rollbackService';
import { initSampleData } from '../data/sampleData';
import { ArticleStatus, RollbackStatus } from '../types';

describe('知识库服务文章发布回滚 - 验收测试', () => {
  beforeAll(() => {
    initSampleData();
  });

  describe('1. 完整流转测试', () => {
    test('创建文章 -> 更新文章 -> 发布文章 -> 回滚文章', () => {
      const article = articleService.createArticle(
        '验收测试文档',
        '初始内容',
        '测试文档',
        '测试用户'
      );
      expect(article.status).toBe(ArticleStatus.DRAFT);
      expect(article.currentVersion).toBe(1);

      const updated = articleService.updateArticle(
        article.id,
        '验收测试文档',
        '更新后的内容',
        '测试用户'
      );
      expect(updated?.currentVersion).toBe(2);

      const published = articleService.publishArticle(article.id, '测试用户');
      expect(published?.status).toBe(ArticleStatus.PUBLISHED);

      const rollbackResult = articleService.requestRollback(
        article.id,
        1,
        '测试用户',
        '验收测试回滚'
      );
      expect(rollbackResult.success).toBe(true);
      expect(rollbackResult.data?.status).toBe(RollbackStatus.SUCCESS);

      const rolledBackArticle = articleService.getArticle(article.id);
      expect(rolledBackArticle?.status).toBe(ArticleStatus.RESTORED);
      expect(rolledBackArticle?.currentVersion).toBe(3);
    });
  });

  describe('2. 回滚记录列表查询', () => {
    test('查询所有回滚记录', () => {
      const result = rollbackService.getRollbackRecords({}, { page: 1, pageSize: 10 });
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);
    });

    test('按状态筛选 - 冲突记录', () => {
      const result = rollbackService.getRollbackRecords(
        { status: RollbackStatus.CONFLICT },
        { page: 1, pageSize: 10 }
      );
      result.data.forEach(record => {
        expect(record.status).toBe(RollbackStatus.CONFLICT);
      });
    });

    test('按状态筛选 - 驳回记录', () => {
      const result = rollbackService.getRollbackRecords(
        { status: RollbackStatus.REJECTED },
        { page: 1, pageSize: 10 }
      );
      result.data.forEach(record => {
        expect(record.status).toBe(RollbackStatus.REJECTED);
        expect(record.rejectReason).toBeDefined();
      });
    });

    test('按业务对象筛选', () => {
      const result = rollbackService.getRollbackRecords(
        { businessObject: '技术文档' },
        { page: 1, pageSize: 10 }
      );
      result.data.forEach(record => {
        expect(record.businessObject).toBe('技术文档');
      });
    });

    test('按申请人筛选', () => {
      const result = rollbackService.getRollbackRecords(
        { requestedBy: '李四' },
        { page: 1, pageSize: 10 }
      );
      result.data.forEach(record => {
        expect(record.requestedBy).toBe('李四');
      });
    });

    test('分页查询', () => {
      const result1 = rollbackService.getRollbackRecords({}, { page: 1, pageSize: 2 });
      const result2 = rollbackService.getRollbackRecords({}, { page: 2, pageSize: 2 });
      
      expect(result1.page).toBe(1);
      expect(result2.page).toBe(2);
      expect(result1.pageSize).toBe(2);
    });
  });

  describe('3. 回滚记录详情', () => {
    test('查询单条回滚记录详情', () => {
      const listResult = rollbackService.getRollbackRecords({}, { page: 1, pageSize: 1 });
      const recordId = listResult.data[0].id;

      const record = rollbackService.getRollbackRecord(recordId);
      expect(record).toBeDefined();
      expect(record?.id).toBe(recordId);
      expect(record?.articleId).toBeDefined();
      expect(record?.articleTitle).toBeDefined();
      expect(record?.fromVersion).toBeDefined();
      expect(record?.toVersion).toBeDefined();
      expect(record?.requestedBy).toBeDefined();
      expect(record?.requestedAt).toBeDefined();
      expect(record?.reason).toBeDefined();
      expect(record?.status).toBeDefined();
      expect(record?.businessObject).toBeDefined();
    });

    test('冲突记录包含冲突详情', () => {
      const result = rollbackService.getRollbackRecords(
        { status: RollbackStatus.CONFLICT },
        { page: 1, pageSize: 1 }
      );
      const record = result.data[0];
      expect(record.conflictDetails).toBeDefined();
      expect(record.conflictDetails?.length).toBeGreaterThan(0);
    });

    test('驳回记录包含驳回原因', () => {
      const result = rollbackService.getRollbackRecords(
        { status: RollbackStatus.REJECTED },
        { page: 1, pageSize: 1 }
      );
      const record = result.data[0];
      expect(record.rejectReason).toBeDefined();
      expect(record.rejectReason?.length).toBeGreaterThan(0);
    });
  });

  describe('4. 文章回滚历史', () => {
    test('查询文章的回滚历史记录', () => {
      const articles = db.getAllArticles();
      const article = articles.find(a => a.title === '产品使用手册');
      expect(article).toBeDefined();

      const history = rollbackService.getRollbackHistory(article!.id);
      expect(history.length).toBeGreaterThan(0);
      
      history.forEach(record => {
        expect(record.articleId).toBe(article!.id);
      });
    });
  });

  describe('5. 导入坏行记录', () => {
    test('导入坏行记录存在且状态正确', () => {
      const result = rollbackService.getRollbackRecords(
        { businessObject: '数据导入' },
        { page: 1, pageSize: 10 }
      );
      const badRecord = result.data.find(r => r.articleTitle === '导入坏行测试记录');
      
      expect(badRecord).toBeDefined();
      expect(badRecord?.status).toBe(RollbackStatus.FAILED);
      expect(badRecord?.conflictDetails).toContain('CSV导入');
      expect(badRecord?.requestedBy).toBe('系统');
    });
  });

  describe('6. CSV导出功能', () => {
    test('导出所有记录为CSV格式', async () => {
      const csv = await rollbackService.exportToCSV({});
      expect(csv).toContain('记录ID');
      expect(csv).toContain('文章标题');
      expect(csv).toContain('状态');
      expect(csv).toContain('回滚原因');
    });

    test('按筛选条件导出CSV', async () => {
      const csv = await rollbackService.exportToCSV({ status: RollbackStatus.CONFLICT });
      expect(csv).toContain('conflict');
    });
  });

  describe('7. 边界条件验证', () => {
    test('回滚非已发布文章应该失败', () => {
      const article = articleService.createArticle(
        '边界测试文档',
        '草稿内容',
        '测试',
        '测试用户'
      );
      
      const result = articleService.requestRollback(
        article.id,
        1,
        '测试用户',
        '测试回滚草稿'
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('只有已发布的文章才能回滚');
    });

    test('回滚到不存在的版本应该失败', () => {
      const article = articleService.createArticle(
        '版本测试文档',
        '内容',
        '测试',
        '测试用户'
      );
      articleService.publishArticle(article.id, '测试用户');

      const result = articleService.requestRollback(
        article.id,
        999,
        '测试用户',
        '测试不存在版本'
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('目标版本不存在');
    });

    test('回滚到当前或更高版本应该失败', () => {
      const article = articleService.createArticle(
        '回滚方向测试',
        '内容',
        '测试',
        '测试用户'
      );
      articleService.publishArticle(article.id, '测试用户');

      const result = articleService.requestRollback(
        article.id,
        1,
        '测试用户',
        '测试回滚方向'
      );
      
      expect(result.success).toBe(false);
    });
  });

  describe('8. 数据一致性验证', () => {
    test('列表、详情、历史记录数据互相对齐', () => {
      const listResult = rollbackService.getRollbackRecords({}, { page: 1, pageSize: 1 });
      const recordFromList = listResult.data[0];

      const recordFromDetail = rollbackService.getRollbackRecord(recordFromList.id);
      expect(recordFromDetail?.id).toBe(recordFromList.id);
      expect(recordFromDetail?.articleId).toBe(recordFromList.articleId);
      expect(recordFromDetail?.status).toBe(recordFromList.status);

      const history = rollbackService.getRollbackHistory(recordFromList.articleId);
      const recordFromHistory = history.find(r => r.id === recordFromList.id);
      expect(recordFromHistory).toBeDefined();
      expect(recordFromHistory?.id).toBe(recordFromList.id);
    });

    test('回滚后版本号递增，不覆盖原记录', () => {
      const article = articleService.createArticle(
        '版本一致性测试',
        '初始内容V1',
        '测试',
        '测试用户'
      );
      articleService.updateArticle(article.id, '版本一致性测试', '内容V2', '测试用户');
      articleService.publishArticle(article.id, '测试用户');

      const versionBeforeRollback = articleService.getArticle(article.id)?.currentVersion;
      
      const result = articleService.requestRollback(article.id, 1, '测试用户', '测试版本递增');
      
      const versionAfterRollback = articleService.getArticle(article.id)?.currentVersion;
      expect(versionAfterRollback).toBe((versionBeforeRollback || 0) + 1);

      const versions = articleService.getArticleVersions(article.id);
      expect(versions.length).toBeGreaterThanOrEqual(3);
    });
  });
});

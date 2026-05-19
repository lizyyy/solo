import { BookDatabase } from './database';
import { BookService } from './bookService';
import { Role, ProcessingStatus, BookCondition, GradeLevel } from './types';
import * as fs from 'fs';
import * as path from 'path';

const TEST_DB_PATH = path.join(__dirname, '..', 'test-db.sqlite');

describe('BookService', () => {
  let db: BookDatabase;
  let service: BookService;

  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    db = new BookDatabase(TEST_DB_PATH);
    service = new BookService(db);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('ISBN校验', () => {
    it('应该接受有效的13位ISBN', async () => {
      const result = await service.importBooks(
        [{
          isbn: '978-7-107-18604-1',
          title: '测试书籍',
          condition: '全新',
          gradeLevel: '一年级',
        }],
        '测试用户',
        Role.VOLUNTEER
      );
      expect(result.batch.acceptedCount).toBe(1);
    });

    it('应该接受缺少ISBN的书籍并记录原因', async () => {
      const result = await service.importBooks(
        [{
          title: '测试书籍',
          condition: '全新',
          gradeLevel: '一年级',
        }],
        '测试用户',
        Role.VOLUNTEER
      );
      expect(result.batch.acceptedCount).toBe(1);
      expect(result.results[0].reason).toContain('缺少ISBN');
    });

    it('应该拒绝无效的ISBN格式', async () => {
      const result = await service.importBooks(
        [{
          isbn: '12345',
          title: '测试书籍',
          condition: '全新',
          gradeLevel: '一年级',
        }],
        '测试用户',
        Role.VOLUNTEER
      );
      expect(result.batch.rejectedCount).toBe(1);
      expect(result.results[0].reason).toContain('ISBN格式无效');
    });
  });

  describe('品相校验', () => {
    it('应该识别"全新"品相', async () => {
      const result = await service.importBooks(
        [{
          title: '测试书籍',
          condition: '全新',
          gradeLevel: '一年级',
        }],
        '测试用户',
        Role.VOLUNTEER
      );
      expect(result.batch.acceptedCount).toBe(1);
    });

    it('应该识别"9成新"品相等简写', async () => {
      const result = await service.importBooks(
        [{
          title: '测试书籍',
          condition: '9成新',
          gradeLevel: '一年级',
        }],
        '测试用户',
        Role.VOLUNTEER
      );
      expect(result.batch.acceptedCount).toBe(1);
    });

    it('应该拒绝缺少品相的书籍', async () => {
      const result = await service.importBooks(
        [{
          title: '测试书籍',
          gradeLevel: '一年级',
        }] as any,
        '测试用户',
        Role.VOLUNTEER
      );
      expect(result.batch.rejectedCount).toBe(1);
      expect(result.results[0].reason).toContain('缺少品相信息');
    });

    it('应该拒绝无法识别的品相', async () => {
      const result = await service.importBooks(
        [{
          title: '测试书籍',
          condition: '未知品相',
          gradeLevel: '一年级',
        }],
        '测试用户',
        Role.VOLUNTEER
      );
      expect(result.batch.rejectedCount).toBe(1);
      expect(result.results[0].reason).toContain('无法识别的品相');
    });
  });

  describe('年级识别', () => {
    it('应该识别"一年级"', async () => {
      const result = await service.importBooks(
        [{
          title: '测试书籍',
          condition: '全新',
          gradeLevel: '一年级',
        }],
        '测试用户',
        Role.VOLUNTEER
      );
      expect(result.batch.acceptedCount).toBe(1);
    });

    it('应该识别"初一"为七年级', async () => {
      const result = await service.importBooks(
        [{
          title: '测试书籍',
          condition: '全新',
          gradeLevel: '初一',
        }],
        '测试用户',
        Role.VOLUNTEER
      );
      expect(result.batch.acceptedCount).toBe(1);
    });

    it('应该接受缺少年级的书籍并设为未分级', async () => {
      const result = await service.importBooks(
        [{
          title: '测试书籍',
          condition: '全新',
        }],
        '测试用户',
        Role.VOLUNTEER
      );
      expect(result.batch.acceptedCount).toBe(1);
    });
  });

  describe('去重功能', () => {
    it('应该检测到重复的书籍(同ISBN+同标题+同品相)', async () => {
      const result = await service.importBooks(
        [
          {
            isbn: '978-7-107-18604-1',
            title: '测试书籍',
            condition: '全新',
            gradeLevel: '一年级',
          },
          {
            isbn: '978-7-107-18604-1',
            title: '测试书籍',
            condition: '全新',
            gradeLevel: '一年级',
          },
        ],
        '测试用户',
        Role.VOLUNTEER
      );
      expect(result.batch.acceptedCount).toBe(1);
      expect(result.batch.duplicateCount).toBe(1);
    });

    it('同一ISBN不同品相应该不视为重复', async () => {
      const result = await service.importBooks(
        [
          {
            isbn: '978-7-107-18604-1',
            title: '测试书籍',
            condition: '全新',
            gradeLevel: '一年级',
          },
          {
            isbn: '978-7-107-18604-1',
            title: '测试书籍',
            condition: '九成新',
            gradeLevel: '一年级',
          },
        ],
        '测试用户',
        Role.VOLUNTEER
      );
      expect(result.batch.acceptedCount).toBe(2);
      expect(result.batch.duplicateCount).toBe(0);
    });

    it('无ISBN的书籍按标题+品相去重', async () => {
      const result = await service.importBooks(
        [
          {
            title: '格林童话',
            condition: '八成新',
            gradeLevel: '三年级',
          },
          {
            title: '格林童话',
            condition: '八成新',
            gradeLevel: '三年级',
          },
        ],
        '测试用户',
        Role.VOLUNTEER
      );
      expect(result.batch.acceptedCount).toBe(1);
      expect(result.batch.duplicateCount).toBe(1);
    });
  });

  describe('审计字段', () => {
    it('应该正确记录操作人和角色', async () => {
      const result = await service.importBooks(
        [{
          title: '测试书籍',
          condition: '全新',
          gradeLevel: '一年级',
        }],
        '张志愿者',
        Role.ADMIN
      );
      expect(result.batch.operator).toBe('张志愿者');
      expect(result.batch.operatorRole).toBe(Role.ADMIN);
      expect(result.results[0].audit.operator).toBe('张志愿者');
      expect(result.results[0].audit.operatorRole).toBe(Role.ADMIN);
    });

    it('应该记录操作时间', async () => {
      const result = await service.importBooks(
        [{
          title: '测试书籍',
          condition: '全新',
          gradeLevel: '一年级',
        }],
        '测试用户',
        Role.VOLUNTEER
      );
      expect(result.batch.importedAt).toBeInstanceOf(Date);
      expect(result.results[0].processedAt).toBeInstanceOf(Date);
    });
  });

  describe('批量导入统计', () => {
    it('应该正确统计通过、拒绝、重复的数量', async () => {
      const result = await service.importBooks(
        [
          {
            isbn: '978-7-107-18604-1',
            title: '书籍1',
            condition: '全新',
            gradeLevel: '一年级',
          },
          {
            isbn: '978-7-107-18604-1',
            title: '书籍1',
            condition: '全新',
            gradeLevel: '一年级',
          },
          {
            title: '书籍2',
            condition: '无效品相',
            gradeLevel: '二年级',
          },
        ],
        '测试用户',
        Role.VOLUNTEER
      );
      expect(result.batch.totalCount).toBe(3);
      expect(result.batch.acceptedCount).toBe(1);
      expect(result.batch.duplicateCount).toBe(1);
      expect(result.batch.rejectedCount).toBe(1);
    });
  });

  describe('历史查询', () => {
    it('应该能查询所有历史记录', async () => {
      await service.importBooks(
        [{ title: '书籍1', condition: '全新', gradeLevel: '一年级' }],
        '用户A',
        Role.VOLUNTEER
      );
      await service.importBooks(
        [{ title: '书籍2', condition: '九成新', gradeLevel: '二年级' }],
        '用户B',
        Role.VOLUNTEER
      );

      const history = await service.getHistory({});
      expect(history.total).toBe(2);
      expect(history.records.length).toBe(2);
    });

    it('应该能按操作人筛选历史记录', async () => {
      await service.importBooks(
        [{ title: '书籍1', condition: '全新', gradeLevel: '一年级' }],
        '张三',
        Role.VOLUNTEER
      );
      await service.importBooks(
        [{ title: '书籍2', condition: '九成新', gradeLevel: '二年级' }],
        '李四',
        Role.VOLUNTEER
      );

      const history = await service.getHistory({ operator: '张三' });
      expect(history.total).toBe(1);
      expect(history.records[0].title).toBe('书籍1');
    });
  });

  describe('上架单生成', () => {
    it('应该能为批次生成上架单', async () => {
      const importResult = await service.importBooks(
        [
          { title: '书籍A', condition: '全新', gradeLevel: '一年级' },
          { title: '书籍B', condition: '九成新', gradeLevel: '二年级' },
        ],
        '测试用户',
        Role.VOLUNTEER
      );

      const shelfList = await service.generateShelfList(
        importResult.batch.id,
        '测试用户',
        Role.VOLUNTEER
      );

      expect(shelfList.totalCount).toBe(2);
      expect(shelfList.items.length).toBe(2);
      expect(shelfList.items[0].shelfNumber).toBeDefined();
    });

    it('应该按年级排序上架单', async () => {
      const importResult = await service.importBooks(
        [
          { title: '高年级书', condition: '全新', gradeLevel: '高三' },
          { title: '低年级书', condition: '全新', gradeLevel: '一年级' },
        ],
        '测试用户',
        Role.VOLUNTEER
      );

      const shelfList = await service.generateShelfList(
        importResult.batch.id,
        '测试用户',
        Role.VOLUNTEER
      );

      expect(shelfList.items[0].title).toBe('低年级书');
      expect(shelfList.items[1].title).toBe('高年级书');
    });
  });
});

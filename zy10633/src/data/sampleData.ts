import { articleService } from '../services/articleService';
import { rollbackService } from '../services/rollbackService';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../store/database';
import { ArticleStatus, RollbackStatus } from '../types';

export function initSampleData() {
  console.log('初始化样例数据...');

  const article1Id = uuidv4();
  const now = new Date();

  db.createArticle({
    id: article1Id,
    title: '产品使用手册',
    content: '这是产品使用手册的完整内容，包含所有功能说明。',
    status: ArticleStatus.RESTORED,
    businessObject: '产品文档',
    currentVersion: 4,
    createdBy: '张三',
    createdAt: new Date(now.getTime() - 86400000 * 5),
    updatedAt: new Date(now.getTime() - 86400000)
  });

  for (let i = 1; i <= 4; i++) {
    db.createVersion({
      id: uuidv4(),
      articleId: article1Id,
      version: i,
      title: i === 1 ? '产品使用手册（初稿）' : i === 2 ? '产品使用手册（修订）' : '产品使用手册',
      content: `版本${i}内容`,
      createdBy: '张三',
      createdAt: new Date(now.getTime() - 86400000 * (6 - i)),
      isPublished: i >= 3,
      publishedAt: i >= 3 ? new Date(now.getTime() - 86400000 * (5 - i)) : undefined
    });
  }

  rollbackService.createCompletedRecord(
    article1Id,
    '产品使用手册',
    3,
    1,
    '张三',
    '内容错误需要回滚',
    '产品文档',
    '管理员'
  );

  const article2Id = uuidv4();
  db.createArticle({
    id: article2Id,
    title: 'API接口文档',
    content: '这是API接口文档内容',
    status: ArticleStatus.PUBLISHED,
    businessObject: '技术文档',
    currentVersion: 2,
    createdBy: '李四',
    createdAt: new Date(now.getTime() - 86400000 * 3),
    updatedAt: new Date(now.getTime() - 86400000 * 2)
  });

  for (let i = 1; i <= 2; i++) {
    db.createVersion({
      id: uuidv4(),
      articleId: article2Id,
      version: i,
      title: 'API接口文档',
      content: `API文档版本${i}`,
      createdBy: '李四',
      createdAt: new Date(now.getTime() - 86400000 * (4 - i)),
      isPublished: true,
      publishedAt: new Date(now.getTime() - 86400000 * (3 - i))
    });
  }

  rollbackService.createConflictRecord(
    article2Id,
    'API接口文档',
    2,
    1,
    '李四',
    '需要回退到上一版本',
    '技术文档',
    '检测到数据冲突：当前版本已有新的发布记录，无法回滚'
  );

  const article3Id = uuidv4();
  db.createArticle({
    id: article3Id,
    title: '用户指南',
    content: '用户指南内容',
    status: ArticleStatus.PUBLISHED,
    businessObject: '用户文档',
    currentVersion: 2,
    createdBy: '王五',
    createdAt: new Date(now.getTime() - 86400000 * 4),
    updatedAt: new Date(now.getTime() - 86400000 * 2)
  });

  for (let i = 1; i <= 2; i++) {
    db.createVersion({
      id: uuidv4(),
      articleId: article3Id,
      version: i,
      title: '用户指南',
      content: `用户指南版本${i}`,
      createdBy: '王五',
      createdAt: new Date(now.getTime() - 86400000 * (5 - i)),
      isPublished: true,
      publishedAt: new Date(now.getTime() - 86400000 * (4 - i))
    });
  }

  rollbackService.createRejectedRecord(
    article3Id,
    '用户指南',
    2,
    1,
    '王五',
    '发现错误需要回滚',
    '用户文档',
    '回滚申请被驳回：经审核该错误不影响使用，建议发布新版本修正'
  );

  const article4Id = uuidv4();
  db.createArticle({
    id: article4Id,
    title: '导入坏行测试记录',
    content: '这条记录用于测试数据导入异常情况',
    status: ArticleStatus.PUBLISHED,
    businessObject: '数据导入',
    currentVersion: 1,
    createdBy: '系统',
    createdAt: new Date(now.getTime() - 86400000 * 2),
    updatedAt: new Date(now.getTime() - 86400000)
  });

  db.createVersion({
    id: uuidv4(),
    articleId: article4Id,
    version: 1,
    title: '导入坏行测试记录',
    content: '这条记录用于测试数据导入异常情况',
    createdBy: '系统',
    createdAt: new Date(now.getTime() - 86400000 * 2),
    isPublished: true,
    publishedAt: new Date(now.getTime() - 86400000 * 2)
  });

  db.createRollbackRecord({
    id: uuidv4(),
    articleId: article4Id,
    articleTitle: '导入坏行测试记录',
    fromVersion: 1,
    toVersion: 0,
    requestedBy: '系统',
    requestedAt: new Date(now.getTime() - 86400000),
    reason: '数据导入坏行自动记录',
    status: RollbackStatus.FAILED,
    businessObject: '数据导入',
    conflictDetails: 'CSV导入第23行：字段格式错误，日期格式不合法',
    executedAt: new Date(now.getTime() - 86400000),
    executedBy: '系统'
  });

  console.log('样例数据初始化完成！');
  console.log(`  - 文章1: 产品使用手册 (完整流转记录)`);
  console.log(`  - 文章2: API接口文档 (冲突记录)`);
  console.log(`  - 文章3: 用户指南 (驳回记录)`);
  console.log(`  - 文章4: 导入坏行测试记录`);
}

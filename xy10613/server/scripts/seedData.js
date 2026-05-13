const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/database.db');
const db = new sqlite3.Database(dbPath);

const authors = ['张三', '李四', '王五', '赵六', '钱七'];
const reviewers = ['产品经理A', '技术专家B', '内容运营C'];
const categories = ['技术文档', '产品说明', '用户指南', 'FAQ', '最佳实践'];
const statuses = ['draft', 'reviewing', 'approved', 'published', 'archived'];

const articleTitles = [
  '如何快速上手新系统',
  'API接口调用规范',
  '用户权限配置指南',
  '数据备份与恢复',
  '常见问题解答',
  '系统性能优化技巧',
  '新版本功能介绍',
  '安全配置最佳实践',
  '移动端适配方案',
  '第三方集成指南'
];

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString();
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

db.serialize(() => {
  const stmt = db.prepare(`INSERT INTO articles (title, content, category, status, author, current_version, published_at, search_index_status, read_feedback_score, read_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  
  for (let i = 0; i < 20; i++) {
    const title = articleTitles[i % articleTitles.length] + (i >= articleTitles.length ? ` (${Math.floor(i/articleTitles.length)+1})` : '');
    const content = `这是【${title}】的详细内容。本文档将指导您完成相关操作。\n\n## 第一部分\n详细说明第一步操作...\n\n## 第二部分\n详细说明第二步操作...\n\n## 注意事项\n请务必按照文档步骤执行。`;
    const status = randomItem(statuses);
    const publishedAt = status === 'published' ? randomDate(new Date('2024-01-01'), new Date()) : null;
    const feedbackScore = Math.random() * 2 + 3;
    const readCount = Math.floor(Math.random() * 500);
    
    stmt.run(
      title,
      content,
      randomItem(categories),
      status,
      randomItem(authors),
      Math.floor(Math.random() * 5) + 1,
      publishedAt,
      Math.random() > 0.2 ? 'success' : 'failed',
      feedbackScore.toFixed(1),
      readCount
    );
  }
  stmt.finalize();

  const versionStmt = db.prepare(`INSERT INTO article_versions (article_id, version_number, title, content, author, change_log) VALUES (?, ?, ?, ?, ?, ?)`);
  
  for (let articleId = 1; articleId <= 20; articleId++) {
    const versionCount = Math.floor(Math.random() * 4) + 1;
    for (let v = 1; v <= versionCount; v++) {
      versionStmt.run(
        articleId,
        v,
        articleTitles[(articleId - 1) % articleTitles.length] + (v > 1 ? ` - 第${v}版` : ''),
        `版本${v}的内容...`,
        randomItem(authors),
        v === 1 ? '初始版本创建' : `版本${v}更新：修正了部分内容`
      );
    }
  }
  versionStmt.finalize();

  const reviewStmt = db.prepare(`INSERT INTO reviews (article_id, version_id, reviewer, comment, status) VALUES (?, ?, ?, ?, ?)`);
  
  for (let i = 0; i < 30; i++) {
    const articleId = Math.floor(Math.random() * 20) + 1;
    reviewStmt.run(
      articleId,
      Math.floor(Math.random() * 3) + 1,
      randomItem(reviewers),
      `评审意见${i + 1}：建议${i % 3 === 0 ? '补充示例' : i % 3 === 1 ? '优化结构' : '修正错别字'}`,
      randomItem(['pending', 'approved', 'rejected'])
    );
  }
  reviewStmt.finalize();

  const publishStmt = db.prepare(`INSERT INTO publish_records (article_id, version_id, publish_type, operator, before_value, after_value, status, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  
  for (let i = 0; i < 25; i++) {
    const articleId = Math.floor(Math.random() * 20) + 1;
    const isSuccess = Math.random() > 0.15;
    publishStmt.run(
      articleId,
      Math.floor(Math.random() * 3) + 1,
      randomItem(['first_publish', 'update', 'rollback']),
      randomItem(reviewers),
      JSON.stringify({ status: 'draft', version: Math.floor(Math.random() * 3) + 1 }),
      JSON.stringify({ status: 'published', version: Math.floor(Math.random() * 3) + 2 }),
      isSuccess ? 'success' : 'failed',
      isSuccess ? null : '搜索索引同步超时，请检查网络连接'
    );
  }
  publishStmt.finalize();

  const rollbackStmt = db.prepare(`INSERT INTO rollback_records (article_id, from_version_id, to_version_id, operator, reason) VALUES (?, ?, ?, ?, ?)`);
  
  for (let i = 0; i < 8; i++) {
    rollbackStmt.run(
      Math.floor(Math.random() * 20) + 1,
      Math.floor(Math.random() * 2) + 2,
      1,
      randomItem(reviewers),
      '线上发现内容有误，回滚到上一个稳定版本'
    );
  }
  rollbackStmt.finalize();

  const feedbackStmt = db.prepare(`INSERT INTO read_feedbacks (article_id, reader, score, comment) VALUES (?, ?, ?, ?)`);
  
  for (let i = 0; i < 50; i++) {
    feedbackStmt.run(
      Math.floor(Math.random() * 20) + 1,
      `读者${i + 1}`,
      Math.floor(Math.random() * 3) + 3,
      i % 4 === 0 ? '很有帮助！' : i % 4 === 1 ? '内容清晰易懂' : i % 4 === 2 ? '希望能有更多示例' : null
    );
  }
  feedbackStmt.finalize();

  const adjustStmt = db.prepare(`INSERT INTO manual_adjustments (article_id, operator, adjust_type, field_name, before_value, after_value, reason) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  
  for (let i = 0; i < 10; i++) {
    const articleId = Math.floor(Math.random() * 20) + 1;
    adjustStmt.run(
      articleId,
      randomItem(reviewers),
      randomItem(['status_change', 'category_change', 'index_reset']),
      'status',
      'reviewing',
      'published',
      '内容审核通过，手动调整状态'
    );
  }
  adjustStmt.finalize();

  console.log('演示数据填充完成！');
});

db.close();

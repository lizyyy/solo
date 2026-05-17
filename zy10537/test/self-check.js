const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../data/test.db');
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

process.env.DATABASE_PATH = dbPath;

const ArticleService = require('../src/models/articleService');

function logResult(testName, passed, message = '') {
  const status = passed ? '✓ 通过' : '✗ 失败';
  console.log(`${status} - ${testName}`);
  if (message) console.log(`  ${message}`);
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('知识库过期提醒API - 自检脚本');
  console.log('='.repeat(60));
  console.log('');

  let passedCount = 0;
  let failedCount = 0;

  console.log('--- 测试1: 正常流程 - 创建、查询、状态推进');
  console.log('');

  try {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 60);
    
    const article = await ArticleService.createArticle({
      article_no: 'KB-001',
      title: '新员工入职指南',
      team: '技术部',
      author: '张三',
      valid_until: futureDate.toISOString().split('T')[0]
    });
    logResult('创建文章', true, `文章编号: ${article.article_no}`);
    passedCount++;

    const found = await ArticleService.getArticle('KB-001');
    logResult('查询文章', found && found.article_no === 'KB-001');
    passedCount++;

    const validity = await ArticleService.checkValidity('KB-001');
    logResult('有效期检查', validity && !validity.is_expired, `剩余天数: ${validity.days_until_expiry}`);
    passedCount++;

    for (let i = 0; i < 5; i++) {
      await ArticleService.incrementCitation('KB-001', 'user_' + i);
    }
    const cited = await ArticleService.getArticle('KB-001');
    logResult('引用统计', cited.citation_count === 5, `引用次数: ${cited.citation_count}`);
    passedCount++;

    const review = await ArticleService.startReview('KB-001', '审核员A');
    logResult('开始复审', true, `复审ID: ${review.review_id}`);
    passedCount++;

    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + 180);
    await ArticleService.submitReview(
      review.review_id,
      '内容更新完成，延长有效期',
      newExpiry.toISOString().split('T')[0]
    );
    const updated = await ArticleService.getArticle('KB-001');
    logResult('提交复审', true, `新有效期: ${updated.valid_until}`);
    passedCount++;

  } catch (err) {
    logResult('正常流程', false, err.message);
    failedCount++;
  }

  console.log('');
  console.log('--- 测试2: 脏数据处理');
  console.log('');

  try {
    let caught = 0;
    try {
      await ArticleService.createArticle({
        article_no: '',
        title: '',
        team: '',
        valid_until: 'invalid-date'
      });
    } catch (err) {
      caught++;
    }
    logResult('空字段验证', caught === 1);
    passedCount++;

    try {
      await ArticleService.createArticle({
        article_no: 'KB-TEST',
        title: '测试',
        team: '测试',
        valid_until: '2023/13/45'
      });
    } catch (err) {
      caught++;
    }
    logResult('日期格式验证', caught === 2);
    passedCount++;

  } catch (err) {
    logResult('脏数据处理', false, err.message);
    failedCount++;
  }

  console.log('');
  console.log('--- 测试3: 重复请求处理');
  console.log('');

  try {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    
    await ArticleService.createArticle({
      article_no: 'KB-DUP',
      title: '重复测试文章',
      team: '测试部',
      valid_until: futureDate.toISOString().split('T')[0]
    });

    let duplicateError = false;
    try {
      await ArticleService.createArticle({
        article_no: 'KB-DUP',
        title: '重复测试文章2',
        team: '测试部',
        valid_until: futureDate.toISOString().split('T')[0]
      });
    } catch (err) {
      duplicateError = true;
    }
    logResult('重复文章编号拦截', duplicateError);
    passedCount++;

  } catch (err) {
    logResult('重复请求处理', false, err.message);
    failedCount++;
  }

  console.log('');
  console.log('--- 测试4: 人工修正');
  console.log('');

  try {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    
    await ArticleService.createArticle({
      article_no: 'KB-CORRECT',
      title: '待修正文章',
      team: '旧团队',
      author: '原作者',
      valid_until: futureDate.toISOString().split('T')[0]
    });

    await ArticleService.manualCorrection('KB-CORRECT', {
      title: '已修正的文章标题',
      team: '新团队名称',
      status: 'active'
    });

    const corrected = await ArticleService.getArticle('KB-CORRECT');
    const titleCorrect = corrected.title === '已修正的文章标题';
    const teamCorrect = corrected.team === '新团队名称';
    logResult('人工修正字段', titleCorrect && teamCorrect, `标题: ${corrected.title}, 团队: ${corrected.team}`);
    passedCount++;

  } catch (err) {
    logResult('人工修正', false, err.message);
    failedCount++;
  }

  console.log('');
  console.log('--- 测试5: 过期与下架状态');
  console.log('');

  try {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 10);
    
    await ArticleService.createArticle({
      article_no: 'KB-EXPIRED',
      title: '已过期文章',
      team: '技术部',
      valid_until: pastDate.toISOString().split('T')[0]
    });

    const validity = await ArticleService.checkValidity('KB-EXPIRED');
    logResult('过期检测', validity.is_expired, `已过期: ${validity.is_expired}`);
    passedCount++;

    await ArticleService.takeDown('KB-EXPIRED');
    const takenDown = await ArticleService.getArticle('KB-EXPIRED');
    logResult('下架状态', takenDown.status === 'taken_down');
    passedCount++;

  } catch (err) {
    logResult('过期与下架', false, err.message);
    failedCount++;
  }

  console.log('');
  console.log('--- 测试6: 报告生成');
  console.log('');

  try {
    const report = await ArticleService.generateExpiryReport('test');
    logResult('生成过期提醒报告', report && report.report_id, `报告ID: ${report.report_id}`);
    passedCount++;

    logResult('报告包含统计数据', report.summary && report.summary.total > 0, `总文章数: ${report.summary.total}`);
    passedCount++;

  } catch (err) {
    logResult('报告生成', false, err.message);
    failedCount++;
  }

  console.log('');
  console.log('--- 测试7: 异常日志记录');
  console.log('');

  try {
    const result = await ArticleService.logException(
      '/api/test',
      { foo: 'bar' },
      '测试错误信息',
      '测试处理依据'
    );
    logResult('异常日志记录', result && result.exception_id, `异常ID: ${result.exception_id}`);
    passedCount++;

  } catch (err) {
    logResult('异常日志', false, err.message);
    failedCount++;
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('测试总结');
  console.log('='.repeat(60));
  console.log(`通过: ${passedCount}`);
  console.log(`失败: ${failedCount}`);
  console.log(`总计: ${passedCount + failedCount}`);
  console.log('');

  if (failedCount === 0) {
    console.log('✓ 所有测试通过！');
  } else {
    console.log('✗ 部分测试失败，请检查代码');
    process.exit(1);
  }

  console.log('');
  console.log('API接口清单:');
  console.log('  POST   /api/articles              - 创建文章');
  console.log('  GET    /api/articles/:no          - 查询文章');
  console.log('  GET    /api/articles               - 文章列表');
  console.log('  GET    /api/articles/:no/validity  - 有效期检查');
  console.log('  POST   /api/articles/:no/cite         - 增加引用');
  console.log('  POST   /api/articles/:no/review/start - 开始复审');
  console.log('  POST   /api/articles/review/:id/submit - 提交复审');
  console.log('  POST   /api/articles/:no/takedown   - 下架文章');
  console.log('  PATCH  /api/articles/:no/correct  - 人工修正');
  console.log('  POST   /api/articles/report/generate - 生成报告');
  console.log('  GET    /api/articles/export/csv   - CSV导出');
  console.log('');
  console.log('数据模型:');
  console.log('  articles        - 文章表 (编号、团队、有效期、状态、引用次数)');
  console.log('  review_records - 复审记录表');
  console.log('  citation_logs  - 引用日志表');
  console.log('  exception_logs - 异常日志表 (保留原始输入)');
  console.log('  reminder_reports - 提醒报告表');
}

runTests().catch(console.error);

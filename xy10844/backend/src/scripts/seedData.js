const TaskService = require('../services/taskService');
const { STAGES, STATUSES } = require('../constants/stages');
const db = require('../config/database');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function seedNormalFlow() {
  console.log('开始创建正常流程示例数据...');
  
  const task = await TaskService.createTask({
    indexName: 'product_search_v2',
    dataSource: 'mysql://product_db',
    targetVersion: 'v2.3.1',
    currentVersion: 'v2.3.0',
    verifyQuery: 'SELECT * FROM products WHERE MATCH(name) AGAINST("手机")',
    createdBy: 'admin'
  });

  await sleep(100);
  await TaskService.updateStage(task.id, STAGES.INIT, STATUSES.RUNNING, '开始初始化任务', 'system');
  
  await sleep(100);
  await TaskService.updateStage(task.id, STAGES.DATA_PREPARE, STATUSES.RUNNING, '开始数据准备阶段', 'system');
  
  await sleep(100);
  await TaskService.updateStage(task.id, STAGES.DATA_PREPARE, STATUSES.SUCCESS, '数据准备完成，共处理1,234,567条记录', 'system');
  
  await sleep(100);
  await TaskService.updateStage(task.id, STAGES.INDEX_BUILDING, STATUSES.RUNNING, '开始构建向量索引', 'system');
  
  await sleep(100);
  await TaskService.updateStage(task.id, STAGES.INDEX_BUILDING, STATUSES.SUCCESS, '索引构建完成，维度: 768, 向量数: 1,234,567', 'system');
  
  await sleep(100);
  await TaskService.updateStage(task.id, STAGES.VERIFICATION, STATUSES.RUNNING, '开始验证查询', 'system');
  
  await sleep(100);
  await TaskService.updateVerifyResult(task.id, '查询结果命中准确率: 98.5%, 召回率: 97.2%, 响应时间: 45ms', true, 'qa_engineer');
  
  await sleep(100);
  await TaskService.updateStage(task.id, STAGES.GRAY_RELEASE, STATUSES.RUNNING, '进入灰度发布阶段', 'system');
  
  await sleep(100);
  await TaskService.updateGrayTraffic(task.id, 10, 'devops');
  
  await sleep(100);
  await TaskService.updateGrayTraffic(task.id, 30, 'devops');
  
  await sleep(100);
  await TaskService.updateGrayTraffic(task.id, 50, 'devops');
  
  await sleep(100);
  await TaskService.updateStage(task.id, STAGES.FULL_SWITCH, STATUSES.RUNNING, '开始全量切换', 'devops');
  
  await sleep(100);
  await TaskService.updateStage(task.id, STAGES.COMPLETED, STATUSES.SUCCESS, '索引重建任务全部完成，新版本已全量上线', 'system');

  console.log('正常流程示例数据创建完成:', task.id);
  return task.id;
}

async function seedBlockedFlow() {
  console.log('开始创建拦截流程示例数据...');
  
  const task = await TaskService.createTask({
    indexName: 'user_profile_v3',
    dataSource: 'mongodb://user_db',
    targetVersion: 'v3.0.0',
    currentVersion: 'v2.9.5',
    verifyQuery: '{ "vector": [...], "top_k": 10 }',
    createdBy: 'developer'
  });

  await sleep(100);
  await TaskService.updateStage(task.id, STAGES.INIT, STATUSES.RUNNING, '开始初始化任务', 'system');
  
  await sleep(100);
  await TaskService.updateStage(task.id, STAGES.DATA_PREPARE, STATUSES.RUNNING, '开始数据准备阶段', 'system');
  
  await sleep(100);
  await TaskService.pauseTask(task.id, '数据清洗步骤#3', '发现脏数据比例超过阈值(5%)，暂停任务进行人工审核', 'data_engineer');
  
  await sleep(100);
  await TaskService.resumeTask(task.id, '脏数据已清理完成，恢复执行', 'data_engineer');
  
  await sleep(100);
  await TaskService.updateStage(task.id, STAGES.DATA_PREPARE, STATUSES.SUCCESS, '数据准备完成', 'system');
  
  await sleep(100);
  await TaskService.updateStage(task.id, STAGES.INDEX_BUILDING, STATUSES.RUNNING, '开始构建向量索引', 'system');
  
  await sleep(100);
  await TaskService.updateStage(task.id, STAGES.INDEX_BUILDING, STATUSES.SUCCESS, '索引构建完成', 'system');
  
  await sleep(100);
  await TaskService.updateStage(task.id, STAGES.VERIFICATION, STATUSES.RUNNING, '开始验证查询', 'system');
  
  await sleep(100);
  await TaskService.updateVerifyResult(task.id, '查询结果命中准确率: 82.3%，低于阈值95%，top10结果中有2条不相关', false, 'qa_engineer');

  console.log('拦截流程示例数据创建完成:', task.id);
  return task.id;
}

async function seedFailedFlow() {
  console.log('开始创建失败流程示例数据...');
  
  const task = await TaskService.createTask({
    indexName: 'recommendation_v1',
    dataSource: 'postgresql://rec_db',
    targetVersion: 'v1.5.0',
    currentVersion: 'v1.4.2',
    verifyQuery: 'SELECT vector_search(...)',
    createdBy: 'ml_engineer'
  });

  await sleep(100);
  await TaskService.updateStage(task.id, STAGES.INIT, STATUSES.RUNNING, '开始初始化任务', 'system');
  
  await sleep(100);
  await TaskService.updateStage(task.id, STAGES.DATA_PREPARE, STATUSES.RUNNING, '开始数据准备阶段', 'system');
  
  await sleep(100);
  await TaskService.updateStage(task.id, STAGES.DATA_PREPARE, STATUSES.FAILED, '数据库连接超时，重试3次后仍失败，任务终止', 'system');

  console.log('失败流程示例数据创建完成:', task.id);
  return task.id;
}

async function seedRollbackFlow() {
  console.log('开始创建回滚流程示例数据...');
  
  const task = await TaskService.createTask({
    indexName: 'image_search_v4',
    dataSource: 's3://image-vectors',
    targetVersion: 'v4.1.0',
    currentVersion: 'v4.0.5',
    verifyQuery: 'image vector similarity search',
    createdBy: 'platform_team'
  });

  await sleep(100);
  await TaskService.updateStage(task.id, STAGES.INIT, STATUSES.RUNNING, '开始初始化任务', 'system');
  
  await sleep(100);
  await TaskService.updateStage(task.id, STAGES.DATA_PREPARE, STATUSES.RUNNING, '开始数据准备阶段', 'system');
  
  await sleep(100);
  await TaskService.updateStage(task.id, STAGES.DATA_PREPARE, STATUSES.SUCCESS, '数据准备完成', 'system');
  
  await sleep(100);
  await TaskService.updateStage(task.id, STAGES.INDEX_BUILDING, STATUSES.RUNNING, '开始构建向量索引', 'system');
  
  await sleep(100);
  await TaskService.updateStage(task.id, STAGES.INDEX_BUILDING, STATUSES.SUCCESS, '索引构建完成', 'system');
  
  await sleep(100);
  await TaskService.updateStage(task.id, STAGES.VERIFICATION, STATUSES.RUNNING, '开始验证查询', 'system');
  
  await sleep(100);
  await TaskService.updateStage(task.id, STAGES.VERIFICATION, STATUSES.SUCCESS, '验证查询通过', 'system');
  
  await sleep(100);
  await TaskService.updateStage(task.id, STAGES.GRAY_RELEASE, STATUSES.RUNNING, '进入灰度发布阶段', 'system');
  
  await sleep(100);
  await TaskService.updateGrayTraffic(task.id, 20, 'sre');
  
  await sleep(100);
  await TaskService.rollback(task.id, '灰度期间发现查询延迟从50ms上升至200ms，触发回滚机制', 'sre');

  console.log('回滚流程示例数据创建完成:', task.id);
  return task.id;
}

async function seedInProgressFlow() {
  console.log('开始创建进行中流程示例数据...');
  
  const task = await TaskService.createTask({
    indexName: 'video_search_v2',
    dataSource: 'hdfs://video-vectors',
    targetVersion: 'v2.1.0',
    currentVersion: 'v2.0.0',
    verifyQuery: 'video embedding search',
    createdBy: 'ml_team'
  });

  await sleep(100);
  await TaskService.updateStage(task.id, STAGES.INIT, STATUSES.RUNNING, '开始初始化任务', 'system');
  
  await sleep(100);
  await TaskService.updateStage(task.id, STAGES.DATA_PREPARE, STATUSES.SUCCESS, '数据准备完成', 'system');
  
  await sleep(100);
  await TaskService.updateStage(task.id, STAGES.INDEX_BUILDING, STATUSES.RUNNING, '索引构建中，当前进度: 67%', 'system');

  console.log('进行中流程示例数据创建完成:', task.id);
  return task.id;
}

async function main() {
  console.log('========================================');
  console.log('开始生成向量索引重建控制台示例数据');
  console.log('========================================\n');

  try {
    await seedNormalFlow();
    console.log('');
    await seedBlockedFlow();
    console.log('');
    await seedFailedFlow();
    console.log('');
    await seedRollbackFlow();
    console.log('');
    await seedInProgressFlow();

    console.log('\n========================================');
    console.log('所有示例数据生成完成!');
    console.log('========================================');
  } catch (err) {
    console.error('生成示例数据失败:', err);
  }

  db.close();
}

main();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../../data/index_rebuild.db');

// 确保数据目录存在
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 删除旧数据库
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('旧数据库已删除');
}

const db = new sqlite3.Database(dbPath);

const initTables = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      CREATE TABLE IF NOT EXISTS index_rebuild_tasks (
        id TEXT PRIMARY KEY,
        index_name TEXT NOT NULL,
        data_source TEXT NOT NULL,
        stage TEXT NOT NULL,
        status TEXT NOT NULL,
        pause_point TEXT,
        current_version TEXT,
        target_version TEXT NOT NULL,
        verify_query TEXT,
        verify_result TEXT,
        gray_traffic_percentage INTEGER DEFAULT 0,
        error_message TEXT,
        state_reason TEXT,
        created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        completed_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS task_logs (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        stage TEXT NOT NULL,
        action TEXT NOT NULL,
        status TEXT NOT NULL,
        message TEXT,
        operator TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS switch_records (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        switch_type TEXT NOT NULL,
        from_version TEXT,
        to_version TEXT,
        traffic_percentage INTEGER,
        operator TEXT NOT NULL,
        rollback_reason TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_task_stage ON index_rebuild_tasks(stage);
      CREATE INDEX IF NOT EXISTS idx_task_status ON index_rebuild_tasks(status);
      CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_logs(task_id);
      CREATE INDEX IF NOT EXISTS idx_switch_records_task_id ON switch_records(task_id);
    `;

    db.exec(sql, (err) => {
      if (err) {
        console.error('创建表失败:', err.message);
        reject(err);
      } else {
        console.log('数据库表初始化成功');
        resolve();
      }
    });
  });
};

const { v4: uuidv4 } = require('uuid');

const STAGES = {
  INIT: 'init',
  DATA_PREPARE: 'data_prepare',
  INDEX_BUILDING: 'index_building',
  VERIFICATION: 'verification',
  GRAY_RELEASE: 'gray_release',
  FULL_SWITCH: 'full_switch',
  COMPLETED: 'completed',
  FAILED: 'failed',
  ROLLED_BACK: 'rolled_back'
};

const STATUSES = {
  PENDING: 'pending',
  RUNNING: 'running',
  PAUSED: 'paused',
  SUCCESS: 'success',
  FAILED: 'failed',
  BLOCKED: 'blocked'
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function createTask(data) {
  return new Promise((resolve, reject) => {
    const now = Date.now();
    const task = {
      id: uuidv4(),
      index_name: data.indexName,
      data_source: data.dataSource,
      stage: STAGES.INIT,
      status: STATUSES.PENDING,
      target_version: data.targetVersion,
      current_version: data.currentVersion || null,
      verify_query: data.verifyQuery || null,
      created_by: data.createdBy || 'system',
      state_reason: '任务创建成功，等待执行',
      created_at: now,
      updated_at: now
    };

    const sql = `
      INSERT INTO index_rebuild_tasks 
      (id, index_name, data_source, stage, status, target_version, current_version, verify_query, created_by, state_reason, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.run(sql, [
      task.id, task.index_name, task.data_source, task.stage, task.status,
      task.target_version, task.current_version, task.verify_query,
      task.created_by, task.state_reason, task.created_at, task.updated_at
    ], function(err) {
      if (err) reject(err);
      else resolve(task);
    });
  });
}

function updateStage(taskId, newStage, newStatus, reason, operator = 'system') {
  return new Promise((resolve, reject) => {
    const now = Date.now();
    const completedAt = (newStage === STAGES.COMPLETED || newStage === STAGES.ROLLED_BACK) ? now : null;
    
    const sql = `
      UPDATE index_rebuild_tasks 
      SET stage = ?, status = ?, state_reason = ?, updated_at = ?, completed_at = COALESCE(?, completed_at)
      WHERE id = ?
    `;
    db.run(sql, [newStage, newStatus, reason, now, completedAt, taskId], function(err) {
      if (err) reject(err);
      else resolve({ id: taskId, stage: newStage, status: newStatus, state_reason: reason });
    });
  });
}

function addTaskLog(taskId, stage, action, status, message, operator) {
  return new Promise((resolve, reject) => {
    const log = {
      id: uuidv4(),
      task_id: taskId,
      stage,
      action,
      status,
      message,
      operator,
      created_at: Date.now()
    };

    const sql = `
      INSERT INTO task_logs (id, task_id, stage, action, status, message, operator, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.run(sql, [log.id, log.task_id, log.stage, log.action, log.status, log.message, log.operator, log.created_at], function(err) {
      if (err) reject(err);
      else resolve(log);
    });
  });
}

function updateGrayTraffic(taskId, percentage, operator) {
  return new Promise((resolve, reject) => {
    const now = Date.now();
    const reason = `灰度流量调整为 ${percentage}%`;

    const sql = `
      UPDATE index_rebuild_tasks 
      SET gray_traffic_percentage = ?, state_reason = ?, updated_at = ?
      WHERE id = ?
    `;
    db.run(sql, [percentage, reason, now, taskId], function(err) {
      if (err) reject(err);
      else resolve({ id: taskId, gray_traffic_percentage: percentage, state_reason: reason });
    });
  });
}

function rollback(taskId, reason, operator) {
  return new Promise((resolve, reject) => {
    const now = Date.now();
    
    const sql = `
      UPDATE index_rebuild_tasks 
      SET stage = ?, status = ?, state_reason = ?, gray_traffic_percentage = 0, updated_at = ?, completed_at = ?
      WHERE id = ?
    `;
    db.run(sql, [STAGES.ROLLED_BACK, STATUSES.SUCCESS, reason, now, now, taskId], function(err) {
      if (err) reject(err);
      else resolve({ id: taskId, stage: STAGES.ROLLED_BACK, status: STATUSES.SUCCESS, state_reason: reason });
    });
  });
}

async function seedNormalFlow() {
  console.log('开始创建正常流程示例数据...');
  
  const task = await createTask({
    indexName: 'product_search_v2',
    dataSource: 'mysql://product_db',
    targetVersion: 'v2.3.1',
    currentVersion: 'v2.3.0',
    verifyQuery: 'SELECT * FROM products WHERE MATCH(name) AGAINST("手机")',
    createdBy: 'admin'
  });

  await sleep(10);
  await addTaskLog(task.id, STAGES.INIT, 'stage_update', STATUSES.RUNNING, '开始初始化任务', 'system');
  await updateStage(task.id, STAGES.INIT, STATUSES.RUNNING, '开始初始化任务', 'system');
  
  await sleep(10);
  await addTaskLog(task.id, STAGES.DATA_PREPARE, 'stage_update', STATUSES.RUNNING, '开始数据准备阶段', 'system');
  await updateStage(task.id, STAGES.DATA_PREPARE, STATUSES.RUNNING, '开始数据准备阶段', 'system');
  
  await sleep(10);
  await addTaskLog(task.id, STAGES.DATA_PREPARE, 'stage_update', STATUSES.SUCCESS, '数据准备完成，共处理1,234,567条记录', 'system');
  await updateStage(task.id, STAGES.DATA_PREPARE, STATUSES.SUCCESS, '数据准备完成，共处理1,234,567条记录', 'system');
  
  await sleep(10);
  await addTaskLog(task.id, STAGES.INDEX_BUILDING, 'stage_update', STATUSES.RUNNING, '开始构建向量索引', 'system');
  await updateStage(task.id, STAGES.INDEX_BUILDING, STATUSES.RUNNING, '开始构建向量索引', 'system');
  
  await sleep(10);
  await addTaskLog(task.id, STAGES.INDEX_BUILDING, 'stage_update', STATUSES.SUCCESS, '索引构建完成，维度: 768, 向量数: 1,234,567', 'system');
  await updateStage(task.id, STAGES.INDEX_BUILDING, STATUSES.SUCCESS, '索引构建完成，维度: 768, 向量数: 1,234,567', 'system');
  
  await sleep(10);
  await addTaskLog(task.id, STAGES.VERIFICATION, 'stage_update', STATUSES.RUNNING, '开始验证查询', 'system');
  await updateStage(task.id, STAGES.VERIFICATION, STATUSES.RUNNING, '开始验证查询', 'system');
  
  await sleep(10);
  await addTaskLog(task.id, STAGES.VERIFICATION, 'verify', STATUSES.SUCCESS, '验证查询通过', 'qa_engineer');
  await updateStage(task.id, STAGES.VERIFICATION, STATUSES.SUCCESS, '验证查询通过', 'qa_engineer');
  
  await sleep(10);
  await addTaskLog(task.id, STAGES.GRAY_RELEASE, 'stage_update', STATUSES.RUNNING, '进入灰度发布阶段', 'system');
  await updateStage(task.id, STAGES.GRAY_RELEASE, STATUSES.RUNNING, '进入灰度发布阶段', 'system');
  
  await sleep(10);
  await updateGrayTraffic(task.id, 10, 'sre');
  await addTaskLog(task.id, STAGES.GRAY_RELEASE, 'gray_update', STATUSES.RUNNING, '灰度流量调整为 10%', 'sre');
  
  await sleep(10);
  await updateGrayTraffic(task.id, 30, 'sre');
  await addTaskLog(task.id, STAGES.GRAY_RELEASE, 'gray_update', STATUSES.RUNNING, '灰度流量调整为 30%', 'sre');
  
  await sleep(10);
  await updateGrayTraffic(task.id, 50, 'sre');
  await addTaskLog(task.id, STAGES.GRAY_RELEASE, 'gray_update', STATUSES.RUNNING, '灰度流量调整为 50%', 'sre');
  
  await sleep(10);
  await addTaskLog(task.id, STAGES.FULL_SWITCH, 'stage_update', STATUSES.RUNNING, '开始全量切换', 'sre');
  await updateStage(task.id, STAGES.FULL_SWITCH, STATUSES.RUNNING, '开始全量切换', 'sre');
  
  await sleep(10);
  await addTaskLog(task.id, STAGES.COMPLETED, 'stage_update', STATUSES.SUCCESS, '索引重建任务全部完成，新版本已全量上线', 'system');
  await updateStage(task.id, STAGES.COMPLETED, STATUSES.SUCCESS, '索引重建任务全部完成，新版本已全量上线', 'system');

  console.log('正常流程示例数据创建完成:', task.id);
  return task.id;
}

async function seedBlockedFlow() {
  console.log('开始创建拦截流程示例数据...');
  
  const task = await createTask({
    indexName: 'user_profile_v3',
    dataSource: 'mongodb://user_db',
    targetVersion: 'v3.0.0',
    currentVersion: 'v2.9.5',
    verifyQuery: '{ "vector": [...], "top_k": 10 }',
    createdBy: 'developer'
  });

  await sleep(10);
  await addTaskLog(task.id, STAGES.INIT, 'stage_update', STATUSES.RUNNING, '开始初始化任务', 'system');
  await updateStage(task.id, STAGES.INIT, STATUSES.RUNNING, '开始初始化任务', 'system');
  
  await sleep(10);
  await addTaskLog(task.id, STAGES.DATA_PREPARE, 'stage_update', STATUSES.RUNNING, '开始数据准备阶段', 'system');
  await updateStage(task.id, STAGES.DATA_PREPARE, STATUSES.RUNNING, '开始数据准备阶段', 'system');
  
  await sleep(10);
  await addTaskLog(task.id, STAGES.DATA_PREPARE, 'pause', STATUSES.PAUSED, '发现脏数据比例超过阈值(5%)，暂停任务进行人工审核', 'data_engineer');
  await updateStage(task.id, STAGES.DATA_PREPARE, STATUSES.PAUSED, '发现脏数据比例超过阈值(5%)，暂停任务进行人工审核', 'data_engineer');
  
  await sleep(10);
  await addTaskLog(task.id, STAGES.DATA_PREPARE, 'resume', STATUSES.SUCCESS, '脏数据已清理完成，恢复执行', 'data_engineer');
  await updateStage(task.id, STAGES.DATA_PREPARE, STATUSES.SUCCESS, '脏数据已清理完成，恢复执行', 'data_engineer');
  
  await sleep(10);
  await addTaskLog(task.id, STAGES.INDEX_BUILDING, 'stage_update', STATUSES.RUNNING, '开始构建向量索引', 'system');
  await updateStage(task.id, STAGES.INDEX_BUILDING, STATUSES.RUNNING, '开始构建向量索引', 'system');
  
  await sleep(10);
  await addTaskLog(task.id, STAGES.INDEX_BUILDING, 'stage_update', STATUSES.SUCCESS, '索引构建完成', 'system');
  await updateStage(task.id, STAGES.INDEX_BUILDING, STATUSES.SUCCESS, '索引构建完成', 'system');
  
  await sleep(10);
  await addTaskLog(task.id, STAGES.VERIFICATION, 'stage_update', STATUSES.RUNNING, '开始验证查询', 'system');
  await updateStage(task.id, STAGES.VERIFICATION, STATUSES.RUNNING, '开始验证查询', 'system');
  
  await sleep(10);
  await addTaskLog(task.id, STAGES.VERIFICATION, 'verify', STATUSES.BLOCKED, '查询结果命中准确率: 82.3%，低于阈值95%，top10结果中有2条不相关', 'qa_engineer');
  await updateStage(task.id, STAGES.VERIFICATION, STATUSES.BLOCKED, '查询结果命中准确率: 82.3%，低于阈值95%，top10结果中有2条不相关', 'qa_engineer');

  console.log('拦截流程示例数据创建完成:', task.id);
  return task.id;
}

async function seedFailedFlow() {
  console.log('开始创建失败流程示例数据...');
  
  const task = await createTask({
    indexName: 'recommendation_v1',
    dataSource: 'postgresql://rec_db',
    targetVersion: 'v1.5.0',
    currentVersion: 'v1.4.2',
    verifyQuery: 'SELECT vector_search(...)',
    createdBy: 'ml_engineer'
  });

  await sleep(10);
  await addTaskLog(task.id, STAGES.INIT, 'stage_update', STATUSES.RUNNING, '开始初始化任务', 'system');
  await updateStage(task.id, STAGES.INIT, STATUSES.RUNNING, '开始初始化任务', 'system');
  
  await sleep(10);
  await addTaskLog(task.id, STAGES.DATA_PREPARE, 'stage_update', STATUSES.RUNNING, '开始数据准备阶段', 'system');
  await updateStage(task.id, STAGES.DATA_PREPARE, STATUSES.RUNNING, '开始数据准备阶段', 'system');
  
  await sleep(10);
  await addTaskLog(task.id, STAGES.DATA_PREPARE, 'stage_update', STATUSES.FAILED, '数据库连接超时，重试3次后仍失败，任务终止', 'system');
  await updateStage(task.id, STAGES.DATA_PREPARE, STATUSES.FAILED, '数据库连接超时，重试3次后仍失败，任务终止', 'system');

  console.log('失败流程示例数据创建完成:', task.id);
  return task.id;
}

async function seedRollbackFlow() {
  console.log('开始创建回滚流程示例数据...');
  
  const task = await createTask({
    indexName: 'image_search_v4',
    dataSource: 's3://image-vectors',
    targetVersion: 'v4.1.0',
    currentVersion: 'v4.0.5',
    verifyQuery: 'image vector similarity search',
    createdBy: 'platform_team'
  });

  await sleep(10);
  await addTaskLog(task.id, STAGES.INIT, 'stage_update', STATUSES.RUNNING, '开始初始化任务', 'system');
  await updateStage(task.id, STAGES.INIT, STATUSES.RUNNING, '开始初始化任务', 'system');
  
  await sleep(10);
  await addTaskLog(task.id, STAGES.DATA_PREPARE, 'stage_update', STATUSES.RUNNING, '开始数据准备阶段', 'system');
  await updateStage(task.id, STAGES.DATA_PREPARE, STATUSES.RUNNING, '开始数据准备阶段', 'system');
  
  await sleep(10);
  await addTaskLog(task.id, STAGES.DATA_PREPARE, 'stage_update', STATUSES.SUCCESS, '数据准备完成', 'system');
  await updateStage(task.id, STAGES.DATA_PREPARE, STATUSES.SUCCESS, '数据准备完成', 'system');
  
  await sleep(10);
  await addTaskLog(task.id, STAGES.INDEX_BUILDING, 'stage_update', STATUSES.RUNNING, '开始构建向量索引', 'system');
  await updateStage(task.id, STAGES.INDEX_BUILDING, STATUSES.RUNNING, '开始构建向量索引', 'system');
  
  await sleep(10);
  await addTaskLog(task.id, STAGES.INDEX_BUILDING, 'stage_update', STATUSES.SUCCESS, '索引构建完成', 'system');
  await updateStage(task.id, STAGES.INDEX_BUILDING, STATUSES.SUCCESS, '索引构建完成', 'system');
  
  await sleep(10);
  await addTaskLog(task.id, STAGES.VERIFICATION, 'stage_update', STATUSES.RUNNING, '开始验证查询', 'system');
  await updateStage(task.id, STAGES.VERIFICATION, STATUSES.RUNNING, '开始验证查询', 'system');
  
  await sleep(10);
  await addTaskLog(task.id, STAGES.VERIFICATION, 'stage_update', STATUSES.SUCCESS, '验证查询通过', 'system');
  await updateStage(task.id, STAGES.VERIFICATION, STATUSES.SUCCESS, '验证查询通过', 'system');
  
  await sleep(10);
  await addTaskLog(task.id, STAGES.GRAY_RELEASE, 'stage_update', STATUSES.RUNNING, '进入灰度发布阶段', 'system');
  await updateStage(task.id, STAGES.GRAY_RELEASE, STATUSES.RUNNING, '进入灰度发布阶段', 'system');
  
  await sleep(10);
  await updateGrayTraffic(task.id, 20, 'sre');
  await addTaskLog(task.id, STAGES.GRAY_RELEASE, 'gray_update', STATUSES.RUNNING, '灰度流量调整为 20%', 'sre');
  
  await sleep(10);
  await addTaskLog(task.id, STAGES.GRAY_RELEASE, 'rollback', STATUSES.SUCCESS, '灰度期间发现查询延迟从50ms上升至200ms，触发回滚机制', 'sre');
  await rollback(task.id, '灰度期间发现查询延迟从50ms上升至200ms，触发回滚机制', 'sre');

  console.log('回滚流程示例数据创建完成:', task.id);
  return task.id;
}

async function seedInProgressFlow() {
  console.log('开始创建进行中流程示例数据...');
  
  const task = await createTask({
    indexName: 'video_search_v2',
    dataSource: 'hdfs://video-vectors',
    targetVersion: 'v2.1.0',
    currentVersion: 'v2.0.0',
    verifyQuery: 'video embedding search',
    createdBy: 'ml_team'
  });

  await sleep(10);
  await addTaskLog(task.id, STAGES.INIT, 'stage_update', STATUSES.RUNNING, '开始初始化任务', 'system');
  await updateStage(task.id, STAGES.INIT, STATUSES.RUNNING, '开始初始化任务', 'system');
  
  await sleep(10);
  await addTaskLog(task.id, STAGES.DATA_PREPARE, 'stage_update', STATUSES.SUCCESS, '数据准备完成', 'system');
  await updateStage(task.id, STAGES.DATA_PREPARE, STATUSES.SUCCESS, '数据准备完成', 'system');
  
  await sleep(10);
  await addTaskLog(task.id, STAGES.INDEX_BUILDING, 'stage_update', STATUSES.RUNNING, '索引构建中，当前进度: 67%', 'system');
  await updateStage(task.id, STAGES.INDEX_BUILDING, STATUSES.RUNNING, '索引构建中，当前进度: 67%', 'system');

  console.log('进行中流程示例数据创建完成:', task.id);
  return task.id;
}

async function main() {
  console.log('========================================');
  console.log('开始生成向量索引重建控制台示例数据');
  console.log('========================================\n');

  try {
    await initTables();
    console.log('');
    
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

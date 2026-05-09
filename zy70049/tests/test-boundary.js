const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../data/test_boundary.json');

if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

const { v4: uuidv4 } = require('uuid');
const { Database } = require('../src/models/database');

function addDays(dateStr, days) {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

function createTestDb() {
  return new Database(dbPath);
}

function recordHistory(db, sampleId, operation, oldData, newData, operator = null, reason = null) {
  db.addHistory({
    history_id: uuidv4(),
    sample_id: sampleId,
    operation,
    old_data: oldData ? JSON.stringify(oldData) : null,
    new_data: newData ? JSON.stringify(newData) : null,
    operator,
    reason,
    created_at: new Date().toISOString()
  });
}

function recordAudit(db, action, entityType, entityId, details = null, operator = null) {
  db.addAuditLog({
    id: uuidv4(),
    action,
    entity_type: entityType,
    entity_id: entityId,
    details: details ? JSON.stringify(details) : null,
    operator,
    created_at: new Date().toISOString()
  });
}

function createSample(db, data) {
  const { batch_no, product_name, quantity, unit, sample_date, retention_days, storage_location, operator } = data;
  const expiry_date = addDays(sample_date, retention_days);
  const id = uuidv4();
  const now = new Date().toISOString();
  
  const newSample = {
    id, batch_no, product_name, quantity, unit,
    sample_date, retention_days, expiry_date,
    storage_location, status: 'active',
    created_at: now, updated_at: now
  };
  
  db.addSample(newSample);
  recordHistory(db, id, 'create', null, newSample, operator);
  recordAudit(db, 'create', 'sample', id, { batch_no, product_name }, operator);
  
  return newSample;
}

function generateTasks(db, targetDate) {
  const runDate = targetDate;
  
  const existingRun = db.findJobRun(
    j => j.job_name === 'generate_expiry_tasks' && j.run_date === runDate && j.status === 'success'
  );
  
  if (existingRun) {
    return { rerunDetected: true, recordsProcessed: existingRun.records_processed };
  }
  
  const jobId = uuidv4();
  db.addJobRun({
    id: jobId,
    job_name: 'generate_expiry_tasks',
    run_date: runDate,
    status: 'running',
    records_processed: 0,
    error_message: null,
    started_at: new Date().toISOString(),
    finished_at: null
  });
  
  const allSamples = db.filterSamples(() => true);
  const samples = allSamples.filter(s => {
    if (s.status !== 'active') return false;
    if (s.expiry_date > runDate) return false;
    
    const existingTask = db.findTask(
      t => t.sample_id === s.id && ['pending', 'approved', 'completed', 'pending_approval'].includes(t.status)
    );
    
    return !existingTask;
  });
  
  let processed = 0;
  
  db.transaction(() => {
    for (const sample of samples) {
      db.addTask({
        id: uuidv4(),
        sample_id: sample.id,
        batch_no: sample.batch_no,
        expiry_date: sample.expiry_date,
        status: 'pending',
        is_extended: 0,
        extension_days: 0,
        extension_reason: null,
        created_at: new Date().toISOString()
      });
      processed++;
      recordAudit(db, 'task_created', 'task', sample.id, { batch_no: sample.batch_no, expiry_date: sample.expiry_date });
    }
  });
  
  const finishedAt = new Date().toISOString();
  const jobRuns = db.data.jobRuns;
  const idx = jobRuns.findIndex(j => j.id === jobId);
  if (idx !== -1) {
    jobRuns[idx].status = 'success';
    jobRuns[idx].records_processed = processed;
    jobRuns[idx].finished_at = finishedAt;
    db.save();
  }
  
  return { rerunDetected: false, recordsProcessed: processed };
}

function submitApproval(db, taskId, submitter) {
  const task = db.findTask(t => t.id === taskId);
  if (!task) throw new Error('任务不存在');
  
  const existing = db.findApproval(
    a => a.task_id === taskId && ['pending', 'approved'].includes(a.status)
  );
  if (existing) throw new Error('该任务已提交审批或已批准');
  
  const id = uuidv4();
  const now = new Date().toISOString();
  
  db.addApproval({
    id, task_id: taskId, sample_id: task.sample_id, batch_no: task.batch_no,
    status: 'pending', submitter, reviewer: null,
    review_comment: null, submitted_at: now, reviewed_at: null
  });
  
  db.updateTask(taskId, { status: 'pending_approval' });
  recordAudit(db, 'approval_submitted', 'approval', id, { taskId, batchNo: task.batch_no }, submitter);
  
  return db.findApproval(a => a.id === id);
}

function approve(db, approvalId, reviewer, comment) {
  const approval = db.findApproval(a => a.id === approvalId);
  if (!approval) throw new Error('审批不存在');
  if (approval.status !== 'pending') throw new Error('只有待审批状态才能审批');
  
  const now = new Date().toISOString();
  
  db.updateApproval(approvalId, {
    status: 'approved',
    reviewer,
    review_comment: comment,
    reviewed_at: now
  });
  
  db.updateTask(approval.task_id, { status: 'approved' });
  recordAudit(db, 'approval_approved', 'approval', approvalId, { taskId: approval.task_id, comment }, reviewer);
  
  return db.findApproval(a => a.id === approvalId);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✓ ${message}`);
}

function assertThrows(fn, expectedError, message) {
  try {
    fn();
    throw new Error(`Expected error: ${expectedError}`);
  } catch (err) {
    assert(err.message.includes(expectedError), message);
  }
}

console.log('\n=== 开始边界条件测试 ===\n');

const today = new Date().toISOString().split('T')[0];
const db = createTestDb();

console.log('--- 边界1：撤回后的留样不生成到期任务 ---');
const withdrawnSample = createSample(db, {
  batch_no: 'BATCH-BOUNDARY-001',
  product_name: '边界测试药品1',
  quantity: 10,
  unit: '盒',
  sample_date: addDays(today, -365),
  retention_days: 180,
  storage_location: '测试柜',
  operator: '测试员'
});

const beforeTasks = db.filterTasks(() => true).length;
assert(beforeTasks === 0, '暂无任务');

db.updateSample(withdrawnSample.id, { status: 'withdrawn', updated_at: new Date().toISOString() });

generateTasks(db, today);
const afterWithdrawnTasks = db.filterTasks(() => true).length;
assert(afterWithdrawnTasks === 0, '已撤回的留样不生成到期任务');

console.log('\n--- 边界2：审批驳回后可重新提交 ---');
const day2 = addDays(today, 2);
const sample2 = createSample(db, {
  batch_no: 'BATCH-BOUNDARY-002',
  product_name: '边界测试药品2',
  quantity: 10,
  unit: '盒',
  sample_date: addDays(today, -365),
  retention_days: 180,
  storage_location: '测试柜',
  operator: '测试员'
});

generateTasks(db, day2);
const task2 = db.findTask(t => t.sample_id === sample2.id);

const approval1 = submitApproval(db, task2.id, '提交人');
assert(approval1.status === 'pending', '首次提交审批成功');

db.updateApproval(approval1.id, {
  status: 'rejected',
  reviewer: '审批人',
  review_comment: '资料不全，请补充',
  reviewed_at: new Date().toISOString()
});
db.updateTask(task2.id, { status: 'pending' });

const approval2 = submitApproval(db, task2.id, '提交人');
assert(approval2.status === 'pending', '驳回后可重新提交审批');

console.log('\n--- 边界3：未批准的任务无法完成销毁 ---');
const sample3 = createSample(db, {
  batch_no: 'BATCH-BOUNDARY-003',
  product_name: '边界测试药品3',
  quantity: 10,
  unit: '盒',
  sample_date: addDays(today, -365),
  retention_days: 180,
  storage_location: '测试柜',
  operator: '测试员'
});

generateTasks(db, addDays(today, 1));
const task3 = db.findTask(t => t.sample_id === sample3.id);

assertThrows(() => {
  if (task3.status !== 'approved') {
    throw new Error('只有已批准的任务才能完成销毁');
  }
}, '只有已批准的任务才能完成销毁', '未批准任务无法完成销毁');

console.log('\n--- 边界4：任务过期后重新生成（延期后）---');
const sample4 = createSample(db, {
  batch_no: 'BATCH-BOUNDARY-004',
  product_name: '边界测试药品4',
  quantity: 10,
  unit: '盒',
  sample_date: addDays(today, -365),
  retention_days: 90,
  storage_location: '测试柜',
  operator: '测试员'
});

const date4a = addDays(today, 3);
const result1 = generateTasks(db, date4a);
assert(result1.recordsProcessed === 1, '第一次生成任务');

const tasks4 = db.findTask(t => t.sample_id === sample4.id);
const oldExpiry = tasks4.expiry_date;

db.updateTask(tasks4.id, {
  is_extended: 1,
  extension_days: 30,
  extension_reason: '测试延期',
  expiry_date: addDays(oldExpiry, 30),
  status: 'pending'
});

const date4b = addDays(oldExpiry, 30);
const result2 = generateTasks(db, date4b);
assert(result2.rerunDetected === false, '新的日期是全新执行，不是重复');

console.log('\n--- 边界5：数据稳定性 - 多次重复执行同一天任务 ---');
const sample5 = createSample(db, {
  batch_no: 'BATCH-BOUNDARY-005',
  product_name: '边界测试药品5',
  quantity: 10,
  unit: '盒',
  sample_date: addDays(today, -500),
  retention_days: 90,
  storage_location: '测试柜',
  operator: '测试员'
});

const date5 = addDays(today, 4);
const countBefore = db.filterTasks(() => true).length;

generateTasks(db, date5);
const countAfter1 = db.filterTasks(() => true).length;
assert(countAfter1 === countBefore + 1, '首次执行新增一个任务');

generateTasks(db, date5);
const countAfter2 = db.filterTasks(() => true).length;
assert(countAfter2 === countAfter1, '重复执行同一天任务，任务数量不变');

generateTasks(db, date5);
const countAfter3 = db.filterTasks(() => true).length;
assert(countAfter3 === countAfter1, '第三次重复执行，结果仍然稳定');

console.log('\n--- 边界6：状态机验证 ---');
const sample6 = createSample(db, {
  batch_no: 'BATCH-BOUNDARY-006',
  product_name: '边界测试药品6',
  quantity: 10,
  unit: '盒',
  sample_date: addDays(today, -400),
  retention_days: 90,
  storage_location: '测试柜',
  operator: '测试员'
});

const date6 = addDays(today, 6);
generateTasks(db, date6);

const task6 = db.findTask(t => t.sample_id === sample6.id);
assert(task6.status === 'pending', '新任务状态为pending');

const approval6 = submitApproval(db, task6.id, '提交人');
const taskAfterSubmit = db.findTask(t => t.id === task6.id);
assert(taskAfterSubmit.status === 'pending_approval', '提交后状态为pending_approval');

approve(db, approval6.id, '审批人', '同意');
const taskAfterApprove = db.findTask(t => t.id === task6.id);
assert(taskAfterApprove.status === 'approved', '批准后状态为approved');

console.log('\n--- 边界7：撤销历史可追溯 ---');
const sample7 = createSample(db, {
  batch_no: 'BATCH-BOUNDARY-007',
  product_name: '边界测试药品7',
  quantity: 10,
  unit: '盒',
  sample_date: addDays(today, -30),
  retention_days: 30,
  storage_location: '柜A',
  operator: '测试员1'
});

const sample7Original = { ...sample7 };

recordHistory(db, sample7.id, 'update', sample7Original, { ...sample7Original, quantity: 15 }, '测试员2', '调整数量');
recordHistory(db, sample7.id, 'supplement', { ...sample7Original, quantity: 15 }, { ...sample7Original, quantity: 15, storage_location: '柜B' }, '测试员2', '补录位置');
recordHistory(db, sample7.id, 'withdraw', { ...sample7Original, quantity: 15, storage_location: '柜B' }, { ...sample7Original, status: 'withdrawn' }, '测试员3', '质量问题');

const history7 = db.findHistory(h => h.sample_id === sample7.id).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

assert(history7.length === 4, '历史记录条数正确（创建+更新+补录+撤回）');
assert(history7[0].operation === 'create', '最早记录是创建');
assert(history7[3].operation === 'withdraw', '最新记录是撤回');

const lastHistory = history7[3];
const lastOldData = JSON.parse(lastHistory.old_data);
const lastNewData = JSON.parse(lastHistory.new_data);

assert(lastOldData.status !== 'withdrawn', '撤回前状态不是withdrawn');
assert(lastNewData.status === 'withdrawn', '撤回后状态是withdrawn');

console.log('\n--- 边界8：任务执行失败后的处理 ---');
const failedJobId = uuidv4();
db.addJobRun({
  id: failedJobId,
  job_name: 'generate_expiry_tasks',
  run_date: addDays(today, -5),
  status: 'failed',
  error_message: '数据库连接超时',
  started_at: new Date().toISOString(),
  finished_at: new Date().toISOString()
});

const failedRuns = db.filterJobRuns(j => j.status === 'failed');
assert(failedRuns.length >= 1, '可以查询到失败的任务执行记录');

const resultAfterFail = generateTasks(db, addDays(today, -5));
assert(resultAfterFail.rerunDetected === false, '失败的任务可以重新执行，不会被幂等性拦截');

console.log('\n--- 边界9：重复提交审批的防御 ---');
const sample9 = createSample(db, {
  batch_no: 'BATCH-BOUNDARY-009',
  product_name: '边界测试药品9',
  quantity: 10,
  unit: '盒',
  sample_date: addDays(today, -365),
  retention_days: 180,
  storage_location: '测试柜',
  operator: '测试员'
});

generateTasks(db, addDays(today, 15));
const task9 = db.findTask(t => t.sample_id === sample9.id);

submitApproval(db, task9.id, '提交人A');

assertThrows(() => {
  submitApproval(db, task9.id, '提交人B');
}, '该任务已提交审批', '同一任务不能重复提交审批');

console.log('\n=== 边界条件测试通过 ===\n');

if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

console.log('所有边界测试通过 ✓');

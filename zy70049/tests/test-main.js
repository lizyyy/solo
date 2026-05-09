const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../data/test_main.json');
const uploadsPath = path.join(__dirname, '../uploads');

if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}
fs.mkdirSync(uploadsPath, { recursive: true });

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
  if (existing) throw new Error('该任务已提交审批');
  
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

function completeDestruction(db, taskId, photos, uploader) {
  const task = db.findTask(t => t.id === taskId);
  if (!task) throw new Error('任务不存在');
  if (task.status !== 'approved') throw new Error('只有已批准的任务才能完成销毁');
  
  const now = new Date().toISOString();
  const photoIds = [];
  
  for (const photo of photos) {
    const photoId = uuidv4();
    db.addPhoto({
      id: photoId, task_id: taskId, file_name: photo.fileName,
      file_path: photo.filePath, uploader, uploaded_at: now
    });
    photoIds.push(photoId);
    recordAudit(db, 'photo_uploaded', 'photo', photoId, { taskId, fileName: photo.fileName }, uploader);
  }
  
  db.updateTask(taskId, { status: 'completed' });
  
  const sampleIdx = db.data.samples.findIndex(s => s.id === task.sample_id);
  if (sampleIdx !== -1) {
    db.data.samples[sampleIdx].status = 'destroyed';
    db.data.samples[sampleIdx].updated_at = now;
    db.save();
  }
  
  recordAudit(db, 'destruction_completed', 'task', taskId, { photoIds, sampleId: task.sample_id }, uploader);
  
  return { taskId, status: 'completed', photoIds };
}

function withdrawSample(db, sampleId, operator, reason) {
  const oldSample = db.findSample(s => s.id === sampleId);
  if (!oldSample) throw new Error('留样不存在');
  if (oldSample.status === 'withdrawn') throw new Error('该留样已撤回');
  
  const now = new Date().toISOString();
  db.updateSample(sampleId, { status: 'withdrawn', updated_at: now });
  
  const newSample = db.findSample(s => s.id === sampleId);
  recordHistory(db, sampleId, 'withdraw', oldSample, newSample, operator, reason);
  recordAudit(db, 'withdraw', 'sample', sampleId, { reason }, operator);
  
  return newSample;
}

function supplementSample(db, sampleId, data, operator, reason) {
  const oldSample = db.findSample(s => s.id === sampleId);
  if (!oldSample) throw new Error('留样不存在');
  
  const updateData = {};
  for (const [k, v] of Object.entries(data)) {
    if (['product_name', 'quantity', 'unit', 'storage_location'].includes(k)) {
      updateData[k] = v;
    }
  }
  updateData.updated_at = new Date().toISOString();
  
  db.updateSample(sampleId, updateData);
  
  const newSample = db.findSample(s => s.id === sampleId);
  recordHistory(db, sampleId, 'supplement', oldSample, newSample, operator, reason);
  recordAudit(db, 'supplement', 'sample', sampleId, { reason }, operator);
  
  return newSample;
}

function extendTask(db, taskId, extensionDays, reason, operator) {
  const task = db.findTask(t => t.id === taskId);
  if (!task) throw new Error('任务不存在');
  if (task.status !== 'pending') throw new Error('只有待处理任务才能延期');
  
  const newExpiry = new Date(task.expiry_date);
  newExpiry.setDate(newExpiry.getDate() + extensionDays);
  const newExpiryStr = newExpiry.toISOString().split('T')[0];
  
  db.updateTask(taskId, {
    is_extended: 1,
    extension_days: extensionDays,
    extension_reason: reason,
    expiry_date: newExpiryStr
  });
  
  recordAudit(db, 'task_extended', 'task', taskId, {
    oldExpiry: task.expiry_date, newExpiry: newExpiryStr, extensionDays, reason
  }, operator);
  
  return db.findTask(t => t.id === taskId);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✓ ${message}`);
}

console.log('\n=== 开始主流程测试 ===\n');

const today = new Date().toISOString().split('T')[0];
const futureDate = addDays(today, 30);

console.log('--- 1. 创建留样台账 ---');
const db = createTestDb();

const sample1 = createSample(db, {
  batch_no: 'BATCH-2024-001',
  product_name: '维生素C片',
  quantity: 50,
  unit: '片',
  sample_date: addDays(today, -365),
  retention_days: 360,
  storage_location: '留样柜-A1',
  operator: '张三'
});

const sample2 = createSample(db, {
  batch_no: 'BATCH-2024-002',
  product_name: '阿莫西林胶囊',
  quantity: 30,
  unit: '粒',
  sample_date: addDays(today, -180),
  retention_days: 360,
  storage_location: '留样柜-A2',
  operator: '张三'
});

assert(sample1.status === 'active', '留样1创建成功，状态为active');
assert(sample2.status === 'active', '留样2创建成功，状态为active');

console.log('\n--- 2. 生成到期任务（数据稳定重跑测试）---');
const result1 = generateTasks(db, today);
assert(result1.rerunDetected === false, '首次执行，生成新任务');
assert(result1.recordsProcessed === 1, '应生成1个到期任务（只有留样1过期）');

const result2 = generateTasks(db, today);
assert(result2.rerunDetected === true, '重跑检测：同日数据应跳过，结果稳定');
assert(result2.recordsProcessed === 1, '重跑记录数与首次一致');

const tasks = db.filterTasks(t => t.status === 'pending');
assert(tasks.length === 1, '待处理任务数量为1');

console.log('\n--- 3. 提交销毁审批 ---');
const approval = submitApproval(db, tasks[0].id, '李四');
assert(approval.status === 'pending', '审批状态为待审批');
assert(approval.submitter === '李四', '提交人为李四');

const taskAfterSubmit = db.findTask(t => t.id === tasks[0].id);
assert(taskAfterSubmit.status === 'pending_approval', '任务状态变为待审批');

console.log('\n--- 4. 审批通过 ---');
const approved = approve(db, approval.id, '王五', '同意销毁');
assert(approved.status === 'approved', '审批状态为已批准');
assert(approved.reviewer === '王五', '审批人为王五');

const taskAfterApprove = db.findTask(t => t.id === tasks[0].id);
assert(taskAfterApprove.status === 'approved', '任务状态变为已批准');

console.log('\n--- 5. 完成销毁（照片回执）---');
const photos = [
  { fileName: 'destruction_before.jpg', filePath: '/tmp/destruction_before.jpg' },
  { fileName: 'destruction_after.jpg', filePath: '/tmp/destruction_after.jpg' }
];
const completion = completeDestruction(db, tasks[0].id, photos, '赵六');
assert(completion.status === 'completed', '销毁完成');
assert(completion.photoIds.length === 2, '上传了2张销毁照片');

const sampleAfterDestroy = db.findSample(s => s.id === sample1.id);
assert(sampleAfterDestroy.status === 'destroyed', '留样状态变为已销毁');

const savedPhotos = db.filterPhotos(p => p.task_id === tasks[0].id);
assert(savedPhotos.length === 2, '照片记录已保存');

console.log('\n--- 6. 历史记录验证（补录、撤回）---');
const sampleForHistory = createSample(db, {
  batch_no: 'BATCH-TEST-003',
  product_name: '布洛芬片',
  quantity: 20,
  unit: '片',
  sample_date: addDays(today, -90),
  retention_days: 90,
  storage_location: '留样柜-B1',
  operator: '测试员'
});

supplementSample(db, sampleForHistory.id, {
  quantity: 25,
  storage_location: '留样柜-B2'
}, '钱七', '发现之前数量登记错误');

withdrawSample(db, sampleForHistory.id, '钱七', '留样被污染，需重新留样');

const history = db.findHistory(h => h.sample_id === sampleForHistory.id).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
assert(history.length >= 3, '历史记录数量正确（创建+补录+撤回）');
assert(history.some(h => h.operation === 'supplement'), '补录操作有历史记录');
assert(history.some(h => h.operation === 'withdraw'), '撤回操作有历史记录');

console.log('\n--- 7. 异常延期 ---');
const tomorrow = addDays(today, 1);
const sampleForExtend = createSample(db, {
  batch_no: 'BATCH-TEST-004',
  product_name: '感冒药',
  quantity: 10,
  unit: '盒',
  sample_date: addDays(today, -365),
  retention_days: 360,
  storage_location: '留样柜-C1',
  operator: '测试员'
});

generateTasks(db, tomorrow);
const tasksForExtend = db.findTask(t => t.sample_id === sampleForExtend.id);

const extendedTask = extendTask(
  db,
  tasksForExtend.id,
  30,
  '需要等待质量投诉调查结果',
  '质检主管'
);

assert(extendedTask.is_extended === 1, '任务标记为已延期');
assert(extendedTask.extension_days === 30, '延期30天');
assert(extendedTask.extension_reason === '需要等待质量投诉调查结果', '延期原因已记录');

console.log('\n--- 8. 审计清单验证 ---');
const auditLogs = db.filterAuditLogs(() => true).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
const actions = new Set(auditLogs.map(l => l.action));

assert(actions.has('create'), '创建操作有审计记录');
assert(actions.has('task_created'), '任务创建有审计记录');
assert(actions.has('approval_submitted'), '审批提交有审计记录');
assert(actions.has('approval_approved'), '审批通过有审计记录');
assert(actions.has('photo_uploaded'), '照片上传有审计记录');
assert(actions.has('destruction_completed'), '销毁完成有审计记录');
assert(actions.has('supplement'), '补录有审计记录');
assert(actions.has('withdraw'), '撤回有审计记录');
assert(actions.has('task_extended'), '延期有审计记录');

console.log('\n--- 9. 重启后历史可查 ---');
const dbPath2 = path.join(__dirname, '../data/test_main.json');
const db2 = new Database(dbPath2);
const reloadedSample = db2.findSample(s => s.id === sample1.id);
assert(reloadedSample !== undefined, '重启后数据仍可加载');
assert(reloadedSample.status === 'destroyed', '重启后状态正确');

const reloadedHistory = db2.findHistory(h => h.sample_id === sampleForHistory.id);
assert(reloadedHistory.length >= 3, '重启后历史记录仍在');

console.log('\n=== 主流程测试通过 ===\n');

if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

console.log('所有测试通过 ✓');

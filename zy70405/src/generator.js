import { createObjectCsvWriter } from 'csv-writer';
import {
  OPERATORS,
  RISK_TYPES,
  VERSIONS,
  SYSTEMS,
  STATUS_FLOW,
  FAILURE_REASONS,
  APPROVERS,
  generateBatchId,
  generateRecordId,
  randomPick,
  randomDate
} from './models.js';
import fs from 'fs/promises';
import path from 'path';

function generateStatusHistory(baseStatus, includeReminder) {
  const history = [];
  
  // 定义状态的两个分支：成功分支和失败分支
  const successBranch = ['待审批', '审批中', '已批准', '待执行', '执行中', '已完成'];
  const failureBranch = ['待审批', '审批中', '已批准', '待执行', '执行中', '已失败'];
  const revertBranch = ['待审批', '审批中', '已撤回'];
  
  // 确定使用哪个分支
  let statusBranch;
  if (baseStatus === '已完成' || successBranch.indexOf(baseStatus) < 5) {
    statusBranch = successBranch;
  } else if (baseStatus === '已失败') {
    statusBranch = failureBranch;
  } else if (baseStatus === '已撤回') {
    statusBranch = revertBranch;
  } else {
    statusBranch = successBranch;
  }
  
  // 正常流程状态 - 按时间递增
  let currentTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7天前开始
  
  const baseIndex = statusBranch.indexOf(baseStatus);
  if (baseIndex === -1) {
    // 如果 baseStatus 不在分支中，直接返回基础状态
    history.push({
      status: baseStatus,
      timestamp: new Date().toISOString(),
      operator: randomPick(OPERATORS).name,
      remark: generateStatusRemark(baseStatus)
    });
    return {
      history: history,
      approverList: []
    };
  }
  
  // 生成正常流程状态，时间严格递增
  for (let i = 0; i <= baseIndex; i++) {
    const status = statusBranch[i];
    currentTime = new Date(currentTime.getTime() + Math.random() * 6 * 60 * 60 * 1000); // 每次增加0-6小时
    
    history.push({
      status: status,
      timestamp: currentTime.toISOString(),
      operator: randomPick(OPERATORS).name,
      remark: generateStatusRemark(status)
    });
  }

  // 添加催办记录（如果需要）
  let approverList = [];
  if (includeReminder && (baseStatus === '待审批' || baseStatus === '审批中')) {
    const reminderCount = Math.floor(Math.random() * 3) + 1;
    const selectedApprover = randomPick(APPROVERS).name;
    approverList.push(selectedApprover);
    
    for (let i = 0; i < reminderCount; i++) {
      // 催办时间在最后状态之后
      currentTime = new Date(currentTime.getTime() + Math.random() * 2 * 60 * 60 * 1000);
      
      history.push({
        status: '已催办',
        timestamp: currentTime.toISOString(),
        operator: randomPick(OPERATORS).name,
        remark: '第' + (i + 1) + '次催办 - 请' + selectedApprover + '尽快审批',
        approver: selectedApprover
      });
    }
    
    // 催办后回到原状态
    currentTime = new Date(currentTime.getTime() + Math.random() * 30 * 60 * 1000);
    history.push({
      status: baseStatus,
      timestamp: currentTime.toISOString(),
      operator: randomPick(OPERATORS).name,
      remark: generateStatusRemark(baseStatus)
    });
  }

  return {
    history: history,
    approverList: approverList
  };
}

function generateStatusRemark(status) {
  const remarks = {
    '待审批': '提交版本冻结申请',
    '审批中': '审批人已接收，正在审核',
    '已批准': '审批通过，可以执行冻结',
    '待执行': '等待执行窗口',
    '执行中': '正在执行版本冻结',
    '已完成': '版本冻结执行完成',
    '已失败': '执行失败，需要重试',
    '已撤回': '申请人撤回申请'
  };
  return remarks[status] || '';
}

function generateSingleRecord(batchId, isDirty) {
  const operator = randomPick(OPERATORS);
  const riskType = randomPick(RISK_TYPES);
  const system = randomPick(SYSTEMS);
  const version = randomPick(VERSIONS);
  const isFailed = Math.random() < 0.2;
  const isBoundary = Math.random() < 0.1;

  let status = isFailed ? '已失败' : randomPick(STATUS_FLOW.slice(0, 6));
  let failureReason = null;
  let failureDetail = null;

  if (isFailed) {
    failureReason = randomPick(FAILURE_REASONS);
    failureDetail = {
      errorCode: 'ERR-' + Math.floor(Math.random() * 1000),
      stackTrace: 'at ' + system + '.' + version + '.execute()',
      retryCount: Math.floor(Math.random() * 3)
    };
  }

  let actualVersion = version;
  let dirtyRemark = '';
  if (isDirty) {
    const versionIndex = VERSIONS.indexOf(version);
    if (versionIndex > 0) {
      actualVersion = VERSIONS[versionIndex - 1];
      dirtyRemark = '【脏数据】旧版本覆盖新版本';
      failureReason = '旧版本覆盖新版本';
      failureDetail = {
        errorCode: 'DIRTY-001',
        stackTrace: 'at ' + system + '.versionConflict()',
        retryCount: 0,
        expectedVersion: version,
        actualVersion: actualVersion
      };
      status = '已失败';
    } else {
      actualVersion = version;
      dirtyRemark = '【脏数据】版本无冲突但标记为脏数据';
      failureReason = '脏数据标记异常';
      failureDetail = {
        errorCode: 'DIRTY-002',
        message: '版本索引异常，无法降级'
      };
      status = '已失败';
    }
  }

  // 提高催办记录生成概率到 50%，确保有足够的复核样本
  const includeReminder = Math.random() < 0.5;
  const statusResult = generateStatusHistory(status, includeReminder);
  const statusHistory = statusResult.history;
  const approvers = statusResult.approverList;

  const record = {
    id: generateRecordId(),
    batchId: batchId,
    system: system,
    oldVersion: actualVersion,
    newVersion: version,
    freezeType: '过期版本冻结',
    riskType: riskType.code,
    riskName: riskType.name,
    operator: operator.name,
    operatorId: operator.id,
    department: operator.department,
    status: status,
    failureReason: isDirty ? '旧版本覆盖新版本' : failureReason,
    failureDetail: failureDetail,
    statusHistory: statusHistory,
    approverList: approvers,
    createTime: randomDate(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      new Date()
    ).toISOString(),
    updateTime: new Date().toISOString(),
    isDirty: isDirty,
    dirtyRemark: dirtyRemark,
    isBoundary: isBoundary,
    boundaryNote: isBoundary ? '边界输入：版本号格式异常' : '',
    description: system + ' 版本 ' + version + ' 冻结通知'
  };

  return record;
}

export async function generateRecords(count, dirtyRatio) {
  if (count === undefined) count = 100;
  if (dirtyRatio === undefined) dirtyRatio = 0.1;
  
  const batchId = generateBatchId();
  const records = [];
  const dirtyCount = Math.floor(count * dirtyRatio);
  const cleanCount = count - dirtyCount;

  for (let i = 0; i < cleanCount; i++) {
    records.push(generateSingleRecord(batchId, false));
  }

  for (let i = 0; i < dirtyCount; i++) {
    records.push(generateSingleRecord(batchId, true));
  }

  return {
    batchId: batchId,
    generateTime: new Date().toISOString(),
    totalCount: count,
    dirtyCount: dirtyCount,
    records: records
  };
}

export async function saveToCsv(data, outputPath) {
  const csvRecords = data.records.map(function(record) {
    return {
      ...record,
      statusHistory: JSON.stringify(record.statusHistory),
      failureDetail: record.failureDetail ? JSON.stringify(record.failureDetail) : '',
      approverList: JSON.stringify(record.approverList)
    };
  });

  const csvWriter = createObjectCsvWriter({
    path: outputPath,
    header: [
      { id: 'id', title: 'id' },
      { id: 'batchId', title: 'batchId' },
      { id: 'system', title: 'system' },
      { id: 'oldVersion', title: 'oldVersion' },
      { id: 'newVersion', title: 'newVersion' },
      { id: 'freezeType', title: 'freezeType' },
      { id: 'riskType', title: 'riskType' },
      { id: 'riskName', title: 'riskName' },
      { id: 'operator', title: 'operator' },
      { id: 'operatorId', title: 'operatorId' },
      { id: 'department', title: 'department' },
      { id: 'status', title: 'status' },
      { id: 'failureReason', title: 'failureReason' },
      { id: 'failureDetail', title: 'failureDetail' },
      { id: 'statusHistory', title: 'statusHistory' },
      { id: 'approverList', title: 'approverList' },
      { id: 'createTime', title: 'createTime' },
      { id: 'updateTime', title: 'updateTime' },
      { id: 'isDirty', title: 'isDirty' },
      { id: 'dirtyRemark', title: 'dirtyRemark' },
      { id: 'isBoundary', title: 'isBoundary' },
      { id: 'boundaryNote', title: 'boundaryNote' },
      { id: 'description', title: 'description' }
    ]
  });

  await csvWriter.writeRecords(csvRecords);
  return outputPath;
}

export async function saveFailures(data, outputPath) {
  const failureRecords = data.records
    .filter(function(r) { return r.status === '已失败' || r.isDirty; })
    .map(function(record) {
      return {
        ...record,
        statusHistory: JSON.stringify(record.statusHistory),
        failureDetail: record.failureDetail ? JSON.stringify(record.failureDetail) : '',
        approverList: JSON.stringify(record.approverList)
      };
    });

  if (failureRecords.length === 0) return null;

  const csvWriter = createObjectCsvWriter({
    path: outputPath,
    header: [
      { id: 'id', title: 'id' },
      { id: 'batchId', title: 'batchId' },
      { id: 'system', title: 'system' },
      { id: 'oldVersion', title: 'oldVersion' },
      { id: 'newVersion', title: 'newVersion' },
      { id: 'riskType', title: 'riskType' },
      { id: 'operator', title: 'operator' },
      { id: 'status', title: 'status' },
      { id: 'failureReason', title: 'failureReason' },
      { id: 'failureDetail', title: 'failureDetail' },
      { id: 'isDirty', title: 'isDirty' },
      { id: 'dirtyRemark', title: 'dirtyRemark' },
      { id: 'approverList', title: 'approverList' },
      { id: 'createTime', title: 'createTime' }
    ]
  });

  await csvWriter.writeRecords(failureRecords);
  return outputPath;
}

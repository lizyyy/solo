const consoleUtils = require('../utils/console');
const { Project } = require('../utils/project');

async function showHistory(projectName, options = {}) {
  const project = new Project(projectName);
  await project.load();

  consoleUtils.printHeader(`历史记录 - ${projectName}`);

  let entries = [];
  
  if (options.latest) {
    entries = project.history.getLatest(options.latest);
  } else if (options.operation) {
    entries = project.history.findByOperation(options.operation);
  } else if (options.screenshot) {
    entries = project.history.getScreenshotChanges();
  } else if (options.correction) {
    entries = project.history.getManualCorrections();
  } else if (options.target) {
    const [targetType, targetId] = options.target.split(':');
    entries = project.history.findByTarget(targetType, targetId);
  } else {
    entries = project.history.getLatest(20);
  }

  if (entries.length === 0) {
    consoleUtils.printInfo('没有历史记录');
    return true;
  }

  const rows = entries.map(entry => [
    new Date(entry.timestamp).toLocaleString(),
    entry.operation,
    entry.targetType,
    entry.description || '-',
    entry.operator
  ]);

  consoleUtils.printTable(
    ['时间', '操作', '类型', '描述', '操作人'],
    rows
  );

  consoleUtils.printInfo(`共 ${entries.length} 条记录`);
  consoleUtils.printInfo(`使用 "lp-review history ${projectName} --detail <记录ID>" 查看详情`);

  return true;
}

async function showHistoryDetail(projectName, entryId, options = {}) {
  const project = new Project(projectName);
  await project.load();

  const entry = project.history.entries.find(e => e.id === entryId);
  
  if (!entry) {
    consoleUtils.printError(`找不到历史记录: ${entryId}`);
    return false;
  }

  consoleUtils.printHeader(`历史记录详情 - ${entryId}`);

  consoleUtils.printSubHeader('基本信息');
  consoleUtils.printKeyValue('时间', new Date(entry.timestamp).toLocaleString());
  consoleUtils.printKeyValue('操作', entry.operation);
  consoleUtils.printKeyValue('目标类型', entry.targetType);
  consoleUtils.printKeyValue('目标ID', entry.targetId);
  consoleUtils.printKeyValue('操作人', entry.operator);
  consoleUtils.printKeyValue('描述', entry.description || '-');
  consoleUtils.printKeyValue('原因', entry.reason || '-');

  if (entry.diff && entry.diff.length > 0) {
    consoleUtils.printSubHeader('变更内容');
    consoleUtils.printDiff(entry.diff);
  }

  if (options.full) {
    if (entry.beforeState) {
      consoleUtils.printSubHeader('变更前状态');
      console.log(JSON.stringify(entry.beforeState, null, 2));
    }
    if (entry.afterState) {
      consoleUtils.printSubHeader('变更后状态');
      console.log(JSON.stringify(entry.afterState, null, 2));
    }
  }

  return true;
}

async function showScreenshotHistory(projectName, options = {}) {
  const project = new Project(projectName);
  await project.load();

  consoleUtils.printHeader(`讲义截图变更历史 - ${projectName}`);

  const entries = project.history.getScreenshotChanges();
  
  if (entries.length === 0) {
    consoleUtils.printInfo('没有讲义截图变更记录');
    return true;
  }

  const rows = entries.map(entry => {
    const beforeNote = entry.beforeState?.screenshotNote || '(空)';
    const afterNote = entry.afterState?.screenshotNote || '(空)';
    return [
      new Date(entry.timestamp).toLocaleString(),
      entry.targetType,
      entry.operator,
      beforeNote.substring(0, 30) + (beforeNote.length > 30 ? '...' : ''),
      afterNote.substring(0, 30) + (afterNote.length > 30 ? '...' : '')
    ];
  });

  consoleUtils.printTable(
    ['时间', '分段', '操作人', '变更前', '变更后'],
    rows
  );

  for (const entry of entries) {
    consoleUtils.printSubHeader(`[${new Date(entry.timestamp).toLocaleString()}] ${entry.operator}`);
    consoleUtils.printKeyValue('分段ID', entry.targetId);
    
    const section = project.reviewScript.sections.find(s => s.id === entry.targetId);
    if (section) {
      consoleUtils.printKeyValue('分段标题', section.title);
      consoleUtils.printKeyValue('知识点', section.knowledgePoint);
    }
    
    consoleUtils.printKeyValue('变更前', entry.beforeState?.screenshotNote || '(空)');
    consoleUtils.printKeyValue('变更后', entry.afterState?.screenshotNote || '(空)');
    consoleUtils.printKeyValue('变更原因', entry.reason || entry.description || '-');
    
    if (entry.diff && entry.diff.length > 0) {
      console.log();
      consoleUtils.printDiff(entry.diff);
    }
    console.log();
  }

  consoleUtils.printInfo(`共 ${entries.length} 条截图变更记录`);
  consoleUtils.printInfo('所有变更均已留痕，可用于回溯前后变化');

  return true;
}

async function showCorrectionHistory(projectName, options = {}) {
  const project = new Project(projectName);
  await project.load();

  consoleUtils.printHeader(`手动改判历史 - ${projectName}`);

  const entries = project.history.getManualCorrections();
  
  if (entries.length === 0) {
    consoleUtils.printInfo('没有手动改判记录');
    return true;
  }

  const rows = entries.map(entry => {
    const before = entry.beforeState?.finalJudgment || '-';
    const after = entry.afterState?.finalJudgment || '-';
    const record = project.mistakeCollection.records.find(r => r.id === entry.targetId);
    return [
      new Date(entry.timestamp).toLocaleString(),
      record ? record.questionNo : '-',
      record ? record.studentName || record.studentId : '-',
      before,
      after,
      entry.operator
    ];
  });

  consoleUtils.printTable(
    ['时间', '题号', '学生', '改判前', '改判后', '操作人'],
    rows
  );

  consoleUtils.printInfo(`共 ${entries.length} 条手动改判记录`);

  return true;
}

async function compareVersions(projectName, options = {}) {
  const project = new Project(projectName);
  await project.load();

  consoleUtils.printHeader(`版本对比 - ${projectName}`);

  const records = project.mistakeCollection.records.filter(r => r.manualOverride !== null);
  
  if (records.length === 0) {
    consoleUtils.printInfo('没有手动改判记录，无需对比');
    return true;
  }

  consoleUtils.printSubHeader('改判明细对比');
  
  const rows = [];
  for (const record of records) {
    const question = project.questionBank.findByNo(record.questionNo);
    const history = project.history.findByTarget('mistake', record.id);
    const lastCorrection = history.find(h => h.operation === 'manual_correction');
    
    rows.push([
      record.questionNo,
      record.studentName || record.studentId,
      record.studentAnswer,
      question ? question.standardAnswer : '-',
      record.originalJudgment,
      record.finalJudgment,
      lastCorrection ? new Date(lastCorrection.timestamp).toLocaleString() : '-',
      lastCorrection?.reason || '-'
    ]);
  }

  consoleUtils.printTable(
    ['题号', '学生', '学生答案', '标准答案', '原始', '最终', '改判时间', '原因'],
    rows
  );

  const correctCount = records.filter(r => r.finalJudgment === 'correct').length;
  consoleUtils.printInfo(`共 ${records.length} 条改判记录，其中 ${correctCount} 条改判为正确`);
  consoleUtils.printInfo('讲评稿导出时将使用最终判定结果，确保数据一致');

  return true;
}

module.exports = {
  showHistory,
  showHistoryDetail,
  showScreenshotHistory,
  showCorrectionHistory,
  compareVersions
};

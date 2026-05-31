const consoleUtils = require('../utils/console');
const anomalyUtils = require('../utils/anomaly');
const { Project } = require('../utils/project');

async function runAutoReview(projectName, options = {}) {
  const project = new Project(projectName);
  await project.load();

  consoleUtils.printHeader(`自动复核 - ${projectName}`);

  if (project.questionBank.questions.length === 0) {
    consoleUtils.printError('请先导入题库表');
    return false;
  }

  if (project.mistakeCollection.records.length === 0) {
    consoleUtils.printError('请先导入学生错题');
    return false;
  }

  const stats = {
    total: 0,
    exactMatch: 0,
    equivalentMatch: 0,
    noMatch: 0,
    anomalies: 0,
    reviewed: 0
  };

  for (const record of project.mistakeCollection.records) {
    stats.total++;
    const question = project.questionBank.findByNo(record.questionNo);
    
    if (!question) {
      consoleUtils.printWarning(`第${record.questionNo}题不存在于题库中，跳过`);
      continue;
    }

    const beforeState = JSON.parse(JSON.stringify(record.toJSON()));
    const checkResult = question.checkAnswer(record.studentAnswer);

    if (checkResult.matchType === 'exact') {
      stats.exactMatch++;
    } else if (checkResult.matchType === 'equivalent') {
      stats.equivalentMatch++;
    } else {
      stats.noMatch++;
    }

    const anomalies = anomalyUtils.detectAnomaly(question, record, checkResult);
    if (anomalies.length > 0) {
      stats.anomalies += anomalies.length;
      const reasons = anomalies.map(a => `${a.type.code}: ${a.type.name}`).join('; ');
      record.flagAnomaly(reasons);
    } else {
      record.clearAnomaly();
    }

    if (checkResult.correct && record.originalJudgment === 'wrong') {
      record.setFinalJudgment('correct', `系统复核: ${checkResult.matchType === 'equivalent' ? '等价答案匹配' : '精确匹配'}`);
      stats.reviewed++;

      const afterState = JSON.parse(JSON.stringify(record.toJSON()));
      project.recordHistory(
        'auto_correction',
        'mistake',
        record.id,
        beforeState,
        afterState,
        'system',
        `自动复核判定正确，匹配类型: ${checkResult.matchType}`
      );
    } else if (!checkResult.correct && record.originalJudgment === 'wrong') {
      record.reviewStatus = 'reviewed';
      stats.reviewed++;
      record.updatedAt = new Date().toISOString();

      const afterState = JSON.parse(JSON.stringify(record.toJSON()));
      project.recordHistory(
        'auto_review',
        'mistake',
        record.id,
        beforeState,
        afterState,
        'system',
        '自动复核确认错误'
      );
    }
  }

  await project.save();

  consoleUtils.printSubHeader('复核结果');
  consoleUtils.printKeyValue('总记录数', stats.total);
  consoleUtils.printKeyValue('精确匹配', stats.exactMatch);
  consoleUtils.printKeyValue('等价匹配', stats.equivalentMatch);
  consoleUtils.printKeyValue('不匹配', stats.noMatch);
  consoleUtils.printKeyValue('异常标记', stats.anomalies);
  consoleUtils.printKeyValue('已完成复核', stats.reviewed);
  consoleUtils.printKeyValue('复核进度', `${Math.round((stats.reviewed / stats.total) * 100)}%`);

  if (stats.anomalies > 0) {
    consoleUtils.printInfo(`发现 ${stats.anomalies} 个异常，请运行 "lp-review anomalies ${projectName}" 查看详情`);
  }

  return true;
}

async function showAnomalies(projectName, options = {}) {
  const project = new Project(projectName);
  await project.load();

  consoleUtils.printHeader(`异常记录 - ${projectName}`);

  const anomalies = project.mistakeCollection.getAnomalies();
  
  if (anomalies.length === 0) {
    consoleUtils.printSuccess('没有异常记录');
    return true;
  }

  const rows = [];
  for (const record of anomalies) {
    const question = project.questionBank.findByNo(record.questionNo);
    const checkResult = question ? question.checkAnswer(record.studentAnswer) : null;
    
    rows.push([
      record.questionNo,
      record.studentName || record.studentId,
      record.studentAnswer,
      question ? question.standardAnswer : '-',
      record.anomalyReason,
      record.reviewStatus
    ]);

    if (options.detail) {
      consoleUtils.printSubHeader(`第${record.questionNo}题 - ${record.studentName || record.studentId}`);
      consoleUtils.printKeyValue('学生答案', record.studentAnswer);
      consoleUtils.printKeyValue('标准答案', question ? question.standardAnswer : '-');
      consoleUtils.printKeyValue('匹配类型', checkResult ? checkResult.matchType : '-');
      consoleUtils.printKeyValue('原始判定', record.originalJudgment);
      consoleUtils.printKeyValue('最终判定', record.finalJudgment);
      consoleUtils.printKeyValue('异常原因', record.anomalyReason);
      consoleUtils.printKeyValue('教师备注', record.teacherNotes || '无');
      
      if (checkResult && checkResult.matchType === 'equivalent') {
        consoleUtils.printKeyValue('匹配的等价答案', checkResult.matchedAnswer);
      }
      console.log();
    }
  }

  if (!options.detail) {
    consoleUtils.printTable(
      ['题号', '学生', '学生答案', '标准答案', '异常原因', '状态'],
      rows
    );
  }

  consoleUtils.printInfo(`共 ${anomalies.length} 条异常记录`);
  consoleUtils.printInfo(`使用 "lp-review correct ${projectName} --question <题号> --student <学生ID>" 进行修正`);

  return true;
}

async function showPendingReview(projectName, options = {}) {
  const project = new Project(projectName);
  await project.load();

  consoleUtils.printHeader(`待复核记录 - ${projectName}`);

  const pending = project.mistakeCollection.getPendingReview();
  
  if (pending.length === 0) {
    consoleUtils.printSuccess('所有记录已完成复核');
    return true;
  }

  const stats = project.mistakeCollection.getStatistics();
  consoleUtils.printProgress('复核进度', stats.reviewed, stats.total);
  console.log();

  const rows = pending.map(record => [
    record.questionNo,
    record.studentName || record.studentId,
    record.studentAnswer,
    record.originalJudgment,
    record.anomalyFlag ? '是' : '否'
  ]);

  consoleUtils.printTable(
    ['题号', '学生', '学生答案', '原始判定', '异常'],
    rows
  );

  consoleUtils.printInfo(`共 ${pending.length} 条待复核记录`);

  return true;
}

async function showStatus(projectName, options = {}) {
  const project = new Project(projectName);
  await project.load();

  consoleUtils.printHeader(`项目状态 - ${projectName}`);

  const status = project.getStatus();

  consoleUtils.printSubHeader('基本信息');
  consoleUtils.printKeyValue('项目名称', status.name);
  consoleUtils.printKeyValue('题目数量', status.questionCount);
  consoleUtils.printKeyValue('错题记录数', status.mistakeCount);
  consoleUtils.printKeyValue('知识点数', status.knowledgePoints.length);
  consoleUtils.printKeyValue('讲评分段数', status.sectionCount);
  consoleUtils.printKeyValue('历史记录数', status.historyCount);
  consoleUtils.printKeyValue('当前版本', status.version);

  consoleUtils.printSubHeader('复核进度');
  const stats = status.statistics;
  consoleUtils.printProgress('总体进度', stats.reviewed, stats.total);
  consoleUtils.printKeyValue('待复核', stats.pending);
  consoleUtils.printKeyValue('已复核', stats.reviewed);
  consoleUtils.printKeyValue('异常记录', stats.anomalies);
  consoleUtils.printKeyValue('手动改判正确', stats.correctOverride);

  if (status.lastReviewedAt) {
    consoleUtils.printKeyValue('上次复核时间', new Date(status.lastReviewedAt).toLocaleString());
  }
  if (status.lastExportedAt) {
    consoleUtils.printKeyValue('上次导出时间', new Date(status.lastExportedAt).toLocaleString());
  }

  consoleUtils.printSubHeader('知识点列表');
  status.knowledgePoints.forEach((kp, i) => {
    const questions = project.questionBank.findByKnowledgePoint(kp);
    const qNos = questions.map(q => q.questionNo).join(', ');
    consoleUtils.printKeyValue(`${i + 1}. ${kp}`, `题目: ${qNos}`);
  });

  const consistency = project.validateConsistency();
  if (!consistency.valid) {
    consoleUtils.printSubHeader('一致性检查');
    consistency.issues.forEach(issue => {
      if (issue.severity === 'warning') {
        consoleUtils.printWarning(issue.message);
      } else {
        consoleUtils.printInfo(issue.message);
      }
    });
  }

  return true;
}

async function showAnomalyExplain(code) {
  const type = anomalyUtils.getAnomalyType(code);
  
  if (!type) {
    consoleUtils.printError(`未知的异常代码: ${code}`);
    const allCodes = Object.values(anomalyUtils.ANOMALY_TYPES).map(t => `${t.code} - ${t.name}`).join('\n  ');
    consoleUtils.printInfo(`可用的异常代码:\n  ${allCodes}`);
    return false;
  }

  consoleUtils.printHeader(`异常说明 - ${type.code}`);
  consoleUtils.printKeyValue('名称', type.name);
  consoleUtils.printKeyValue('描述', type.description);
  consoleUtils.printKeyValue('详细说明', type.explanation);

  return true;
}

module.exports = {
  runAutoReview,
  showAnomalies,
  showPendingReview,
  showStatus,
  showAnomalyExplain
};

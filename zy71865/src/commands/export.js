const path = require('path');
const storage = require('../utils/storage');
const consoleUtils = require('../utils/console');
const { Project } = require('../utils/project');

async function exportReviewScript(projectName, options = {}) {
  const project = new Project(projectName);
  await project.load();

  consoleUtils.printHeader(`导出讲评稿 - ${projectName}`);

  const consistency = project.validateConsistency();
  
  consoleUtils.printSubHeader('导出前一致性检查');
  if (consistency.summary.warnings > 0) {
    consoleUtils.printWarning(`发现 ${consistency.summary.warnings} 个警告`);
  }
  if (consistency.summary.infos > 0) {
    consoleUtils.printInfo(`发现 ${consistency.summary.infos} 个提示`);
  }
  consistency.issues.forEach(issue => {
    if (issue.severity === 'warning') {
      consoleUtils.printWarning(`  - ${issue.message}`);
    } else {
      consoleUtils.printInfo(`  - ${issue.message}`);
    }
  });

  if (!options.force && consistency.summary.warnings > 0) {
    consoleUtils.printError('存在一致性警告，请先处理或使用 --force 参数强制导出');
    return false;
  }

  const stats = project.mistakeCollection.getStatistics();
  if (stats.pending > 0 && !options.force) {
    consoleUtils.printError(`还有 ${stats.pending} 条记录未复核，请先完成复核或使用 --force 参数强制导出`);
    return false;
  }

  if (project.reviewScript.sections.length === 0) {
    consoleUtils.printInfo('讲评稿尚未生成分段，将自动按知识点生成分段');
    generateAutoSections(project);
  }

  const beforeState = JSON.parse(JSON.stringify(project.reviewScript.toJSON()));
  project.reviewScript.markAsExported();
  const afterState = JSON.parse(JSON.stringify(project.reviewScript.toJSON()));
  project.recordHistory(
    'export',
    'reviewScript',
    project.reviewScript.id,
    beforeState,
    afterState,
    options.operator || 'teacher',
    `导出版本 ${project.reviewScript.metadata.version}`
  );

  await project.save();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const version = project.reviewScript.metadata.version;

  const mdContent = project.reviewScript.toMarkdown(project.questionBank, project.mistakeCollection);
  const mdFileName = `${projectName}-review-script-v${version}-${timestamp}.md`;
  const mdFilePath = storage.getFilePath('exports', mdFileName);
  storage.writeFile(mdFilePath, mdContent);
  consoleUtils.printSuccess(`讲评稿已导出: ${mdFilePath}`);

  const detailData = generateExportDetail(project);
  const detailFileName = `${projectName}-export-detail-v${version}-${timestamp}.json`;
  const detailFilePath = storage.getFilePath('exports', detailFileName);
  storage.writeJson(detailFilePath, detailData);
  consoleUtils.printSuccess(`明细数据已导出: ${detailFilePath}`);

  const consistencyReport = generateConsistencyReport(project, consistency);
  const reportFileName = `${projectName}-consistency-report-v${version}-${timestamp}.json`;
  const reportFilePath = storage.getFilePath('exports', reportFileName);
  storage.writeJson(reportFilePath, consistencyReport);
  consoleUtils.printSuccess(`一致性报告已导出: ${reportFilePath}`);

  consoleUtils.printSubHeader('导出摘要');
  consoleUtils.printKeyValue('讲评稿版本', `v${version}`);
  consoleUtils.printKeyValue('分段数量', project.reviewScript.sections.length);
  consoleUtils.printKeyValue('复核完成度', `${stats.progress}%`);
  consoleUtils.printKeyValue('手动改判数', stats.correctOverride);
  consoleUtils.printKeyValue('异常记录数', stats.anomalies);
  consoleUtils.printKeyValue('导出时间', new Date().toLocaleString());

  return true;
}

function generateAutoSections(project) {
  const knowledgePoints = project.questionBank.getAllKnowledgePoints();
  
  for (const kp of knowledgePoints) {
    const questions = project.questionBank.findByKnowledgePoint(kp);
    const qNos = questions.map(q => q.questionNo);
    
    const mistakesByQ = {};
    qNos.forEach(qNo => {
      mistakesByQ[qNo] = project.mistakeCollection.findByQuestionNo(qNo);
    });

    const commonMistakes = [];
    const errorTypes = new Set();
    
    qNos.forEach(qNo => {
      const mistakes = mistakesByQ[qNo];
      mistakes.forEach(m => {
        if (m.errorType) errorTypes.add(m.errorType);
        if (m.errorAnalysis && !commonMistakes.includes(m.errorAnalysis)) {
          commonMistakes.push(m.errorAnalysis);
        }
      });
    });

    project.reviewScript.addSection({
      knowledgePoint: kp,
      title: kp,
      questionNos: qNos,
      commonMistakes: commonMistakes.slice(0, 5),
      teachingPoints: Array.from(errorTypes).map(t => `加强${t}相关训练`)
    });
  }
}

function generateExportDetail(project) {
  const detail = {
    metadata: {
      projectName: project.name,
      exportTime: new Date().toISOString(),
      version: project.reviewScript.metadata.version,
      reviewer: project.reviewScript.metadata.reviewer
    },
    statistics: project.mistakeCollection.getStatistics(),
    questions: [],
    mistakes: [],
    reviewSections: []
  };

  for (const question of project.questionBank.questions) {
    const mistakes = project.mistakeCollection.findByQuestionNo(question.questionNo);
    const wrongCount = mistakes.filter(m => m.finalJudgment === 'wrong').length;
    const correctCount = mistakes.filter(m => m.finalJudgment === 'correct').length;
    
    detail.questions.push({
      questionNo: question.questionNo,
      content: question.content,
      standardAnswer: question.standardAnswer,
      equivalentAnswers: question.equivalentAnswers,
      knowledgePoint: question.knowledgePoint,
      score: question.score,
      totalStudents: mistakes.length,
      wrongCount,
      correctCount,
      errorRate: mistakes.length > 0 ? Math.round((wrongCount / mistakes.length) * 100) + '%' : '0%'
    });
  }

  for (const record of project.mistakeCollection.records) {
    detail.mistakes.push({
      questionNo: record.questionNo,
      studentId: record.studentId,
      studentName: record.studentName,
      studentAnswer: record.studentAnswer,
      originalJudgment: record.originalJudgment,
      finalJudgment: record.finalJudgment,
      manualOverride: record.manualOverride,
      errorType: record.errorType,
      errorAnalysis: record.errorAnalysis,
      teacherNotes: record.teacherNotes,
      reviewStatus: record.reviewStatus,
      anomalyFlag: record.anomalyFlag,
      anomalyReason: record.anomalyReason
    });
  }

  for (const section of project.reviewScript.sections) {
    detail.reviewSections.push({
      knowledgePoint: section.knowledgePoint,
      title: section.title,
      summary: section.summary,
      questionNos: section.questionNos,
      commonMistakes: section.commonMistakes,
      teachingPoints: section.teachingPoints,
      screenshotNote: section.screenshotNote,
      teacherNotes: section.teacherNotes
    });
  }

  return detail;
}

function generateConsistencyReport(project, consistency) {
  return {
    projectName: project.name,
    reportTime: new Date().toISOString(),
    version: project.reviewScript.metadata.version,
    valid: consistency.valid,
    issues: consistency.issues,
    summary: consistency.summary,
    dataConsistency: {
      questionCount: project.questionBank.questions.length,
      mistakeCount: project.mistakeCollection.records.length,
      sectionCount: project.reviewScript.sections.length,
      questionNosInMistakes: [...new Set(project.mistakeCollection.records.map(r => r.questionNo))].length,
      questionNosInSections: [...new Set(project.reviewScript.sections.flatMap(s => s.questionNos))].length
    },
    reviewStatus: project.mistakeCollection.getStatistics(),
    screenshotChanges: project.history.getScreenshotChanges().length,
    manualCorrections: project.history.getManualCorrections().length
  };
}

async function exportMistakeDetail(projectName, options = {}) {
  const project = new Project(projectName);
  await project.load();

  consoleUtils.printHeader(`导出错题明细 - ${projectName}`);

  const { question, student } = options;
  
  let records = [...project.mistakeCollection.records];
  
  if (question) {
    records = records.filter(r => r.questionNo == question);
  }
  if (student) {
    records = records.filter(r => r.studentId === student || r.studentName === student);
  }

  if (records.length === 0) {
    consoleUtils.printError('没有符合条件的记录');
    return false;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${projectName}-mistake-detail${question ? '-q' + question : ''}${student ? '-s' + student : ''}-${timestamp}.json`;
  const filePath = storage.getFilePath('exports', fileName);

  const exportData = {
    exportTime: new Date().toISOString(),
    filter: { question, student },
    total: records.length,
    records: records.map(r => {
      const question = project.questionBank.findByNo(r.questionNo);
      return {
        questionNo: r.questionNo,
        questionContent: question ? question.content : '-',
        standardAnswer: question ? question.standardAnswer : '-',
        studentId: r.studentId,
        studentName: r.studentName,
        studentAnswer: r.studentAnswer,
        originalJudgment: r.originalJudgment,
        finalJudgment: r.finalJudgment,
        manualOverride: r.manualOverride,
        errorType: r.errorType,
        errorAnalysis: r.errorAnalysis,
        teacherNotes: r.teacherNotes,
        reviewStatus: r.reviewStatus,
        anomalyFlag: r.anomalyFlag,
        anomalyReason: r.anomalyReason,
        history: project.history.findByTarget('mistake', r.id).map(h => ({
          time: h.timestamp,
          operation: h.operation,
          description: h.description,
          operator: h.operator,
          reason: h.reason
        }))
      };
    })
  };

  storage.writeJson(filePath, exportData);
  consoleUtils.printSuccess(`错题明细已导出: ${filePath}`);
  consoleUtils.printKeyValue('记录数量', records.length);

  return true;
}

async function preExportCheck(projectName, options = {}) {
  const project = new Project(projectName);
  await project.load();

  consoleUtils.printHeader(`导出前检查 - ${projectName}`);

  let passed = true;

  consoleUtils.printSubHeader('1. 复核进度检查');
  const stats = project.mistakeCollection.getStatistics();
  consoleUtils.printProgress('复核进度', stats.reviewed, stats.total);
  if (stats.pending > 0) {
    consoleUtils.printWarning(`还有 ${stats.pending} 条记录未复核`);
    passed = false;
  } else {
    consoleUtils.printSuccess('所有记录已完成复核');
  }

  consoleUtils.printSubHeader('2. 异常记录检查');
  const anomalies = project.mistakeCollection.getAnomalies();
  if (anomalies.length > 0) {
    consoleUtils.printWarning(`存在 ${anomalies.length} 条异常记录，请先处理`);
    anomalies.forEach(a => {
      consoleUtils.printInfo(`  - 第${a.questionNo}题 ${a.studentName || a.studentId}: ${a.anomalyReason}`);
    });
    passed = false;
  } else {
    consoleUtils.printSuccess('没有异常记录');
  }

  consoleUtils.printSubHeader('3. 数据一致性检查');
  const consistency = project.validateConsistency();
  if (consistency.summary.warnings > 0) {
    consoleUtils.printWarning(`存在 ${consistency.summary.warnings} 个一致性警告`);
    consistency.issues.filter(i => i.severity === 'warning').forEach(i => {
      consoleUtils.printInfo(`  - ${i.message}`);
    });
    passed = false;
  } else {
    consoleUtils.printSuccess('数据一致性检查通过');
  }

  consoleUtils.printSubHeader('4. 讲评稿完整性检查');
  if (project.reviewScript.sections.length === 0) {
    consoleUtils.printWarning('讲评稿尚未生成分段，导出时将自动生成');
  } else {
    consoleUtils.printSuccess(`讲评稿已有 ${project.reviewScript.sections.length} 个分段`);
  }

  const kps = project.questionBank.getAllKnowledgePoints();
  const sectionKps = new Set(project.reviewScript.sections.map(s => s.knowledgePoint));
  const missingKps = kps.filter(kp => !sectionKps.has(kp));
  if (missingKps.length > 0) {
    consoleUtils.printWarning(`以下知识点尚未创建讲评分段: ${missingKps.join(', ')}`);
  }

  consoleUtils.printSubHeader('检查结果');
  if (passed) {
    consoleUtils.printSuccess('所有检查通过，可以安全导出');
  } else {
    consoleUtils.printWarning('存在未处理的问题，建议先处理后再导出');
    consoleUtils.printInfo('如确认导出，可使用 --force 参数强制导出');
  }

  return passed;
}

module.exports = {
  exportReviewScript,
  exportMistakeDetail,
  preExportCheck
};

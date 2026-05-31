const consoleUtils = require('../utils/console');
const { Project } = require('../utils/project');

async function correctMistake(projectName, options = {}) {
  const project = new Project(projectName);
  await project.load();

  consoleUtils.printHeader(`手动修正 - ${projectName}`);

  const { question, student, judgment, reason, notes } = options;

  if (!question) {
    consoleUtils.printError('请指定题号: --question <题号>');
    return false;
  }

  let records = project.mistakeCollection.findByQuestionNo(question);
  
  if (student) {
    records = records.filter(r => r.studentId === student || r.studentName === student);
  }

  if (records.length === 0) {
    consoleUtils.printError(`找不到符合条件的错题记录`);
    return false;
  }

  const questionObj = project.questionBank.findByNo(question);

  for (const record of records) {
    const beforeState = JSON.parse(JSON.stringify(record.toJSON()));

    consoleUtils.printSubHeader(`处理: 第${question}题 - ${record.studentName || record.studentId}`);
    consoleUtils.printKeyValue('学生答案', record.studentAnswer);
    consoleUtils.printKeyValue('标准答案', questionObj ? questionObj.standardAnswer : '-');
    consoleUtils.printKeyValue('原始判定', record.originalJudgment);
    consoleUtils.printKeyValue('当前判定', record.finalJudgment);
    consoleUtils.printKeyValue('异常标记', record.anomalyFlag ? `是 (${record.anomalyReason})` : '否');

    if (judgment) {
      record.setFinalJudgment(judgment, reason || '手动修正');
      
      if (record.anomalyFlag) {
        record.clearAnomaly();
      }

      const afterState = JSON.parse(JSON.stringify(record.toJSON()));
      project.recordHistory(
        'manual_correction',
        'mistake',
        record.id,
        beforeState,
        afterState,
        options.operator || 'teacher',
        reason || '手动修正判定结果'
      );

      consoleUtils.printSuccess(`已修正为: ${judgment}`);
    }

    if (notes) {
      record.teacherNotes = record.teacherNotes 
        ? `${record.teacherNotes}\n${new Date().toLocaleString()}: ${notes}`
        : `${new Date().toLocaleString()}: ${notes}`;
      record.updatedAt = new Date().toISOString();

      const afterState = JSON.parse(JSON.stringify(record.toJSON()));
      project.recordHistory(
        'update_notes',
        'mistake',
        record.id,
        beforeState,
        afterState,
        options.operator || 'teacher',
        '补充教师备注'
      );

      consoleUtils.printSuccess('已补充备注');
    }

    if (options.errorType) {
      record.errorType = options.errorType;
      record.updatedAt = new Date().toISOString();
      consoleUtils.printSuccess(`已设置错误类型: ${options.errorType}`);
    }

    if (options.errorAnalysis) {
      record.errorAnalysis = options.errorAnalysis;
      record.updatedAt = new Date().toISOString();
      consoleUtils.printSuccess('已设置错误分析');
    }
  }

  await project.save();
  consoleUtils.printSuccess(`共处理 ${records.length} 条记录`);

  return true;
}

async function updateQuestion(projectName, questionNo, options = {}) {
  const project = new Project(projectName);
  await project.load();

  consoleUtils.printHeader(`更新题目 - ${projectName} 第${questionNo}题`);

  const question = project.questionBank.findByNo(questionNo);
  if (!question) {
    consoleUtils.printError(`找不到第${questionNo}题`);
    return false;
  }

  const beforeState = JSON.parse(JSON.stringify(question.toJSON()));

  if (options.standardAnswer) {
    question.standardAnswer = options.standardAnswer;
    consoleUtils.printSuccess('已更新标准答案');
  }

  if (options.equivalentAnswer) {
    const answers = Array.isArray(options.equivalentAnswer) 
      ? options.equivalentAnswer 
      : [options.equivalentAnswer];
    question.equivalentAnswers = [...new Set([...question.equivalentAnswers, ...answers])];
    consoleUtils.printSuccess(`已添加等价答案: ${answers.join(', ')}`);
  }

  if (options.removeEquivalentAnswer) {
    const answers = Array.isArray(options.removeEquivalentAnswer)
      ? options.removeEquivalentAnswer
      : [options.removeEquivalentAnswer];
    question.equivalentAnswers = question.equivalentAnswers.filter(a => !answers.includes(a));
    consoleUtils.printSuccess(`已移除等价答案: ${answers.join(', ')}`);
  }

  if (options.notes) {
    question.notes = options.notes;
    consoleUtils.printSuccess('已更新题目备注');
  }

  if (options.knowledgePoint) {
    question.knowledgePoint = options.knowledgePoint;
    consoleUtils.printSuccess(`已更新知识点: ${options.knowledgePoint}`);
  }

  question.updatedAt = new Date().toISOString();

  const afterState = JSON.parse(JSON.stringify(question.toJSON()));
  project.recordHistory(
    'update',
    'question',
    question.id,
    beforeState,
    afterState,
    options.operator || 'teacher',
    '更新题目信息'
  );

  await project.save();
  return true;
}

async function updateReviewSection(projectName, options = {}) {
  const project = new Project(projectName);
  await project.load();

  consoleUtils.printHeader(`更新讲评稿 - ${projectName}`);

  const { knowledgePoint, title, summary, commonMistakes, teachingPoints, screenshotNote, teacherNotes } = options;

  if (!knowledgePoint) {
    consoleUtils.printError('请指定知识点: --knowledge-point <知识点>');
    return false;
  }

  let section = project.reviewScript.findSectionByKnowledgePoint(knowledgePoint);
  const beforeState = section ? JSON.parse(JSON.stringify(section.toJSON())) : null;

  if (!section) {
    section = project.reviewScript.addSection({
      knowledgePoint,
      title: title || knowledgePoint,
      questionNos: project.questionBank.findByKnowledgePoint(knowledgePoint).map(q => q.questionNo)
    });
    consoleUtils.printSuccess(`已创建新分段: ${knowledgePoint}`);
  }

  if (title) {
    section.title = title;
  }
  if (summary) {
    section.summary = summary;
  }
  if (commonMistakes) {
    const mistakes = Array.isArray(commonMistakes) ? commonMistakes : [commonMistakes];
    section.commonMistakes = mistakes;
  }
  if (teachingPoints) {
    const points = Array.isArray(teachingPoints) ? teachingPoints : [teachingPoints];
    section.teachingPoints = points;
  }
  if (screenshotNote) {
    const desc = beforeState && beforeState.screenshotNote !== screenshotNote ? '更新讲义截图备注' : '设置讲义截图备注';
    section.screenshotNote = screenshotNote;
    
    const afterState = JSON.parse(JSON.stringify(section.toJSON()));
    project.recordHistory(
      'update',
      'section',
      section.id,
      beforeState || {},
      afterState,
      options.operator || 'teacher',
      `${desc}: ${screenshotNote.substring(0, 50)}...`
    );
    
    consoleUtils.printSuccess('已更新截图备注');
  }
  if (teacherNotes) {
    section.teacherNotes = teacherNotes;
  }

  section.updatedAt = new Date().toISOString();

  const afterState = JSON.parse(JSON.stringify(section.toJSON()));
  if (!screenshotNote) {
    project.recordHistory(
      'update',
      'section',
      section.id,
      beforeState || {},
      afterState,
      options.operator || 'teacher',
      '更新讲评分段'
    );
  }

  await project.save();
  consoleUtils.printSuccess(`已更新分段: ${section.title}`);

  return true;
}

async function updateReviewMeta(projectName, options = {}) {
  const project = new Project(projectName);
  await project.load();

  consoleUtils.printHeader(`更新讲评稿元数据 - ${projectName}`);

  const beforeState = JSON.parse(JSON.stringify(project.reviewScript.toJSON()));

  if (options.title) {
    project.reviewScript.metadata.title = options.title;
  }
  if (options.examName) {
    project.reviewScript.metadata.examName = options.examName;
  }
  if (options.className) {
    project.reviewScript.metadata.className = options.className;
  }
  if (options.reviewer) {
    project.reviewScript.metadata.reviewer = options.reviewer;
  }
  if (options.overallAnalysis) {
    project.reviewScript.overallAnalysis = options.overallAnalysis;
  }
  if (options.suggestions) {
    project.reviewScript.suggestions = options.suggestions;
  }

  project.reviewScript.metadata.updatedAt = new Date().toISOString();

  const afterState = JSON.parse(JSON.stringify(project.reviewScript.toJSON()));
  project.recordHistory(
    'update',
    'reviewScript',
    project.reviewScript.id,
    beforeState,
    afterState,
    options.operator || 'teacher',
    '更新讲评稿元数据'
  );

  await project.save();
  consoleUtils.printSuccess('已更新讲评稿元数据');

  return true;
}

async function markReviewed(projectName, options = {}) {
  const project = new Project(projectName);
  await project.load();

  consoleUtils.printHeader(`标记复核完成 - ${projectName}`);

  project.reviewScript.markAsReviewed();
  await project.save();

  consoleUtils.printSuccess(`已标记为已复核，时间: ${new Date().toLocaleString()}`);

  const consistency = project.validateConsistency();
  if (!consistency.valid) {
    consoleUtils.printSubHeader('一致性检查提醒');
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

module.exports = {
  correctMistake,
  updateQuestion,
  updateReviewSection,
  updateReviewMeta,
  markReviewed
};

const storage = require('../utils/storage');
const consoleUtils = require('../utils/console');
const { Project } = require('../utils/project');

async function importQuestionBank(projectName, inputPath, options = {}) {
  storage.ensureAllDirs();
  
  const project = new Project(projectName);
  await project.load();

  consoleUtils.printHeader(`导入题库表 - ${projectName}`);

  const rawData = storage.readJson(inputPath);
  if (!rawData) {
    consoleUtils.printError(`找不到文件: ${inputPath}`);
    return false;
  }

  const beforeState = JSON.parse(JSON.stringify(project.questionBank.toJSON()));
  
  let count = 0;
  if (rawData.questions && Array.isArray(rawData.questions)) {
    rawData.questions.forEach(q => {
      project.questionBank.addQuestion(q);
      count++;
    });
    if (rawData.metadata) {
      Object.assign(project.questionBank.metadata, rawData.metadata);
    }
  } else if (Array.isArray(rawData)) {
    rawData.forEach(q => {
      project.questionBank.addQuestion(q);
      count++;
    });
  } else {
    project.questionBank.addQuestion(rawData);
    count = 1;
  }

  const afterState = JSON.parse(JSON.stringify(project.questionBank.toJSON()));
  project.recordHistory(
    'import',
    'questionBank',
    projectName,
    beforeState,
    afterState,
    options.operator || 'teacher',
    `导入${count}道题目`
  );

  await project.save();

  consoleUtils.printSuccess(`成功导入 ${count} 道题目`);
  consoleUtils.printKeyValue('题库名称', project.questionBank.metadata.name);
  consoleUtils.printKeyValue('知识点数量', project.questionBank.getAllKnowledgePoints().length);
  consoleUtils.printKeyValue('题目总数', project.questionBank.questions.length);

  return true;
}

async function importMistakes(projectName, inputPath, options = {}) {
  storage.ensureAllDirs();
  
  const project = new Project(projectName);
  await project.load();

  consoleUtils.printHeader(`导入学生错题 - ${projectName}`);

  const rawData = storage.readJson(inputPath);
  if (!rawData) {
    consoleUtils.printError(`找不到文件: ${inputPath}`);
    return false;
  }

  const beforeState = JSON.parse(JSON.stringify(project.mistakeCollection.toJSON()));

  let count = 0;
  if (rawData.records && Array.isArray(rawData.records)) {
    rawData.records.forEach(r => {
      project.mistakeCollection.addRecord(r);
      count++;
    });
    if (rawData.metadata) {
      Object.assign(project.mistakeCollection.metadata, rawData.metadata);
    }
  } else if (Array.isArray(rawData)) {
    rawData.forEach(r => {
      project.mistakeCollection.addRecord(r);
      count++;
    });
  } else {
    project.mistakeCollection.addRecord(rawData);
    count = 1;
  }

  const afterState = JSON.parse(JSON.stringify(project.mistakeCollection.toJSON()));
  project.recordHistory(
    'import',
    'mistakeCollection',
    projectName,
    beforeState,
    afterState,
    options.operator || 'teacher',
    `导入${count}条错题记录`
  );

  await project.save();

  const stats = project.mistakeCollection.getStatistics();
  consoleUtils.printSuccess(`成功导入 ${count} 条错题记录`);
  consoleUtils.printKeyValue('考试名称', project.mistakeCollection.metadata.examName);
  consoleUtils.printKeyValue('班级', project.mistakeCollection.metadata.className);
  consoleUtils.printKeyValue('待复核', stats.pending);
  consoleUtils.printKeyValue('已复核', stats.reviewed);

  return true;
}

async function importNotes(projectName, inputPath, options = {}) {
  storage.ensureAllDirs();
  
  const project = new Project(projectName);
  await project.load();

  consoleUtils.printHeader(`导入备注 - ${projectName}`);

  const rawData = storage.readJson(inputPath);
  if (!rawData) {
    consoleUtils.printError(`找不到文件: ${inputPath}`);
    return false;
  }

  let count = 0;
  
  if (rawData.questionNotes && Array.isArray(rawData.questionNotes)) {
    for (const note of rawData.questionNotes) {
      const question = project.questionBank.findByNo(note.questionNo);
      if (question) {
        const before = JSON.parse(JSON.stringify(question.toJSON()));
        if (note.notes) {
          question.notes = note.notes;
        }
        if (note.equivalentAnswers && Array.isArray(note.equivalentAnswers)) {
          question.equivalentAnswers = [...new Set([...question.equivalentAnswers, ...note.equivalentAnswers])];
        }
        question.updatedAt = new Date().toISOString();
        count++;
        
        const after = JSON.parse(JSON.stringify(question.toJSON()));
        project.recordHistory(
          'update',
          'question',
          question.id,
          before,
          after,
          options.operator || 'teacher',
          `更新题目备注`
        );
      }
    }
  }

  if (rawData.mistakeNotes && Array.isArray(rawData.mistakeNotes)) {
    for (const note of rawData.mistakeNotes) {
      const records = project.mistakeCollection.records.filter(
        r => r.studentId === note.studentId && r.questionNo === note.questionNo
      );
      for (const record of records) {
        const before = JSON.parse(JSON.stringify(record.toJSON()));
        if (note.teacherNotes) {
          record.teacherNotes = note.teacherNotes;
        }
        if (note.errorType) {
          record.errorType = note.errorType;
        }
        if (note.errorAnalysis) {
          record.errorAnalysis = note.errorAnalysis;
        }
        record.updatedAt = new Date().toISOString();
        count++;
        
        const after = JSON.parse(JSON.stringify(record.toJSON()));
        project.recordHistory(
          'update',
          'mistake',
          record.id,
          before,
          after,
          options.operator || 'teacher',
          `更新错题备注`
        );
      }
    }
  }

  await project.save();

  consoleUtils.printSuccess(`成功更新 ${count} 条备注`);
  return true;
}

module.exports = {
  importQuestionBank,
  importMistakes,
  importNotes
};

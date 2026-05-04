const fs = require('fs');
const csv = require('csv-parser');

function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath, 'utf8')
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

function parseVocabulary(data) {
  return data.map((row, index) => ({
    id: row.id || index + 1,
    word: row.word || row.词汇 || row.vocabulary || row.term || '',
    meaning: row.meaning || row.含义 || row.释义 || '',
    category: row.category || row.分类 || row.category || '',
    difficulty: row.difficulty || row.难度 || '',
    tags: row.tags ? row.tags.split(/[,，]/).map(t => t.trim()) : []
  })).filter(v => v.word);
}

function parseSegments(data) {
  return data.map((row, index) => ({
    id: row.id || index + 1,
    name: row.name || row.环节名称 || row.segment || '',
    order: parseInt(row.order || row.顺序 || index + 1),
    startTime: row.startTime || row.开始时间 || '',
    endTime: row.endTime || row.结束时间 || '',
    duration: row.duration || row.时长 || '',
    description: row.description || row.描述 || row.说明 || '',
    teacher: row.teacher || row.讲师 || '',
    objectives: row.objectives ? row.objectives.split(/[,，]/).map(t => t.trim()) : []
  })).filter(s => s.name);
}

function parseFeedback(data) {
  return data.map((row, index) => ({
    id: row.id || index + 1,
    student: row.student || row.学员 || row.name || '',
    question: row.question || row.问题 || row.feedback || row.反馈 || '',
    category: row.category || row.分类 || row.type || '',
    status: row.status || row.状态 || 'pending',
    response: row.response || row.回复 || row.回答 || '',
    submittedAt: row.submittedAt || row.提交时间 || '',
    closedAt: row.closedAt || row.闭环时间 || '',
    tags: row.tags ? row.tags.split(/[,，]/).map(t => t.trim()) : []
  })).filter(f => f.question || f.student);
}

module.exports = {
  parseCSV,
  parseVocabulary,
  parseSegments,
  parseFeedback
};

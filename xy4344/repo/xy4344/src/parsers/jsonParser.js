const fs = require('fs');

function parseJSON(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content);
}

function parseVocabulary(data) {
  if (!Array.isArray(data)) {
    if (data.vocabulary) return parseVocabulary(data.vocabulary);
    if (data.words) return parseVocabulary(data.words);
    if (data.items) return parseVocabulary(data.items);
    return [];
  }
  
  return data.map((item, index) => ({
    id: item.id || item._id || index + 1,
    word: item.word || item.词汇 || item.vocabulary || item.term || item.name || '',
    meaning: item.meaning || item.含义 || item.释义 || item.description || item.desc || '',
    category: item.category || item.分类 || item.type || '',
    difficulty: item.difficulty || item.难度 || item.level || '',
    tags: item.tags || item.标签 || []
  })).filter(v => v.word);
}

function parseSegments(data) {
  if (!Array.isArray(data)) {
    if (data.segments) return parseSegments(data.segments);
    if (data.环节) return parseSegments(data.环节);
    if (data.items) return parseSegments(data.items);
    return [];
  }
  
  return data.map((item, index) => ({
    id: item.id || item._id || index + 1,
    name: item.name || item.环节名称 || item.segment || item.title || '',
    order: parseInt(item.order || item.顺序 || item.sort || index + 1),
    startTime: item.startTime || item.开始时间 || item.start || '',
    endTime: item.endTime || item.结束时间 || item.end || '',
    duration: item.duration || item.时长 || '',
    description: item.description || item.描述 || item.说明 || item.desc || '',
    teacher: item.teacher || item.讲师 || item.instructor || '',
    objectives: item.objectives || item.目标 || item.goals || []
  })).filter(s => s.name);
}

function parseFeedback(data) {
  if (!Array.isArray(data)) {
    if (data.feedback) return parseFeedback(data.feedback);
    if (data.feedbackList) return parseFeedback(data.feedbackList);
    if (data.学员反馈) return parseFeedback(data.学员反馈);
    if (data.items) return parseFeedback(data.items);
    return [];
  }
  
  return data.map((item, index) => ({
    id: item.id || item._id || index + 1,
    student: item.student || item.学员 || item.name || item.studentName || '',
    question: item.question || item.问题 || item.feedback || item.content || item.反馈 || '',
    category: item.category || item.分类 || item.type || '',
    status: item.status || item.状态 || 'pending',
    response: item.response || item.回复 || item.回答 || item.answer || '',
    submittedAt: item.submittedAt || item.提交时间 || item.createdAt || '',
    closedAt: item.closedAt || item.闭环时间 || item.resolvedAt || '',
    tags: item.tags || item.标签 || []
  })).filter(f => f.question || f.student);
}

module.exports = {
  parseJSON,
  parseVocabulary,
  parseSegments,
  parseFeedback
};

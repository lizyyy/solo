const fs = require('fs');
const path = require('path');
const { Parser } = require('json2csv');

const issueDao = require('../dao/issueDao');
const subtitleDao = require('../dao/subtitleDao');
const vocabularyDao = require('../dao/vocabularyDao');
const segmentDao = require('../dao/segmentDao');
const feedbackDao = require('../dao/feedbackDao');

const typeNames = {
  'time_overlap': '时间重叠',
  'vocabulary_missing': '词汇缺失',
  'segment_order': '环节顺序',
  'feedback_loop': '反馈闭环',
  'subtitle_empty': '字幕为空',
  'subtitle_long': '字幕过长'
};

const severityNames = {
  'critical': '严重',
  'warning': '警告',
  'info': '信息'
};

const statusNames = {
  'open': '待处理',
  'resolved': '已解决',
  'closed': '已闭环',
  'ignored': '已忽略'
};

async function exportIssuesCSV(outputPath) {
  const issues = await issueDao.getAllIssues();
  
  const data = issues.map(function(issue) {
    var obj = {};
    obj['ID'] = issue.id;
    obj['类型'] = typeNames[issue.type] || issue.type;
    obj['严重程度'] = severityNames[issue.severity] || issue.severity;
    obj['标题'] = issue.title;
    obj['描述'] = issue.description;
    obj['关联项目ID'] = issue.related_item_id || '-';
    obj['关联项目类型'] = issue.related_item_type || '-';
    obj['状态'] = statusNames[issue.status] || issue.status;
    obj['复核意见'] = issue.comment || '-';
    obj['创建时间'] = issue.created_at;
    obj['更新时间'] = issue.updated_at;
    return obj;
  });
  
  const fields = [
    'ID', '类型', '严重程度', '标题', '描述', 
    '关联项目ID', '关联项目类型', '状态', '复核意见',
    '创建时间', '更新时间'
  ];
  
  const parser = new Parser({ fields: fields });
  const csv = parser.parse(data);
  
  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, csv, 'utf8');
  return outputPath;
}

async function exportSubtitlesCSV(outputPath) {
  const subtitles = await subtitleDao.getAllSubtitles();
  
  const data = subtitles.map(function(sub) {
    var obj = {};
    obj['ID'] = sub.id;
    obj['序号'] = sub.index_num;
    obj['开始时间'] = sub.start_time_str;
    obj['结束时间'] = sub.end_time_str;
    obj['内容'] = sub.text;
    obj['时长(毫秒)'] = sub.duration;
    obj['来源文件'] = sub.source_file;
    return obj;
  });
  
  const fields = ['ID', '序号', '开始时间', '结束时间', '内容', '时长(毫秒)', '来源文件'];
  const parser = new Parser({ fields: fields });
  const csv = parser.parse(data);
  
  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, csv, 'utf8');
  return outputPath;
}

async function exportVocabularyCSV(outputPath) {
  const vocabulary = await vocabularyDao.getAllVocabulary();
  
  const data = vocabulary.map(function(v) {
    var obj = {};
    obj['ID'] = v.id;
    obj['词汇'] = v.word;
    obj['释义'] = v.meaning || '-';
    obj['分类'] = v.category || '-';
    obj['难度'] = v.difficulty || '-';
    obj['标签'] = (v.tags || []).join(', ');
    return obj;
  });
  
  const fields = ['ID', '词汇', '释义', '分类', '难度', '标签'];
  const parser = new Parser({ fields: fields });
  const csv = parser.parse(data);
  
  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, csv, 'utf8');
  return outputPath;
}

async function exportSegmentsCSV(outputPath) {
  const segments = await segmentDao.getAllSegments();
  
  const data = segments.map(function(s) {
    var obj = {};
    obj['ID'] = s.id;
    obj['顺序'] = s.order_num;
    obj['环节名称'] = s.name;
    obj['开始时间'] = s.start_time || '-';
    obj['结束时间'] = s.end_time || '-';
    obj['时长'] = s.duration || '-';
    obj['描述'] = s.description || '-';
    obj['讲师'] = s.teacher || '-';
    obj['目标'] = (s.objectives || []).join(', ');
    return obj;
  });
  
  const fields = ['ID', '顺序', '环节名称', '开始时间', '结束时间', '时长', '描述', '讲师', '目标'];
  const parser = new Parser({ fields: fields });
  const csv = parser.parse(data);
  
  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, csv, 'utf8');
  return outputPath;
}

async function exportFeedbackCSV(outputPath) {
  const feedback = await feedbackDao.getAllFeedback();
  
  const feedbackStatusNames = {
    'pending': '待处理',
    'closed': '已闭环',
    'resolved': '已解决'
  };
  
  const data = feedback.map(function(f) {
    var obj = {};
    obj['ID'] = f.id;
    obj['学员'] = f.student || '匿名';
    obj['问题'] = f.question || '-';
    obj['分类'] = f.category || '-';
    obj['状态'] = feedbackStatusNames[f.status] || f.status || '-';
    obj['回复'] = f.response || '-';
    obj['提交时间'] = f.submitted_at || '-';
    obj['闭环时间'] = f.closed_at || '-';
    obj['标签'] = (f.tags || []).join(', ');
    return obj;
  });
  
  const fields = ['ID', '学员', '问题', '分类', '状态', '回复', '提交时间', '闭环时间', '标签'];
  const parser = new Parser({ fields: fields });
  const csv = parser.parse(data);
  
  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, csv, 'utf8');
  return outputPath;
}

async function exportAllCSV(outputDir) {
  const results = {};
  
  results.issues = await exportIssuesCSV(path.join(outputDir, '问题清单.csv'));
  results.subtitles = await exportSubtitlesCSV(path.join(outputDir, '字幕列表.csv'));
  results.vocabulary = await exportVocabularyCSV(path.join(outputDir, '词汇表.csv'));
  results.segments = await exportSegmentsCSV(path.join(outputDir, '环节表.csv'));
  results.feedback = await exportFeedbackCSV(path.join(outputDir, '学员反馈.csv'));
  
  return results;
}

module.exports = {
  exportIssuesCSV: exportIssuesCSV,
  exportSubtitlesCSV: exportSubtitlesCSV,
  exportVocabularyCSV: exportVocabularyCSV,
  exportSegmentsCSV: exportSegmentsCSV,
  exportFeedbackCSV: exportFeedbackCSV,
  exportAllCSV: exportAllCSV
};

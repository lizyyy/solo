const subtitleDao = require('../dao/subtitleDao');
const vocabularyDao = require('../dao/vocabularyDao');
const segmentDao = require('../dao/segmentDao');
const feedbackDao = require('../dao/feedbackDao');
const issueDao = require('../dao/issueDao');
const { ISSUE_TYPES, SEVERITY_LEVELS } = issueDao;

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

async function checkTimeOverlap() {
  const subtitles = await subtitleDao.getAllSubtitles();
  const issues = [];
  
  for (let i = 0; i < subtitles.length; i++) {
    const current = subtitles[i];
    
    for (let j = i + 1; j < subtitles.length; j++) {
      const next = subtitles[j];
      
      if (current.end_time > next.start_time) {
        const overlapMs = current.end_time - next.start_time;
        
        issues.push({
          type: ISSUE_TYPES.TIME_OVERLAP,
          severity: overlapMs > 1000 ? SEVERITY_LEVELS.CRITICAL : SEVERITY_LEVELS.WARNING,
          title: `字幕时间重叠 - 第${current.index_num}条与第${next.index_num}条`,
          description: `第${current.index_num}条字幕(${current.start_time_str} ~ ${current.end_time_str}) ` +
                       `与第${next.index_num}条字幕(${next.start_time_str} ~ ${next.end_time_str}) ` +
                       `重叠了 ${formatDuration(overlapMs)}`,
          relatedItemId: current.id,
          relatedItemType: 'subtitle'
        });
      }
    }
    
    if (current.duration > 10000) {
      issues.push({
        type: ISSUE_TYPES.SUBTITLE_LONG,
        severity: SEVERITY_LEVELS.WARNING,
        title: `字幕时长过长 - 第${current.index_num}条`,
        description: `第${current.index_num}条字幕时长为${formatDuration(current.duration)}，建议控制在10秒内`,
        relatedItemId: current.id,
        relatedItemType: 'subtitle'
      });
    }
    
    if (!current.text || current.text.trim().length === 0) {
      issues.push({
        type: ISSUE_TYPES.SUBTITLE_EMPTY,
        severity: SEVERITY_LEVELS.CRITICAL,
        title: `字幕内容为空 - 第${current.index_num}条`,
        description: `第${current.index_num}条字幕(${current.start_time_str} ~ ${current.end_time_str})没有内容`,
        relatedItemId: current.id,
        relatedItemType: 'subtitle'
      });
    }
  }
  
  return issues;
}

async function checkVocabularyCoverage() {
  const subtitles = await subtitleDao.getAllSubtitles();
  const vocabularyWords = await vocabularyDao.getVocabularyWords();
  const vocabulary = await vocabularyDao.getAllVocabulary();
  
  const wordMap = new Map();
  vocabulary.forEach(v => {
    wordMap.set(v.word.toLowerCase(), v);
  });
  
  const subtitleWords = new Set();
  subtitles.forEach(sub => {
    const words = sub.text.split(/[\s，。、；：""''（）【】\.\,\;\:\'\"\(\)\[\]\-]+/);
    words.forEach(w => {
      if (w.trim().length > 0) {
        subtitleWords.add(w.trim().toLowerCase());
      }
    });
  });
  
  const issues = [];
  const foundWords = new Set();
  
  vocabulary.forEach(v => {
    const wordLower = v.word.toLowerCase();
    let found = false;
    
    for (const subWord of subtitleWords) {
      if (subWord.includes(wordLower) || wordLower.includes(subWord)) {
        found = true;
        foundWords.add(wordLower);
        break;
      }
    }
    
    if (!found) {
      issues.push({
        type: ISSUE_TYPES.VOCABULARY_MISSING,
        severity: SEVERITY_LEVELS.WARNING,
        title: `词汇表词汇未在字幕中出现 - ${v.word}`,
        description: `词汇表中的"${v.word}"(${v.meaning || '无释义'})未在字幕内容中找到对应`,
        relatedItemId: v.id,
        relatedItemType: 'vocabulary'
      });
    }
  });
  
  const missingFromVocab = [];
  for (const subWord of subtitleWords) {
    if (subWord.length >= 2) {
      let found = false;
      for (const vocabWord of vocabularyWords) {
        if (subWord.includes(vocabWord.toLowerCase()) || vocabWord.toLowerCase().includes(subWord)) {
          found = true;
          break;
        }
      }
      if (!found) {
        missingFromVocab.push(subWord);
      }
    }
  }
  
  if (missingFromVocab.length > 0) {
    issues.push({
      type: ISSUE_TYPES.VOCABULARY_MISSING,
      severity: SEVERITY_LEVELS.INFO,
      title: `字幕中有未纳入词汇表的词汇`,
      description: `字幕中出现了${missingFromVocab.length}个未在词汇表中定义的词汇: ${missingFromVocab.slice(0, 10).join(', ')}${missingFromVocab.length > 10 ? '...' : ''}`,
      relatedItemId: null,
      relatedItemType: 'vocabulary'
    });
  }
  
  return issues;
}

async function checkSegmentOrder() {
  const segments = await segmentDao.getSegmentsOrdered();
  const issues = [];
  
  for (let i = 0; i < segments.length; i++) {
    const current = segments[i];
    const expectedOrder = i + 1;
    
    if (current.order_num !== expectedOrder) {
      issues.push({
        type: ISSUE_TYPES.SEGMENT_ORDER,
        severity: SEVERITY_LEVELS.WARNING,
        title: `环节顺序错位 - ${current.name}`,
        description: `环节"${current.name}"的顺序应为${expectedOrder}，但当前为${current.order_num}`,
        relatedItemId: current.id,
        relatedItemType: 'segment'
      });
    }
  }
  
  for (let i = 0; i < segments.length - 1; i++) {
    const current = segments[i];
    const next = segments[i + 1];
    
    if (current.order_num > next.order_num) {
      issues.push({
        type: ISSUE_TYPES.SEGMENT_ORDER,
        severity: SEVERITY_LEVELS.CRITICAL,
        title: `环节顺序颠倒 - ${current.name} 与 ${next.name}`,
        description: `环节"${current.name}"(顺序${current.order_num})排在"${next.name}"(顺序${next.order_num})之前，但顺序号更大`,
        relatedItemId: current.id,
        relatedItemType: 'segment'
      });
    }
  }
  
  const orderNumbers = segments.map(s => s.order_num);
  const uniqueOrders = new Set(orderNumbers);
  if (uniqueOrders.size !== orderNumbers.length) {
    const duplicates = orderNumbers.filter((x, i) => orderNumbers.indexOf(x) !== i);
    issues.push({
      type: ISSUE_TYPES.SEGMENT_ORDER,
      severity: SEVERITY_LEVELS.CRITICAL,
      title: `环节顺序号重复`,
      description: `发现重复的顺序号: ${[...new Set(duplicates)].join(', ')}`,
      relatedItemId: null,
      relatedItemType: 'segment'
    });
  }
  
  return issues;
}

async function checkFeedbackClosedLoop() {
  const feedbackList = await feedbackDao.getAllFeedback();
  const issues = [];
  
  for (const feedback of feedbackList) {
    const isClosed = feedback.status === 'closed' || feedback.status === 'resolved';
    const hasResponse = feedback.response && feedback.response.trim().length > 0;
    
    if (isClosed && !hasResponse) {
      issues.push({
        type: ISSUE_TYPES.FEEDBACK_LOOP,
        severity: SEVERITY_LEVELS.WARNING,
        title: `反馈闭环不完整 - ${feedback.student || '匿名学员'}`,
        description: `学员"${feedback.student || '匿名'}"的反馈已标记为闭环，但没有填写回复内容`,
        relatedItemId: feedback.id,
        relatedItemType: 'feedback'
      });
    }
    
    if (!isClosed && feedback.status !== 'pending' && feedback.status) {
      issues.push({
        type: ISSUE_TYPES.FEEDBACK_LOOP,
        severity: SEVERITY_LEVELS.INFO,
        title: `反馈状态异常 - ${feedback.student || '匿名学员'}`,
        description: `学员"${feedback.student || '匿名'}"的反馈状态为"${feedback.status}"，应为"pending"、"closed"或"resolved"`,
        relatedItemId: feedback.id,
        relatedItemType: 'feedback'
      });
    }
    
    if (feedback.status === 'pending' || !feedback.status) {
      issues.push({
        type: ISSUE_TYPES.FEEDBACK_LOOP,
        severity: SEVERITY_LEVELS.WARNING,
        title: `反馈未处理 - ${feedback.student || '匿名学员'}`,
        description: `学员"${feedback.student || '匿名'}"的反馈"${(feedback.question || '').substring(0, 50)}..."尚未处理`,
        relatedItemId: feedback.id,
        relatedItemType: 'feedback'
      });
    }
  }
  
  return issues;
}

async function runAllChecks() {
  const [
    timeIssues,
    vocabIssues,
    segmentIssues,
    feedbackIssues
  ] = await Promise.all([
    checkTimeOverlap(),
    checkVocabularyCoverage(),
    checkSegmentOrder(),
    checkFeedbackClosedLoop()
  ]);
  
  const allIssues = [
    ...timeIssues,
    ...vocabIssues,
    ...segmentIssues,
    ...feedbackIssues
  ];
  
  await issueDao.saveIssues(allIssues);
  
  return {
    total: allIssues.length,
    byType: {
      timeOverlap: timeIssues.length,
      vocabulary: vocabIssues.length,
      segmentOrder: segmentIssues.length,
      feedbackLoop: feedbackIssues.length
    },
    issues: allIssues
  };
}

module.exports = {
  checkTimeOverlap,
  checkVocabularyCoverage,
  checkSegmentOrder,
  checkFeedbackClosedLoop,
  runAllChecks
};

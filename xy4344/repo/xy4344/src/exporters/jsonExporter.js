const fs = require('fs');
const path = require('path');

const subtitleDao = require('../dao/subtitleDao');
const vocabularyDao = require('../dao/vocabularyDao');
const segmentDao = require('../dao/segmentDao');
const feedbackDao = require('../dao/feedbackDao');
const issueDao = require('../dao/issueDao');
const reviewDao = require('../dao/reviewDao');
const db = require('../database');

async function generateAuditPackage() {
  const [
    subtitles,
    vocabulary,
    segments,
    feedback,
    issues,
    issueStats,
    reviews,
    reviewStats
  ] = await Promise.all([
    subtitleDao.getAllSubtitles(),
    vocabularyDao.getAllVocabulary(),
    segmentDao.getAllSegments(),
    feedbackDao.getAllFeedback(),
    issueDao.getAllIssues(),
    issueDao.getIssueStats(),
    reviewDao.getAllReviews(),
    reviewDao.getReviewStats()
  ]);
  
  const auditPackage = {
    meta: {
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
      databasePath: db.DB_PATH
    },
    summary: {
      subtitles: subtitles.length,
      vocabulary: vocabulary.length,
      segments: segments.length,
      feedback: feedback.length,
      issues: issueStats,
      reviews: reviewStats
    },
    data: {
      subtitles: subtitles.map(s => ({
        id: s.id,
        index: s.index_num,
        startTime: s.start_time,
        endTime: s.end_time,
        startTimeStr: s.start_time_str,
        endTimeStr: s.end_time_str,
        text: s.text,
        duration: s.duration,
        sourceFile: s.source_file
      })),
      vocabulary: vocabulary.map(v => ({
        id: v.id,
        word: v.word,
        meaning: v.meaning,
        category: v.category,
        difficulty: v.difficulty,
        tags: v.tags || []
      })),
      segments: segments.map(s => ({
        id: s.id,
        name: s.name,
        order: s.order_num,
        startTime: s.start_time,
        endTime: s.end_time,
        duration: s.duration,
        description: s.description,
        teacher: s.teacher,
        objectives: s.objectives || []
      })),
      feedback: feedback.map(f => ({
        id: f.id,
        student: f.student,
        question: f.question,
        category: f.category,
        status: f.status,
        response: f.response,
        submittedAt: f.submitted_at,
        closedAt: f.closed_at,
        tags: f.tags || []
      }))
    },
    issues: issues.map(i => ({
      id: i.id,
      type: i.type,
      severity: i.severity,
      title: i.title,
      description: i.description,
      relatedItemId: i.related_item_id,
      relatedItemType: i.related_item_type,
      status: i.status,
      comment: i.comment,
      createdAt: i.created_at,
      updatedAt: i.updated_at
    })),
    reviews: reviews.map(r => ({
      id: r.id,
      itemType: r.item_type,
      itemId: r.item_id,
      reviewer: r.reviewer,
      comment: r.comment,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }))
  };
  
  return auditPackage;
}

async function exportJSON(outputPath) {
  const auditPackage = await generateAuditPackage();
  const jsonStr = JSON.stringify(auditPackage, null, 2);
  
  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, jsonStr, 'utf8');
  return outputPath;
}

async function exportSubtitlesJSON(outputPath) {
  const subtitles = await subtitleDao.getAllSubtitles();
  const data = subtitles.map(s => ({
    id: s.id,
    index: s.index_num,
    startTime: s.start_time,
    endTime: s.end_time,
    startTimeStr: s.start_time_str,
    endTimeStr: s.end_time_str,
    text: s.text,
    duration: s.duration,
    sourceFile: s.source_file
  }));
  
  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
  return outputPath;
}

async function exportIssuesJSON(outputPath) {
  const issues = await issueDao.getAllIssues();
  const data = issues.map(i => ({
    id: i.id,
    type: i.type,
    severity: i.severity,
    title: i.title,
    description: i.description,
    relatedItemId: i.related_item_id,
    relatedItemType: i.related_item_type,
    status: i.status,
    comment: i.comment,
    createdAt: i.created_at,
    updatedAt: i.updated_at
  }));
  
  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
  return outputPath;
}

module.exports = {
  generateAuditPackage,
  exportJSON,
  exportSubtitlesJSON,
  exportIssuesJSON
};

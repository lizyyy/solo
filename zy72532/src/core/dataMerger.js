function mergeManualReview(modelRecords, reviewRecords, correctionLog) {
  const reviewMap = new Map();
  reviewRecords.forEach(r => reviewMap.set(r.id, r));
  
  const mergedRecords = modelRecords.map(record => {
    const result = { ...record };
    result.manual_review = null;
    result.hit_final = record.hit;
    result.hit_source = 'model';
    result.change_history = [];
    
    if (reviewMap.has(record.id)) {
      const review = reviewMap.get(record.id);
      result.manual_review = {
        reviewed_hit: review.reviewed_hit,
        reviewer: review.reviewer,
        review_time: review.review_time,
        review_note: review.review_note,
        old_caliber_info: review.old_caliber_info
      };
      
      if (review.reviewed_hit !== record.hit) {
        result.change_history.push({
          field: 'hit',
          old_value: record.hit,
          new_value: review.reviewed_hit,
          reason: '人工改判表补录',
          source: 'manual_review_sheet'
        });
        result.hit_final = review.reviewed_hit;
        result.hit_source = 'manual_review';
      }
    }
    
    if (correctionLog && correctionLog.changes) {
      correctionLog.changes.forEach(change => {
        if (change.record_id === record.id) {
          result.change_history.push({
            ...change,
            source: 'manual_correction',
            operator: correctionLog.operator,
            correction_time: correctionLog.correction_time
          });
          if (change.field === 'hit') {
            result.hit_final = change.new_value;
            result.hit_source = 'manual_correction';
          }
        }
      });
    }
    
    return result;
  });
  
  return mergedRecords;
}

function calculateStats(records) {
  const total = records.length;
  const hitCount = records.filter(r => r.hit_final === '命中').length;
  const manualReviewed = records.filter(r => r.manual_review !== null).length;
  const changedCount = records.filter(r => r.change_history.length > 0).length;
  const privacyIssues = records.filter(r => r.warnings && r.warnings.length > 0).length;
  
  return {
    total,
    hitCount,
    hitRate: total > 0 ? (hitCount / total * 100).toFixed(2) + '%' : '0%',
    manualReviewed,
    changedCount,
    privacyIssues
  };
}

module.exports = {
  mergeManualReview,
  calculateStats
};

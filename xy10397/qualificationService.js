const { db, examTypes } = require('./database');

const educationOrder = ['高中', '中专', '专科', '本科', '硕士', '博士'];

function getEducationLevel(education) {
  const level = educationOrder.indexOf(education);
  return level === -1 ? -1 : level;
}

function checkQualification(education, workYears, examTypeId) {
  const examType = examTypes.find(t => t.id === examTypeId);
  if (!examType) {
    return {
      passed: false,
      error: '未知的考试类型',
      details: {}
    };
  }

  const requiredLevel = getEducationLevel(examType.minEducation);
  const candidateLevel = getEducationLevel(education);
  
  const educationPassed = candidateLevel >= requiredLevel;
  const yearsPassed = workYears >= examType.minWorkYears;

  const details = {
    examType: examType.name,
    minEducation: examType.minEducation,
    candidateEducation: education,
    educationPassed,
    minWorkYears: examType.minWorkYears,
    candidateWorkYears: workYears,
    yearsPassed
  };

  if (!educationPassed && !yearsPassed) {
    return {
      passed: false,
      error: '学历不符合要求且工作年限不足',
      details
    };
  }

  if (!educationPassed) {
    return {
      passed: false,
      error: `学历不符合要求（需要${examType.minEducation}及以上）`,
      details
    };
  }

  if (!yearsPassed) {
    return {
      passed: false,
      error: `工作年限不足（需要${examType.minWorkYears}年及以上）`,
      details
    };
  }

  return {
    passed: true,
    error: null,
    details
  };
}

function checkReviewEligibility(candidate) {
  const checks = [];
  
  if (!candidate.photo_uploaded) {
    checks.push({
      step: 'photo',
      passed: false,
      message: '未上传照片'
    });
  } else {
    checks.push({
      step: 'photo',
      passed: true,
      message: '照片已上传'
    });
  }
  
  const qualCheck = checkQualification(
    candidate.education,
    candidate.work_years,
    candidate.exam_type_id
  );
  
  checks.push({
    step: 'qualification',
    passed: qualCheck.passed,
    message: qualCheck.error || '资格校验通过'
  });
  
  if (candidate.payment_status !== 'paid') {
    checks.push({
      step: 'payment',
      passed: false,
      message: '未缴纳报名费'
    });
  } else {
    checks.push({
      step: 'payment',
      passed: true,
      message: '已缴费'
    });
  }
  
  return {
    allPassed: checks.every(c => c.passed),
    checks
  };
}

function determineCurrentStep(candidate) {
  if (!candidate.photo_uploaded) {
    return 'photo_required';
  }
  
  const qualCheck = checkQualification(
    candidate.education,
    candidate.work_years,
    candidate.exam_type_id
  );
  
  if (!qualCheck.passed) {
    return 'qualification_failed';
  }
  
  if (candidate.payment_status !== 'paid') {
    return 'payment_required';
  }
  
  return 'ready_for_review';
}

function canPassReview(candidate) {
  const eligibility = checkReviewEligibility(candidate);
  
  if (!eligibility.allPassed) {
    const failedChecks = eligibility.checks.filter(c => !c.passed);
    return {
      canPass: false,
      blockedReason: failedChecks.map(c => c.message).join('；')
    };
  }
  
  return {
    canPass: true,
    blockedReason: null
  };
}

function needsReReviewAfterSupplement(candidate) {
  if (candidate.current_step === 'ready_for_review' && candidate.status === 'rejected') {
    return {
      needsReReview: true,
      message: '已补交材料但未复审'
    };
  }
  return {
    needsReReview: false,
    message: null
  };
}

module.exports = {
  checkQualification,
  checkReviewEligibility,
  determineCurrentStep,
  canPassReview,
  needsReReviewAfterSupplement,
  getEducationLevel
};

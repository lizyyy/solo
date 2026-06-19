import { analyzeGeometry } from '../geometry/core.js';
import { dataStore, ReviewRecord } from '../models/index.js';

export function detectMultipleVersions(studentId, answerId) {
  const answers = dataStore.getAnswersByStudentAndAnswer(studentId, answerId);
  return answers.length > 1;
}

export function getStudentVersions(studentId, answerId) {
  return dataStore.getAnswersByStudentAndAnswer(studentId, answerId);
}

export function generateErrorAnalysis(record) {
  const parts = [];
  if (!record) return '【无数据】';

  const geo = record.geometryAnalysis;
  const manual = record.manualExample;
  const questionnaire = record.questionnaire;

  if (record.hasMultipleVersions) {
    parts.push('【先服务复核：多版本答案】');
    parts.push(`• 同一学生提交了 ${record.versions.length} 版答案，暂不归正常`);
    record.versions.forEach((v, i) => {
      parts.push(`  - 版本${v.version}: ${v.submittedAt ? v.submittedAt.substring(0, 19) : ''} (来源：${v.source || '未知'})`);
    });
  }

  const geoConcave = geo && geo.issues ? geo.issues.filter(i => i.type === 'concave') : [];
  const geoDup = geo && geo.issues ? geo.issues.filter(i => i.type === 'duplicate') : [];
  const geoWind = geo && geo.issues ? geo.issues.filter(i => i.type === 'winding') : [];

  if (geoConcave.length > 0 || geoDup.length > 0 || geoWind.length > 0) {
    parts.push('【几何问题（分开提示）】');
    geoConcave.forEach(i => parts.push('• [凹点] ' + i.message));
    geoDup.forEach(i => parts.push('• [重复坐标] ' + i.message));
    geoWind.forEach(i => parts.push('• [顺逆时针] ' + i.message));
  }

  const missing = [];
  if (!manual) missing.push('手算反例（主流程）');
  if (!questionnaire) missing.push('问卷原始行（现场说法）');
  if (questionnaire && !questionnaire.siteStatement) missing.push('问卷现场说法内容（已录入但字段为空）');
  if (missing.length > 0) {
    parts.push('【还缺什么材料】');
    missing.forEach(m => parts.push('• 缺少：' + m));
  }

  if (geo && Math.abs(geo.areaDiff) > 0.01) {
    parts.push('【面积差异】');
    parts.push(`• 原始多边形面积: ${geo.rawArea.toFixed(2)}，凸包面积: ${geo.convexArea.toFixed(2)}`);
    parts.push(`• 面积差值: ${geo.areaDiff.toFixed(2)} (${(geo.areaDiffRatio * 100).toFixed(1)}%)`);
    parts.push('• 差值原因：凹点造成凸包外包矩形更大（若为合理凹形需问卷佐证）');
  }

  if (parts.length === 0) {
    parts.push('【误差说明】暂无发现误差项，几何与材料齐全。');
  }

  return parts.join('\n');
}

export function determineNextStep(record) {
  if (!record) return '';

  const geo = record.geometryAnalysis;
  const manual = record.manualExample;
  const questionnaire = record.questionnaire;
  const hasGeoIssues = geo && geo.issues && geo.issues.length > 0;
  const needsManual = !manual;
  const needsQuestionnaire = !questionnaire;

  if (record.hasMultipleVersions) return '先找业务运营';
  if (needsManual || needsQuestionnaire) return '找教研负责人吴老师';
  if (hasGeoIssues) return '教研负责人吴老师';
  return '业务运营';
}

export function generateNextStepDetail(record) {
  if (!record) return '【暂无】';

  const parts = [];
  const geo = record.geometryAnalysis;
  const manual = record.manualExample;
  const questionnaire = record.questionnaire;

  const hasGeoIssues = geo && geo.issues && geo.issues.length > 0;
  const geoConcave = geo && geo.issues ? geo.issues.filter(i => i.type === 'concave') : [];
  const geoDup = geo && geo.issues ? geo.issues.filter(i => i.type === 'duplicate') : [];
  const geoWind = geo && geo.issues ? geo.issues.filter(i => i.type === 'winding') : [];

  if (record.hasMultipleVersions) {
    parts.push('【下一步：先找业务运营】');
    parts.push('• 事由：同一学生有多版答案，需先确认最终版');
    parts.push('• 动作：业务运营对接学生，口头或书面确认以哪一版为准');
    parts.push('• 完成后：在系统中更新该记录，标记选定版本后再进入教研复核');
    parts.push('• 说明：在运营确认前，本记录不自动归正常');
  }

  if (!manual) {
    parts.push('【下一步：找教研负责人吴老师】');
    parts.push('• 事由：缺少手算反例，无法核对学生主流程计算');
    parts.push('• 动作：吴老师查阅学生纸质/电子稿，录入计算步骤、期望面积、标注问题');
    parts.push('• 完成后：误差说明中的"缺少材料"将自动移除');
  }

  if (!questionnaire) {
    const head = manual ? '【下一步：找教研负责人吴老师】' : '';
    if (head && !parts.some(p => p.includes('【下一步：找教研负责人吴老师】'))) {
      parts.push('【下一步：找教研负责人吴老师】');
    }
    parts.push('• 事由：缺少问卷原始行，无法对照现场说法判断合理性');
    parts.push('• 动作：吴老师或调查员补录现场说法、测量工具、照片、访谈记录');
    parts.push('• 完成后：系统自动重新评估几何问题是否为现场合理情况');
  }

  if (hasGeoIssues && manual && questionnaire) {
    parts.push('【下一步：教研负责人吴老师人工复核】');
    parts.push('• 事由：材料齐全，但仍存在几何问题，需结合两边证据判断');
    if (geoConcave.length > 0) {
      parts.push('• 凹点：参考问卷原始行的现场说法，判断凹点是否因现场障碍物（树/围墙等）形成');
      parts.push('  - 若合理：保留原始形状，在备注说明，不强行归为凸包');
      parts.push('  - 若不合理：标记为输入错误，退回学生修正');
    }
    if (geoDup.length > 0) {
      parts.push('• 重复坐标：参考手算反例查看学生是否多写一步；若是提示录入规范');
    }
    if (geoWind.length > 0) {
      parts.push('• 顺逆时针：参考问卷原始行查看测量起点/方向；若面积正确可批注通过');
    }
    parts.push('• 完成后：吴老师批注理由后点击批准，保留痕迹');
  }

  if (!record.hasMultipleVersions && manual && questionnaire && !hasGeoIssues) {
    parts.push('【下一步：业务运营归档】');
    parts.push('• 事由：双证齐全、几何无异常，可视为复核通过');
    parts.push('• 动作：业务运营确认后点击批准，记录归档');
  }

  if (parts.length === 0) {
    parts.push('【下一步：状态正常，等待最终批准归档】');
  }

  return parts.join('\n');
}

export function recomputeRecordFields(record) {
  record.errorAnalysis = generateErrorAnalysis(record);
  record.nextStep = determineNextStep(record);
  record.nextStepDetail = generateNextStepDetail(record);
  record.assignedTo = record.nextStep;
}

export function createReviewRecord(studentId, answerId) {
  const versions = getStudentVersions(studentId, answerId);
  if (versions.length === 0) return null;

  const primaryAnswer = versions[0];
  const geoAnalysis = analyzeGeometry(primaryAnswer);
  const manualExample = dataStore.getManualExample(studentId, answerId);
  const questionnaire = dataStore.getQuestionnaire(studentId, answerId);

  const hasMultipleVersions = versions.length > 1;

  const record = new ReviewRecord({
    id: `review-${studentId}-${answerId}-${Date.now()}`,
    studentId,
    answerId,
    status: hasMultipleVersions ? 'needs-operation-review' : 'pending',
    geometryAnalysis: geoAnalysis,
    manualExample: manualExample ? manualExample.toJSON() : null,
    questionnaire: questionnaire ? questionnaire.toJSON() : null,
    hasMultipleVersions,
    versions: versions.map(v => ({
      version: v.version,
      submittedAt: v.submittedAt,
      source: v.source
    })),
    reviewHistory: []
  });

  recomputeRecordFields(record);

  const createReason = [];
  if (hasMultipleVersions) createReason.push(`检测到${versions.length}版答案，先运营复核`);
  if (geoAnalysis.issues && geoAnalysis.issues.length > 0) createReason.push(`几何问题${geoAnalysis.issues.length}项`);
  if (!manualExample) createReason.push('缺手算反例');
  if (!questionnaire) createReason.push('缺问卷原始行');
  const reasonText = createReason.length > 0 ? createReason.join('；') : '初始创建待处理';

  record.addHistoryEntry({
    action: 'created',
    message: '复核记录已创建',
    createReason: reasonText,
    snapshotAfter: record.snapshot()
  });

  dataStore.addReviewRecord(record);
  return record;
}

export function updateWithQuestionnaire(recordId, questionnaireData) {
  const record = dataStore.getReviewRecord(recordId);
  if (!record) return null;

  record.markForHistory();

  dataStore.addQuestionnaire(questionnaireData);
  const questionnaire = dataStore.getQuestionnaire(questionnaireData.studentId, questionnaireData.answerId);
  const qObj = questionnaire ? questionnaire.toJSON() : null;

  const oldMissing = [];
  if (!record.questionnaire) oldMissing.push('问卷原始行');
  if (record.questionnaire && !record.questionnaire.siteStatement) oldMissing.push('问卷现场说法');

  record.questionnaire = qObj;
  if (record.status === 'pending' || record.status === 'needs-operation-review') {
    record.status = 'updated';
  }

  recomputeRecordFields(record);

  const changes = [];
  changes.push('已补录问卷原始行（来源：' + (questionnaireData.interviewer || '未注明调查员') + '）');
  if (questionnaireData.siteStatement) {
    changes.push('现场说法摘要："' + questionnaireData.siteStatement.substring(0, 50) + (questionnaireData.siteStatement.length > 50 ? '...' : '') + '"');
  }
  if (oldMissing.length > 0) changes.push('不再缺少：' + oldMissing.join('、'));
  changes.push('误差说明与下一步行动已随最新数据重新计算');

  record.addHistoryEntry({
    action: 'questionnaire-added',
    message: changes.join('；'),
    changedBy: questionnaireData.interviewer || '吴老师',
    originalStatement: record.snapshotBefore,
    snapshotAfter: record.snapshot(),
    processReason: oldMissing.length > 0
      ? '补齐缺失材料后重新评估几何问题合理性'
      : '更新现场说法以支持几何问题判断'
  });

  dataStore.saveToFiles();
  return record;
}

export function updateWithManualExample(recordId, manualData) {
  const record = dataStore.getReviewRecord(recordId);
  if (!record) return null;

  record.markForHistory();

  dataStore.addManualExample(manualData);
  const manualExample = dataStore.getManualExample(manualData.studentId, manualData.answerId);

  record.manualExample = manualExample ? manualExample.toJSON() : null;
  if (record.status === 'pending' || record.status === 'needs-operation-review') {
    record.status = 'updated';
  }

  recomputeRecordFields(record);

  const changes = [];
  changes.push('已补录手算反例（审核人：' + (manualData.reviewer || '未注明') + '）');
  if (manualData.notes) changes.push('主流程备注："' + manualData.notes.substring(0, 60) + '"');
  changes.push('误差说明与下一步行动已重新计算');

  record.addHistoryEntry({
    action: 'manual-added',
    message: changes.join('；'),
    changedBy: manualData.reviewer || '教研',
    snapshotAfter: record.snapshot(),
    processReason: '补录手算反例（主流程）后，与问卷原始行两边证据合并判断'
  });

  dataStore.saveToFiles();
  return record;
}

export function approveRecord(recordId, approver, reason) {
  const record = dataStore.getReviewRecord(recordId);
  if (!record) return null;

  record.markForHistory();

  const snapshotBefore = { ...record.snapshot() };
  const geo = record.geometryAnalysis;
  const hasGeoConcerns = geo && geo.issues && geo.issues.some(i =>
    i.type === 'concave' || i.type === 'winding' || i.type === 'duplicate'
  );
  const hasPendingConcerns =
    record.hasMultipleVersions ||
    !record.manualExample ||
    !record.questionnaire ||
    hasGeoConcerns;

  const oldStatus = record.status;
  record.status = 'approved';

  recomputeRecordFields(record);

  const historyMsg = [];
  historyMsg.push(`已由 ${approver} 批准`);
  if (reason) historyMsg.push(`批注：${reason}`);
  if (hasPendingConcerns) {
    historyMsg.push('注意：存在未清事项但人工批准，详情见下方；不提前归正常，保留全部原始痕迹');
  }

  record.addHistoryEntry({
    action: 'approved',
    message: historyMsg.join('；'),
    approver,
    reason: reason || '（未填写批注）',
    approvedWithConcerns: hasPendingConcerns,
    statusChange: `${oldStatus} → approved`,
    snapshotBefore,
    snapshotAfter: record.snapshot(),
    processReason: hasPendingConcerns
      ? '人工判断：结合手算反例与问卷原始行，虽仍有几何/材料提示但业务上可通过'
      : '全部项满足条件，正常通过'
  });

  dataStore.saveToFiles();
  return record;
}

export function processAllAnswers() {
  const processed = new Set();
  const results = [];

  dataStore.studentAnswers.forEach(answer => {
    const key = `${answer.studentId}-${answer.answerId}`;
    if (processed.has(key)) return;
    processed.add(key);

    const record = createReviewRecord(answer.studentId, answer.answerId);
    if (record) {
      results.push(record);
    }
  });

  dataStore.saveToFiles();
  return results;
}

export function generateReport(recordId) {
  const record = dataStore.getReviewRecord(recordId);
  if (!record) return null;

  return {
    record: record.toJSON(),
    summary: generateReportSummary(record),
    humanReport: generateHumanReadableReport(record)
  };
}

export function generateReportSummary(record) {
  const geo = record.geometryAnalysis;
  const issuesByType = { concave: 0, duplicate: 0, winding: 0, total: 0 };

  if (geo && geo.issues) {
    geo.issues.forEach(issue => {
      issuesByType[issue.type] = (issuesByType[issue.type] || 0) + 1;
      issuesByType.total++;
    });
  }

  return {
    status: record.status,
    hasMultipleVersions: record.hasMultipleVersions,
    versionCount: record.versions.length,
    hasManual: !!record.manualExample,
    hasQuestionnaire: !!record.questionnaire,
    issuesByType,
    areaDiff: geo ? geo.areaDiff : 0,
    areaDiffRatio: geo ? geo.areaDiffRatio : 0,
    nextStep: record.nextStep,
    nextStepDetail: record.nextStepDetail,
    assignedTo: record.assignedTo,
    problemEdgeCount: geo && geo.problemEdges ? geo.problemEdges.length : 0
  };
}

export function generateHumanReadableReport(record) {
  const lines = [];
  lines.push('＝＝＝ 凸包围栏面积复核 · 正式报告 ＝＝＝');
  lines.push(`记录ID：${record.id}`);
  lines.push(`学生ID：${record.studentId}　　答案ID：${record.answerId}`);
  lines.push(`当前状态：${record.status}　　分配给：${record.assignedTo || '未分配'}`);
  lines.push('');
  lines.push('── 证据来源 ──');
  lines.push(`手算反例（主流程）：${record.manualExample ? '✓ 已录入（审核人：' + (record.manualExample.reviewer || '未填') + '）' : '✗ 缺失'}`);
  lines.push(`问卷原始行（现场说法）：${record.questionnaire ? '✓ 已录入（调查员：' + (record.questionnaire.interviewer || '未填') + '）' : '✗ 缺失'}`);
  if (record.hasMultipleVersions) {
    lines.push(`多版本答案：⚠️ ${record.versions.length} 版，尚未确认最终版`);
  }
  lines.push('');
  lines.push('── 几何分析 ──');
  if (record.geometryAnalysis) {
    const g = record.geometryAnalysis;
    lines.push(`原始面积：${g.rawArea.toFixed(2)} ㎡　　凸包面积：${g.convexArea.toFixed(2)} ㎡`);
    lines.push(`面积差值：${g.areaDiff.toFixed(2)} ㎡（${(g.areaDiffRatio * 100).toFixed(1)}%）`);
    lines.push(`是否凸多边形：${g.isConvex ? '是' : '否'}　　环绕方向：${g.windingOrder}`);
    if (g.issues && g.issues.length > 0) {
      lines.push(`几何问题共 ${g.issues.length} 项（分开提示）：`);
      g.issues.forEach(i => lines.push(`　- [${i.type}] ${i.message}`));
    }
    if (g.problemEdges && g.problemEdges.length > 0) {
      lines.push(`问题边（需在图中标红）共 ${g.problemEdges.length} 条`);
    }
  }
  lines.push('');
  lines.push('── 误差说明（为什么被留下） ──');
  lines.push(record.errorAnalysis || '（无）');
  lines.push('');
  lines.push('── 下一步该找谁、做什么 ──');
  lines.push(record.nextStepDetail || '（无）');
  lines.push('');
  lines.push('── 处理历史（保留全部痕迹，不提前归正常） ──');
  record.reviewHistory.forEach((h, i) => {
    lines.push(`${i + 1}. [${h.timestamp ? h.timestamp.substring(0, 19) : '?'}] ${h.action} - ${h.message}`);
    if (h.processReason) lines.push(`　　处理原因：${h.processReason}`);
    if (h.approvedWithConcerns === true) {
      lines.push(`　　⚠️ 批准时仍有未清事项：保留全部原始痕迹，不提前归正常`);
    }
    if (h.snapshotBefore) {
      const sb = h.snapshotBefore;
      const sa = h.snapshotAfter;
      if (sb.status !== (sa && sa.status)) lines.push(`　　状态变化：${sb.status} → ${sa && sa.status}`);
      if (sb.nextStep !== (sa && sa.nextStep)) lines.push(`　　下一步变化：${sb.nextStep} → ${sa && sa.nextStep}`);
      if (sb.manualExample !== (sa && sa.manualExample)) lines.push(`　　手算反例：${sb.manualExample} → ${sa && sa.manualExample}`);
      if (sb.questionnaire !== (sa && sa.questionnaire)) lines.push(`　　问卷原始行：${sb.questionnaire} → ${sa && sa.questionnaire}`);
    }
  });
  lines.push('');
  lines.push('＝＝＝ 报告结束 ＝＝＝');
  return lines.join('\n');
}

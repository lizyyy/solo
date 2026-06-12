import { db } from '@/db';
import { 
  GISPoint, 
  ResidentFeedback, 
  InspectionRecord, 
  MergedRecord, 
  MatchResult,
  Anomaly
} from '@/types';
import { calculateMatchScore, getConfidenceFromScore, generateId, stringSimilarity } from './matching';
import { detectAllAnomalies } from './anomaly';

const ADDRESS_SIMILARITY_THRESHOLD = 0.5;

export async function mergeAllData(): Promise<MatchResult[]> {
  await db.mergedRecords.clear();
  await db.anomalies.clear();

  const gisPoints = await db.gisPoints.toArray();
  const feedbacks = await db.residentFeedbacks.toArray();
  const inspections = await db.inspectionRecords.toArray();

  const matchResults: MatchResult[] = [];
  const processedGis = new Set<string>();
  const processedFeedback = new Set<string>();
  const processedInspection = new Set<string>();

  const allLampIds = new Set<string>();
  gisPoints.forEach(g => g.lamp_id && allLampIds.add(g.lamp_id));
  inspections.forEach(i => i.lamp_id && allLampIds.add(i.lamp_id));

  const feedbackOnlyLampIds = new Set<string>();
  feedbacks.forEach(f => {
    if (f.lamp_id && !allLampIds.has(f.lamp_id)) {
      feedbackOnlyLampIds.add(f.lamp_id);
    }
  });

  for (const lampId of allLampIds) {
    const gisMatches = gisPoints.filter(g => g.lamp_id === lampId);
    const feedbackMatches = feedbacks.filter(f => f.lamp_id === lampId);
    const inspectionMatches = inspections.filter(i => i.lamp_id === lampId);

    if (gisMatches.length > 0 || feedbackMatches.length > 0 || inspectionMatches.length > 0) {
      const primaryGis = gisMatches[0];
      const primaryFeedback = feedbackMatches[0];
      const primaryInspection = inspectionMatches[0];

      let score = 0;
      let pairCount = 0;
      const address = primaryGis?.address || primaryFeedback?.address || primaryInspection?.address || '';

      if (primaryGis && primaryFeedback) {
        score += calculateMatchScore(
          primaryGis.lamp_id, primaryFeedback.lamp_id,
          primaryGis.address, primaryFeedback.address,
          primaryGis.latitude, primaryGis.longitude
        );
        pairCount++;
      }
      if (primaryGis && primaryInspection) {
        score += calculateMatchScore(
          primaryGis.lamp_id, primaryInspection.lamp_id,
          primaryGis.address, primaryInspection.address,
          primaryGis.latitude, primaryGis.longitude
        );
        pairCount++;
      }
      if (primaryFeedback && primaryInspection) {
        score += calculateMatchScore(
          primaryFeedback.lamp_id, primaryInspection.lamp_id,
          primaryFeedback.address, primaryInspection.address
        );
        pairCount++;
      }

      score = pairCount > 0 ? Math.min(100, score / pairCount) : 80;

      const mergedRecord: MergedRecord = {
        id: generateId(),
        lamp_id: lampId,
        gis_point_id: primaryGis?.id,
        feedback_id: primaryFeedback?.id,
        inspection_id: primaryInspection?.id,
        address: address,
        longitude: primaryGis?.longitude,
        latitude: primaryGis?.latitude,
        match_confidence: getConfidenceFromScore(score),
        match_score: score,
        match_method: 'lamp_id',
        review_status: 'pending',
        review_note: '',
        merged_at: new Date()
      };

      const anomalies = detectAllAnomalies(mergedRecord, primaryGis, primaryFeedback, primaryInspection);

      if (gisMatches.length > 1 || feedbackMatches.length > 1 || inspectionMatches.length > 1) {
        anomalies.push({
          id: generateId(),
          merged_record_id: mergedRecord.id,
          type: 'duplicate',
          severity: 'medium',
          description: `存在重复记录: GIS=${gisMatches.length}条, 反馈=${feedbackMatches.length}条, 巡检=${inspectionMatches.length}条`,
          human_readable: `该编号下发现${Math.max(gisMatches.length, feedbackMatches.length, inspectionMatches.length)}条重复记录，请人工确认是否为同一灯具。`,
          detected_at: new Date()
        });
      }

      await db.mergedRecords.add(mergedRecord);
      if (anomalies.length > 0) {
        await db.anomalies.bulkAdd(anomalies);
      }

      matchResults.push({
        mergedRecord,
        gisPoint: primaryGis,
        feedback: primaryFeedback,
        inspection: primaryInspection,
        anomalies,
        auditLogs: []
      });

      gisMatches.forEach(g => processedGis.add(g.id));
      feedbackMatches.forEach(f => processedFeedback.add(f.id));
      inspectionMatches.forEach(i => processedInspection.add(i.id));
    }
  }

  const unmatchedFeedbacks = feedbacks.filter(f => !processedFeedback.has(f.id));

  const feedbackAddrSupplement = new Map<string, ResidentFeedback>();
  for (const fb of unmatchedFeedbacks) {
    if (!fb.address) continue;
    let bestMatch: MergedRecord | null = null;
    let bestSim = 0;
    for (const mr of matchResults) {
      if (mr.feedback) continue;
      const sim = stringSimilarity(fb.address, mr.mergedRecord.address);
      if (sim >= ADDRESS_SIMILARITY_THRESHOLD && sim > bestSim) {
        bestSim = sim;
        bestMatch = mr.mergedRecord;
      }
    }
    if (bestMatch) {
      bestMatch.feedback_id = fb.id;
      const oldLampId = fb.lamp_id;
      const isOldFormat = !!fb.old_format_note;
      
      await db.mergedRecords.update(bestMatch.id, {
        feedback_id: fb.id
      });

      const existingGis = matchResults.find(r => r.mergedRecord.id === bestMatch.id)?.gisPoint;
      const newAnomalies: Anomaly[] = [];

      const mismatches: string[] = [];
      if (existingGis && fb) {
        const addrSim = stringSimilarity(existingGis.address, fb.address);
        if (addrSim < 0.5) {
          mismatches.push('GIS地址与反馈地址差异较大');
        }
        if (existingGis.lamp_id && fb.lamp_id && existingGis.lamp_id !== fb.lamp_id) {
          mismatches.push('路灯编号不一致');
        }
      }
      if (mismatches.length > 0) {
        newAnomalies.push({
          id: generateId(),
          merged_record_id: bestMatch.id,
          type: 'data_mismatch',
          severity: 'medium',
          description: `数据不一致: ${mismatches.join(', ')}`,
          human_readable: `多源数据存在${mismatches.length}处不一致：${mismatches.join('；')}。需要人工确认是否为同一灯具。`,
          detected_at: new Date()
        });
      }

      if (isOldFormat && oldLampId !== bestMatch.lamp_id) {
        newAnomalies.push({
          id: generateId(),
          merged_record_id: bestMatch.id,
          type: 'data_mismatch',
          severity: 'medium',
          description: `旧口径反馈(编号${oldLampId})通过地址相似度(${(bestSim*100).toFixed(0)}%)归并到${bestMatch.lamp_id}`,
          human_readable: `该条居民反馈使用旧编号"${oldLampId}"，通过地址"${fb.address}"与${bestMatch.lamp_id}("${bestMatch.address}")的相似度(${(bestSim*100).toFixed(0)}%)匹配归并。旧口径备注：${fb.old_format_note}。请人工确认是否确为同一灯具。`,
          detected_at: new Date()
        });
      }

      if (newAnomalies.length > 0) {
        await db.anomalies.bulkAdd(newAnomalies);
      }

      const matchResult = matchResults.find(r => r.mergedRecord.id === bestMatch.id);
      if (matchResult) {
        matchResult.feedback = fb;
        matchResult.anomalies = [...matchResult.anomalies, ...newAnomalies];
      }

      processedFeedback.add(fb.id);
      feedbackAddrSupplement.set(bestMatch.id, fb);
    }
  }

  const unmatchedGisAfterSupplement = gisPoints.filter(g => !processedGis.has(g.id));
  const unmatchedFeedbacksAfterSupplement = feedbacks.filter(f => !processedFeedback.has(f.id));
  const unmatchedInspectionsAfterSupplement = inspections.filter(i => !processedInspection.has(i.id));

  const addressBucket = new Map<string, {
    gisList: GISPoint[];
    feedbackList: ResidentFeedback[];
    inspectionList: InspectionRecord[];
  }>();

  const allAddresses: { address: string; source: 'gis' | 'feedback' | 'inspection'; id: string; record: GISPoint | ResidentFeedback | InspectionRecord }[] = [];
  
  unmatchedGisAfterSupplement.forEach(g => allAddresses.push({ address: g.address, source: 'gis', id: g.id, record: g }));
  unmatchedFeedbacksAfterSupplement.forEach(f => allAddresses.push({ address: f.address, source: 'feedback', id: f.id, record: f }));
  unmatchedInspectionsAfterSupplement.forEach(i => allAddresses.push({ address: i.address, source: 'inspection', id: i.id, record: i }));

  const clustered = new Set<string>();
  
  for (let i = 0; i < allAddresses.length; i++) {
    if (clustered.has(allAddresses[i].id)) continue;
    if (!allAddresses[i].address) continue;

    const bucketKey = allAddresses[i].id;
    const bucket: typeof addressBucket extends Map<string, infer V> ? V : never = {
      gisList: [],
      feedbackList: [],
      inspectionList: []
    };

    for (let j = i; j < allAddresses.length; j++) {
      if (clustered.has(allAddresses[j].id)) continue;
      if (!allAddresses[j].address) continue;

      const sim = stringSimilarity(allAddresses[i].address, allAddresses[j].address);
      if (sim >= ADDRESS_SIMILARITY_THRESHOLD) {
        clustered.add(allAddresses[j].id);
        if (allAddresses[j].source === 'gis') bucket.gisList.push(allAddresses[j].record as GISPoint);
        else if (allAddresses[j].source === 'feedback') bucket.feedbackList.push(allAddresses[j].record as ResidentFeedback);
        else bucket.inspectionList.push(allAddresses[j].record as InspectionRecord);
      }
    }

    if (bucket.gisList.length > 0 || bucket.feedbackList.length > 0 || bucket.inspectionList.length > 0) {
      addressBucket.set(bucketKey, bucket);
    }
  }

  for (const [, bucket] of addressBucket) {
    const primaryGis = bucket.gisList[0];
    const primaryFeedback = bucket.feedbackList[0];
    const primaryInspection = bucket.inspectionList[0];

    let score = 0;
    let pairCount = 0;
    const address = primaryGis?.address || primaryFeedback?.address || primaryInspection?.address || '';
    const bestLampId = primaryGis?.lamp_id || primaryInspection?.lamp_id || primaryFeedback?.lamp_id || 'UNKNOWN';

    if (primaryGis && primaryFeedback) {
      score += calculateMatchScore(
        primaryGis.lamp_id, primaryFeedback.lamp_id,
        primaryGis.address, primaryFeedback.address,
        primaryGis.latitude, primaryGis.longitude
      );
      pairCount++;
    }
    if (primaryGis && primaryInspection) {
      score += calculateMatchScore(
        primaryGis.lamp_id, primaryInspection.lamp_id,
        primaryGis.address, primaryInspection.address,
        primaryGis.latitude, primaryGis.longitude
      );
      pairCount++;
    }
    if (primaryFeedback && primaryInspection) {
      score += calculateMatchScore(
        primaryFeedback.lamp_id, primaryInspection.lamp_id,
        primaryFeedback.address, primaryInspection.address
      );
      pairCount++;
    }

    if (pairCount === 0) {
      score = 25;
    } else {
      score = Math.min(100, score / pairCount);
    }

    const isOldFormatFeedback = primaryFeedback?.old_format_note && primaryFeedback.lamp_id !== bestLampId;

    const mergedRecord: MergedRecord = {
      id: generateId(),
      lamp_id: bestLampId,
      gis_point_id: primaryGis?.id,
      feedback_id: primaryFeedback?.id,
      inspection_id: primaryInspection?.id,
      address: address,
      longitude: primaryGis?.longitude,
      latitude: primaryGis?.latitude,
      match_confidence: getConfidenceFromScore(score),
      match_score: score,
      match_method: 'address',
      review_status: 'pending',
      review_note: '',
      merged_at: new Date()
    };

    const anomalies = detectAllAnomalies(mergedRecord, primaryGis, primaryFeedback, primaryInspection);

    if (isOldFormatFeedback) {
      anomalies.push({
        id: generateId(),
        merged_record_id: mergedRecord.id,
        type: 'data_mismatch',
        severity: 'medium',
        description: `旧口径反馈(编号${primaryFeedback!.lamp_id})通过地址相似度归并到${bestLampId}`,
        human_readable: `该条居民反馈使用旧编号"${primaryFeedback!.lamp_id}"，通过地址"${primaryFeedback!.address}"与${bestLampId}("${address}")的相似度匹配归并。旧口径备注：${primaryFeedback!.old_format_note}。请人工确认是否确为同一灯具。`,
        detected_at: new Date()
      });
    }

    const totalGis = bucket.gisList.length;
    const totalFeedback = bucket.feedbackList.length;
    const totalInspection = bucket.inspectionList.length;
    if (totalGis > 1 || totalFeedback > 1 || totalInspection > 1) {
      anomalies.push({
        id: generateId(),
        merged_record_id: mergedRecord.id,
        type: 'duplicate',
        severity: 'medium',
        description: `地址匹配组存在多条记录: GIS=${totalGis}, 反馈=${totalFeedback}, 巡检=${totalInspection}`,
        human_readable: `该地址匹配组内发现多条记录(GIS=${totalGis}条,反馈=${totalFeedback}条,巡检=${totalInspection}条)，请人工确认是否为同一灯具。`,
        detected_at: new Date()
      });
    }

    await db.mergedRecords.add(mergedRecord);
    if (anomalies.length > 0) {
      await db.anomalies.bulkAdd(anomalies);
    }

    matchResults.push({
      mergedRecord,
      gisPoint: primaryGis,
      feedback: primaryFeedback,
      inspection: primaryInspection,
      anomalies,
      auditLogs: []
    });

    bucket.gisList.forEach(g => processedGis.add(g.id));
    bucket.feedbackList.forEach(f => processedFeedback.add(f.id));
    bucket.inspectionList.forEach(i => processedInspection.add(i.id));
  }

  const stillUnmatchedGis = gisPoints.filter(g => !processedGis.has(g.id));
  const stillUnmatchedFeedbacks = feedbacks.filter(f => !processedFeedback.has(f.id));
  const stillUnmatchedInspections = inspections.filter(i => !processedInspection.has(i.id));

  for (const gis of stillUnmatchedGis) {
    const mergedRecord: MergedRecord = {
      id: generateId(),
      lamp_id: gis.lamp_id || 'UNKNOWN',
      gis_point_id: gis.id,
      address: gis.address,
      longitude: gis.longitude,
      latitude: gis.latitude,
      match_confidence: 'low',
      match_score: 0,
      match_method: 'unmatched',
      review_status: 'pending',
      review_note: '',
      merged_at: new Date()
    };

    const anomalies = detectAllAnomalies(mergedRecord, gis, undefined, undefined);
    anomalies.push({
      id: generateId(),
      merged_record_id: mergedRecord.id,
      type: 'boundary_case',
      severity: 'low',
      description: '仅GIS数据，无匹配的反馈或巡检记录',
      human_readable: '该点位只有GIS系统数据，没有对应的居民反馈或巡检记录，建议确认是否遗漏。',
      detected_at: new Date()
    });

    await db.mergedRecords.add(mergedRecord);
    await db.anomalies.bulkAdd(anomalies);

    matchResults.push({ mergedRecord, gisPoint: gis, anomalies, auditLogs: [] });
  }

  for (const feedback of stillUnmatchedFeedbacks) {
    const mergedRecord: MergedRecord = {
      id: generateId(),
      lamp_id: feedback.lamp_id || 'UNKNOWN',
      feedback_id: feedback.id,
      address: feedback.address,
      match_confidence: 'low',
      match_score: 0,
      match_method: 'unmatched',
      review_status: 'pending',
      review_note: '',
      merged_at: new Date()
    };

    const anomalies = detectAllAnomalies(mergedRecord, undefined, feedback, undefined);
    anomalies.push({
      id: generateId(),
      merged_record_id: mergedRecord.id,
      type: 'boundary_case',
      severity: 'low',
      description: '仅居民反馈，无匹配的GIS或巡检记录',
      human_readable: feedback.old_format_note ? '该条为历史旧口径数据，使用了旧编号系统，且地址无法匹配到其他记录，需要人工确认对应到新系统的哪个灯具。' : '该居民反馈无法关联到具体灯具，请人工确认位置。',
      detected_at: new Date()
    });

    await db.mergedRecords.add(mergedRecord);
    await db.anomalies.bulkAdd(anomalies);

    matchResults.push({ mergedRecord, feedback, anomalies, auditLogs: [] });
  }

  for (const inspection of stillUnmatchedInspections) {
    const mergedRecord: MergedRecord = {
      id: generateId(),
      lamp_id: inspection.lamp_id || 'UNKNOWN',
      inspection_id: inspection.id,
      address: inspection.address,
      match_confidence: 'low',
      match_score: 0,
      match_method: 'unmatched',
      review_status: 'pending',
      review_note: '',
      merged_at: new Date()
    };

    const anomalies = detectAllAnomalies(mergedRecord, undefined, undefined, inspection);
    anomalies.push({
      id: generateId(),
      merged_record_id: mergedRecord.id,
      type: 'boundary_case',
      severity: 'low',
      description: '仅巡检记录，无匹配的GIS或反馈数据',
      human_readable: '该巡检记录无法关联到具体灯具，请人工确认。',
      detected_at: new Date()
    });

    await db.mergedRecords.add(mergedRecord);
    await db.anomalies.bulkAdd(anomalies);

    matchResults.push({ mergedRecord, inspection, anomalies, auditLogs: [] });
  }

  return matchResults;
}

export async function getMatchResults(): Promise<MatchResult[]> {
  const mergedRecords = await db.mergedRecords.toArray();
  const gisPoints = await db.gisPoints.toArray();
  const feedbacks = await db.residentFeedbacks.toArray();
  const inspections = await db.inspectionRecords.toArray();
  const anomalies = await db.anomalies.toArray();
  const auditLogs = await db.auditLogs.toArray();

  const gisMap = new Map(gisPoints.map(g => [g.id, g]));
  const feedbackMap = new Map(feedbacks.map(f => [f.id, f]));
  const inspectionMap = new Map(inspections.map(i => [i.id, i]));
  const anomalyMap = new Map<string, typeof anomalies>();
  const auditMap = new Map<string, typeof auditLogs>();

  anomalies.forEach(a => {
    if (!anomalyMap.has(a.merged_record_id)) {
      anomalyMap.set(a.merged_record_id, []);
    }
    anomalyMap.get(a.merged_record_id)!.push(a);
  });

  auditLogs.forEach(log => {
    if (!auditMap.has(log.record_id)) {
      auditMap.set(log.record_id, []);
    }
    auditMap.get(log.record_id)!.push(log);
  });

  return mergedRecords.map(mr => ({
    mergedRecord: mr,
    gisPoint: mr.gis_point_id ? gisMap.get(mr.gis_point_id) : undefined,
    feedback: mr.feedback_id ? feedbackMap.get(mr.feedback_id) : undefined,
    inspection: mr.inspection_id ? inspectionMap.get(mr.inspection_id) : undefined,
    anomalies: anomalyMap.get(mr.id) || [],
    auditLogs: auditMap.get(mr.id) || []
  }));
}

export async function updateReviewStatus(
  mergedRecordId: string,
  status: 'pending' | 'confirmed' | 'need_verify' | 'on_site',
  note?: string
): Promise<void> {
  const existing = await db.mergedRecords.get(mergedRecordId);
  const oldStatus = existing?.review_status || 'pending';
  const oldNote = existing?.review_note || '';

  await db.mergedRecords.update(mergedRecordId, {
    review_status: status,
    review_note: note || undefined,
    reviewed_at: new Date()
  });

  await db.auditLogs.add({
    id: generateId(),
    record_id: mergedRecordId,
    action: 'status_change',
    old_value: oldStatus,
    new_value: status,
    note: note || '',
    detail: oldStatus !== status
      ? `状态从"${getReviewStatusLabelLocal(oldStatus)}"变更为"${getReviewStatusLabelLocal(status)}"${note ? '，备注：' + note : ''}`
      : `仅更新备注${oldNote !== note ? '（旧备注：' + oldNote + '）' : ''}`,
    created_at: new Date()
  });
}

function getReviewStatusLabelLocal(status: string): string {
  const labels: Record<string, string> = {
    pending: '待复核',
    confirmed: '已处理',
    need_verify: '待核实',
    on_site: '需现场复看'
  };
  return labels[status] || status;
}

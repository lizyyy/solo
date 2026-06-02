import { db } from '@/db';
import { 
  GISPoint, 
  ResidentFeedback, 
  InspectionRecord, 
  MergedRecord, 
  MatchResult,
  MatchConfidence
} from '@/types';
import { calculateMatchScore, getConfidenceFromScore, generateId } from './matching';
import { detectAllAnomalies } from './anomaly';

export interface MatchCandidate {
  gis?: GISPoint;
  feedback?: ResidentFeedback;
  inspection?: InspectionRecord;
  score: number;
}

export async function mergeAllData(): Promise<MatchResult[]> {
  await db.mergedRecords.clear();
  await db.anomalies.clear();

  const gisPoints = await db.gisPoints.toArray();
  const feedbacks = await db.residentFeedbacks.toArray();
  const inspections = await db.inspectionRecords.toArray();

  const allLampIds = new Set<string>();
  gisPoints.forEach(g => g.lamp_id && allLampIds.add(g.lamp_id));
  feedbacks.forEach(f => f.lamp_id && allLampIds.add(f.lamp_id));
  inspections.forEach(i => i.lamp_id && allLampIds.add(i.lamp_id));

  const matchResults: MatchResult[] = [];
  const processedGis = new Set<string>();
  const processedFeedback = new Set<string>();
  const processedInspection = new Set<string>();

  for (const lampId of allLampIds) {
    const gisMatches = gisPoints.filter(g => g.lamp_id === lampId);
    const feedbackMatches = feedbacks.filter(f => f.lamp_id === lampId);
    const inspectionMatches = inspections.filter(i => i.lamp_id === lampId);

    if (gisMatches.length > 0 || feedbackMatches.length > 0 || inspectionMatches.length > 0) {
      const primaryGis = gisMatches[0];
      const primaryFeedback = feedbackMatches[0];
      const primaryInspection = inspectionMatches[0];

      let score = 0;
      const address = primaryGis?.address || primaryFeedback?.address || primaryInspection?.address || '';

      if (primaryGis && primaryFeedback) {
        score += calculateMatchScore(
          primaryGis.lamp_id, primaryFeedback.lamp_id,
          primaryGis.address, primaryFeedback.address,
          primaryGis.latitude, primaryGis.longitude
        );
      }
      if (primaryGis && primaryInspection) {
        score += calculateMatchScore(
          primaryGis.lamp_id, primaryInspection.lamp_id,
          primaryGis.address, primaryInspection.address,
          primaryGis.latitude, primaryGis.longitude
        );
      }
      if (primaryFeedback && primaryInspection) {
        score += calculateMatchScore(
          primaryFeedback.lamp_id, primaryInspection.lamp_id,
          primaryFeedback.address, primaryInspection.address
        );
      }

      score = Math.min(100, score / (
        (primaryGis && primaryFeedback ? 1 : 0) + 
        (primaryGis && primaryInspection ? 1 : 0) + 
        (primaryFeedback && primaryInspection ? 1 : 0) || 1
      ));

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
        anomalies
      });

      gisMatches.forEach(g => processedGis.add(g.id));
      feedbackMatches.forEach(f => processedFeedback.add(f.id));
      inspectionMatches.forEach(i => processedInspection.add(i.id));
    }
  }

  const unmatchedGis = gisPoints.filter(g => !processedGis.has(g.id));
  const unmatchedFeedbacks = feedbacks.filter(f => !processedFeedback.has(f.id));
  const unmatchedInspections = inspections.filter(i => !processedInspection.has(i.id));

  for (const gis of unmatchedGis) {
    const mergedRecord: MergedRecord = {
      id: generateId(),
      lamp_id: gis.lamp_id || 'UNKNOWN',
      gis_point_id: gis.id,
      address: gis.address,
      longitude: gis.longitude,
      latitude: gis.latitude,
      match_confidence: 'low',
      match_score: 0,
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

    matchResults.push({
      mergedRecord,
      gisPoint: gis,
      anomalies
    });
  }

  for (const feedback of unmatchedFeedbacks) {
    const mergedRecord: MergedRecord = {
      id: generateId(),
      lamp_id: feedback.lamp_id || 'UNKNOWN',
      feedback_id: feedback.id,
      address: feedback.address,
      match_confidence: 'low',
      match_score: 0,
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
      human_readable: feedback.old_format_note ? '该条为历史旧口径数据，使用了旧编号系统，需要人工确认对应到新系统的哪个灯具。' : '该居民反馈无法关联到具体灯具，请人工确认位置。',
      detected_at: new Date()
    });

    await db.mergedRecords.add(mergedRecord);
    await db.anomalies.bulkAdd(anomalies);

    matchResults.push({
      mergedRecord,
      feedback,
      anomalies
    });
  }

  for (const inspection of unmatchedInspections) {
    const mergedRecord: MergedRecord = {
      id: generateId(),
      lamp_id: inspection.lamp_id || 'UNKNOWN',
      inspection_id: inspection.id,
      address: inspection.address,
      match_confidence: 'low',
      match_score: 0,
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

    matchResults.push({
      mergedRecord,
      inspection,
      anomalies
    });
  }

  return matchResults;
}

export async function getMatchResults(): Promise<MatchResult[]> {
  const mergedRecords = await db.mergedRecords.toArray();
  const gisPoints = await db.gisPoints.toArray();
  const feedbacks = await db.residentFeedbacks.toArray();
  const inspections = await db.inspectionRecords.toArray();
  const anomalies = await db.anomalies.toArray();

  const gisMap = new Map(gisPoints.map(g => [g.id, g]));
  const feedbackMap = new Map(feedbacks.map(f => [f.id, f]));
  const inspectionMap = new Map(inspections.map(i => [i.id, i]));
  const anomalyMap = new Map<string, typeof anomalies>();

  anomalies.forEach(a => {
    if (!anomalyMap.has(a.merged_record_id)) {
      anomalyMap.set(a.merged_record_id, []);
    }
    anomalyMap.get(a.merged_record_id)!.push(a);
  });

  return mergedRecords.map(mr => ({
    mergedRecord: mr,
    gisPoint: mr.gis_point_id ? gisMap.get(mr.gis_point_id) : undefined,
    feedback: mr.feedback_id ? feedbackMap.get(mr.feedback_id) : undefined,
    inspection: mr.inspection_id ? inspectionMap.get(mr.inspection_id) : undefined,
    anomalies: anomalyMap.get(mr.id) || []
  }));
}

export async function updateReviewStatus(
  mergedRecordId: string,
  status: 'pending' | 'confirmed' | 'need_verify' | 'on_site',
  note?: string
): Promise<void> {
  await db.mergedRecords.update(mergedRecordId, {
    review_status: status,
    review_note: note || undefined,
    reviewed_at: new Date()
  });
}

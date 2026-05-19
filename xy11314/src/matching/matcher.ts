import { dao } from '../database/dao';
import { ParentComplaint, GPSRecord, DriverCheckin, StopSchedule, MatchRecord } from '../types';

const EARTH_RADIUS = 6371000;

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS * c;
}

function parseTime(timeStr: string): Date {
  return new Date(timeStr.replace(' ', 'T'));
}

function formatTime(date: Date): string {
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

export async function matchComplaint(complaintId: number): Promise<MatchRecord | null> {
  const complaint = await dao.getComplaintById(complaintId);
  if (!complaint) {
    return null;
  }

  const scheduledDateTime = `${complaint.scheduledDate} ${complaint.scheduledTime}`;
  const scheduledTime = parseTime(scheduledDateTime);
  const startTime = addMinutes(scheduledTime, -30);
  const endTime = addMinutes(scheduledTime, 60);

  let stopSchedule = await dao.getStopSchedule(
    complaint.routeId,
    complaint.stopId,
    formatTime(scheduledTime)
  );

  if (!stopSchedule) {
    stopSchedule = await dao.getStopSchedule(
      complaint.routeId,
      complaint.stopId,
      complaint.scheduledTime
    );
  }

  if (!stopSchedule) {
    stopSchedule = {
      id: 0,
      routeId: complaint.routeId,
      stopId: complaint.stopId,
      stopName: '未知站点',
      scheduledTime: complaint.scheduledTime,
      latitude: 0,
      longitude: 0,
      importBatchId: ''
    };
  }

  const allGPSRecords = await dao.getGPSByDriverAndTimeRange(
    'DRIVER001',
    formatTime(startTime),
    formatTime(endTime)
  );

  const nearbyGPSRecords = allGPSRecords.filter(gps => {
    if (stopSchedule.latitude === 0 && stopSchedule.longitude === 0) {
      return true;
    }
    const distance = haversineDistance(
      gps.latitude,
      gps.longitude,
      stopSchedule.latitude,
      stopSchedule.longitude
    );
    return distance <= 500;
  });

  const checkinRecords = await dao.getCheckinsByRouteAndStop(
    complaint.routeId,
    complaint.stopId,
    complaint.scheduledDate
  );

  let timeDiscrepancyMinutes = 0;
  let distanceDiscrepancyMeters = 0;

  if (nearbyGPSRecords.length > 0) {
    const firstNearbyGPS = nearbyGPSRecords[0];
    const gpsTime = parseTime(firstNearbyGPS.timestamp);
    timeDiscrepancyMinutes = (gpsTime.getTime() - scheduledTime.getTime()) / 60000;
    if (stopSchedule.latitude !== 0 || stopSchedule.longitude !== 0) {
      distanceDiscrepancyMeters = haversineDistance(
        firstNearbyGPS.latitude,
        firstNearbyGPS.longitude,
        stopSchedule.latitude,
        stopSchedule.longitude
      );
    } else {
      distanceDiscrepancyMeters = 0;
    }
  }

  const confidence = calculateMatchConfidence(
    nearbyGPSRecords.length,
    checkinRecords.length,
    Math.abs(timeDiscrepancyMinutes)
  );

  const matchRecord: MatchRecord = {
    complaintId: complaint.id!,
    gpsRecords: nearbyGPSRecords.map(g => g.id!),
    checkinRecords: checkinRecords.map(c => c.id!),
    stopScheduleId: stopSchedule.id!,
    matchConfidence: confidence,
    timeDiscrepancyMinutes,
    distanceDiscrepancyMeters,
    status: 'matched'
  };

  const matchId = await dao.insertMatchRecord(matchRecord);
  matchRecord.id = matchId;

  await dao.updateComplaintStatus(complaint.id!, 'matched');

  await dao.insertAuditLog({
    entityType: 'complaint',
    entityId: complaint.id!,
    action: 'match',
    details: JSON.stringify({
      matchId,
      confidence,
      gpsRecordsCount: nearbyGPSRecords.length,
      checkinRecordsCount: checkinRecords.length
    }),
    operator: 'system',
    timestamp: formatTime(new Date())
  });

  return matchRecord;
}

export async function matchAllPendingComplaints(): Promise<number> {
  const pendingComplaints = await dao.getComplaintsByStatus('pending');
  let matchedCount = 0;

  for (const complaint of pendingComplaints) {
    const match = await matchComplaint(complaint.id!);
    if (match) {
      matchedCount++;
    }
  }

  return matchedCount;
}

function calculateMatchConfidence(
  gpsCount: number,
  checkinCount: number,
  timeDiffMinutes: number
): number {
  let confidence = 0;

  if (gpsCount > 0) {
    confidence += 0.4;
    if (gpsCount >= 3) confidence += 0.1;
  }

  if (checkinCount > 0) {
    confidence += 0.3;
  }

  if (timeDiffMinutes <= 5) {
    confidence += 0.2;
  } else if (timeDiffMinutes <= 15) {
    confidence += 0.1;
  }

  return Math.min(confidence, 1.0);
}

export function explainMatch(match: MatchRecord): string[] {
  const explanations: string[] = [];

  explanations.push(`匹配置信度: ${(match.matchConfidence * 100).toFixed(1)}%`);
  explanations.push(`时间差异: ${match.timeDiscrepancyMinutes > 0 ? '晚' : '早'} ${Math.abs(match.timeDiscrepancyMinutes).toFixed(1)} 分钟`);
  explanations.push(`距离差异: ${match.distanceDiscrepancyMeters.toFixed(1)} 米`);

  if (match.gpsRecords.length > 0) {
    explanations.push(`找到 ${match.gpsRecords.length} 条相关 GPS 轨迹记录`);
  } else {
    explanations.push('警告: 未找到附近的 GPS 轨迹记录');
  }

  if (match.checkinRecords.length > 0) {
    explanations.push(`找到 ${match.checkinRecords.length} 条司机打卡记录`);
  } else {
    explanations.push('警告: 未找到司机打卡记录');
  }

  if (match.matchConfidence < 0.5) {
    explanations.push('建议: 该匹配需要人工复核');
  }

  return explanations;
}

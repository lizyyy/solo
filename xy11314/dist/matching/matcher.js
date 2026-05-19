"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchComplaint = matchComplaint;
exports.matchAllPendingComplaints = matchAllPendingComplaints;
exports.explainMatch = explainMatch;
const dao_1 = require("../database/dao");
const EARTH_RADIUS = 6371000;
function haversineDistance(lat1, lng1, lat2, lng2) {
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS * c;
}
function parseTime(timeStr) {
    return new Date(timeStr.replace(' ', 'T'));
}
function formatTime(date) {
    return date.toISOString().replace('T', ' ').substring(0, 19);
}
function addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60000);
}
async function matchComplaint(complaintId) {
    const complaint = await dao_1.dao.getComplaintById(complaintId);
    if (!complaint) {
        return null;
    }
    const scheduledDateTime = `${complaint.scheduledDate} ${complaint.scheduledTime}`;
    const scheduledTime = parseTime(scheduledDateTime);
    const startTime = addMinutes(scheduledTime, -30);
    const endTime = addMinutes(scheduledTime, 60);
    const stopSchedule = await dao_1.dao.getStopSchedule(complaint.routeId, complaint.stopId, formatTime(scheduledTime));
    if (!stopSchedule) {
        return null;
    }
    const allGPSRecords = await dao_1.dao.getGPSByDriverAndTimeRange('DRIVER001', formatTime(startTime), formatTime(endTime));
    const nearbyGPSRecords = allGPSRecords.filter(gps => {
        const distance = haversineDistance(gps.latitude, gps.longitude, stopSchedule.latitude, stopSchedule.longitude);
        return distance <= 500;
    });
    const checkinRecords = await dao_1.dao.getCheckinsByRouteAndStop(complaint.routeId, complaint.stopId, complaint.scheduledDate);
    let timeDiscrepancyMinutes = 0;
    let distanceDiscrepancyMeters = 0;
    if (nearbyGPSRecords.length > 0) {
        const firstNearbyGPS = nearbyGPSRecords[0];
        const gpsTime = parseTime(firstNearbyGPS.timestamp);
        timeDiscrepancyMinutes = (gpsTime.getTime() - scheduledTime.getTime()) / 60000;
        distanceDiscrepancyMeters = haversineDistance(firstNearbyGPS.latitude, firstNearbyGPS.longitude, stopSchedule.latitude, stopSchedule.longitude);
    }
    const confidence = calculateMatchConfidence(nearbyGPSRecords.length, checkinRecords.length, Math.abs(timeDiscrepancyMinutes));
    const matchRecord = {
        complaintId: complaint.id,
        gpsRecords: nearbyGPSRecords.map(g => g.id),
        checkinRecords: checkinRecords.map(c => c.id),
        stopScheduleId: stopSchedule.id,
        matchConfidence: confidence,
        timeDiscrepancyMinutes,
        distanceDiscrepancyMeters,
        status: 'matched'
    };
    const matchId = await dao_1.dao.insertMatchRecord(matchRecord);
    matchRecord.id = matchId;
    await dao_1.dao.updateComplaintStatus(complaint.id, 'matched');
    await dao_1.dao.insertAuditLog({
        entityType: 'complaint',
        entityId: complaint.id,
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
async function matchAllPendingComplaints() {
    const pendingComplaints = await dao_1.dao.getComplaintsByStatus('pending');
    let matchedCount = 0;
    for (const complaint of pendingComplaints) {
        const match = await matchComplaint(complaint.id);
        if (match) {
            matchedCount++;
        }
    }
    return matchedCount;
}
function calculateMatchConfidence(gpsCount, checkinCount, timeDiffMinutes) {
    let confidence = 0;
    if (gpsCount > 0) {
        confidence += 0.4;
        if (gpsCount >= 3)
            confidence += 0.1;
    }
    if (checkinCount > 0) {
        confidence += 0.3;
    }
    if (timeDiffMinutes <= 5) {
        confidence += 0.2;
    }
    else if (timeDiffMinutes <= 15) {
        confidence += 0.1;
    }
    return Math.min(confidence, 1.0);
}
function explainMatch(match) {
    const explanations = [];
    explanations.push(`匹配置信度: ${(match.matchConfidence * 100).toFixed(1)}%`);
    explanations.push(`时间差异: ${match.timeDiscrepancyMinutes > 0 ? '晚' : '早'} ${Math.abs(match.timeDiscrepancyMinutes).toFixed(1)} 分钟`);
    explanations.push(`距离差异: ${match.distanceDiscrepancyMeters.toFixed(1)} 米`);
    if (match.gpsRecords.length > 0) {
        explanations.push(`找到 ${match.gpsRecords.length} 条相关 GPS 轨迹记录`);
    }
    else {
        explanations.push('警告: 未找到附近的 GPS 轨迹记录');
    }
    if (match.checkinRecords.length > 0) {
        explanations.push(`找到 ${match.checkinRecords.length} 条司机打卡记录`);
    }
    else {
        explanations.push('警告: 未找到司机打卡记录');
    }
    if (match.matchConfidence < 0.5) {
        explanations.push('建议: 该匹配需要人工复核');
    }
    return explanations;
}

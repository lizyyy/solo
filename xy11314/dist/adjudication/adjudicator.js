"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adjudicateComplaint = adjudicateComplaint;
exports.adjudicateAllMatchedComplaints = adjudicateAllMatchedComplaints;
exports.reviewAdjudication = reviewAdjudication;
exports.explainAdjudication = explainAdjudication;
const dao_1 = require("../database/dao");
const ADJUDICATION_RULES = [
    { code: 'LATE_OVER_30_MIN', description: 'GPS显示迟到超过30分钟', weight: 0.8 },
    { code: 'LATE_15_30_MIN', description: 'GPS显示迟到15-30分钟', weight: 0.6 },
    { code: 'LATE_5_15_MIN', description: 'GPS显示迟到5-15分钟', weight: 0.4 },
    { code: 'NO_CHECKIN', description: '司机未打卡', weight: 0.5 },
    { code: 'NO_GPS_NEARBY', description: '站点附近无GPS记录', weight: 0.7 },
    { code: 'DISTANCE_TOO_FAR', description: '最近GPS点距离站点超过200米', weight: 0.5 },
    { code: 'LOW_MATCH_CONFIDENCE', description: '匹配置信度低', weight: 0.3 }
];
function formatTime(date) {
    return date.toISOString().replace('T', ' ').substring(0, 19);
}
async function adjudicateComplaint(complaintId) {
    const match = await dao_1.dao.getMatchByComplaintId(complaintId);
    if (!match) {
        return null;
    }
    const complaint = await dao_1.dao.getComplaintById(complaintId);
    if (!complaint) {
        return null;
    }
    const { result, confidence, reasons, evidence } = analyzeEvidence(match, complaint);
    const adjudication = {
        matchId: match.id,
        complaintId: complaint.id,
        result,
        confidence,
        reasons,
        evidence,
        adjudicator: 'system',
        adjudicatedAt: formatTime(new Date()),
        reviewStatus: 'pending_review'
    };
    const adjudicationId = await dao_1.dao.insertAdjudication(adjudication);
    adjudication.id = adjudicationId;
    await dao_1.dao.updateComplaintStatus(complaint.id, 'adjudicated');
    await dao_1.dao.insertAuditLog({
        entityType: 'adjudication',
        entityId: adjudicationId,
        action: 'adjudicate',
        details: JSON.stringify({
            complaintId: complaint.id,
            result,
            confidence,
            reasons
        }),
        operator: 'system',
        timestamp: formatTime(new Date())
    });
    return adjudication;
}
async function adjudicateAllMatchedComplaints() {
    const matchedComplaints = await dao_1.dao.getComplaintsByStatus('matched');
    let adjudicatedCount = 0;
    for (const complaint of matchedComplaints) {
        const adjudication = await adjudicateComplaint(complaint.id);
        if (adjudication) {
            adjudicatedCount++;
        }
    }
    return adjudicatedCount;
}
function analyzeEvidence(match, complaint) {
    const reasons = [];
    let driverFaultScore = 0;
    let trafficFaultScore = 0;
    let totalWeight = 0;
    if (match.gpsRecords.length === 0) {
        reasons.push('站点附近无GPS记录，无法确认车辆位置');
        driverFaultScore += 0.7;
        totalWeight += 0.7;
    }
    if (match.checkinRecords.length === 0) {
        reasons.push('司机未在该站点进行打卡');
        driverFaultScore += 0.5;
        totalWeight += 0.5;
    }
    if (match.timeDiscrepancyMinutes > 30) {
        reasons.push(`GPS显示车辆迟到 ${match.timeDiscrepancyMinutes.toFixed(1)} 分钟`);
        driverFaultScore += 0.8;
        totalWeight += 0.8;
    }
    else if (match.timeDiscrepancyMinutes > 15) {
        reasons.push(`GPS显示车辆迟到 ${match.timeDiscrepancyMinutes.toFixed(1)} 分钟`);
        driverFaultScore += 0.6;
        totalWeight += 0.6;
    }
    else if (match.timeDiscrepancyMinutes > 5) {
        reasons.push(`GPS显示车辆迟到 ${match.timeDiscrepancyMinutes.toFixed(1)} 分钟`);
        driverFaultScore += 0.4;
        totalWeight += 0.4;
    }
    if (match.distanceDiscrepancyMeters > 200) {
        reasons.push(`最近GPS点距离站点 ${match.distanceDiscrepancyMeters.toFixed(1)} 米`);
        trafficFaultScore += 0.5;
        totalWeight += 0.5;
    }
    if (match.matchConfidence < 0.5) {
        reasons.push(`数据匹配置信度较低 (${(match.matchConfidence * 100).toFixed(1)}%)`);
    }
    let result;
    let confidence = 0;
    if (totalWeight === 0) {
        result = 'undetermined';
        reasons.push('证据不足，无法判定责任');
        confidence = 0.3;
    }
    else if (driverFaultScore >= trafficFaultScore && driverFaultScore > 0.5) {
        result = 'driver_fault';
        confidence = driverFaultScore / totalWeight;
    }
    else if (trafficFaultScore > driverFaultScore && trafficFaultScore > 0.5) {
        result = 'traffic_fault';
        confidence = trafficFaultScore / totalWeight;
    }
    else {
        result = 'undetermined';
        reasons.push('证据不足以明确判定责任，建议人工复核');
        confidence = Math.max(driverFaultScore, trafficFaultScore);
    }
    const evidence = {
        gpsEvidence: `共匹配 ${match.gpsRecords.length} 条GPS记录`,
        checkinEvidence: `共匹配 ${match.checkinRecords.length} 条打卡记录`,
        scheduleEvidence: `计划时间: ${complaint.scheduledDate} ${complaint.scheduledTime}`,
        timeDiscrepancy: `${match.timeDiscrepancyMinutes > 0 ? '晚' : '早'} ${Math.abs(match.timeDiscrepancyMinutes).toFixed(1)} 分钟`,
        distanceDiscrepancy: `${match.distanceDiscrepancyMeters.toFixed(1)} 米`
    };
    return { result, confidence, reasons, evidence };
}
async function reviewAdjudication(adjudicationId, reviewer, reviewStatus, reviewNotes) {
    await dao_1.dao.updateAdjudicationReview(adjudicationId, reviewStatus, reviewer, reviewNotes);
    const adjudication = await dao_1.dao.getAdjudicationByMatchId(adjudicationId);
    if (adjudication) {
        await dao_1.dao.insertAuditLog({
            entityType: 'adjudication',
            entityId: adjudicationId,
            action: 'review',
            details: JSON.stringify({
                reviewStatus,
                reviewNotes,
                previousStatus: adjudication.reviewStatus
            }),
            operator: reviewer,
            timestamp: formatTime(new Date())
        });
    }
}
function explainAdjudication(adjudication) {
    const explanations = [];
    const resultLabels = {
        driver_fault: '司机责任',
        traffic_fault: '交通或路况原因',
        parent_fault: '家长原因',
        system_error: '系统错误',
        undetermined: '待人工复核'
    };
    explanations.push(`裁定结果: ${resultLabels[adjudication.result]}`);
    explanations.push(`裁定置信度: ${(adjudication.confidence * 100).toFixed(1)}%`);
    explanations.push(`裁定时间: ${adjudication.adjudicatedAt}`);
    explanations.push('');
    explanations.push('裁定理由:');
    adjudication.reasons.forEach((reason, index) => {
        explanations.push(`  ${index + 1}. ${reason}`);
    });
    if (adjudication.reviewStatus !== 'pending_review') {
        explanations.push('');
        explanations.push(`复核状态: ${adjudication.reviewStatus === 'confirmed' ? '已确认' : '已推翻'}`);
        explanations.push(`复核人: ${adjudication.reviewedBy}`);
        if (adjudication.reviewNotes) {
            explanations.push(`复核备注: ${adjudication.reviewNotes}`);
        }
    }
    return explanations;
}

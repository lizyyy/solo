const Reservation = require('../models/Reservation');
const config = require('../config');

function generateReservationNo() {
  const date = new Date();
  const timestamp = date.getTime().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `RES${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}${timestamp}${random}`;
}

function isTimeOverlap(window1, window2) {
  const start1 = new Date(window1.start).getTime();
  const end1 = new Date(window1.end).getTime();
  const start2 = new Date(window2.start).getTime();
  const end2 = new Date(window2.end).getTime();
  
  return !(end1 <= start2 || end2 <= start1);
}

function getOverlapWindow(window1, window2) {
  const start1 = new Date(window1.start).getTime();
  const end1 = new Date(window1.end).getTime();
  const start2 = new Date(window2.start).getTime();
  const end2 = new Date(window2.end).getTime();
  
  if (!isTimeOverlap(window1, window2)) {
    return null;
  }
  
  return {
    start: new Date(Math.max(start1, start2)),
    end: new Date(Math.min(end1, end2))
  };
}

function hasMatchingLabels(labels1, labels2) {
  if (!labels1 || !labels2 || labels1.length === 0 || labels2.length === 0) {
    return true;
  }
  
  for (const label1 of labels1) {
    for (const label2 of labels2) {
      if (label1.name === label2.name && label1.value === label2.value) {
        return true;
      }
    }
  }
  
  return false;
}

async function detectConflicts(newReservation, excludeId = null) {
  const activeStatuses = [
    config.reservation.status.PENDING,
    config.reservation.status.APPROVED,
    config.reservation.status.ACTIVE
  ];
  
  let query = {
    status: { $in: activeStatuses },
    _id: { $ne: excludeId }
  };
  
  const existingReservations = await Reservation.find(query).lean();
  
  const conflicts = [];
  
  for (const existing of existingReservations) {
    const hasLabelMatch = hasMatchingLabels(
      newReservation.machineLabels,
      existing.machineLabels
    );
    
    if (!hasLabelMatch) {
      continue;
    }
    
    const overlapWindow = getOverlapWindow(
      newReservation.drillWindow,
      existing.drillWindow
    );
    
    if (overlapWindow) {
      conflicts.push({
        reservationId: existing._id,
        reservationNo: existing.reservationNo,
        applicant: existing.applicant,
        applicantDepartment: existing.applicantDepartment,
        purpose: existing.purpose,
        overlappedWindow: overlapWindow,
        releasePlan: existing.release ? `计划于 ${existing.release.releasedAt} 释放` : '暂无释放计划',
        description: `资源 ${existing.machineLabels.map(l => `${l.name}=${l.value}`).join(', ')} 在 ${overlapWindow.start.toISOString()} 至 ${overlapWindow.end.toISOString()} 期间被占用`
      });
    }
  }
  
  return conflicts;
}

async function createReservation(reservationData) {
  const reservationNo = generateReservationNo();
  
  const reservation = new Reservation({
    ...reservationData,
    reservationNo,
    status: config.reservation.status.PENDING
  });
  
  const conflicts = await detectConflicts(reservation);
  
  if (conflicts.length > 0) {
    reservation.conflicts = conflicts.map(c => ({
      reservationId: c.reservationId,
      overlappedWindow: c.overlappedWindow,
      releasePlan: c.releasePlan,
      description: c.description
    }));
    
    reservation.conflictDescription = `检测到 ${conflicts.length} 个资源冲突`;
  }
  
  await reservation.save();
  
  return {
    reservation,
    conflicts
  };
}

async function getConflicts(reservationId) {
  const reservation = await Reservation.findById(reservationId);
  if (!reservation) {
    throw new Error('预留记录不存在');
  }
  
  const conflicts = await detectConflicts(reservation, reservation._id);
  return conflicts;
}

async function checkConflictsByTimeWindow(start, end, machineLabels = []) {
  const conflicts = await detectConflicts({
    drillWindow: { start, end },
    machineLabels
  });
  
  return conflicts;
}

async function approveReservation(reservationId, approvalData) {
  const reservation = await Reservation.findById(reservationId);
  if (!reservation) {
    throw new Error('预留记录不存在');
  }
  
  if (reservation.status !== config.reservation.status.PENDING) {
    throw new Error('只能审批待审批的预留记录');
  }
  
  reservation.status = config.reservation.status.APPROVED;
  reservation.approval = {
    approver: approvalData.approver,
    comment: approvalData.comment
  };
  
  await reservation.save();
  return reservation;
}

async function releaseReservation(reservationId, releaseData) {
  const reservation = await Reservation.findById(reservationId);
  if (!reservation) {
    throw new Error('预留记录不存在');
  }
  
  const activeStatuses = [
    config.reservation.status.APPROVED,
    config.reservation.status.ACTIVE
  ];
  
  if (!activeStatuses.includes(reservation.status)) {
    throw new Error('只能释放已批准或活跃的预留记录');
  }
  
  reservation.status = config.reservation.status.RELEASED;
  reservation.release = {
    releasedBy: releaseData.releasedBy,
    releasedAt: new Date(),
    reason: releaseData.reason
  };
  
  await reservation.save();
  return reservation;
}

async function generateOccupancyProof(reservationId) {
  const reservation = await Reservation.findById(reservationId);
  if (!reservation) {
    throw new Error('预留记录不存在');
  }
  
  const proof = {
    reservationNo: reservation.reservationNo,
    applicant: reservation.applicant,
    applicantDepartment: reservation.applicantDepartment,
    purpose: reservation.purpose,
    drillWindow: {
      start: reservation.drillWindow.start,
      end: reservation.drillWindow.end
    },
    machineLabels: reservation.machineLabels,
    pressureTestResource: reservation.pressureTestResource,
    status: reservation.status,
    approval: reservation.approval ? {
      approver: reservation.approval.approver,
      approvedAt: reservation.approval.approvedAt,
      comment: reservation.approval.comment
    } : null,
    release: reservation.release ? {
      releasedBy: reservation.release.releasedBy,
      releasedAt: reservation.release.releasedAt,
      reason: reservation.release.reason
    } : null,
    generatedAt: new Date()
  };
  
  return proof;
}

async function getAllReservations(filters = {}) {
  const query = {};
  if (filters.status) {
    query.status = filters.status;
  }
  if (filters.applicant) {
    query.applicant = filters.applicant;
  }
  
  return await Reservation.find(query).sort({ createdAt: -1 });
}

async function getReservationById(reservationId) {
  return await Reservation.findById(reservationId);
}

module.exports = {
  createReservation,
  getConflicts,
  checkConflictsByTimeWindow,
  approveReservation,
  releaseReservation,
  generateOccupancyProof,
  getAllReservations,
  getReservationById,
  isTimeOverlap
};

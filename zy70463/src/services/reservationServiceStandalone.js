const store = require('../storage/memoryStore');

const RESERVATION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  ACTIVE: 'active',
  RELEASED: 'released',
  EXPIRED: 'expired'
};

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
    RESERVATION_STATUS.PENDING,
    RESERVATION_STATUS.APPROVED,
    RESERVATION_STATUS.ACTIVE
  ];

  const existingReservations = store.findReservations().filter(r => {
    return activeStatuses.includes(r.status) && r._id !== excludeId;
  });

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
        releasePlan: existing.release 
          ? `于 ${existing.release.releasedAt.toISOString()} 已释放` 
          : '暂无释放计划',
        description: `资源 ${existing.machineLabels.map(l => `${l.name}=${l.value}`).join(', ')} 在 ${overlapWindow.start.toISOString()} 至 ${overlapWindow.end.toISOString()} 期间被占用`
      });
    }
  }

  return conflicts;
}

async function createReservation(reservationData) {
  const tempReservation = {
    ...reservationData,
    _id: 'temp',
    status: RESERVATION_STATUS.PENDING
  };

  const conflicts = await detectConflicts(tempReservation);

  const reservation = store.createReservation({
    ...reservationData,
    status: RESERVATION_STATUS.PENDING,
    conflicts: conflicts.map(c => ({
      reservationId: c.reservationId,
      overlappedWindow: c.overlappedWindow,
      releasePlan: c.releasePlan,
      description: c.description
    })),
    conflictDescription: conflicts.length > 0 ? `检测到 ${conflicts.length} 个资源冲突` : null
  });

  return {
    reservation,
    conflicts
  };
}

async function getConflicts(reservationId) {
  const reservation = store.findReservationById(reservationId);
  if (!reservation) {
    throw new Error('预留记录不存在');
  }
  return await detectConflicts(reservation, reservationId);
}

async function checkConflictsByTimeWindow(start, end, machineLabels = []) {
  return await detectConflicts({
    drillWindow: { start, end },
    machineLabels
  });
}

async function approveReservation(reservationId, approvalData) {
  const reservation = store.findReservationById(reservationId);
  if (!reservation) {
    throw new Error('预留记录不存在');
  }
  if (reservation.status !== RESERVATION_STATUS.PENDING) {
    throw new Error('只能审批待审批的预留记录');
  }

  return store.updateReservation(reservationId, {
    status: RESERVATION_STATUS.APPROVED,
    approval: {
      approver: approvalData.approver,
      approvedAt: new Date(),
      comment: approvalData.comment
    }
  });
}

async function releaseReservation(reservationId, releaseData) {
  const reservation = store.findReservationById(reservationId);
  if (!reservation) {
    throw new Error('预留记录不存在');
  }

  const activeStatuses = [
    RESERVATION_STATUS.APPROVED,
    RESERVATION_STATUS.ACTIVE
  ];

  if (!activeStatuses.includes(reservation.status)) {
    throw new Error('只能释放已批准或活跃的预留记录');
  }

  return store.updateReservation(reservationId, {
    status: RESERVATION_STATUS.RELEASED,
    release: {
      releasedBy: releaseData.releasedBy,
      releasedAt: new Date(),
      reason: releaseData.reason
    }
  });
}

async function generateOccupancyProof(reservationId) {
  const reservation = store.findReservationById(reservationId);
  if (!reservation) {
    throw new Error('预留记录不存在');
  }

  return {
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
}

async function getAllReservations(filters = {}) {
  return store.findReservations(filters);
}

async function getReservationById(reservationId) {
  return store.findReservationById(reservationId);
}

function clearAllData() {
  store.clearAll();
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
  isTimeOverlap,
  clearAllData,
  RESERVATION_STATUS
};

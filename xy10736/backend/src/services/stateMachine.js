const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const EVENT_STATES = {
  RECEIVED: 'received',
  VALIDATED: 'validated',
  PROCESSED: 'processed',
  FAILED: 'failed'
};

const DETECTION_STATES = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  RESOLVED: 'resolved',
  DISMISSED: 'dismissed'
};

const SESSION_STATES = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

const VERSION_STATES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

class StateMachine {
  async transitionEventStatus(eventId, newStatus) {
    const validTransitions = {
      [EVENT_STATES.RECEIVED]: [EVENT_STATES.VALIDATED, EVENT_STATES.FAILED],
      [EVENT_STATES.VALIDATED]: [EVENT_STATES.PROCESSED, EVENT_STATES.FAILED],
      [EVENT_STATES.PROCESSED]: [],
      [EVENT_STATES.FAILED]: []
    };

    const event = await prisma.pageEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new Error('事件不存在');

    if (!validTransitions[event.status].includes(newStatus)) {
      throw new Error(`无效的状态转换: ${event.status} -> ${newStatus}`);
    }

    const updated = await prisma.pageEvent.update({
      where: { id: eventId },
      data: { status: newStatus }
    });

    await this.recalculateSessionDetections(updated.sessionId);
    return updated;
  }

  async transitionDetectionStatus(detectionId, newStatus, operator, reason) {
    const validTransitions = {
      [DETECTION_STATES.PENDING]: [DETECTION_STATES.CONFIRMED, DETECTION_STATES.DISMISSED],
      [DETECTION_STATES.CONFIRMED]: [DETECTION_STATES.RESOLVED, DETECTION_STATES.DISMISSED],
      [DETECTION_STATES.RESOLVED]: [],
      [DETECTION_STATES.DISMISSED]: []
    };

    const detection = await prisma.missingDetection.findUnique({ where: { id: detectionId } });
    if (!detection) throw new Error('检测记录不存在');

    if (!validTransitions[detection.status].includes(newStatus)) {
      throw new Error(`无效的状态转换: ${detection.status} -> ${newStatus}`);
    }

    await prisma.reviewLog.create({
      data: {
        detectionId,
        action: `状态变更: ${this.getDetectionStatusText(detection.status)} -> ${this.getDetectionStatusText(newStatus)}`,
        reason,
        operator
      }
    });

    const updateData = { status: newStatus };
    if (newStatus === DETECTION_STATES.RESOLVED) {
      updateData.resolvedBy = operator;
      updateData.resolvedAt = new Date();
    }

    return prisma.missingDetection.update({
      where: { id: detectionId },
      data: updateData
    });
  }

  async transitionSessionStatus(sessionId, newStatus) {
    const validTransitions = {
      [SESSION_STATES.ACTIVE]: [SESSION_STATES.COMPLETED, SESSION_STATES.CANCELLED],
      [SESSION_STATES.COMPLETED]: [],
      [SESSION_STATES.CANCELLED]: []
    };

    const session = await prisma.debugSession.findUnique({ where: { sessionId } });
    if (!session) throw new Error('会话不存在');

    if (!validTransitions[session.status].includes(newStatus)) {
      throw new Error(`无效的状态转换`);
    }

    const updated = await prisma.debugSession.update({
      where: { sessionId },
      data: {
        status: newStatus,
        endTime: new Date()
      }
    });

    if (newStatus === SESSION_STATES.COMPLETED) {
      await this.recalculateSessionDetections(sessionId);
    }

    return updated;
  }

  async transitionVersionStatus(versionId, newStatus, reviewer, reason) {
    const validTransitions = {
      [VERSION_STATES.PENDING]: [VERSION_STATES.APPROVED, VERSION_STATES.REJECTED],
      [VERSION_STATES.APPROVED]: [],
      [VERSION_STATES.REJECTED]: []
    };

    const version = await prisma.versionRelease.findUnique({ where: { id: versionId } });
    if (!version) throw new Error('版本不存在');

    if (!validTransitions[version.status].includes(newStatus)) {
      throw new Error(`无效的状态转换`);
    }

    return prisma.versionRelease.update({
      where: { id: versionId },
      data: {
        status: newStatus,
        reviewedBy: reviewer,
        reviewedAt: new Date(),
        reviewReason: reason
      }
    });
  }

  async recalculateSessionDetections(sessionId) {
    const session = await prisma.debugSession.findUnique({
      where: { sessionId },
      include: {
        pageEvents: true,
        missingDetections: true
      }
    });

    if (!session) throw new Error('会话不存在');

    const activePoints = await prisma.trackingPoint.findMany({
      where: { version: session.version, status: 'active' }
    });

    const receivedCodes = new Set(session.pageEvents.map(e => e.trackingCode));
    const missingPoints = activePoints.filter(p => !receivedCodes.has(p.code));
    const existingMissingCodes = new Set(session.missingDetections.map(d => d.trackingCode));

    const toCreate = missingPoints.filter(p => !existingMissingCodes.has(p.code));
    const toKeep = missingPoints.map(p => p.code);

    const promises = [];

    for (const point of toCreate) {
      promises.push(
        prisma.missingDetection.create({
          data: {
            sessionId,
            trackingCode: point.code,
            expectedTime: session.startTime,
            status: DETECTION_STATES.PENDING
          }
        })
      );
    }

    for (const detection of session.missingDetections) {
      if (!toKeep.includes(detection.trackingCode) && detection.status !== DETECTION_STATES.RESOLVED) {
        promises.push(
          prisma.missingDetection.update({
            where: { id: detection.id },
            data: { status: DETECTION_STATES.RESOLVED, resolvedAt: new Date(), resolvedBy: 'System' }
          })
        );
      }
    }

    await Promise.all(promises);
    return { created: toCreate.length, autoResolved: promises.length - toCreate.length };
  }

  getDetectionStatusText(status) {
    const map = {
      pending: '待确认',
      confirmed: '已确认',
      resolved: '已解决',
      dismissed: '已忽略'
    };
    return map[status] || status;
  }
}

module.exports = new StateMachine();
module.exports.STATES = {
  EVENT: EVENT_STATES,
  DETECTION: DETECTION_STATES,
  SESSION: SESSION_STATES,
  VERSION: VERSION_STATES
};

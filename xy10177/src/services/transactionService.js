const db = require('../db');
const { generateId, now, AppError } = require('../utils');
const { RESOURCE_TYPES, LOCK_TYPES } = require('./resourceService');
const {
  acquireLock,
  releaseLocksByTransaction,
  getLocksByTransaction,
} = require('./lockService');
const {
  checkRescheduleConflicts,
  getMeetingBookings,
  findAllAlternatives,
} = require('./conflictService');
const {
  MEETING_STATUSES,
  getMeeting,
  updateMeeting,
  createBooking,
  cancelBookingsByMeeting,
  cancelMeeting,
} = require('./meetingService');
const { sendCallback } = require('./callbackService');

const TRANSACTION_TYPES = {
  CREATE: 'create',
  RESCHEDULE: 'reschedule',
  CANCEL: 'cancel',
};

const TRANSACTION_STATUSES = {
  INITIATED: 'initiated',
  CONFLICT_CHECKING: 'conflict_checking',
  LOCKING: 'locking',
  APPLYING: 'applying',
  CALLBACK: 'callback',
  COMPLETED: 'completed',
  COMPENSATING: 'compensating',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

const STEP_NAMES = {
  VALIDATE_INPUT: 'validate_input',
  CHECK_CONFLICTS: 'check_conflicts',
  LOCK_NEW_RESOURCES: 'lock_new_resources',
  UPDATE_MEETING: 'update_meeting',
  CREATE_NEW_BOOKINGS: 'create_new_bookings',
  CANCEL_OLD_BOOKINGS: 'cancel_old_bookings',
  RELEASE_OLD_LOCKS: 'release_old_locks',
  SEND_CALLBACK: 'send_callback',
};

function createTransaction(type, meetingId, data = {}, callbackUrl = null) {
  const id = generateId();
  const stmt = db.prepare(`
    INSERT INTO transactions (
      id, type, meeting_id,
      old_start_time, old_end_time, old_room_id, old_device_id, old_catering_id,
      new_start_time, new_end_time, new_room_id, new_device_id, new_catering_id,
      status, step, retry_count, callback_url, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    id, type, meetingId,
    data.oldStartTime || null,
    data.oldEndTime || null,
    data.oldRoomId || null,
    data.oldDeviceId || null,
    data.oldCateringId || null,
    data.newStartTime || null,
    data.newEndTime || null,
    data.newRoomId || null,
    data.newDeviceId || null,
    data.newCateringId || null,
    TRANSACTION_STATUSES.INITIATED,
    null,
    0,
    callbackUrl,
    now(),
    now()
  );

  return getTransaction(id);
}

function getTransaction(id) {
  return db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
}

function getTransactionWithSteps(id) {
  const transaction = getTransaction(id);
  if (!transaction) return null;

  const steps = db.prepare(`
    SELECT * FROM transaction_steps WHERE transaction_id = ? ORDER BY step_order ASC
  `).all(id);

  return {
    ...transaction,
    steps,
  };
}

function listTransactions(meetingId = null, status = null) {
  let query = 'SELECT * FROM transactions WHERE 1=1';
  const params = [];

  if (meetingId) {
    query += ' AND meeting_id = ?';
    params.push(meetingId);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC';
  return db.prepare(query).all(...params);
}

function updateTransaction(id, updates) {
  const validUpdates = { ...updates, updated_at: now() };
  const setClauses = Object.keys(validUpdates).map(field => `${field} = ?`);
  const values = [...Object.values(validUpdates), id];

  const stmt = db.prepare(`UPDATE transactions SET ${setClauses.join(', ')} WHERE id = ?`);
  stmt.run(...values);
  return getTransaction(id);
}

function createTransactionStep(transactionId, stepOrder, stepName, status, result = null, errorMessage = null) {
  const id = generateId();
  const stmt = db.prepare(`
    INSERT INTO transaction_steps (
      id, transaction_id, step_order, step_name, status, result, error_message, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id, transactionId, stepOrder, stepName, status,
    result ? JSON.stringify(result) : null,
    errorMessage,
    now(),
    now()
  );
  return id;
}

function addHistory(meetingId, transactionId, action, oldValues, newValues, actor = 'system') {
  const id = generateId();
  const stmt = db.prepare(`
    INSERT INTO history (
      id, meeting_id, transaction_id, action, old_values, new_values, actor, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id, meetingId, transactionId, action,
    oldValues ? JSON.stringify(oldValues) : null,
    newValues ? JSON.stringify(newValues) : null,
    actor,
    now()
  );
  return id;
}

function getHistory(meetingId, limit = 50) {
  return db.prepare(`
    SELECT * FROM history WHERE meeting_id = ? ORDER BY created_at DESC LIMIT ?
  `).all(meetingId, limit);
}

function lockResourcesForTransaction(transactionId, meetingId, roomId, deviceId, cateringId) {
  const locks = [];
  
  if (roomId) {
    locks.push(acquireLock(RESOURCE_TYPES.ROOM, roomId, meetingId, transactionId, LOCK_TYPES.PENDING));
  }
  if (deviceId) {
    locks.push(acquireLock(RESOURCE_TYPES.DEVICE, deviceId, meetingId, transactionId, LOCK_TYPES.PENDING));
  }
  if (cateringId) {
    locks.push(acquireLock(RESOURCE_TYPES.CATERING, cateringId, meetingId, transactionId, LOCK_TYPES.PENDING));
  }

  return locks;
}

function executeRescheduleTransaction(meetingId, newData, actor = 'system') {
  const meeting = getMeeting(meetingId);
  if (!meeting) {
    throw new AppError(`Meeting not found: ${meetingId}`, 404, 'MEETING_NOT_FOUND');
  }

  if (meeting.status === MEETING_STATUSES.CANCELLED) {
    throw new AppError('Cannot reschedule cancelled meeting', 400, 'MEETING_CANCELLED');
  }

  const currentBookings = getMeetingBookings(meetingId);
  const oldRoomId = currentBookings.find(b => b.resource_type === RESOURCE_TYPES.ROOM)?.resource_id;
  const oldDeviceId = currentBookings.find(b => b.resource_type === RESOURCE_TYPES.DEVICE)?.resource_id;
  const oldCateringId = currentBookings.find(b => b.resource_type === RESOURCE_TYPES.CATERING)?.resource_id;

  const newStartTime = newData.start_time || meeting.start_time;
  const newEndTime = newData.end_time || meeting.end_time;
  const newRoomId = newData.room_id !== undefined ? newData.room_id : oldRoomId;
  const newDeviceId = newData.device_id !== undefined ? newData.device_id : oldDeviceId;
  const newCateringId = newData.catering_id !== undefined ? newData.catering_id : oldCateringId;

  const transaction = createTransaction(
    TRANSACTION_TYPES.RESCHEDULE,
    meetingId,
    {
      oldStartTime: meeting.start_time,
      oldEndTime: meeting.end_time,
      oldRoomId,
      oldDeviceId,
      oldCateringId,
      newStartTime,
      newEndTime,
      newRoomId,
      newDeviceId,
      newCateringId,
    },
    newData.callback_url
  );

  let stepOrder = 0;

  try {
    stepOrder++;
    updateTransaction(transaction.id, {
      status: TRANSACTION_STATUSES.INITIATED,
      step: STEP_NAMES.VALIDATE_INPUT,
    });

    const startTime = new Date(newStartTime.replace(' ', 'T'));
    const endTime = new Date(newEndTime.replace(' ', 'T'));
    if (startTime >= endTime) {
      const errMsg = 'End time must be after start time';
      createTransactionStep(
        transaction.id,
        stepOrder,
        STEP_NAMES.VALIDATE_INPUT,
        'failed',
        null,
        errMsg
      );
      updateTransaction(transaction.id, {
        status: TRANSACTION_STATUSES.FAILED,
        step: null,
        error_message: errMsg,
      });

      return {
        success: false,
        transaction_id: transaction.id,
        error: 'INVALID_TIME_RANGE',
        message: errMsg,
      };
    }

    createTransactionStep(
      transaction.id,
      stepOrder,
      STEP_NAMES.VALIDATE_INPUT,
      'completed'
    );
    updateTransaction(transaction.id, {
      status: TRANSACTION_STATUSES.CONFLICT_CHECKING,
      step: STEP_NAMES.VALIDATE_INPUT,
    });

    stepOrder++;
    updateTransaction(transaction.id, { step: STEP_NAMES.CHECK_CONFLICTS });
    const conflicts = checkRescheduleConflicts(
      meetingId,
      newRoomId,
      newDeviceId,
      newCateringId,
      newStartTime,
      newEndTime
    );

    if (!conflicts.available) {
      const alternatives = findAllAlternatives(
        newRoomId,
        newDeviceId,
        newCateringId,
        newStartTime,
        newEndTime
      );
      createTransactionStep(
        transaction.id,
        stepOrder,
        STEP_NAMES.CHECK_CONFLICTS,
        'failed',
        null,
        JSON.stringify(conflicts)
      );
      updateTransaction(transaction.id, {
        status: TRANSACTION_STATUSES.FAILED,
        step: STEP_NAMES.CHECK_CONFLICTS,
        error_message: 'Conflicts detected',
      });

      return {
        success: false,
        transaction_id: transaction.id,
        error: 'RESOURCE_CONFLICT',
        conflicts: conflicts.conflicts,
        alternatives,
      };
    }

    createTransactionStep(
      transaction.id,
      stepOrder,
      STEP_NAMES.CHECK_CONFLICTS,
      'completed',
      { available: true }
    );

    stepOrder++;
    updateTransaction(transaction.id, {
      status: TRANSACTION_STATUSES.LOCKING,
      step: STEP_NAMES.LOCK_NEW_RESOURCES,
    });

    let locks = [];
    try {
      locks = lockResourcesForTransaction(
        transaction.id,
        meetingId,
        newRoomId,
        newDeviceId,
        newCateringId
      );
      createTransactionStep(
        transaction.id,
        stepOrder,
        STEP_NAMES.LOCK_NEW_RESOURCES,
        'completed',
        { lock_count: locks.length }
      );
    } catch (lockErr) {
      createTransactionStep(
        transaction.id,
        stepOrder,
        STEP_NAMES.LOCK_NEW_RESOURCES,
        'failed',
        null,
        lockErr.message
      );
      updateTransaction(transaction.id, {
        status: TRANSACTION_STATUSES.FAILED,
        step: STEP_NAMES.LOCK_NEW_RESOURCES,
        error_message: lockErr.message,
      });

      return {
        success: false,
        transaction_id: transaction.id,
        error: 'LOCK_FAILED',
        message: lockErr.message,
      };
    }

    stepOrder++;
    updateTransaction(transaction.id, {
      status: TRANSACTION_STATUSES.APPLYING,
      step: STEP_NAMES.UPDATE_MEETING,
    });

    const oldValues = {
      start_time: meeting.start_time,
      end_time: meeting.end_time,
      room_id: oldRoomId,
      device_id: oldDeviceId,
      catering_id: oldCateringId,
    };

    const newValues = {
      start_time: newStartTime,
      end_time: newEndTime,
      room_id: newRoomId,
      device_id: newDeviceId,
      catering_id: newCateringId,
    };

    updateMeeting(meetingId, {
      start_time: newStartTime,
      end_time: newEndTime,
    });
    createTransactionStep(
      transaction.id,
      stepOrder,
      STEP_NAMES.UPDATE_MEETING,
      'completed'
    );

    stepOrder++;
    updateTransaction(transaction.id, { step: STEP_NAMES.CREATE_NEW_BOOKINGS });
    cancelBookingsByMeeting(meetingId);

    if (newRoomId) {
      createBooking(meetingId, RESOURCE_TYPES.ROOM, newRoomId, newStartTime, newEndTime);
    }
    if (newDeviceId) {
      createBooking(meetingId, RESOURCE_TYPES.DEVICE, newDeviceId, newStartTime, newEndTime);
    }
    if (newCateringId) {
      createBooking(meetingId, RESOURCE_TYPES.CATERING, newCateringId, newStartTime, newEndTime);
    }

    createTransactionStep(
      transaction.id,
      stepOrder,
      STEP_NAMES.CREATE_NEW_BOOKINGS,
      'completed'
    );

    stepOrder++;
    updateTransaction(transaction.id, { step: STEP_NAMES.RELEASE_OLD_LOCKS });
    releaseLocksByTransaction(transaction.id);
    createTransactionStep(
      transaction.id,
      stepOrder,
      STEP_NAMES.RELEASE_OLD_LOCKS,
      'completed'
    );

    stepOrder++;
    updateTransaction(transaction.id, {
      status: TRANSACTION_STATUSES.COMPLETED,
      step: null,
    });

    addHistory(
      meetingId,
      transaction.id,
      'rescheduled',
      oldValues,
      newValues,
      actor
    );

    if (newData.callback_url) {
      setImmediate(() => {
        sendCallback(
          transaction.id,
          meetingId,
          TRANSACTION_TYPES.RESCHEDULE,
          {
            old: oldValues,
            new: newValues,
          }
        ).catch(err => {
          console.error('[Async Callback] Failed:', err);
        });
      });
    }

    return {
      success: true,
      transaction_id: transaction.id,
      meeting_id: meetingId,
      message: 'Meeting rescheduled successfully',
    };
  } catch (err) {
    updateTransaction(transaction.id, {
      status: TRANSACTION_STATUSES.COMPENSATING,
      error_message: err.message,
    });

    try {
      compensateReschedule(transaction.id, meetingId);
    } catch (compErr) {
      console.error('Compensation failed:', compErr);
    }

    updateTransaction(transaction.id, {
      status: TRANSACTION_STATUSES.FAILED,
    });

    throw err;
  }
}

function compensateReschedule(transactionId, meetingId) {
  const transaction = getTransaction(transactionId);
  if (!transaction) return;

  releaseLocksByTransaction(transactionId);

  if (transaction.old_start_time || transaction.old_end_time) {
    const updates = {};
    if (transaction.old_start_time) updates.start_time = transaction.old_start_time;
    if (transaction.old_end_time) updates.end_time = transaction.old_end_time;
    
    if (Object.keys(updates).length > 0) {
      try {
        updateMeeting(meetingId, updates);
      } catch (e) {
        console.error('Failed to restore meeting time:', e);
      }
    }
  }

  cancelBookingsByMeeting(meetingId);

  if (transaction.old_room_id) {
    try {
      createBooking(
        meetingId,
        RESOURCE_TYPES.ROOM,
        transaction.old_room_id,
        transaction.old_start_time,
        transaction.old_end_time
      );
    } catch (e) {
      console.error('Failed to restore room booking:', e);
    }
  }

  if (transaction.old_device_id) {
    try {
      createBooking(
        meetingId,
        RESOURCE_TYPES.DEVICE,
        transaction.old_device_id,
        transaction.old_start_time,
        transaction.old_end_time
      );
    } catch (e) {
      console.error('Failed to restore device booking:', e);
    }
  }

  if (transaction.old_catering_id) {
    try {
      createBooking(
        meetingId,
        RESOURCE_TYPES.CATERING,
        transaction.old_catering_id,
        transaction.old_start_time,
        transaction.old_end_time
      );
    } catch (e) {
      console.error('Failed to restore catering booking:', e);
    }
  }
}

function executeCancelTransaction(meetingId, actor = 'system', callbackUrl = null) {
  const meeting = getMeeting(meetingId);
  if (!meeting) {
    throw new AppError(`Meeting not found: ${meetingId}`, 404, 'MEETING_NOT_FOUND');
  }

  if (meeting.status === MEETING_STATUSES.CANCELLED) {
    throw new AppError('Meeting is already cancelled', 400, 'ALREADY_CANCELLED');
  }

  const currentBookings = getMeetingBookings(meetingId);
  const oldRoomId = currentBookings.find(b => b.resource_type === RESOURCE_TYPES.ROOM)?.resource_id;
  const oldDeviceId = currentBookings.find(b => b.resource_type === RESOURCE_TYPES.DEVICE)?.resource_id;
  const oldCateringId = currentBookings.find(b => b.resource_type === RESOURCE_TYPES.CATERING)?.resource_id;

  const transaction = createTransaction(
    TRANSACTION_TYPES.CANCEL,
    meetingId,
    {
      oldStartTime: meeting.start_time,
      oldEndTime: meeting.end_time,
      oldRoomId,
      oldDeviceId,
      oldCateringId,
    },
    callbackUrl
  );

  try {
    cancelBookingsByMeeting(meetingId);
    cancelMeeting(meetingId);

    updateTransaction(transaction.id, {
      status: TRANSACTION_STATUSES.COMPLETED,
    });

    addHistory(
      meetingId,
      transaction.id,
      'cancelled',
      { status: meeting.status },
      { status: MEETING_STATUSES.CANCELLED },
      actor
    );

    if (callbackUrl) {
      setImmediate(() => {
        sendCallback(
          transaction.id,
          meetingId,
          TRANSACTION_TYPES.CANCEL,
          {
            cancelled_at: now(),
            original_start_time: meeting.start_time,
          }
        ).catch(err => {
          console.error('[Async Callback] Failed:', err);
        });
      });
    }

    return {
      success: true,
      transaction_id: transaction.id,
      meeting_id: meetingId,
      message: 'Meeting cancelled successfully',
    };
  } catch (err) {
    updateTransaction(transaction.id, {
      status: TRANSACTION_STATUSES.FAILED,
      error_message: err.message,
    });
    throw err;
  }
}

module.exports = {
  TRANSACTION_TYPES,
  TRANSACTION_STATUSES,
  STEP_NAMES,
  createTransaction,
  getTransaction,
  getTransactionWithSteps,
  listTransactions,
  updateTransaction,
  addHistory,
  getHistory,
  executeRescheduleTransaction,
  executeCancelTransaction,
  compensateReschedule,
};

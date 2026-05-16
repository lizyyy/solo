const { v4: uuidv4 } = require('uuid');
const { db } = require('../database/schema');
const { REPLAY_STATES, BATCH_STATES, VALIDATION_STATES, EXCEPTION_STATES, INTERCEPTION_STATUS } = require('../utils/constants');
const { desensitizeObject, validateDesensitization } = require('../utils/desensitizer');
const { logOperation } = require('./auditService');

const validateBatchBelongsToNamespace = (batchId, namespace) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM event_batches WHERE id = ?`, [batchId], (err, batch) => {
      if (err) {
        reject(err);
        return;
      }
      if (!batch) {
        reject(new Error(`批次 ${batchId} 不存在`));
        return;
      }
      if (batch.namespace !== namespace) {
        reject(new Error(`批次 ${batchId} 不属于命名空间 ${namespace}, 实际属于 ${batch.namespace}`));
        return;
      }
      resolve(batch);
    });
  });
};

const validateSpaceBelongsToNamespace = (spaceId, namespace) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT id, namespace FROM isolation_spaces WHERE id = ?`, [spaceId], (err, space) => {
      if (err) {
        reject(err);
        return;
      }
      if (!space) {
        reject(new Error(`隔离空间 ${spaceId} 不存在`));
        return;
      }
      if (space.namespace !== namespace) {
        reject(new Error(`隔离空间 ${spaceId} 不属于命名空间 ${namespace}, 实际属于 ${space.namespace}`));
        return;
      }
      resolve(space);
    });
  });
};

const validatePayloadBelongsToBatch = (payloadId, batchId, namespace) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT id, batch_id, namespace FROM desensitized_payloads WHERE id = ?`, [payloadId], (err, payload) => {
      if (err) {
        reject(err);
        return;
      }
      if (!payload) {
        reject(new Error(`载荷 ${payloadId} 不存在`));
        return;
      }
      if (payload.batch_id !== batchId) {
        reject(new Error(`载荷 ${payloadId} 不属于批次 ${batchId}, 实际属于 ${payload.batch_id}`));
        return;
      }
      if (payload.namespace !== namespace) {
        reject(new Error(`载荷 ${payloadId} 不属于命名空间 ${namespace}, 实际属于 ${payload.namespace}`));
        return;
      }
      resolve(payload);
    });
  });
};

const validateExceptionBelongsToBatch = (exceptionId, batchId, namespace) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT id, batch_id, namespace FROM exception_records WHERE id = ?`, [exceptionId], (err, exception) => {
      if (err) {
        reject(err);
        return;
      }
      if (!exception) {
        reject(new Error(`异常记录 ${exceptionId} 不存在`));
        return;
      }
      if (exception.batch_id !== batchId) {
        reject(new Error(`异常记录 ${exceptionId} 不属于批次 ${batchId}, 实际属于 ${exception.batch_id}`));
        return;
      }
      if (exception.namespace !== namespace) {
        reject(new Error(`异常记录 ${exceptionId} 不属于命名空间 ${namespace}, 实际属于 ${exception.namespace}`));
        return;
      }
      resolve(exception);
    });
  });
};

const createIsolationSpace = (namespace, name, description, createdBy, config = {}, ipAddress, userAgent) => {
  return new Promise((resolve, reject) => {
    const id = uuidv4();
    const now = Date.now();
    
    db.run(
      `INSERT INTO isolation_spaces (id, namespace, name, description, created_by, created_at, updated_at, status, config)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [id, namespace, name, description, createdBy, now, now, JSON.stringify(config)],
      async (err) => {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            reject(new Error('命名空间已存在'));
          } else {
            reject(err);
          }
          return;
        }
        
        await logOperation('CREATE', 'isolation_space', id, null, { namespace, name, description }, createdBy, namespace, ipAddress, userAgent);
        resolve({ id, namespace, name, description, createdBy, createdAt: now });
      }
    );
  });
};

const getIsolationSpaces = (limit = 50, offset = 0) => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM isolation_spaces ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(row => ({
          ...row,
          config: row.config ? JSON.parse(row.config) : {}
        })));
      }
    );
  });
};

const createEventBatch = (spaceId, namespace, batchName, sourceSystem, createdBy, eventCount = 0, ipAddress, userAgent) => {
  return new Promise((resolve, reject) => {
    validateSpaceBelongsToNamespace(spaceId, namespace)
      .then(() => {
        const id = uuidv4();
        const now = Date.now();
        
        db.run(
          `INSERT INTO event_batches (id, space_id, namespace, batch_name, source_system, event_count, status, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, spaceId, namespace, batchName, sourceSystem, eventCount, BATCH_STATES.PENDING, createdBy, now, now],
          async (err) => {
            if (err) {
              reject(err);
              return;
            }
            
            const replayStatusId = uuidv4();
            db.run(
              `INSERT INTO replay_status (id, batch_id, space_id, namespace, current_state, progress_percent, processed_count, success_count, failed_count, skipped_count)
               VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0, 0)`,
              [replayStatusId, id, spaceId, namespace, REPLAY_STATES.PENDING],
              (err2) => {
                if (err2) reject(err2);
              }
            );
            
            await logOperation('CREATE', 'event_batch', id, null, { spaceId, batchName, sourceSystem }, createdBy, namespace, ipAddress, userAgent);
            resolve({ id, spaceId, namespace, batchName, sourceSystem, createdBy, createdAt: now });
          }
        );
      })
      .catch(reject);
  });
};

const addDesensitizedPayload = (batchId, spaceId, namespace, originalEventId, eventType, originalPayload, desensitizedPayload, desensitizationRules, desensitizedBy, ipAddress, userAgent) => {
  return new Promise((resolve, reject) => {
    Promise.all([
      validateBatchBelongsToNamespace(batchId, namespace),
      validateSpaceBelongsToNamespace(spaceId, namespace)
    ])
      .then(([batch, space]) => {
        if (batch.space_id !== spaceId) {
          throw new Error(`批次 ${batchId} 所属空间 ${batch.space_id} 与传入的 spaceId ${spaceId} 不一致`);
        }
        
        const id = uuidv4();
        const now = Date.now();
        
        const validation = validateDesensitization(originalPayload, desensitizedPayload, desensitizationRules || {});
        const validationStatus = validation.valid ? VALIDATION_STATES.VALID : VALIDATION_STATES.NEEDS_REVIEW;
        
        db.run(
          `INSERT INTO desensitized_payloads (id, batch_id, space_id, namespace, original_event_id, event_type, original_payload, desensitized_payload, desensitization_rules, desensitized_at, desensitized_by, validation_status, validation_message)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, batchId, spaceId, namespace, originalEventId, eventType, JSON.stringify(originalPayload), JSON.stringify(desensitizedPayload), JSON.stringify(desensitizationRules), now, desensitizedBy, validationStatus, validation.issues.join('; ')],
          async (err) => {
            if (err) {
              reject(err);
              return;
            }
            
            await logOperation('CREATE', 'payload', id, null, { batchId, eventType, validationStatus }, desensitizedBy || 'system', namespace, ipAddress, userAgent);
            
            db.run(
              `UPDATE event_batches SET event_count = event_count + 1, updated_at = ? WHERE id = ?`,
              [now, batchId]
            );
            
            resolve({ id, batchId, eventType, validationStatus, validationIssues: validation.issues, createdAt: now });
          }
        );
      })
      .catch(reject);
  });
};

const advanceReplayState = (batchId, namespace, newState, operatedBy, ipAddress, userAgent) => {
  return new Promise((resolve, reject) => {
    validateBatchBelongsToNamespace(batchId, namespace)
      .then(() => {
        const validTransitions = {
          [REPLAY_STATES.PENDING]: [REPLAY_STATES.VALIDATING, REPLAY_STATES.CANCELLED],
          [REPLAY_STATES.VALIDATING]: [REPLAY_STATES.READY, REPLAY_STATES.FAILED],
          [REPLAY_STATES.READY]: [REPLAY_STATES.RUNNING, REPLAY_STATES.CANCELLED],
          [REPLAY_STATES.RUNNING]: [REPLAY_STATES.PAUSED, REPLAY_STATES.COMPLETED, REPLAY_STATES.FAILED],
          [REPLAY_STATES.PAUSED]: [REPLAY_STATES.RUNNING, REPLAY_STATES.CANCELLED],
          [REPLAY_STATES.COMPLETED]: [],
          [REPLAY_STATES.FAILED]: [REPLAY_STATES.READY],
          [REPLAY_STATES.CANCELLED]: []
        };
        
        db.get(`SELECT * FROM replay_status WHERE batch_id = ?`, [batchId], async (err, currentStatus) => {
          if (err) {
            reject(err);
            return;
          }
          
          if (!currentStatus) {
            reject(new Error('回放状态不存在'));
            return;
          }
          
          const allowedStates = validTransitions[currentStatus.current_state];
          if (!allowedStates.includes(newState)) {
            reject(new Error(`状态转换不允许: ${currentStatus.current_state} -> ${newState}`));
            return;
          }
          
          const now = Date.now();
          const updates = { current_state: newState, last_heartbeat_at: now };
          
          if (newState === REPLAY_STATES.RUNNING) {
            updates.started_at = now;
          } else if (newState === REPLAY_STATES.COMPLETED || newState === REPLAY_STATES.FAILED) {
            updates.completed_at = now;
          }
          
          const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
          const values = Object.values(updates);
          values.push(batchId);
          
          db.run(
            `UPDATE replay_status SET ${setClauses} WHERE batch_id = ?`,
            values,
            async (err2) => {
              if (err2) {
                reject(err2);
                return;
              }
              
              const batchStateMap = {
                [REPLAY_STATES.RUNNING]: BATCH_STATES.REPLAYING,
                [REPLAY_STATES.COMPLETED]: BATCH_STATES.COMPLETED,
                [REPLAY_STATES.FAILED]: BATCH_STATES.FAILED
              };
              
              if (batchStateMap[newState]) {
                db.run(`UPDATE event_batches SET status = ?, updated_at = ? WHERE id = ?`, [batchStateMap[newState], now, batchId]);
              }
              
              await logOperation('UPDATE', 'replay_status', batchId, { current_state: currentStatus.current_state }, { current_state: newState }, operatedBy, namespace, ipAddress, userAgent);
              resolve({ batchId, previousState: currentStatus.current_state, newState, transitionedAt: now });
            }
          );
        });
      })
      .catch(reject);
  });
};

const recordWriteInterception = (batchId, spaceId, namespace, payloadId, originalTarget, interceptedTarget, interceptionRules, interceptionStatus, responseData, operatedBy) => {
  return new Promise((resolve, reject) => {
    Promise.all([
      validateBatchBelongsToNamespace(batchId, namespace),
      validateSpaceBelongsToNamespace(spaceId, namespace),
      validatePayloadBelongsToBatch(payloadId, batchId, namespace)
    ])
      .then(([batch, space, payload]) => {
        if (batch.space_id !== spaceId) {
          throw new Error(`批次 ${batchId} 所属空间 ${batch.space_id} 与传入的 spaceId ${spaceId} 不一致`);
        }
        
        const id = uuidv4();
        const now = Date.now();
        
        db.run(
          `INSERT INTO write_interceptions (id, batch_id, space_id, namespace, payload_id, original_target, intercepted_target, intercepted_at, interception_rules, interception_status, response_data)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, batchId, spaceId, namespace, payloadId, originalTarget, interceptedTarget, now, JSON.stringify(interceptionRules), interceptionStatus, JSON.stringify(responseData)],
          (err) => {
            if (err) {
              reject(err);
              return;
            }
            
            db.get(`SELECT * FROM replay_status WHERE batch_id = ?`, [batchId], (err2, status) => {
              if (err2) {
                reject(err2);
                return;
              }
              
              if (status) {
                const isSuccess = interceptionStatus === INTERCEPTION_STATUS.REDIRECTED || interceptionStatus === INTERCEPTION_STATUS.ALLOWED;
                db.run(
                  `UPDATE replay_status SET processed_count = processed_count + 1, success_count = success_count + ?, failed_count = failed_count + ?, last_heartbeat_at = ? WHERE batch_id = ?`,
                  [isSuccess ? 1 : 0, isSuccess ? 0 : 1, now, batchId]
                );
              }
            });
            
            resolve({ id, batchId, payloadId, originalTarget, interceptedTarget, interceptionStatus, interceptedAt: now });
          }
        );
      })
      .catch(reject);
  });
};

const recordException = (batchId, spaceId, namespace, payloadId, exceptionType, errorMessage, errorStack, originalInput, processingEvidence, operatedBy) => {
  return new Promise((resolve, reject) => {
    const validations = [
      validateBatchBelongsToNamespace(batchId, namespace),
      validateSpaceBelongsToNamespace(spaceId, namespace)
    ];
    
    if (payloadId) {
      validations.push(validatePayloadBelongsToBatch(payloadId, batchId, namespace));
    }
    
    Promise.all(validations)
      .then(([batch, space]) => {
        if (batch.space_id !== spaceId) {
          throw new Error(`批次 ${batchId} 所属空间 ${batch.space_id} 与传入的 spaceId ${spaceId} 不一致`);
        }
        
        const id = uuidv4();
        const now = Date.now();
        
        db.run(
          `INSERT INTO exception_records (id, batch_id, space_id, namespace, payload_id, exception_type, error_message, error_stack, original_input, processing_evidence, occurred_at, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, batchId, spaceId, namespace, payloadId, exceptionType, errorMessage, errorStack, JSON.stringify(originalInput), JSON.stringify(processingEvidence), now, EXCEPTION_STATES.OPEN],
          (err) => {
            if (err) {
              reject(err);
              return;
            }
            
            db.get(`SELECT * FROM replay_status WHERE batch_id = ?`, [batchId], (err2, status) => {
              if (status) {
                db.run(
                  `UPDATE replay_status SET failed_count = failed_count + 1, last_heartbeat_at = ? WHERE batch_id = ?`,
                  [now, batchId]
                );
              }
            });
            
            resolve({ id, batchId, exceptionType, errorMessage, occurredAt: now });
          }
        );
      })
      .catch(reject);
  });
};

const createManualCorrection = (batchId, spaceId, namespace, payloadId, exceptionId, correctionType, originalValue, correctedValue, correctionReason, correctedBy, ipAddress, userAgent) => {
  return new Promise((resolve, reject) => {
    const validations = [
      validateBatchBelongsToNamespace(batchId, namespace),
      validateSpaceBelongsToNamespace(spaceId, namespace)
    ];
    
    if (payloadId) {
      validations.push(validatePayloadBelongsToBatch(payloadId, batchId, namespace));
    }
    if (exceptionId) {
      validations.push(validateExceptionBelongsToBatch(exceptionId, batchId, namespace));
    }
    
    Promise.all(validations)
      .then(([batch, space]) => {
        if (batch.space_id !== spaceId) {
          throw new Error(`批次 ${batchId} 所属空间 ${batch.space_id} 与传入的 spaceId ${spaceId} 不一致`);
        }
        
        const id = uuidv4();
        const now = Date.now();
        
        db.run(
          `INSERT INTO manual_corrections (id, batch_id, space_id, namespace, payload_id, exception_id, correction_type, original_value, corrected_value, correction_reason, corrected_by, corrected_at, approval_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
          [id, batchId, spaceId, namespace, payloadId, exceptionId, correctionType, originalValue ? JSON.stringify(originalValue) : null, JSON.stringify(correctedValue), correctionReason, correctedBy, now],
          async (err) => {
            if (err) {
              reject(err);
              return;
            }
            
            await logOperation('CREATE', 'manual_correction', id, null, { correctionType, correctionReason }, correctedBy, namespace, ipAddress, userAgent);
            resolve({ id, batchId, correctionType, correctedBy, correctedAt: now });
          }
        );
      })
      .catch(reject);
  });
};

const createReviewSummary = (batchId, spaceId, namespace, summaryTitle, summaryContent, rootCause, impactAssessment, correctiveActions, createdBy, ipAddress, userAgent) => {
  return new Promise((resolve, reject) => {
    Promise.all([
      validateBatchBelongsToNamespace(batchId, namespace),
      validateSpaceBelongsToNamespace(spaceId, namespace)
    ])
      .then(([batch, space]) => {
        if (batch.space_id !== spaceId) {
          throw new Error(`批次 ${batchId} 所属空间 ${batch.space_id} 与传入的 spaceId ${spaceId} 不一致`);
        }
        
        const id = uuidv4();
        const now = Date.now();
        
        db.run(
          `INSERT INTO replay_reviews (id, batch_id, space_id, namespace, summary_title, summary_content, root_cause, impact_assessment, corrective_actions, created_at, updated_at, review_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
          [id, batchId, spaceId, namespace, summaryTitle, summaryContent, rootCause, impactAssessment, JSON.stringify(correctiveActions), now, now],
          async (err) => {
            if (err) {
              reject(err);
              return;
            }
            
            await logOperation('CREATE', 'review_summary', id, null, { summaryTitle, batchId }, createdBy, namespace, ipAddress, userAgent);
            resolve({ id, batchId, summaryTitle, createdBy, createdAt: now });
          }
        );
      })
      .catch(reject);
  });
};

const getBatchDetail = (batchId, namespace) => {
  return new Promise((resolve, reject) => {
    validateBatchBelongsToNamespace(batchId, namespace)
      .then((batch) => {
        db.get(`SELECT * FROM replay_status WHERE batch_id = ?`, [batchId], (err2, status) => {
          if (err2) {
            reject(err2);
            return;
          }
          
          db.all(`SELECT * FROM desensitized_payloads WHERE batch_id = ? ORDER BY desensitized_at DESC LIMIT 10`, [batchId], (err3, payloads) => {
            if (err3) {
              reject(err3);
              return;
            }
            
            db.all(`SELECT * FROM exception_records WHERE batch_id = ? ORDER BY occurred_at DESC LIMIT 10`, [batchId], (err4, exceptions) => {
              if (err4) {
                reject(err4);
                return;
              }
              
              db.get(`SELECT * FROM replay_reviews WHERE batch_id = ? LIMIT 1`, [batchId], (err5, review) => {
                if (err5) {
                  reject(err5);
                  return;
                }
                
                resolve({
                  batch: {
                    ...batch,
                    config: batch.config ? JSON.parse(batch.config) : {}
                  },
                  replayStatus: status,
                  recentPayloads: payloads.map(p => ({
                    ...p,
                    original_payload: p.original_payload ? JSON.parse(p.original_payload) : null,
                    desensitized_payload: p.desensitized_payload ? JSON.parse(p.desensitized_payload) : null,
                    desensitization_rules: p.desensitization_rules ? JSON.parse(p.desensitization_rules) : null
                  })),
                  recentExceptions: exceptions.map(e => ({
                    ...e,
                    original_input: e.original_input ? JSON.parse(e.original_input) : null,
                    processing_evidence: e.processing_evidence ? JSON.parse(e.processing_evidence) : null
                  })),
                  review: review ? {
                    ...review,
                    corrective_actions: review.corrective_actions ? JSON.parse(review.corrective_actions) : null
                  } : null
                });
              });
            });
          });
        });
      })
      .catch(reject);
  });
};

module.exports = {
  createIsolationSpace,
  getIsolationSpaces,
  createEventBatch,
  addDesensitizedPayload,
  advanceReplayState,
  recordWriteInterception,
  recordException,
  createManualCorrection,
  createReviewSummary,
  getBatchDetail,
  validateBatchBelongsToNamespace,
  validateSpaceBelongsToNamespace,
  validatePayloadBelongsToBatch,
  validateExceptionBelongsToBatch
};

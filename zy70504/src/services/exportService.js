const { db } = require('../database/schema');
const { Parser } = require('json2csv');
const { validateBatchBelongsToNamespace } = require('./replayService');

const validateDataConsistency = (batchId, namespace, payloads, interceptions, exceptions, corrections, status) => {
  const inconsistencies = [];
  
  const wrongNamespacePayloads = payloads.filter(p => p.namespace !== namespace);
  if (wrongNamespacePayloads.length > 0) {
    inconsistencies.push(`${wrongNamespacePayloads.length} 个载荷 namespace 不匹配`);
  }
  
  const wrongBatchPayloads = payloads.filter(p => p.batch_id !== batchId);
  if (wrongBatchPayloads.length > 0) {
    inconsistencies.push(`${wrongBatchPayloads.length} 个载荷 batch_id 不匹配`);
  }
  
  const wrongNamespaceInterceptions = interceptions.filter(i => i.namespace !== namespace);
  if (wrongNamespaceInterceptions.length > 0) {
    inconsistencies.push(`${wrongNamespaceInterceptions.length} 个拦截记录 namespace 不匹配`);
  }
  
  const wrongBatchInterceptions = interceptions.filter(i => i.batch_id !== batchId);
  if (wrongBatchInterceptions.length > 0) {
    inconsistencies.push(`${wrongBatchInterceptions.length} 个拦截记录 batch_id 不匹配`);
  }
  
  const wrongNamespaceExceptions = exceptions.filter(e => e.namespace !== namespace);
  if (wrongNamespaceExceptions.length > 0) {
    inconsistencies.push(`${wrongNamespaceExceptions.length} 个异常记录 namespace 不匹配`);
  }
  
  const wrongBatchExceptions = exceptions.filter(e => e.batch_id !== batchId);
  if (wrongBatchExceptions.length > 0) {
    inconsistencies.push(`${wrongBatchExceptions.length} 个异常记录 batch_id 不匹配`);
  }
  
  const wrongNamespaceCorrections = corrections.filter(c => c.namespace !== namespace);
  if (wrongNamespaceCorrections.length > 0) {
    inconsistencies.push(`${wrongNamespaceCorrections.length} 个修正记录 namespace 不匹配`);
  }
  
  const wrongBatchCorrections = corrections.filter(c => c.batch_id !== batchId);
  if (wrongBatchCorrections.length > 0) {
    inconsistencies.push(`${wrongBatchCorrections.length} 个修正记录 batch_id 不匹配`);
  }
  
  if (status && status.batch_id !== batchId) {
    inconsistencies.push('回放状态 batch_id 不匹配');
  }
  
  if (status && status.namespace !== namespace) {
    inconsistencies.push('回放状态 namespace 不匹配');
  }
  
  return inconsistencies;
};

const exportBatchData = (batchId, namespace, format = 'json') => {
  return new Promise((resolve, reject) => {
    validateBatchBelongsToNamespace(batchId, namespace)
      .then((batch) => {
        const result = {
          exportTime: new Date().toISOString(),
          batchId,
          namespace,
          data: {},
          consistencyCheck: null
        };
        
        result.data.batch = {
          ...batch,
          config: batch.config ? JSON.parse(batch.config) : {}
        };
        
        db.get(`SELECT * FROM replay_status WHERE batch_id = ?`, [batchId], (err2, status) => {
          if (err2) {
            reject(err2);
            return;
          }
          
          result.data.replayStatus = status;
          
          db.all(`SELECT * FROM desensitized_payloads WHERE batch_id = ? ORDER BY desensitized_at ASC`, [batchId], (err3, payloads) => {
            if (err3) {
              reject(err3);
              return;
            }
            
            result.data.payloads = payloads.map(p => ({
              ...p,
              original_payload: p.original_payload ? JSON.parse(p.original_payload) : null,
              desensitized_payload: p.desensitized_payload ? JSON.parse(p.desensitized_payload) : null,
              desensitization_rules: p.desensitization_rules ? JSON.parse(p.desensitization_rules) : null
            }));
            
            db.all(`SELECT * FROM write_interceptions WHERE batch_id = ? ORDER BY intercepted_at ASC`, [batchId], (err4, interceptions) => {
              if (err4) {
                reject(err4);
                return;
              }
              
              result.data.interceptions = interceptions.map(i => ({
                ...i,
                interception_rules: i.interception_rules ? JSON.parse(i.interception_rules) : null,
                response_data: i.response_data ? JSON.parse(i.response_data) : null
              }));
              
              db.all(`SELECT * FROM exception_records WHERE batch_id = ? ORDER BY occurred_at ASC`, [batchId], (err5, exceptions) => {
                if (err5) {
                  reject(err5);
                  return;
                }
                
                result.data.exceptions = exceptions.map(e => ({
                  ...e,
                  original_input: e.original_input ? JSON.parse(e.original_input) : null,
                  processing_evidence: e.processing_evidence ? JSON.parse(e.processing_evidence) : null,
                  final_conclusion: e.final_conclusion ? JSON.parse(e.final_conclusion) : null
                }));
                
                db.all(`SELECT * FROM manual_corrections WHERE batch_id = ? ORDER BY corrected_at ASC`, [batchId], (err6, corrections) => {
                  if (err6) {
                    reject(err6);
                    return;
                  }
                  
                  result.data.corrections = corrections.map(c => ({
                    ...c,
                    original_value: c.original_value ? JSON.parse(c.original_value) : null,
                    corrected_value: c.corrected_value ? JSON.parse(c.corrected_value) : null
                  }));
                  
                  const inconsistencies = validateDataConsistency(
                    batchId, namespace, payloads, interceptions, exceptions, corrections, status
                  );
                  result.consistencyCheck = {
                    passed: inconsistencies.length === 0,
                    inconsistencies,
                    checkedAt: new Date().toISOString()
                  };
                  
                  if (inconsistencies.length > 0) {
                    console.warn(`数据一致性检查发现问题: ${inconsistencies.join(', ')}`);
                  }
                  
                  db.get(`SELECT * FROM replay_reviews WHERE batch_id = ? LIMIT 1`, [batchId], (err7, review) => {
                    if (err7) {
                      reject(err7);
                      return;
                    }
                    
                    if (review) {
                      result.data.review = {
                        ...review,
                        corrective_actions: review.corrective_actions ? JSON.parse(review.corrective_actions) : null
                      };
                    }
                    
                    db.all(`SELECT * FROM audit_logs WHERE entity_id = ? OR entity_id = ? ORDER BY operated_at ASC`, [batchId, batchId], (err8, audits) => {
                      if (err8) {
                        reject(err8);
                        return;
                      }
                      
                      result.data.auditLogs = audits.map(a => ({
                        ...a,
                        old_value: a.old_value ? JSON.parse(a.old_value) : null,
                        new_value: a.new_value ? JSON.parse(a.new_value) : null
                      }));
                      
                      if (format === 'csv') {
                        const csvData = flattenDataForCSV(result.data);
                        resolve({
                          filename: `replay-export-${batchId}-${Date.now()}.csv`,
                          contentType: 'text/csv; charset=utf-8',
                          data: csvData,
                          consistencyCheck: result.consistencyCheck
                        });
                      } else {
                        resolve({
                          filename: `replay-export-${batchId}-${Date.now()}.json`,
                          contentType: 'application/json',
                          data: JSON.stringify(result, null, 2)
                        });
                      }
                    });
                  });
                });
              });
            });
          });
        });
      })
      .catch(reject);
  });
};

const flattenDataForCSV = (data) => {
  const sections = [];
  
  sections.push('=== 批次信息 ===');
  const batchParser = new Parser({ header: true });
  sections.push(batchParser.parse([data.batch]));
  sections.push('');
  
  sections.push('=== 回放状态 ===');
  const statusParser = new Parser({ header: true });
  sections.push(statusParser.parse([data.replayStatus]));
  sections.push('');
  
  if (data.payloads && data.payloads.length > 0) {
    sections.push('=== 脱敏载荷列表 ===');
    const payloadParser = new Parser({ header: true });
    sections.push(payloadParser.parse(data.payloads));
    sections.push('');
  }
  
  if (data.exceptions && data.exceptions.length > 0) {
    sections.push('=== 异常记录列表 ===');
    const exceptionParser = new Parser({ header: true });
    sections.push(exceptionParser.parse(data.exceptions));
    sections.push('');
  }
  
  if (data.corrections && data.corrections.length > 0) {
    sections.push('=== 人工修正列表 ===');
    const correctionParser = new Parser({ header: true });
    sections.push(correctionParser.parse(data.corrections));
    sections.push('');
  }
  
  if (data.review) {
    sections.push('=== 复盘摘要 ===');
    const reviewParser = new Parser({ header: true });
    sections.push(reviewParser.parse([data.review]));
    sections.push('');
  }
  
  return sections.join('\n');
};

const getExportSummary = (batchId, namespace) => {
  return new Promise((resolve, reject) => {
    validateBatchBelongsToNamespace(batchId, namespace)
      .then((batch) => {
        db.get(`SELECT COUNT(*) as count FROM desensitized_payloads WHERE batch_id = ?`, [batchId], (err2, payloadCount) => {
          if (err2) {
            reject(err2);
            return;
          }
          
          db.get(`SELECT COUNT(*) as count FROM exception_records WHERE batch_id = ?`, [batchId], (err3, exceptionCount) => {
            if (err3) {
              reject(err3);
              return;
            }
            
            db.get(`SELECT COUNT(*) as count FROM write_interceptions WHERE batch_id = ?`, [batchId], (err4, interceptionCount) => {
              if (err4) {
                reject(err4);
                return;
              }
              
              db.get(`SELECT COUNT(*) as count FROM manual_corrections WHERE batch_id = ?`, [batchId], (err5, correctionCount) => {
                if (err5) {
                  reject(err5);
                  return;
                }
                
                db.get(`SELECT * FROM replay_status WHERE batch_id = ?`, [batchId], (err6, status) => {
                  if (err6) {
                    reject(err6);
                    return;
                  }
                  
                  resolve({
                    batchId,
                    batchName: batch.batch_name,
                    namespace: batch.namespace,
                    status: status ? status.current_state : 'unknown',
                    payloadCount: payloadCount.count,
                    exceptionCount: exceptionCount.count,
                    interceptionCount: interceptionCount.count,
                    correctionCount: correctionCount.count,
                    successRate: status && status.processed_count > 0 
                      ? ((status.success_count / status.processed_count) * 100).toFixed(2) + '%'
                      : '0%',
                    exportable: payloadCount.count > 0
                  });
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
  exportBatchData,
  getExportSummary,
  validateDataConsistency
};

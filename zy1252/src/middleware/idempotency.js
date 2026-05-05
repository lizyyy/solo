const { IdempotencyKey, IdempotencyStatus } = require('../models/IdempotencyKey');
const { RequestFingerprint } = require('../models/RequestFingerprint');
const { AuditLog, AuditAction } = require('../models/AuditLog');

const IDEMPOTENCY_KEY_HEADER = 'X-Idempotency-Key';

class IdempotencyMiddleware {
  static checkIdempotencyKey(options = {}) {
    const { 
      required = true,
      warnIfMissing = false,
      enforceFingerprint = true 
    } = options;

    return async (req, res, next) => {
      const idempotencyKey = req.headers[IDEMPOTENCY_KEY_HEADER.toLowerCase()];
      
      if (!idempotencyKey) {
        if (warnIfMissing || !required) {
          await AuditLog.create({
            user_id: req.user?.id || null,
            action: AuditAction.IDEMPOTENT_MISSING,
            ip_address: req.ip,
            user_agent: req.get('User-Agent'),
            details: {
              path: req.path,
              method: req.method,
              message: 'Idempotency key missing'
            }
          });
        }

        if (required) {
          return res.status(400).json({
            success: false,
            code: 'IDEMPOTENCY_KEY_REQUIRED',
            message: 'Idempotency key is required for this operation',
            risk_warning: true,
            hint: 'Please provide a unique X-Idempotency-Key header to ensure idempotency. Recommended format: {action}-{unique-id}'
          });
        }

        return next();
      }

      req.idempotencyKey = idempotencyKey;
      req.idempotencyOptions = { enforceFingerprint };
      next();
    };
  }

  static createIdempotencyRecord = async (req, res, next) => {
    const idempotencyKey = req.idempotencyKey;
    const { enforceFingerprint } = req.idempotencyOptions;

    const existingRecord = await IdempotencyKey.findByKey(idempotencyKey);

    if (existingRecord) {
      if (enforceFingerprint) {
        const currentFingerprint = RequestFingerprint.generateFingerprint(
          req.path,
          req.method,
          req.body,
          req.query,
          req.user?.id
        );

        const existingFingerprints = await RequestFingerprint.findByIdempotencyKeyId(existingRecord.id);
        
        if (existingFingerprints.length > 0) {
          const existingFingerprint = existingFingerprints[0];
          
          if (existingFingerprint.fingerprint !== currentFingerprint) {
            await IdempotencyKey.updateStatus(existingRecord.id, IdempotencyStatus.CONFLICT);
            
            await AuditLog.create({
              user_id: req.user?.id || null,
              action: AuditAction.IDEMPOTENT_CONFLICT,
              resource_type: 'idempotency_key',
              resource_id: existingRecord.id,
              ip_address: req.ip,
              user_agent: req.get('User-Agent'),
              details: {
                key: idempotencyKey,
                existing_fingerprint: existingFingerprint.fingerprint,
                new_fingerprint: currentFingerprint
              }
            });

            return res.status(409).json({
              success: false,
              code: 'IDEMPOTENCY_CONFLICT',
              message: 'Idempotency conflict: same key with different request parameters',
              existing_request: {
                idempotency_key: idempotencyKey,
                status: 'conflict',
                created_at: existingRecord.created_at
              }
            });
          }
        }
      }

      if (existingRecord.status === IdempotencyStatus.SUCCESS) {
        await AuditLog.create({
          user_id: req.user?.id || null,
          action: AuditAction.IDEMPOTENT_HIT,
          resource_type: 'idempotency_key',
          resource_id: existingRecord.id,
          ip_address: req.ip,
          user_agent: req.get('User-Agent'),
          details: {
            key: idempotencyKey,
            cached: true
          }
        });

        const cachedResponse = existingRecord.response_data 
          ? JSON.parse(existingRecord.response_data) 
          : {};

        return res.status(200).json({
          ...cachedResponse,
          idempotency_hit: true,
          cached_response: true,
          idempotency_key: idempotencyKey
        });
      }

      if (existingRecord.status === IdempotencyStatus.PROCESSING) {
        return res.status(202).json({
          success: true,
          code: 'REQUEST_PROCESSING',
          message: 'Request is currently being processed. Please retry later.',
          idempotency_key: idempotencyKey,
          status: 'processing'
        });
      }

      if (existingRecord.status === IdempotencyStatus.CONFLICT) {
        return res.status(409).json({
          success: false,
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'Idempotency conflict detected for this key',
          idempotency_key: idempotencyKey
        });
      }

      req.existingIdempotencyRecord = existingRecord;
      return next();
    }

    const newRecord = await IdempotencyKey.create({
      key: idempotencyKey,
      request_path: req.path,
      request_method: req.method,
      status: IdempotencyStatus.PROCESSING
    });

    if (enforceFingerprint) {
      const fingerprint = RequestFingerprint.generateFingerprint(
        req.path,
        req.method,
        req.body,
        req.query,
        req.user?.id
      );

      await RequestFingerprint.create({
        idempotency_key_id: newRecord.id,
        fingerprint: fingerprint,
        request_body_hash: RequestFingerprint.generateHash(req.body),
        request_params_hash: RequestFingerprint.generateHash(req.query)
      });
    }

    req.idempotencyRecord = newRecord;
    next();
  };

  static isSerializable(obj) {
    if (obj === null || obj === undefined) return true;
    if (typeof obj !== 'object') return true;
    
    try {
      JSON.stringify(obj);
      return true;
    } catch (e) {
      return false;
    }
  }

  static safeClone(obj) {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;
    
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch (e) {
      return null;
    }
  }

  static wrapIdempotentHandler(handler) {
    return async (req, res) => {
      const idempotencyRecord = req.idempotencyRecord || req.existingIdempotencyRecord;
      const idempotencyKey = req.idempotencyKey;

      try {
        const result = await handler(req, res);

        if (result && idempotencyRecord) {
          const safeResult = this.safeClone(result);
          if (safeResult) {
            await IdempotencyKey.updateStatus(
              idempotencyRecord.id,
              IdempotencyStatus.SUCCESS,
              safeResult
            );
          }
        }

        if (!res.headersSent && result && this.isSerializable(result)) {
          res.json(result);
        }
      } catch (error) {
        console.error('Error in idempotent handler:', error);
        
        if (idempotencyRecord) {
          await IdempotencyKey.updateStatus(
            idempotencyRecord.id,
            IdempotencyStatus.FAILED,
            {
              success: false,
              code: error.code || 'INTERNAL_ERROR',
              message: error.message
            }
          );
        }

        if (!res.headersSent) {
          res.status(error.status || 500).json({
            success: false,
            code: error.code || 'INTERNAL_ERROR',
            message: error.message || 'Internal Server Error'
          });
        }
      }
    };
  }
}

module.exports = { IdempotencyMiddleware };

const fs = require('fs');
const path = require('path');
const pool = require('../database/pool');
const { ApiError } = require('../utils/response');
const config = require('../config/config');
const OperationLogService = require('./operationLogService');
const { v4: uuidv4 } = require('uuid');

class PhotoService {
  static async uploadPhoto(req, seizedItemId, file, photoType) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const itemResult = await client.query(
        'SELECT * FROM seized_items WHERE id = $1 AND is_deleted = FALSE',
        [seizedItemId]
      );

      if (itemResult.rows.length === 0) {
        throw new ApiError('扣押清单不存在', 404, 'ITEM_NOT_FOUND');
      }

      const item = itemResult.rows[0];

      if (!file) {
        throw new ApiError('请上传照片文件', 400, 'NO_FILE_UPLOADED');
      }

      const allowedTypes = config.upload.allowedTypes;
      const fileExt = path.extname(file.originalname).toLowerCase().replace('.', '');
      
      if (!allowedTypes.includes(fileExt)) {
        throw new ApiError(`不支持的文件格式，仅支持: ${allowedTypes.join(', ')}`, 400, 'INVALID_FILE_TYPE');
      }

      if (file.size > config.upload.maxFileSize) {
        throw new ApiError(`文件大小超出限制，最大允许: ${config.upload.maxFileSize} bytes`, 400, 'FILE_TOO_LARGE');
      }

      const uploadDir = path.resolve(config.upload.dir);
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const itemDir = path.join(uploadDir, seizedItemId);
      if (!fs.existsSync(itemDir)) {
        fs.mkdirSync(itemDir, { recursive: true });
      }

      const newFileName = `${uuidv4()}.${fileExt}`;
      const filePath = path.join(itemDir, newFileName);

      fs.writeFileSync(filePath, file.buffer);

      const result = await client.query(
        `INSERT INTO item_photos 
         (seized_item_id, photo_url, file_name, file_size, photo_type, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          seizedItemId,
          `/uploads/${seizedItemId}/${newFileName}`,
          file.originalname,
          file.size,
          photoType,
          req.operator.id
        ]
      );

      const photo = result.rows[0];

      await client.query(
        `UPDATE seized_items 
         SET photo_uploaded = photo_uploaded + 1, last_updated_by = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [req.operator.id, seizedItemId]
      );

      await OperationLogService.log(
        req,
        'upload_photo',
        'photo',
        photo.id,
        { photo_count: item.photo_uploaded },
        { photo_count: item.photo_uploaded + 1, photo_type: photoType },
        `上传照片: 类型 ${photoType}, 文件名 ${file.originalname}`
      );

      await client.query('COMMIT');

      return photo;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async verifyPhoto(req, photoId, data) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const photoResult = await client.query(
        'SELECT * FROM item_photos WHERE id = $1',
        [photoId]
      );

      if (photoResult.rows.length === 0) {
        throw new ApiError('照片不存在', 404, 'PHOTO_NOT_FOUND');
      }

      const photo = photoResult.rows[0];

      if (photo.is_verified) {
        throw new ApiError('该照片已校验', 400, 'PHOTO_ALREADY_VERIFIED');
      }

      const result = data.result || 'passed';
      
      await client.query(
        `UPDATE item_photos 
         SET is_verified = $1, verification_time = CURRENT_TIMESTAMP,
             verified_by = $2, verification_notes = $3
         WHERE id = $4`,
        [
          result === 'passed',
          req.operator.id,
          data.notes || null,
          photoId
        ]
      );

      await client.query(
        `INSERT INTO photo_verifications 
         (seized_item_id, photo_id, verification_type, verification_result, verification_notes, verified_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          photo.seized_item_id,
          photoId,
          data.verification_type || 'content',
          result,
          data.notes || null,
          req.operator.id
        ]
      );

      const verifiedCountResult = await client.query(
        `SELECT COUNT(*) as count FROM item_photos 
         WHERE seized_item_id = $1 AND is_verified = TRUE`,
        [photo.seized_item_id]
      );

      const itemResult = await client.query(
        'SELECT photo_required FROM seized_items WHERE id = $1',
        [photo.seized_item_id]
      );

      const item = itemResult.rows[0];
      const verifiedCount = parseInt(verifiedCountResult.rows[0].count);

      if (item.photo_required > 0 && verifiedCount >= item.photo_required) {
        await client.query(
          `UPDATE seized_items 
           SET is_photo_verified = TRUE, last_updated_by = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [req.operator.id, photo.seized_item_id]
        );
      }

      await OperationLogService.log(
        req,
        'verify_photo',
        'photo',
        photoId,
        { is_verified: false },
        { is_verified: result === 'passed' },
        `照片校验: 结果 ${result}${data.notes ? `, 备注: ${data.notes}` : ''}`
      );

      await client.query('COMMIT');

      return { success: true, message: '照片校验完成' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async deletePhoto(req, photoId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const photoResult = await client.query(
        'SELECT * FROM item_photos WHERE id = $1',
        [photoId]
      );

      if (photoResult.rows.length === 0) {
        throw new ApiError('照片不存在', 404, 'PHOTO_NOT_FOUND');
      }

      const photo = photoResult.rows[0];

      if (photo.is_verified) {
        throw new ApiError('已校验的照片不能删除', 400, 'VERIFIED_PHOTO_CANNOT_DELETE');
      }

      const filePath = path.join(config.upload.dir, photo.photo_url.replace('/uploads/', ''));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      await client.query('DELETE FROM item_photos WHERE id = $1', [photoId]);

      await client.query(
        `UPDATE seized_items 
         SET photo_uploaded = GREATEST(photo_uploaded - 1, 0), last_updated_by = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [req.operator.id, photo.seized_item_id]
      );

      await OperationLogService.log(
        req,
        'delete_photo',
        'photo',
        photoId,
        { photo_url: photo.photo_url },
        null,
        '删除照片'
      );

      await client.query('COMMIT');

      return { success: true, message: '照片删除成功' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async verifyQuantity(req, seizedItemId, expectedCount) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const itemResult = await client.query(
        'SELECT * FROM seized_items WHERE id = $1 AND is_deleted = FALSE',
        [seizedItemId]
      );

      if (itemResult.rows.length === 0) {
        throw new ApiError('扣押清单不存在', 404, 'ITEM_NOT_FOUND');
      }

      const item = itemResult.rows[0];

      const photoCountResult = await client.query(
        `SELECT COUNT(*) as count FROM item_photos 
         WHERE seized_item_id = $1 AND is_verified = TRUE`,
        [seizedItemId]
      );

      const actualCount = parseInt(photoCountResult.rows[0].count);
      const result = actualCount >= expectedCount ? 'passed' : 'failed';

      await client.query(
        `INSERT INTO photo_verifications 
         (seized_item_id, verification_type, verification_result, verification_notes, verified_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          seizedItemId,
          'quantity',
          result,
          `期望数量: ${expectedCount}, 实际已校验照片数量: ${actualCount}`,
          req.operator.id
        ]
      );

      if (result === 'passed') {
        await client.query(
          `UPDATE seized_items 
           SET is_photo_verified = TRUE, last_updated_by = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [req.operator.id, seizedItemId]
        );
      }

      await OperationLogService.log(
        req,
        'verify_quantity',
        'seized_item',
        seizedItemId,
        { expected_photos: expectedCount, actual_photos: item.photo_uploaded },
        { verification_result: result },
        `照片数量校验: 期望 ${expectedCount} 张，实际 ${actualCount} 张已校验照片，结果: ${result}`
      );

      await client.query('COMMIT');

      return {
        success: result === 'passed',
        expected_count: expectedCount,
        actual_count: actualCount,
        result,
        message: result === 'passed' ? '照片数量校验通过' : `照片数量不足：期望 ${expectedCount} 张，实际只有 ${actualCount} 张已校验照片`
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getByItemId(seizedItemId) {
    const result = await pool.query(
      `SELECT ip.*,
              o.real_name as uploaded_by_name,
              ov.real_name as verified_by_name
       FROM item_photos ip
       LEFT JOIN operators o ON ip.uploaded_by = o.id
       LEFT JOIN operators ov ON ip.verified_by = ov.id
       WHERE ip.seized_item_id = $1
       ORDER BY ip.upload_time DESC`,
      [seizedItemId]
    );

    return result.rows;
  }

  static async getVerificationHistory(seizedItemId) {
    const result = await pool.query(
      `SELECT pv.*,
              o.real_name as verified_by_name
       FROM photo_verifications pv
       LEFT JOIN operators o ON pv.verified_by = o.id
       WHERE pv.seized_item_id = $1
       ORDER BY pv.created_at DESC`,
      [seizedItemId]
    );

    return result.rows;
  }
}

module.exports = PhotoService;

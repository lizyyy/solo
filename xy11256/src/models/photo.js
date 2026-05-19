const db = require('../utils/database');
const { validatePhoto } = require('../utils/validator');

class PhotoModel {
  async create(data) {
    const validation = validatePhoto(data);
    if (!validation.isValid) {
      throw new Error(`数据验证失败: ${JSON.stringify(validation.errors)}`);
    }

    const { value } = validation;

    const result = await db.run(`
      INSERT INTO photos (
        photo_id, hazard_code, photo_type, file_path,
        upload_date, uploader, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      value.photoId,
      value.hazardCode,
      value.photoType,
      value.filePath,
      value.uploadDate.toISOString().split('T')[0],
      value.uploader,
      value.description || ''
    ]);

    return { id: result.lastID, photoId: value.photoId };
  }

  async findByHazardCode(hazardCode) {
    return await db.all(`
      SELECT * FROM photos 
      WHERE hazard_code = ? 
      ORDER BY upload_date ASC, photo_type ASC
    `, [hazardCode]);
  }

  async findByType(hazardCode, photoType) {
    return await db.all(`
      SELECT * FROM photos 
      WHERE hazard_code = ? AND photo_type = ? 
      ORDER BY upload_date ASC
    `, [hazardCode, photoType]);
  }

  async findAll() {
    return await db.all('SELECT * FROM photos ORDER BY upload_date DESC');
  }
}

module.exports = new PhotoModel();

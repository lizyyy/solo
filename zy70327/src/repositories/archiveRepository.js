const db = require('../config/database');

class ArchiveRepository {
  async findByApiPath(apiPath, httpMethod) {
    const result = await db.query(
      `SELECT * FROM archives WHERE api_path = $1 AND http_method = $2`,
      [apiPath, httpMethod]
    );
    return result.rows[0];
  }

  async create(archiveData) {
    const result = await db.query(
      `INSERT INTO archives (api_path, http_method, category, status, responsible, notes)
       VALUES ($1, $2, $3::archive_category, $4::archive_status, $5, $6)
       RETURNING *`,
      [
        archiveData.api_path,
        archiveData.http_method,
        archiveData.category || 'unknown',
        archiveData.status || 'pending',
        archiveData.responsible,
        archiveData.notes,
      ]
    );
    return result.rows[0];
  }

  async update(id, updateData) {
    const setClauses = [];
    const values = [id];
    let paramIndex = 2;

    if (updateData.category) {
      setClauses.push(`category = $${paramIndex}::archive_category`);
      values.push(updateData.category);
      paramIndex++;
    }
    if (updateData.status) {
      setClauses.push(`status = $${paramIndex}::archive_status`);
      values.push(updateData.status);
      paramIndex++;
    }
    if (updateData.responsible !== undefined) {
      setClauses.push(`responsible = $${paramIndex}`);
      values.push(updateData.responsible);
      paramIndex++;
    }
    if (updateData.notes !== undefined) {
      setClauses.push(`notes = $${paramIndex}`);
      values.push(updateData.notes);
      paramIndex++;
    }
    if (updateData.last_seen_at) {
      setClauses.push(`last_seen_at = $${paramIndex}`);
      values.push(updateData.last_seen_at);
      paramIndex++;
    }
    if (updateData.occurrence_count) {
      setClauses.push(`occurrence_count = $${paramIndex}`);
      values.push(updateData.occurrence_count);
      paramIndex++;
    }

    if (setClauses.length === 0) return null;

    const query = `UPDATE archives SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`;
    const result = await db.query(query, values);
    return result.rows[0];
  }

  async incrementOccurrence(id) {
    const result = await db.query(
      `UPDATE archives 
       SET occurrence_count = occurrence_count + 1, 
           last_seen_at = NOW()
       WHERE id = $1 
       RETURNING *`,
      [id]
    );
    return result.rows[0];
  }

  async findById(id) {
    const result = await db.query(`SELECT * FROM archives WHERE id = $1`, [id]);
    return result.rows[0];
  }

  async findAll(filters = {}) {
    const whereClauses = [];
    const values = [];
    let paramIndex = 1;

    if (filters.status) {
      whereClauses.push(`status = $${paramIndex}::archive_status`);
      values.push(filters.status);
      paramIndex++;
    }
    if (filters.category) {
      whereClauses.push(`category = $${paramIndex}::archive_category`);
      values.push(filters.category);
      paramIndex++;
    }
    if (filters.api_path) {
      whereClauses.push(`api_path ILIKE $${paramIndex}`);
      values.push(`%${filters.api_path}%`);
      paramIndex++;
    }

    let query = `SELECT * FROM archives`;
    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }
    query += ` ORDER BY last_seen_at DESC`;

    const result = await db.query(query, values);
    return result.rows;
  }
}

module.exports = new ArchiveRepository();

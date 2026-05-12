const db = require('../config/database');

class SampleRepository {
  async create(sampleData) {
    const result = await db.query(
      `INSERT INTO samples 
       (archive_id, trace_id, request_url, http_method, request_headers, request_body, 
        response_status, response_time_ms, user_id, ip_address, sql_summaries, 
        external_deps, raw_log)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        sampleData.archive_id,
        sampleData.trace_id,
        sampleData.request_url,
        sampleData.http_method,
        JSON.stringify(sampleData.request_headers || {}),
        JSON.stringify(sampleData.request_body || {}),
        sampleData.response_status,
        sampleData.response_time_ms,
        sampleData.user_id,
        sampleData.ip_address,
        JSON.stringify(sampleData.sql_summaries || []),
        JSON.stringify(sampleData.external_deps || []),
        sampleData.raw_log,
      ]
    );
    return result.rows[0];
  }

  async findByArchiveId(archiveId, limit = 100) {
    const result = await db.query(
      `SELECT * FROM samples WHERE archive_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [archiveId, limit]
    );
    return result.rows;
  }

  async findByTraceId(traceId) {
    const result = await db.query(
      `SELECT * FROM samples WHERE trace_id = $1 ORDER BY created_at DESC`,
      [traceId]
    );
    return result.rows;
  }

  async findSimilarSamples(sampleData, timeWindowHours = 24) {
    const result = await db.query(
      `SELECT s.*, a.api_path, a.http_method, a.category, a.status
       FROM samples s
       JOIN archives a ON s.archive_id = a.id
       WHERE s.response_time_ms > ($1 * 0.5)
         AND s.response_time_ms < ($1 * 2)
         AND s.created_at > NOW() - INTERVAL '${timeWindowHours} hours'
         AND (
           (a.api_path = $2 AND a.http_method = $3)
           OR s.trace_id = $4
         )
       ORDER BY s.created_at DESC
       LIMIT 10`,
      [
        sampleData.response_time_ms,
        sampleData.api_path,
        sampleData.http_method,
        sampleData.trace_id,
      ]
    );
    return result.rows;
  }
}

module.exports = new SampleRepository();

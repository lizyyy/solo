const { db } = require('../config/database');

const Storage = {
  saveBenchmarkRun: function (runData) {
    return new Promise((resolve, reject) => {
      const { run_id, version, package: pkg, notes, pprof_summary } = runData;
      
      db.run(
        `INSERT INTO benchmark_runs (run_id, version, package, notes, pprof_summary)
         VALUES (?, ?, ?, ?, ?)`,
        [run_id, version, pkg, notes, pprof_summary ? JSON.stringify(pprof_summary) : null],
        function (err) {
          if (err) {
            if (err.code === 'SQLITE_CONSTRAINT') {
              return reject(new Error(`Run with id ${run_id} already exists`));
            }
            return reject(err);
          }
          resolve(this.lastID);
        }
      );
    });
  },

  saveBenchmarkResults: function (runDbId, benchmarks) {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(
        `INSERT INTO benchmark_results (run_id, name, ns_op, b_op, allocs_op, mb_s, extra)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );

      db.serialize(() => {
        for (const bench of benchmarks) {
          stmt.run(
            runDbId,
            bench.name,
            bench.ns_op,
            bench.b_op,
            bench.allocs_op,
            bench.mb_s,
            bench.extra ? JSON.stringify(bench.extra) : null
          );
        }
        
        stmt.finalize((err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    });
  },

  getBenchmarkRun: function (runId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM benchmark_runs WHERE run_id = ? OR id = ?`,
        [runId, runId],
        (err, row) => {
          if (err) return reject(err);
          if (!row) return resolve(null);
          
          const result = {
            ...row,
            pprof_summary: row.pprof_summary ? JSON.parse(row.pprof_summary) : null
          };
          resolve(result);
        }
      );
    });
  },

  getBenchmarkResults: function (runDbId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM benchmark_results WHERE run_id = ?`,
        [runDbId],
        (err, rows) => {
          if (err) return reject(err);
          
          const results = rows.map(row => ({
            ...row,
            extra: row.extra ? JSON.parse(row.extra) : null
          }));
          resolve(results);
        }
      );
    });
  },

  listBenchmarkRuns: function (filters = {}) {
    return new Promise((resolve, reject) => {
      let query = `SELECT * FROM benchmark_runs WHERE 1=1`;
      const params = [];
      
      if (filters.package) {
        query += ` AND package = ?`;
        params.push(filters.package);
      }
      
      if (filters.version) {
        query += ` AND version = ?`;
        params.push(filters.version);
      }
      
      query += ` ORDER BY created_at DESC`;
      
      db.all(query, params, (err, rows) => {
        if (err) return reject(err);
        
        const results = rows.map(row => ({
          ...row,
          pprof_summary: row.pprof_summary ? JSON.parse(row.pprof_summary) : null
        }));
        resolve(results);
      });
    });
  },

  saveComparison: function (baseRunId, newRunId, notes, overallStatus) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO comparisons (base_run_id, new_run_id, notes, overall_status)
         VALUES (?, ?, ?, ?)`,
        [baseRunId, newRunId, notes, overallStatus],
        function (err) {
          if (err) return reject(err);
          resolve(this.lastID);
        }
      );
    });
  },

  saveComparisonDetails: function (comparisonId, details) {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(
        `INSERT INTO comparison_details 
         (comparison_id, benchmark_name, metric, base_value, new_value, delta_percent, status, threshold_exceeded)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );

      db.serialize(() => {
        for (const detail of details) {
          stmt.run(
            comparisonId,
            detail.benchmark_name,
            detail.metric,
            detail.base_value,
            detail.new_value,
            detail.delta_percent,
            detail.status,
            detail.threshold_exceeded ? 1 : 0
          );
        }
        
        stmt.finalize((err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    });
  },

  getComparison: function (comparisonId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM comparisons WHERE id = ?`,
        [comparisonId],
        (err, row) => {
          if (err) return reject(err);
          resolve(row || null);
        }
      );
    });
  },

  getComparisonDetails: function (comparisonId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM comparison_details WHERE comparison_id = ?`,
        [comparisonId],
        (err, rows) => {
          if (err) return reject(err);
          
          const results = rows.map(row => ({
            ...row,
            threshold_exceeded: row.threshold_exceeded === 1
          }));
          resolve(results);
        }
      );
    });
  },

  listComparisons: function () {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM comparisons ORDER BY created_at DESC`,
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });
  },

  addAuditTag: function (runDbId, tag, createdBy, notes) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO audit_tags (run_id, tag, created_by, notes)
         VALUES (?, ?, ?, ?)`,
        [runDbId, tag, createdBy, notes],
        function (err) {
          if (err) return reject(err);
          resolve(this.lastID);
        }
      );
    });
  },

  getAuditTags: function (runDbId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM audit_tags WHERE run_id = ? ORDER BY created_at DESC`,
        [runDbId],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });
  },

  updateBenchmarkRun: function (runDbId, updates) {
    return new Promise((resolve, reject) => {
      const fields = [];
      const values = [];
      
      if (updates.version !== undefined) {
        fields.push('version = ?');
        values.push(updates.version);
      }
      
      if (updates.notes !== undefined) {
        fields.push('notes = ?');
        values.push(updates.notes);
      }
      
      if (updates.pprof_summary !== undefined) {
        fields.push('pprof_summary = ?');
        values.push(updates.pprof_summary ? JSON.stringify(updates.pprof_summary) : null);
      }
      
      if (fields.length === 0) {
        return resolve();
      }
      
      values.push(runDbId);
      
      db.run(
        `UPDATE benchmark_runs SET ${fields.join(', ')} WHERE id = ?`,
        values,
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }
};

module.exports = Storage;

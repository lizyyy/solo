const { getDb, initDatabase } = require('./database');
const crypto = require('crypto');

class ArticleService {
  static async ensureDbInit() {
    await initDatabase();
    return getDb();
  }

  static generateId() {
    return 'art_' + crypto.randomBytes(8).toString('hex');
  }

  static async createArticle(data) {
    const db = await this.ensureDbInit();
    return new Promise((resolve, reject) => {
      const { article_no, title, team, author, valid_until } = data;
      const id = this.generateId();
      
      db.run(
        `INSERT INTO articles (id, article_no, title, team, author, valid_until, status)
         VALUES (?, ?, ?, ?, ?, ?, 'active')`,
        [id, article_no, title, team, author, valid_until],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id, article_no, title, team, author, valid_until, status: 'active' });
          }
        }
      );
    });
  }

  static async getArticle(articleNo) {
    const db = await this.ensureDbInit();
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM articles WHERE article_no = ?`,
        [articleNo],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  static async listArticles(filters = {}) {
    const db = await this.ensureDbInit();
    return new Promise((resolve, reject) => {
      let query = `SELECT * FROM articles WHERE 1=1`;
      const params = [];

      if (filters.team) {
        query += ` AND team = ?`;
        params.push(filters.team);
      }
      if (filters.status) {
        query += ` AND status = ?`;
        params.push(filters.status);
      }
      if (filters.is_expired) {
        query += ` AND valid_until < DATE('now')`;
      }
      if (filters.soon_expire_days) {
        query += ` AND valid_until BETWEEN DATE('now') AND DATE('now', '+' || ? || ' days')`;
        params.push(filters.soon_expire_days);
      }

      query += ` ORDER BY valid_until ASC`;

      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async checkValidity(articleNo) {
    const article = await this.getArticle(articleNo);
    if (!article) return null;

    const now = new Date();
    const validUntil = new Date(article.valid_until);
    const isExpired = validUntil < now;
    
    const daysUntilExpiry = Math.ceil((validUntil - now) / (1000 * 60 * 60 * 24));

    return {
      article_no: article.article_no,
      title: article.title,
      status: article.status,
      valid_until: article.valid_until,
      is_expired: isExpired,
      days_until_expiry: daysUntilExpiry,
      needs_review: isExpired || daysUntilExpiry <= 30
    };
  }

  static async incrementCitation(articleNo, citedBy = null) {
    const db = await this.ensureDbInit();
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        db.run(
          `UPDATE articles SET citation_count = citation_count + 1, updated_at = CURRENT_TIMESTAMP
           WHERE article_no = ?`,
          [articleNo],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
              return;
            }
          }
        );

        db.run(
          `INSERT INTO citation_logs (article_no, cited_by) VALUES (?, ?)`,
          [articleNo, citedBy],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
              return;
            }
          }
        );

        db.run('COMMIT', (err) => {
          if (err) reject(err);
          else resolve({ success: true, article_no: articleNo });
        });
      });
    });
  }

  static async startReview(articleNo, reviewer = null) {
    const article = await this.getArticle(articleNo);
    if (!article) throw new Error('文章不存在');

    const db = await this.ensureDbInit();
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO review_records (article_no, reviewer, review_status)
         VALUES (?, ?, 'in_review')`,
        [articleNo, reviewer],
        function(err) {
          if (err) reject(err);
          else resolve({ review_id: this.lastID, article_no: articleNo, status: 'in_review' });
        }
      );
    });
  }

  static async submitReview(reviewId, reviewOpinion, suggestedValidUntil = null) {
    const db = await this.ensureDbInit();
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.run(
          `UPDATE review_records 
           SET review_opinion = ?, suggested_valid_until = ?, review_status = 'reviewed'
           WHERE id = ?`,
          [reviewOpinion, suggestedValidUntil, reviewId],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
              return;
            }
          }
        );

        db.get(`SELECT article_no FROM review_records WHERE id = ?`, [reviewId], (err, row) => {
          if (err) {
            db.run('ROLLBACK');
            reject(err);
            return;
          }

          if (suggestedValidUntil) {
            db.run(
              `UPDATE articles SET valid_until = ?, status = 'active', updated_at = CURRENT_TIMESTAMP
               WHERE article_no = ?`,
              [suggestedValidUntil, row.article_no],
              function(err) {
                if (err) {
                  db.run('ROLLBACK');
                  reject(err);
                  return;
                }
              }
            );
          }

          db.run('COMMIT', (err) => {
            if (err) reject(err);
            else resolve({ success: true, review_id: reviewId, status: 'reviewed' });
          });
        });
      });
    });
  }

  static async takeDown(articleNo) {
    const db = await this.ensureDbInit();
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE articles SET status = 'taken_down', updated_at = CURRENT_TIMESTAMP
         WHERE article_no = ?`,
        [articleNo],
        function(err) {
          if (err) reject(err);
          else resolve({ success: true, article_no: articleNo, status: 'taken_down' });
        }
      );
    });
  }

  static async manualCorrection(articleNo, updates) {
    const db = await this.ensureDbInit();
    const allowedFields = ['title', 'team', 'author', 'valid_until', 'status'];
    const setClauses = [];
    const values = [];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        setClauses.push(`${field} = ?`);
        values.push(updates[field]);
      }
    }

    if (setClauses.length === 0) {
      throw new Error('没有有效更新字段');
    }

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    values.push(articleNo);

    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE articles SET ${setClauses.join(', ')} WHERE article_no = ?`,
        values,
        function(err) {
          if (err) reject(err);
          else resolve({ success: true, article_no: articleNo, changes: this.changes });
        }
      );
    });
  }

  static async getReviewRecords(articleNo) {
    const db = await this.ensureDbInit();
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM review_records WHERE article_no = ? ORDER BY created_at DESC`,
        [articleNo],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  static async logException(requestPath, originalInput, errorMessage, processingBasis) {
    const db = await this.ensureDbInit();
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO exception_logs (request_path, original_input, error_message, processing_basis)
         VALUES (?, ?, ?, ?)`,
        [requestPath, JSON.stringify(originalInput), errorMessage, processingBasis],
        function(err) {
          if (err) reject(err);
          else resolve({ exception_id: this.lastID });
        }
      );
    });
  }

  static async generateExpiryReport(reportType = 'daily') {
    const articles = await this.listArticles();
    const db = await this.ensureDbInit();
    const now = new Date();
    
    const expired = articles.filter(a => new Date(a.valid_until) < now);
    const expiring30 = articles.filter(a => {
      const days = Math.ceil((new Date(a.valid_until) - now) / (1000 * 60 * 60 * 24));
      return days >= 0 && days <= 30;
    });
    const highCitation = articles.filter(a => a.citation_count >= 10);

    const report = {
      report_date: now.toISOString().split('T')[0],
      report_type: reportType,
      summary: {
        total: articles.length,
        expired: expired.length,
        expiring_30_days: expiring30.length,
        high_citation: highCitation.length
      },
      expired_articles: expired.map(a => ({
        article_no: a.article_no,
        title: a.title,
        team: a.team,
        valid_until: a.valid_until,
        citation_count: a.citation_count
      })),
      expiring_articles: expiring30.map(a => ({
        article_no: a.article_no,
        title: a.title,
        team: a.team,
        valid_until: a.valid_until,
        citation_count: a.citation_count
      }))
    };

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO reminder_reports (report_type, report_date, content) VALUES (?, ?, ?)`,
        [reportType, report.report_date, JSON.stringify(report)],
        function(err) {
          if (err) reject(err);
          else resolve({ report_id: this.lastID, ...report });
        }
      );
    });
  }
}

module.exports = ArticleService;

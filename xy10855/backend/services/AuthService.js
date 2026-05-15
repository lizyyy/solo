const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

const JWT_SECRET = 'report-generator-secret-key-2024';

class AuthService {
  static async createDownloadAuthorization(taskId, authorizedBy = 'system') {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT id, status, file_path FROM report_tasks WHERE id = ?`,
        [taskId],
        (err, task) => {
          if (err) {
            reject(err);
            return;
          }

          if (!task) {
            reject(new Error('任务不存在'));
            return;
          }

          if (task.status !== 'completed') {
            reject(new Error('只有已完成的任务才能下载'));
            return;
          }

          if (!task.file_path) {
            reject(new Error('报告文件不存在'));
            return;
          }

          const authId = `auth-${uuidv4().substring(0, 12)}`;
          const token = jwt.sign(
            { taskId, authId, timestamp: Date.now() },
            JWT_SECRET,
            { expiresIn: '24h' }
          );
          const authorizedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

          db.run(
            `INSERT INTO download_authorizations 
             (id, task_id, authorized_by, authorized_until, token, is_valid)
             VALUES (?, ?, ?, ?, ?, 1)`,
            [authId, taskId, authorizedBy, authorizedUntil, token],
            (err) => {
              if (err) {
                reject(err);
                return;
              }
              resolve({
                authId,
                token,
                authorizedUntil,
                downloadUrl: `/api/download/${token}`
              });
            }
          );
        }
      );
    });
  }

  static async validateDownloadToken(token) {
    return new Promise((resolve, reject) => {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        db.get(
          `SELECT da.*, rt.file_path, rt.file_name, rt.file_size
           FROM download_authorizations da
           JOIN report_tasks rt ON da.task_id = rt.id
           WHERE da.token = ? AND da.is_valid = 1`,
          [token],
          (err, auth) => {
            if (err) {
              reject(err);
              return;
            }

            if (!auth) {
              reject(new Error('授权令牌无效或已失效'));
              return;
            }

            const now = new Date();
            const until = new Date(auth.authorized_until);
            if (now > until) {
              reject(new Error('授权令牌已过期'));
              return;
            }

            if (auth.download_count >= auth.max_downloads) {
              reject(new Error('已达到最大下载次数'));
              return;
            }

            resolve({
              taskId: auth.task_id,
              filePath: auth.file_path,
              fileName: auth.file_name,
              fileSize: auth.file_size,
              authId: auth.id
            });
          }
        );
      } catch (err) {
        reject(new Error('令牌验证失败: ' + err.message));
      }
    });
  }

  static async recordDownload(authId) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE download_authorizations 
         SET download_count = download_count + 1 
         WHERE id = ?`,
        [authId],
        (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        }
      );
    });
  }

  static async invalidateAuthorization(authId) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE download_authorizations SET is_valid = 0 WHERE id = ?`,
        [authId],
        (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        }
      );
    });
  }

  static verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return null;
    }
  }
}

module.exports = AuthService;

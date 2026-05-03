const db = require('../config/database');

const STATUS_FLOW = {
  pending: {
    label: '待排',
    color: 'gray',
    next: ['in_kiln', 'cancelled'],
    description: '作品已创建，等待排窑'
  },
  in_kiln: {
    label: '已入窑',
    color: 'blue',
    next: ['firing', 'pending'],
    description: '作品已安排到烧窑任务中'
  },
  firing: {
    label: '烧成中',
    color: 'orange',
    next: ['out_kiln'],
    description: '作品正在窑炉中烧制'
  },
  out_kiln: {
    label: '已出窑',
    color: 'green',
    next: ['delivered', 'failed'],
    description: '作品已出窑，等待质检和交付'
  },
  delivered: {
    label: '已交付',
    color: 'purple',
    next: [],
    description: '作品已交付给客户'
  },
  failed: {
    label: '烧制失败',
    color: 'red',
    next: [],
    description: '作品在烧制过程中损坏'
  },
  cancelled: {
    label: '已取消',
    color: 'default',
    next: [],
    description: '作品已取消'
  }
};

class StatusService {
  static getStatusFlow() {
    return STATUS_FLOW;
  }

  static getStatusInfo(status) {
    return STATUS_FLOW[status] || { label: '未知', color: 'default', next: [] };
  }

  static canTransition(fromStatus, toStatus) {
    const fromInfo = STATUS_FLOW[fromStatus];
    if (!fromInfo) return false;
    return fromInfo.next.includes(toStatus);
  }

  static transitionArtworkStatus(artworkId, toStatus, notes = '') {
    return new Promise((resolve, reject) => {
      db.get('SELECT id, status, current_firing_task_id FROM artworks WHERE id = ?', [artworkId], (err, artwork) => {
        if (err) {
          reject(err);
          return;
        }

        if (!artwork) {
          reject(new Error('作品不存在'));
          return;
        }

        const fromStatus = artwork.status;

        if (fromStatus === toStatus) {
          resolve({ success: true, message: '状态未改变', artworkId, fromStatus, toStatus });
          return;
        }

        if (!this.canTransition(fromStatus, toStatus)) {
          reject(new Error(`无法从"${this.getStatusInfo(fromStatus).label}"状态转换到"${this.getStatusInfo(toStatus).label}"状态`));
          return;
        }

        db.serialize(() => {
          db.run('BEGIN TRANSACTION');

          db.run(
            'UPDATE artworks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [toStatus, artworkId],
            (err) => {
              if (err) {
                db.run('ROLLBACK');
                reject(err);
                return;
              }

              db.run(
                `INSERT INTO status_history (artwork_id, from_status, to_status, notes) VALUES (?, ?, ?, ?)`,
                [artworkId, fromStatus, toStatus, notes],
                (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    reject(err);
                    return;
                  }

                  if (['out_kiln', 'delivered', 'failed', 'cancelled'].includes(toStatus) && artwork.current_firing_task_id) {
                    db.run(
                      'UPDATE artworks SET current_firing_task_id = NULL WHERE id = ?',
                      [artworkId],
                      (err) => {
                        if (err) {
                          console.warn('清除当前烧窑任务ID失败:', err.message);
                        }
                      }
                    );
                  }

                  db.run('COMMIT', (err) => {
                    if (err) {
                      db.run('ROLLBACK');
                      reject(err);
                      return;
                    }

                    resolve({
                      success: true,
                      message: `状态已从"${this.getStatusInfo(fromStatus).label}"更新为"${this.getStatusInfo(toStatus).label}"`,
                      artworkId,
                      fromStatus,
                      toStatus,
                      timestamp: new Date().toISOString()
                    });
                  });
                }
              );
            }
          );
        });
      });
    });
  }

  static getArtworkStatusHistory(artworkId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          sh.id,
          sh.artwork_id,
          sh.from_status,
          sh.to_status,
          sh.timestamp,
          sh.notes,
          a.name as artwork_name
        FROM status_history sh
        LEFT JOIN artworks a ON sh.artwork_id = a.id
        WHERE sh.artwork_id = ?
        ORDER BY sh.timestamp DESC
      `;

      db.all(query, [artworkId], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        const history = rows.map(row => ({
          ...row,
          from_status_label: this.getStatusInfo(row.from_status).label,
          to_status_label: this.getStatusInfo(row.to_status).label,
          from_status_color: this.getStatusInfo(row.from_status).color,
          to_status_color: this.getStatusInfo(row.to_status).color
        }));

        resolve(history);
      });
    });
  }

  static getFiringTaskStatusHistory(taskId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          sh.id,
          sh.artwork_id,
          sh.from_status,
          sh.to_status,
          sh.timestamp,
          sh.notes,
          a.name as artwork_name
        FROM status_history sh
        LEFT JOIN artworks a ON sh.artwork_id = a.id
        LEFT JOIN task_artworks ta ON sh.artwork_id = ta.artwork_id
        WHERE ta.task_id = ?
        ORDER BY sh.timestamp DESC
      `;

      db.all(query, [taskId], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        const history = rows.map(row => ({
          ...row,
          from_status_label: this.getStatusInfo(row.from_status).label,
          to_status_label: this.getStatusInfo(row.to_status).label,
          from_status_color: this.getStatusInfo(row.from_status).color,
          to_status_color: this.getStatusInfo(row.to_status).color
        }));

        resolve(history);
      });
    });
  }

  static batchTransitionStatus(artworkIds, toStatus, notes = '') {
    return Promise.all(
      artworkIds.map(id => 
        this.transitionArtworkStatus(id, toStatus, notes)
          .then(result => ({ id, success: true, ...result }))
          .catch(error => ({ id, success: false, error: error.message }))
      )
    );
  }
}

module.exports = StatusService;

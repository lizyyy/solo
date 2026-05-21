const { v4: uuidv4 } = require('uuid');
const { db } = require('../database/schema');

const ChannelStatus = {
  PENDING: 'PENDING',
  PUBLISHING: 'PUBLISHING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED'
};

class PublishChannel {
  static create(policyVersionId, channels) {
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(
        `INSERT INTO publish_channels (id, policy_version_id, channel_name, channel_type, status)
         VALUES (?, ?, ?, ?, ?)`
      );
      
      db.serialize(() => {
        channels.forEach((channel) => {
          const id = uuidv4();
          stmt.run(id, policyVersionId, channel.channelName, channel.channelType, ChannelStatus.PENDING);
        });
        stmt.finalize((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }

  static findByPolicyVersionId(policyVersionId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM publish_channels WHERE policy_version_id = ?`,
        [policyVersionId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map(row => this.mapRow(row)));
        }
      );
    });
  }

  static updateStatus(id, status, errorMessage = null) {
    return new Promise((resolve, reject) => {
      const updates = [status, id];
      let query = `UPDATE publish_channels SET status = ?`;
      
      if (errorMessage) {
        query += `, error_message = ?`;
        updates.splice(1, 0, errorMessage);
      }
      
      if (status === ChannelStatus.SUCCESS) {
        query += `, publish_time = CURRENT_TIMESTAMP`;
      }
      
      if (status === ChannelStatus.FAILED) {
        query += `, retry_count = retry_count + 1`;
      }
      
      query += ` WHERE id = ?`;
      
      db.run(query, updates, function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  }

  static retry(id) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE publish_channels SET status = ?, retry_count = retry_count + 1, error_message = NULL WHERE id = ?`,
        [ChannelStatus.PENDING, id],
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });
  }

  static mapRow(row) {
    return {
      id: row.id,
      policyVersionId: row.policy_version_id,
      channelName: row.channel_name,
      channelType: row.channel_type,
      status: row.status,
      publishTime: row.publish_time,
      errorMessage: row.error_message,
      retryCount: row.retry_count
    };
  }
}

module.exports = { PublishChannel, ChannelStatus };

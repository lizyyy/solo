const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const logger = require('../utils/logger');
const { logAudit, OPERATIONS, ENTITY_TYPES } = require('../utils/audit');

class UserService {
  static getAllUsers() {
    try {
      return db.prepare(`
        SELECT * FROM users ORDER BY created_at ASC
      `).all();
    } catch (error) {
      logger.error('Failed to get all users', { error: error.message });
      throw error;
    }
  }

  static getUserById(id) {
    try {
      return db.prepare(`
        SELECT * FROM users WHERE id = ?
      `).get(id);
    } catch (error) {
      logger.error('Failed to get user by id', { error: error.message, userId: id });
      throw error;
    }
  }

  static createUser(name, req = {}) {
    if (!name || !name.trim()) {
      throw new Error('User name is required');
    }

    const transaction = db.transaction(() => {
      const now = Date.now();
      const userId = uuidv4();
      
      const existingUser = db.prepare(`
        SELECT id FROM users WHERE name = ?
      `).get(name.trim());
      
      if (existingUser) {
        throw new Error('User with this name already exists');
      }

      db.prepare(`
        INSERT INTO users (id, name, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `).run(userId, name.trim(), now, now);

      const user = this.getUserById(userId);
      
      logAudit(OPERATIONS.CREATE, ENTITY_TYPES.USER, userId, null, user, req);
      
      return user;
    });

    try {
      return transaction();
    } catch (error) {
      logger.error('Failed to create user', { error: error.message });
      throw error;
    }
  }

  static updateUser(id, name, req = {}) {
    if (!name || !name.trim()) {
      throw new Error('User name is required');
    }

    const transaction = db.transaction(() => {
      const existingUser = this.getUserById(id);
      if (!existingUser) {
        throw new Error('User not found');
      }

      const now = Date.now();
      
      db.prepare(`
        UPDATE users SET name = ?, updated_at = ?
        WHERE id = ?
      `).run(name.trim(), now, id);

      const updatedUser = this.getUserById(id);
      
      logAudit(OPERATIONS.UPDATE, ENTITY_TYPES.USER, id, existingUser, updatedUser, req);
      
      return updatedUser;
    });

    try {
      return transaction();
    } catch (error) {
      logger.error('Failed to update user', { error: error.message, userId: id });
      throw error;
    }
  }

  static deleteUser(id, req = {}) {
    const transaction = db.transaction(() => {
      const existingUser = this.getUserById(id);
      if (!existingUser) {
        throw new Error('User not found');
      }

      const bills = db.prepare(`
        SELECT COUNT(*) as count FROM bills 
        WHERE payer_id = ? AND is_deleted = 0
      `).get(id);
      
      if (bills.count > 0) {
        throw new Error('Cannot delete user: user has active bills');
      }

      const splits = db.prepare(`
        SELECT COUNT(*) as count FROM bill_splits 
        WHERE user_id = ?
      `).get(id);
      
      if (splits.count > 0) {
        throw new Error('Cannot delete user: user is part of bill splits');
      }

      db.prepare(`
        DELETE FROM users WHERE id = ?
      `).run(id);

      logAudit(OPERATIONS.DELETE, ENTITY_TYPES.USER, id, existingUser, null, req);
      
      return true;
    });

    try {
      return transaction();
    } catch (error) {
      logger.error('Failed to delete user', { error: error.message, userId: id });
      throw error;
    }
  }

  static getUserSummary(userId) {
    try {
      const user = this.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const paidBills = db.prepare(`
        SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total
        FROM bills 
        WHERE payer_id = ? AND is_deleted = 0
      `).get(userId);

      const owedAmount = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM bill_splits
        WHERE user_id = ?
      `).get(userId);

      return {
        ...user,
        stats: {
          billsPaid: paidBills.count,
          totalPaid: paidBills.total,
          totalOwed: owedAmount.total,
          netBalance: paidBills.total - owedAmount.total
        }
      };
    } catch (error) {
      logger.error('Failed to get user summary', { error: error.message, userId });
      throw error;
    }
  }
}

module.exports = UserService;

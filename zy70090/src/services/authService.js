const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../database/pool');
const { ApiError } = require('../utils/response');
const config = require('../config/config');

class AuthService {
  static async login(username, password) {
    const result = await pool.query(
      'SELECT * FROM operators WHERE username = $1 AND is_active = TRUE',
      [username]
    );

    if (result.rows.length === 0) {
      throw new ApiError('用户名或密码错误', 401, 'AUTH_INVALID_CREDENTIALS');
    }

    const operator = result.rows[0];

    const isValid = await bcrypt.compare(password, operator.password_hash);
    if (!isValid) {
      throw new ApiError('用户名或密码错误', 401, 'AUTH_INVALID_CREDENTIALS');
    }

    const token = jwt.sign(
      { 
        operatorId: operator.id,
        username: operator.username,
        role: operator.role
      },
      config.app.jwtSecret,
      { expiresIn: config.app.jwtExpiresIn }
    );

    return {
      token,
      operator: {
        id: operator.id,
        username: operator.username,
        real_name: operator.real_name,
        department: operator.department,
        role: operator.role
      }
    };
  }

  static async changePassword(operatorId, oldPassword, newPassword) {
    const result = await pool.query(
      'SELECT * FROM operators WHERE id = $1',
      [operatorId]
    );

    if (result.rows.length === 0) {
      throw new ApiError('用户不存在', 404, 'USER_NOT_FOUND');
    }

    const operator = result.rows[0];

    const isValid = await bcrypt.compare(oldPassword, operator.password_hash);
    if (!isValid) {
      throw new ApiError('原密码错误', 400, 'INVALID_OLD_PASSWORD');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await pool.query(
      'UPDATE operators SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newPasswordHash, operatorId]
    );

    return { success: true, message: '密码修改成功' };
  }

  static async getCurrentUser(operatorId) {
    const result = await pool.query(
      `SELECT id, username, real_name, department, phone, role, created_at
       FROM operators WHERE id = $1`,
      [operatorId]
    );

    if (result.rows.length === 0) {
      throw new ApiError('用户不存在', 404, 'USER_NOT_FOUND');
    }

    return result.rows[0];
  }
}

module.exports = AuthService;

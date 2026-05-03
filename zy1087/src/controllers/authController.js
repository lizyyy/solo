const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { generateToken } = require('../utils/jwt');
const { successResponse, createdResponse } = require('../utils/response');
const { ConflictError, AuthenticationError, NotFoundError } = require('../utils/errors');

const register = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;

    const existingUser = await db('users').where({ email }).first();
    if (existingUser) {
      throw new ConflictError('该邮箱已被注册');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    await db('users').insert({
      id: userId,
      name,
      email,
      password_hash: passwordHash,
      phone
    });

    const user = await db('users')
      .select('id', 'name', 'email', 'phone', 'avatar_url', 'created_at')
      .where({ id: userId })
      .first();

    const token = generateToken({
      userId: user.id,
      email: user.email,
      name: user.name
    });

    createdResponse(res, {
      user,
      token
    }, '注册成功');
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await db('users').where({ email }).first();
    if (!user) {
      throw new AuthenticationError('邮箱或密码错误');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new AuthenticationError('邮箱或密码错误');
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      name: user.name
    });

    const userResponse = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatar_url: user.avatar_url,
      created_at: user.created_at
    };

    successResponse(res, {
      user: userResponse,
      token
    }, '登录成功');
  } catch (error) {
    next(error);
  }
};

const getCurrentUser = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const user = await db('users')
      .select('id', 'name', 'email', 'phone', 'avatar_url', 'created_at')
      .where({ id: userId })
      .first();

    if (!user) {
      throw new NotFoundError('用户不存在');
    }

    successResponse(res, user, '获取成功');
  } catch (error) {
    next(error);
  }
};

const updateCurrentUser = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name, phone, avatar_url } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url;

    if (Object.keys(updateData).length === 0) {
      successResponse(res, null, '无需更新');
      return;
    }

    await db('users').where({ id: userId }).update(updateData);

    const user = await db('users')
      .select('id', 'name', 'email', 'phone', 'avatar_url', 'created_at')
      .where({ id: userId })
      .first();

    successResponse(res, user, '更新成功');
  } catch (error) {
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { current_password, new_password } = req.body;

    const user = await db('users').where({ id: userId }).first();
    if (!user) {
      throw new NotFoundError('用户不存在');
    }

    const isPasswordValid = await bcrypt.compare(current_password, user.password_hash);
    if (!isPasswordValid) {
      throw new AuthenticationError('当前密码错误');
    }

    const newPasswordHash = await bcrypt.hash(new_password, 10);
    await db('users').where({ id: userId }).update({ password_hash: newPasswordHash });

    successResponse(res, null, '密码修改成功');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getCurrentUser,
  updateCurrentUser,
  changePassword
};

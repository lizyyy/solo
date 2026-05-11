require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { RateLimiterRedis } = require('rate-limiter-flexible');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const db = require('./config/database');
const { redis } = require('./config/redis');
const requestIdMiddleware = require('./middleware/requestId');
const authMiddleware = require('./middleware/auth');
const inventoryRoutes = require('./routes/inventoryRoutes');
const logger = require('./utils/logger');
const AsyncTaskService = require('./services/asyncTaskService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestIdMiddleware);

app.use(express.static(path.join(__dirname, '../public')));

const rateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'middleware',
  points: process.env.RATE_LIMIT_MAX || 100,
  duration: process.env.RATE_LIMIT_WINDOW_MS || 60000,
});

app.use(async (req, res, next) => {
  try {
    await rateLimiter.consume(req.ip);
    next();
  } catch (rejRes) {
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.ceil(rejRes.msBeforeNext / 1000),
      requestId: req.requestId
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const query = `SELECT * FROM users WHERE username = $1 AND is_active = true`;
    const result = await db.query(query, [username]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid credentials',
        requestId: req.requestId
      });
    }
    
    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(401).json({
        error: 'Invalid credentials',
        requestId: req.requestId
      });
    }
    
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
    
    await db.query(
      `UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1`,
      [user.id]
    );
    
    res.status(200).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: user.full_name
      },
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      error: 'Internal server error',
      requestId: req.requestId
    });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, fullName } = req.body;
    
    const existingUser = await db.query(
      `SELECT id FROM users WHERE username = $1 OR email = $2`,
      [username, email]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        error: 'Username or email already exists',
        requestId: req.requestId
      });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    
    const query = `
      INSERT INTO users (id, username, email, password, full_name, role)
      VALUES ($1, $2, $3, $4, $5, 'user')
      RETURNING id, username, email, full_name, role
    `;
    
    const result = await db.query(query, [userId, username, email, hashedPassword, fullName]);
    
    res.status(201).json({
      user: result.rows[0],
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({
      error: 'Internal server error',
      requestId: req.requestId
    });
  }
});

app.use('/api/inventory', inventoryRoutes);

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    requestId: req.requestId
  });
});

app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    requestId: req.requestId
  });
});

AsyncTaskService.registerHandler('update_count', async (data, userId) => {
  const { task_item_id, actual_quantity, notes } = data;
  
  const query = `
    UPDATE inventory_task_items
    SET actual_quantity = $1,
        notes = $2,
        counted_by = $3,
        counted_at = CURRENT_TIMESTAMP,
        status = 'completed'
    WHERE id = $4
    RETURNING *
  `;
  
  const result = await db.query(query, [actual_quantity, notes, userId, task_item_id]);
  return result.rows[0];
});

AsyncTaskService.registerHandler('complete_task', async (data, userId) => {
  const { task_id } = data;
  
  const itemsQuery = `
    SELECT COUNT(*) as total,
           COUNT(*) FILTER (WHERE status = 'completed') as completed
    FROM inventory_task_items WHERE task_id = $1
  `;
  
  const itemsResult = await db.query(itemsQuery, [task_id]);
  const { total, completed } = itemsResult.rows[0];
  
  if (parseInt(total) !== parseInt(completed)) {
    throw new Error('Not all items counted');
  }
  
  const query = `
    UPDATE inventory_tasks
    SET status = 'completed',
        completed_at = CURRENT_TIMESTAMP,
        end_time = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
  `;
  
  const result = await db.query(query, [task_id]);
  return result.rows[0];
});

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  
  AsyncTaskService.startProcessing(1000);
  
  setInterval(async () => {
    try {
      const retried = await AsyncTaskService.retryFailedTasks();
      if (retried > 0) {
        logger.info(`Retried ${retried} failed tasks`);
      }
    } catch (error) {
      logger.error('Error retrying failed tasks:', error);
    }
  }, 60000);
});

module.exports = app;

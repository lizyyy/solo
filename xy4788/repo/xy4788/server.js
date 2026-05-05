const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({ dest: 'uploads/' });

const generateTraceId = () => uuidv4().replace(/-/g, '').slice(0, 16);

const unifiedErrorMiddleware = (req, res, next) => {
  res.sendOriginalResponse = (status, data) => {
    res._originalResponse = { status, data };
    res.status(status).json(data);
  };

  res.sendUnifiedResponse = (status, originalData) => {
    let unifiedResponse = {
      traceId: generateTraceId(),
      retryable: false,
      code: 0,
      message: '成功',
      fieldErrors: []
    };

    if (status >= 200 && status < 300) {
      unifiedResponse = {
        ...unifiedResponse,
        data: originalData
      };
    } else {
      const errorType = determineErrorType(originalData, status);
      unifiedResponse = {
        ...unifiedResponse,
        code: errorType.code,
        message: errorType.message,
        fieldErrors: errorType.fieldErrors,
        retryable: errorType.retryable
      };
    }

    res._unifiedResponse = { status, data: unifiedResponse };
    res.status(status).json(unifiedResponse);
  };

  res.sendBothResponses = (status, originalData) => {
    let unifiedResponse = {
      traceId: generateTraceId(),
      retryable: false,
      code: 0,
      message: '成功',
      fieldErrors: []
    };

    if (status >= 200 && status < 300) {
      unifiedResponse = {
        ...unifiedResponse,
        data: originalData
      };
    } else {
      const errorType = determineErrorType(originalData, status);
      unifiedResponse = {
        ...unifiedResponse,
        code: errorType.code,
        message: errorType.message,
        fieldErrors: errorType.fieldErrors,
        retryable: errorType.retryable
      };
    }

    res.status(status).json({
      original: originalData,
      unified: unifiedResponse
    });
  };

  next();
};

const determineErrorType = (data, status) => {
  const errorTypes = {
    VALIDATION_ERROR: { code: 40001, message: '参数验证失败', retryable: false, fieldErrors: [] },
    AUTH_ERROR: { code: 40101, message: '认证失败', retryable: false, fieldErrors: [] },
    PERMISSION_ERROR: { code: 40301, message: '权限不足', retryable: false, fieldErrors: [] },
    NETWORK_ERROR: { code: 50001, message: '网络错误', retryable: true, fieldErrors: [] },
    SERVER_ERROR: { code: 50002, message: '服务器内部错误', retryable: false, fieldErrors: [] }
  };

  if (data.errors && Array.isArray(data.errors)) {
    return {
      ...errorTypes.VALIDATION_ERROR,
      fieldErrors: data.errors.map(e => ({
        field: e.path || e.field || 'unknown',
        message: e.message || e.msg || '验证错误'
      }))
    };
  }

  if (data.fieldErrors && Array.isArray(data.fieldErrors)) {
    return {
      ...errorTypes.VALIDATION_ERROR,
      fieldErrors: data.fieldErrors
    };
  }

  if (data.validationErrors) {
    const fieldErrors = Object.entries(data.validationErrors).map(([field, messages]) => ({
      field,
      message: Array.isArray(messages) ? messages[0] : messages
    }));
    return {
      ...errorTypes.VALIDATION_ERROR,
      fieldErrors
    };
  }

  if (data.error === 'Unauthorized' || status === 401) {
    return {
      ...errorTypes.AUTH_ERROR,
      message: data.message || '认证失败，请重新登录'
    };
  }

  if (data.error === 'Forbidden' || status === 403) {
    return {
      ...errorTypes.PERMISSION_ERROR,
      message: data.message || '权限不足，无法执行此操作'
    };
  }

  if (status >= 500) {
    return {
      ...errorTypes.SERVER_ERROR,
      message: data.message || '服务器内部错误，请稍后重试'
    };
  }

  if (data.code) {
    return {
      code: data.code,
      message: data.message || data.msg || '未知错误',
      fieldErrors: [],
      retryable: data.retryable || false
    };
  }

  return {
    code: data.code || 50000,
    message: data.message || data.msg || data.error || '未知错误',
    fieldErrors: [],
    retryable: data.retryable || false
  };
};

app.use(unifiedErrorMiddleware);

let tickets = [];
let nextTicketId = 1;

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.sendBothResponses(400, {
      error: 'Bad Request',
      message: '用户名和密码不能为空',
      validationErrors: {
        username: username ? [] : ['用户名不能为空'],
        password: password ? [] : ['密码不能为空']
      }
    });
  }

  if (username === 'admin' && password === 'admin123') {
    return res.sendBothResponses(200, {
      success: true,
      data: {
        token: 'mock-jwt-token-' + Date.now(),
        user: {
          id: 1,
          username: 'admin',
          role: 'admin'
        }
      }
    });
  }

  if (username === 'user' && password === 'user123') {
    return res.sendBothResponses(200, {
      success: true,
      data: {
        token: 'mock-jwt-token-' + Date.now(),
        user: {
          id: 2,
          username: 'user',
          role: 'user'
        }
      }
    });
  }

  return res.sendBothResponses(401, {
    error: 'Unauthorized',
    message: '用户名或密码错误'
  });
});

app.post('/api/tickets', (req, res) => {
  const { title, description, priority, category } = req.body;
  const errors = [];

  if (!title || title.trim() === '') {
    errors.push({ path: 'title', message: '工单标题不能为空' });
  } else if (title.length < 5) {
    errors.push({ path: 'title', message: '工单标题长度至少为5个字符' });
  }

  if (!description || description.trim() === '') {
    errors.push({ path: 'description', message: '工单描述不能为空' });
  }

  if (!priority) {
    errors.push({ path: 'priority', message: '请选择优先级' });
  } else if (!['low', 'medium', 'high', 'urgent'].includes(priority)) {
    errors.push({ path: 'priority', message: '无效的优先级值' });
  }

  if (errors.length > 0) {
    return res.sendBothResponses(400, {
      error: 'Validation Failed',
      message: '表单验证失败',
      errors
    });
  }

  const ticket = {
    id: nextTicketId++,
    title,
    description,
    priority,
    category: category || 'general',
    status: 'open',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  tickets.push(ticket);

  return res.sendBothResponses(201, {
    success: true,
    message: '工单创建成功',
    data: ticket
  });
});

app.get('/api/tickets', (req, res) => {
  return res.sendBothResponses(200, {
    success: true,
    data: tickets
  });
});

app.post('/api/tickets/:id/close', (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const ticketId = parseInt(id);
  const ticket = tickets.find(t => t.id === ticketId);

  if (!ticket) {
    return res.sendBothResponses(404, {
      error: 'Not Found',
      message: `工单 ID ${id} 不存在`,
      code: 'TICKET_NOT_FOUND'
    });
  }

  if (ticket.status === 'closed') {
    return res.sendBothResponses(400, {
      error: 'Bad Request',
      message: '工单已关闭，无法重复关闭',
      code: 'TICKET_ALREADY_CLOSED'
    });
  }

  if (!reason || reason.trim() === '') {
    return res.sendBothResponses(400, {
      error: 'Bad Request',
      message: '关闭原因不能为空'
    });
  }

  ticket.status = 'closed';
  ticket.closedAt = new Date().toISOString();
  ticket.closeReason = reason;
  ticket.updatedAt = new Date().toISOString();

  return res.sendBothResponses(200, {
    success: true,
    message: '工单关闭成功',
    data: ticket
  });
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.sendBothResponses(400, {
      status: 'error',
      msg: '请选择要上传的文件'
    });
  }

  const { originalname, mimetype, size } = req.file;

  if (size > 5 * 1024 * 1024) {
    return res.sendBothResponses(400, {
      status: 'error',
      msg: '文件大小超过限制（最大5MB）',
      fieldErrors: [
        { field: 'file', message: '文件大小超过限制' }
      ]
    });
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'];
  if (!allowedTypes.includes(mimetype)) {
    return res.sendBothResponses(400, {
      status: 'error',
      msg: '不支持的文件类型',
      fieldErrors: [
        { field: 'file', message: '只支持JPEG、PNG、GIF、PDF和TXT格式' }
      ]
    });
  }

  return res.sendBothResponses(200, {
    success: true,
    message: '文件上传成功',
    data: {
      id: uuidv4(),
      filename: originalname,
      size,
      mimetype,
      url: `/uploads/${req.file.filename}`
    }
  });
});

app.post('/api/test/network-error', (req, res) => {
  return res.sendBothResponses(503, {
    error: 'Service Unavailable',
    message: '服务暂时不可用，请稍后重试',
    retryable: true
  });
});

app.post('/api/test/server-error', (req, res) => {
  return res.sendBothResponses(500, {
    error: 'Internal Server Error',
    message: '服务器内部错误，请联系管理员'
  });
});

app.post('/api/test/permission-error', (req, res) => {
  return res.sendBothResponses(403, {
    error: 'Forbidden',
    message: '您没有权限执行此操作'
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});

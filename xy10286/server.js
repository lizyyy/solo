const express = require('express');
const { initDatabase } = require('./database');
const { initData } = require('./init-data');
const service = require('./service');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

function getRequestId(req) {
  return req.headers['x-request-id'] || 
         req.headers['x-idempotency-key'] || 
         (req.body && req.body.request_id) || 
         null;
}

function handleError(res, error) {
  console.error('API Error:', error);
  
  if (error instanceof service.ValidationError) {
    return res.status(400).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      }
    });
  }
  
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: error.message || '服务器内部错误'
    }
  });
}

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString()
    }
  });
});

app.post('/api/applications', async (req, res) => {
  try {
    const requestId = getRequestId(req);
    
    if (!requestId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REQUEST_ID',
          message: '缺少请求唯一标识，请在Header中提供 X-Request-Id 或 X-Idempotency-Key'
        }
      });
    }
    
    const result = await service.createApplication(req.body, requestId);
    
    res.json({
      success: true,
      data: result,
      message: '申请创建成功'
    });
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/applications/:applicationNo/advance', async (req, res) => {
  try {
    const requestId = getRequestId(req);
    
    if (!requestId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REQUEST_ID',
          message: '缺少请求唯一标识'
        }
      });
    }
    
    const { action, remark } = req.body;
    
    if (!action) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_ACTION',
          message: '缺少操作类型参数 action'
        }
      });
    }
    
    const result = await service.advanceApplication(
      req.params.applicationNo,
      action,
      remark || '',
      requestId
    );
    
    res.json({
      success: true,
      data: result,
      message: `申请推进成功: ${action}`
    });
  } catch (error) {
    handleError(res, error);
  }
});

app.post('/api/applications/:applicationNo/withdraw', async (req, res) => {
  try {
    const requestId = getRequestId(req);
    
    if (!requestId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REQUEST_ID',
          message: '缺少请求唯一标识'
        }
      });
    }
    
    const { reason } = req.body;
    
    const result = await service.withdrawApplication(
      req.params.applicationNo,
      reason || '申请人主动撤回',
      requestId
    );
    
    res.json({
      success: true,
      data: result,
      message: '申请撤回成功'
    });
  } catch (error) {
    handleError(res, error);
  }
});

app.put('/api/applications/:applicationNo', async (req, res) => {
  try {
    const requestId = getRequestId(req);
    
    if (!requestId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REQUEST_ID',
          message: '缺少请求唯一标识'
        }
      });
    }
    
    const result = await service.modifyApplication(
      req.params.applicationNo,
      req.body,
      requestId
    );
    
    res.json({
      success: true,
      data: result,
      message: '申请修改成功'
    });
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/applications/:applicationNo', async (req, res) => {
  try {
    const result = await service.getApplicationByNo(req.params.applicationNo);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'APPLICATION_NOT_FOUND',
          message: '申请不存在'
        }
      });
    }
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/applications', async (req, res) => {
  try {
    const params = {
      status: req.query.status,
      booth_code: req.query.booth_code,
      floor_name: req.query.floor_name,
      applicant_name: req.query.applicant_name,
      start_date: req.query.start_date,
      end_date: req.query.end_date
    };
    
    Object.keys(params).forEach(key => {
      if (params[key] === undefined || params[key] === null || params[key] === '') {
        delete params[key];
      }
    });
    
    const result = await service.queryApplications(params);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/floors/:floorName/capacity', async (req, res) => {
  try {
    const result = await service.getFloorCapacity(req.params.floorName);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/statuses', (req, res) => {
  res.json({
    success: true,
    data: {
      statuses: service.APPLICATION_STATUSES,
      descriptions: {
        DRAFT: '草稿',
        PENDING_APPROVAL: '待审批',
        APPROVED: '已通过',
        REJECTED: '已拒绝',
        WITHDRAWN: '已撤回',
        MODIFIED: '已修改待重新提交'
      }
    }
  });
});

async function startServer() {
  try {
    await initDatabase();
    await initData();
    
    app.listen(PORT, () => {
      console.log('\n========================================');
      console.log('  商场快闪摊位用电审批 API 已启动');
      console.log('  服务地址: http://localhost:' + PORT);
      console.log('========================================\n');
      console.log('可用接口:');
      console.log('  GET  /api/health                    - 健康检查');
      console.log('  POST /api/applications              - 创建用电申请');
      console.log('  POST /api/applications/:no/advance  - 推进审批 (SUBMIT/APPROVE/REJECT)');
      console.log('  POST /api/applications/:no/withdraw - 撤回申请');
      console.log('  PUT  /api/applications/:no          - 修改申请');
      console.log('  GET  /api/applications/:no          - 查询申请详情');
      console.log('  GET  /api/applications              - 查询申请列表+汇总');
      console.log('  GET  /api/floors/:name/capacity     - 查询楼层容量详情');
      console.log('  GET  /api/statuses                  - 查看所有状态');
      console.log('');
    });
  } catch (error) {
    console.error('服务启动失败:', error);
    process.exit(1);
  }
}

startServer();

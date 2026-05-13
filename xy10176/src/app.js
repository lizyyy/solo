const express = require('express');
const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const sequelize = require('./config/database');

const sampleRoutes = require('./routes/samples');
const auditRoutes = require('./routes/audit');
const statisticsRoutes = require('./routes/statistics');

const { SampleStatus, StepType, ErrorCode } = require('./constants/status');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '实验样本流转 API',
      version: '1.0.0',
      description: '样本从采集、离心、上机到复核的完整流转管理 API，包含状态机、幂等处理、异常转人工和审计查询功能',
      contact: {
        name: 'API Support'
      }
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: '开发服务器'
      }
    ],
    components: {
      schemas: {
        Sample: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', description: '样本ID' },
            barcode: { type: 'string', description: '样本条码（唯一）' },
            status: {
              type: 'string',
              enum: Object.values(SampleStatus),
              description: '样本状态'
            },
            exceptionReason: { type: 'string', nullable: true, description: '异常原因' },
            handler: { type: 'string', nullable: true, description: '处理人' },
            collectTime: { type: 'string', format: 'date-time', nullable: true },
            centrifugeTime: { type: 'string', format: 'date-time', nullable: true },
            testTime: { type: 'string', format: 'date-time', nullable: true },
            reviewTime: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Audit: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            sampleId: { type: 'string', format: 'uuid' },
            barcode: { type: 'string' },
            stepType: { type: 'string', enum: Object.values(StepType) },
            action: { type: 'string', description: 'CREATE/NORMAL/EXCEPTION/RESOLVE' },
            fromStatus: { type: 'string', enum: Object.values(SampleStatus), nullable: true },
            toStatus: { type: 'string', enum: Object.values(SampleStatus), nullable: true },
            handler: { type: 'string', nullable: true },
            requestId: { type: 'string', nullable: true },
            durationMs: { type: 'integer', nullable: true, description: '步骤耗时（毫秒）' },
            detail: { type: 'string', nullable: true, description: 'JSON 字符串' },
            isIdempotent: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            code: { type: 'integer', description: '错误码', example: 40001 },
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            data: { type: 'object', nullable: true }
          }
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            code: { type: 'integer', example: 0 },
            success: { type: 'boolean', example: true },
            message: { type: 'string' },
            data: { type: 'object' }
          }
        }
      }
    }
  },
  apis: ['./src/routes/*.js', './src/controllers/*.js']
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true
}));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/samples', sampleRoutes);
app.use('/api/audits', auditRoutes);
app.use('/api/statistics', statisticsRoutes);

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    code: ErrorCode.SERVER_ERROR,
    success: false,
    message: '服务器内部错误',
    data: null
  });
});

const init = async () => {
  try {
    await sequelize.authenticate();
    if (require.main === module) {
      console.log('数据库连接成功');
    }

    await sequelize.sync({ force: process.env.NODE_ENV === 'test' });
    if (require.main === module) {
      console.log('数据库模型同步完成');
    }

    return app;
  } catch (error) {
    if (require.main === module) {
      console.error('初始化失败:', error);
      process.exit(1);
    }
    throw error;
  }
};

app.ready = init();

if (require.main === module) {
  app.ready.then(() => {
    app.listen(PORT, () => {
      console.log(`服务器运行在端口 ${PORT}`);
      console.log(`API 文档: http://localhost:${PORT}/api-docs`);
      console.log(`健康检查: http://localhost:${PORT}/health`);
    });
  }).catch((err) => {
    console.error('启动失败:', err);
    process.exit(1);
  });
}

module.exports = app;

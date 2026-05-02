const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const routes = require('./routes');
const { initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.text({ type: ['text/csv', 'text/plain'], limit: '10mb' }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: '灭菌包放行追溯站 API',
    version: '1.0.0',
    description: '医院消毒供应中心灭菌包放行追溯系统 - 本地纯后端API服务',
    contact: {
      name: '系统管理员'
    }
  },
  servers: [
    {
      url: `http://localhost:${PORT}`,
      description: '本地开发服务器'
    }
  ],
  tags: [
    { name: '健康检查', description: '服务健康检查' },
    { name: '器械包管理', description: '器械包CRUD操作' },
    { name: '灭菌锅次', description: '灭菌锅次管理' },
    { name: '参数曲线', description: '灭菌参数曲线' },
    { name: '质检管理', description: '质量检查管理' },
    { name: '领用管理', description: '科室领用管理' },
    { name: '召回管理', description: '器械包召回管理' },
    { name: '导入导出', description: 'CSV导入和报告导出' },
    { name: '审计日志', description: '操作审计日志' },
    { name: '状态管理', description: '状态机和状态转换' }
  ],
  paths: {
    '/health': {
      get: {
        tags: ['健康检查'],
        summary: '检查服务健康状态',
        responses: {
          '200': {
            description: '服务正常',
            content: {
              'application/json': {
                example: {
                  status: 'ok',
                  timestamp: '2026-05-01T00:00:00.000Z',
                  service: 'sterilization-tracking-api'
                }
              }
            }
          }
        }
      }
    },
    '/packages': {
      get: {
        tags: ['器械包管理'],
        summary: '获取器械包列表',
        parameters: [
          { name: 'status', in: 'query', description: '按状态过滤', schema: { type: 'string' } },
          { name: 'package_number', in: 'query', description: '按包编号模糊搜索', schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: '成功返回器械包列表' }
        }
      },
      post: {
        tags: ['器械包管理'],
        summary: '创建新器械包',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['package_number', 'name'],
                properties: {
                  package_number: { type: 'string', example: 'PKG-2026-001' },
                  name: { type: 'string', example: '基础手术器械包' },
                  description: { type: 'string', example: '包含常用手术器械' },
                  instruments: { type: 'array', items: { type: 'string' }, example: ['手术刀', '镊子', '止血钳'] },
                  expiration_date: { type: 'string', format: 'date-time' }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: '器械包创建成功' },
          '400': { description: '参数验证失败' },
          '409': { description: '包编号已存在' }
        }
      }
    },
    '/packages/{id}': {
      get: {
        tags: ['器械包管理'],
        summary: '获取单个器械包详情',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: '成功返回器械包详情' },
          '404': { description: '器械包不存在' }
        }
      }
    },
    '/packages/{id}/transition': {
      post: {
        tags: ['状态管理'],
        summary: '器械包状态流转',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['to_status'],
                properties: {
                  to_status: { type: 'string', enum: ['PENDING_CLEANING', 'PENDING_ASSEMBLY', 'IN_STERILIZATION', 'PENDING_QC', 'RELEASED', 'USED', 'RECALLED'] },
                  context: {
                    type: 'object',
                    properties: {
                      cycle_id: { type: 'string' },
                      cycle_completed: { type: 'boolean' },
                      qc_passed: { type: 'boolean' },
                      expiration_date: { type: 'string', format: 'date-time' },
                      department: { type: 'string' },
                      reason: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: '状态流转成功' },
          '400': { description: '状态流转不允许' },
          '404': { description: '器械包不存在' }
        }
      }
    },
    '/cycles': {
      get: {
        tags: ['灭菌锅次'],
        summary: '获取锅次列表',
        responses: {
          '200': { description: '成功返回锅次列表' }
        }
      },
      post: {
        tags: ['灭菌锅次'],
        summary: '创建新锅次',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['cycle_number', 'sterilizer_id', 'cycle_type', 'target_temperature', 'target_duration'],
                properties: {
                  cycle_number: { type: 'string', example: 'CYC-2026-001' },
                  sterilizer_id: { type: 'string', example: 'STER-001' },
                  cycle_type: { type: 'string', enum: ['HIGH_TEMP', 'LOW_TEMP', 'EO_GAS'] },
                  target_temperature: { type: 'number', example: 134 },
                  target_duration: { type: 'number', example: 180 }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: '锅次创建成功' }
        }
      }
    },
    '/cycles/{id}': {
      get: {
        tags: ['灭菌锅次'],
        summary: '获取锅次详情（包含参数曲线和质量分析）',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: '成功返回锅次详情' }
        }
      }
    },
    '/cycles/{id}/curves': {
      post: {
        tags: ['参数曲线'],
        summary: '添加锅次参数曲线点',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['points'],
                properties: {
                  points: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['timestamp', 'temperature'],
                      properties: {
                        timestamp: { type: 'string', format: 'date-time' },
                        temperature: { type: 'number' },
                        pressure: { type: 'number' },
                        humidity: { type: 'number' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: '曲线点添加成功' }
        }
      }
    },
    '/quality-checks': {
      post: {
        tags: ['质检管理'],
        summary: '创建质检记录',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['cycle_id', 'package_id', 'check_type', 'result'],
                properties: {
                  cycle_id: { type: 'string' },
                  package_id: { type: 'string' },
                  check_type: { type: 'string', enum: ['BIOLOGICAL', 'CHEMICAL', 'PHYSICAL', 'BOWIE_DICK'] },
                  result: { type: 'string', enum: ['PASS', 'FAIL', 'INCONCLUSIVE'] },
                  notes: { type: 'string' },
                  checked_by: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: '质检记录创建成功' }
        }
      }
    },
    '/usage': {
      post: {
        tags: ['领用管理'],
        summary: '记录科室领用',
        description: '校验：状态必须是已放行、包未过期、未重复领用',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['package_id', 'department'],
                properties: {
                  package_id: { type: 'string' },
                  department: { type: 'string' },
                  user_name: { type: 'string' },
                  usage_time: { type: 'string', format: 'date-time' },
                  notes: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: '领用记录创建成功' },
          '400': { description: '领用被拦截（状态不对/已过期/已领用）' }
        }
      }
    },
    '/recall': {
      post: {
        tags: ['召回管理'],
        summary: '召回器械包',
        description: '校验：必须提供召回原因',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['package_id', 'reason'],
                properties: {
                  package_id: { type: 'string' },
                  reason: { type: 'string' },
                  performed_by: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: '召回成功' },
          '400': { description: '缺少召回原因' }
        }
      }
    },
    '/import/packages': {
      post: {
        tags: ['导入导出'],
        summary: '批量导入器械包CSV',
        requestBody: {
          content: {
            'text/csv': {
              schema: { type: 'string' }
            },
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  csv_content: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: '导入完成' }
        }
      }
    },
    '/import/cycles': {
      post: {
        tags: ['导入导出'],
        summary: '批量导入锅次CSV',
        requestBody: {
          content: {
            'text/csv': { schema: { type: 'string' } }
          }
        },
        responses: {
          '200': { description: '导入完成' }
        }
      }
    },
    '/export/report/{packageId}': {
      get: {
        tags: ['导入导出'],
        summary: '导出器械包追溯报告（Markdown格式）',
        parameters: [
          { name: 'packageId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: '返回Markdown格式的追溯报告',
            content: {
              'text/markdown': { schema: { type: 'string' } }
            }
          }
        }
      }
    },
    '/export/audit': {
      get: {
        tags: ['导入导出'],
        summary: '导出JSON审计包',
        parameters: [
          { name: 'entity_type', in: 'query', schema: { type: 'string' } },
          { name: 'action', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: '返回审计包JSON' }
        }
      }
    },
    '/audit': {
      get: {
        tags: ['审计日志'],
        summary: '获取审计日志列表',
        parameters: [
          { name: 'entity_type', in: 'query', schema: { type: 'string' } },
          { name: 'action', in: 'query', schema: { type: 'string' } },
          { name: 'entity_id', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: '成功返回审计日志列表' }
        }
      }
    },
    '/statuses': {
      get: {
        tags: ['状态管理'],
        summary: '获取所有状态定义和流转规则',
        responses: {
          '200': { description: '返回状态定义和流转规则' }
        }
      }
    }
  },
  components: {
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string' },
          code: { type: 'string' },
          errors: { type: 'array', items: { type: 'object' } }
        }
      }
    }
  }
};

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

app.use('/api', routes);

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message,
    code: 'INTERNAL_ERROR'
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '端点不存在',
    code: 'ENDPOINT_NOT_FOUND'
  });
});

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('  灭菌包放行追溯站 API 服务启动成功');
  console.log('='.repeat(60));
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log(`  API文档:  http://localhost:${PORT}/api-docs`);
  console.log(`  健康检查: http://localhost:${PORT}/api/health`);
  console.log('='.repeat(60));
  
  initDatabase();
  console.log('  数据库初始化完成');
  console.log('='.repeat(60));
});

module.exports = app;

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const config = require('./config')
const { initDatabase } = require('./models')
const { ruleEngine } = require('./services/ruleEngine')

const reviewsRouter = require('./routes/reviews')
const rulesRouter = require('./routes/rules')
const statsRouter = require('./routes/stats')

const app = express()

app.use(helmet())
app.use(cors())
app.use(morgan('combined'))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.get('/', (req, res) => {
  res.json({
    name: 'API Design Reviewer',
    version: '1.0.0',
    description: 'RESTful API 设计规范评审服务',
    endpoints: {
      reviews: '/api/v1/reviews',
      rules: '/api/v1/rules',
      stats: '/api/v1/stats',
      health: '/api/v1/stats/health'
    },
    docs: {
      openapi: '访问 /api/v1/openapi 获取 OpenAPI 规范'
    }
  })
})

app.get('/api/v1/openapi', (req, res) => {
  const openapiSpec = {
    openapi: '3.0.3',
    info: {
      title: 'API Design Reviewer API',
      description: 'RESTful API 设计规范评审服务',
      version: '1.0.0',
      contact: {
        name: 'API Team'
      }
    },
    servers: [
      {
        url: `http://${config.server.host}:${config.server.port}`,
        description: '本地开发服务器'
      }
    ],
    paths: {
      '/api/v1/reviews': {
        post: {
          summary: '创建新的评审',
          description: '上传 OpenAPI 规范进行评审',
          tags: ['Reviews'],
          requestBody: {
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: {
                    openapi: {
                      type: 'string',
                      format: 'binary',
                      description: 'OpenAPI YAML/JSON 文件'
                    },
                    rules: {
                      type: 'string',
                      format: 'binary',
                      description: '可选的自定义规则配置文件'
                    },
                    apiName: {
                      type: 'string',
                      description: 'API 名称'
                    },
                    apiVersion: {
                      type: 'string',
                      description: 'API 版本'
                    }
                  },
                  required: ['openapi']
                }
              }
            }
          },
          responses: {
            '201': {
              description: '评审创建成功'
            }
          }
        },
        get: {
          summary: '获取评审列表',
          description: '获取所有评审记录的分页列表',
          tags: ['Reviews'],
          parameters: [
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', default: 20 }
            },
            {
              name: 'offset',
              in: 'query',
              schema: { type: 'integer', default: 0 }
            },
            {
              name: 'status',
              in: 'query',
              schema: { type: 'string' }
            }
          ],
          responses: {
            '200': {
              description: '成功返回评审列表'
            }
          }
        }
      },
      '/api/v1/reviews/{reviewId}': {
        get: {
          summary: '获取评审详情',
          description: '获取单个评审的详细信息',
          tags: ['Reviews'],
          parameters: [
            {
              name: 'reviewId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' }
            }
          ],
          responses: {
            '200': {
              description: '成功返回评审详情'
            },
            '404': {
              description: '评审不存在'
            }
          }
        },
        delete: {
          summary: '删除评审',
          description: '删除指定的评审记录',
          tags: ['Reviews'],
          parameters: [
            {
              name: 'reviewId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' }
            }
          ],
          responses: {
            '200': {
              description: '删除成功'
            },
            '404': {
              description: '评审不存在'
            }
          }
        }
      },
      '/api/v1/reviews/{reviewId}/report': {
        get: {
          summary: '获取评审报告',
          description: '获取评审的详细报告',
          tags: ['Reviews'],
          parameters: [
            {
              name: 'reviewId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' }
            },
            {
              name: 'format',
              in: 'query',
              schema: { type: 'string', enum: ['json', 'markdown', 'md'], default: 'json' }
            }
          ],
          responses: {
            '200': {
              description: '成功返回评审报告'
            }
          }
        }
      },
      '/api/v1/reviews/{reviewId}/rerun': {
        post: {
          summary: '重新运行评审',
          description: '重新执行指定的评审',
          tags: ['Reviews'],
          parameters: [
            {
              name: 'reviewId',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' }
            }
          ],
          responses: {
            '200': {
              description: '重新评审成功'
            }
          }
        }
      },
      '/api/v1/rules': {
        get: {
          summary: '获取规则列表',
          description: '获取所有可用的评审规则',
          tags: ['Rules'],
          parameters: [
            {
              name: 'category',
              in: 'query',
              schema: { type: 'string' }
            },
            {
              name: 'isEnabled',
              in: 'query',
              schema: { type: 'boolean' }
            }
          ],
          responses: {
            '200': {
              description: '成功返回规则列表'
            }
          }
        }
      },
      '/api/v1/stats': {
        get: {
          summary: '获取统计信息',
          description: '获取系统的整体统计信息',
          tags: ['Statistics'],
          responses: {
            '200': {
              description: '成功返回统计信息'
            }
          }
        }
      },
      '/api/v1/stats/health': {
        get: {
          summary: '健康检查',
          description: '检查服务健康状态',
          tags: ['Statistics'],
          responses: {
            '200': {
              description: '服务健康'
            },
            '503': {
              description: '服务不健康'
            }
          }
        }
      }
    },
    tags: [
      { name: 'Reviews', description: '评审相关接口' },
      { name: 'Rules', description: '规则管理接口' },
      { name: 'Statistics', description: '统计信息接口' }
    ]
  }

  res.json(openapiSpec)
})

app.use('/api/v1/reviews', reviewsRouter)
app.use('/api/v1/rules', rulesRouter)
app.use('/api/v1/stats', statsRouter)

app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Endpoint ${req.method} ${req.path} not found`
  })
})

app.use((error, req, res, next) => {
  console.error('Error:', error)

  if (error.message.includes('not found')) {
    return res.status(404).json({
      error: 'Not Found',
      message: error.message
    })
  }

  if (error.message.includes('Invalid') || error.message.includes('missing') || 
      error.message.includes('Missing')) {
    return res.status(400).json({
      error: 'Bad Request',
      message: error.message
    })
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred'
      : error.message
  })
})

const startServer = async () => {
  try {
    console.log('正在初始化数据库...')
    await initDatabase()
    
    console.log('正在初始化规则引擎...')
    await ruleEngine.init()
    
    const server = app.listen(config.server.port, config.server.host, () => {
      console.log(`
╔══════════════════════════════════════════════════════════════╗
║                API Design Reviewer                            ║
║           RESTful API 设计规范评审服务                       ║
╠══════════════════════════════════════════════════════════════╣
║  服务地址: http://${config.server.host}:${config.server.port}                              ║
║  API 文档: http://${config.server.host}:${config.server.port}/api/v1/openapi               ║
║  健康检查: http://${config.server.host}:${config.server.port}/api/v1/stats/health          ║
╠══════════════════════════════════════════════════════════════╣
║  支持的评审规则:                                             ║
║  ✅ 资源命名规范 (resource-naming)                           ║
║  ✅ HTTP 方法规范 (http-method)                              ║
║  ✅ 状态码规范 (status-code)                                 ║
║  ✅ 分页过滤规范 (pagination)                                ║
║  ✅ 幂等键规范 (idempotency)                                 ║
║  ✅ 错误码规范 (error-code)                                  ║
║  ✅ 版本兼容与废弃策略 (versioning)                         ║
╚══════════════════════════════════════════════════════════════╝
      `)
    })

    process.on('SIGTERM', () => {
      console.log('收到 SIGTERM 信号，正在优雅关闭...')
      server.close(() => {
        console.log('服务已关闭')
        process.exit(0)
      })
    })

    process.on('SIGINT', () => {
      console.log('收到 SIGINT 信号，正在优雅关闭...')
      server.close(() => {
        console.log('服务已关闭')
        process.exit(0)
      })
    })

  } catch (error) {
    console.error('服务启动失败:', error)
    process.exit(1)
  }
}

startServer()

module.exports = app
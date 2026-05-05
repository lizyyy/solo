const request = require('supertest')
const path = require('path')
const fs = require('fs')

const app = require('../src/index')
const { initDatabase, sequelize } = require('../src/models')
const { Review, Issue, Rule } = require('../src/models')
const { ruleEngine } = require('../src/services/ruleEngine')
const { openapiParser } = require('../src/services/openapiParser')
const { ResourceNamingValidator } = require('../src/validators/resourceNamingValidator')
const { HttpMethodValidator } = require('../src/validators/httpMethodValidator')
const { StatusCodeValidator } = require('../src/validators/statusCodeValidator')

const EXAMPLES_DIR = path.join(__dirname, '..', 'examples')

const goodOpenapiYaml = `
openapi: "3.0.3"
info:
  title: 测试 API
  version: "1.0.0"
paths:
  /users:
    get:
      summary: 获取用户列表
      parameters:
        - name: page
          in: query
          schema:
            type: integer
        - name: page_size
          in: query
          schema:
            type: integer
      responses:
        "200":
          description: 成功
        "400":
          description: 错误
        "401":
          description: 未授权
        "500":
          description: 服务器错误
    post:
      summary: 创建用户
      parameters:
        - name: Idempotency-Key
          in: header
          required: true
          schema:
            type: string
      responses:
        "201":
          description: 创建成功
        "400":
          description: 错误
`

const badOpenapiYaml = `
openapi: "3.0.3"
info:
  title: 错误示例 API
  version: "1.0"
paths:
  /api/getUser:
    get:
      summary: 获取用户
      responses:
        "200":
          description: 成功
  /api/createUser:
    post:
      summary: 创建用户
      responses:
        "200":
          description: 错误：应返回 201
  /UserList:
    get:
      summary: 获取用户列表
      responses:
        "200":
          description: 成功
`

describe('API Design Reviewer - 单元测试', () => {
  
  beforeAll(async () => {
    process.env.DB_PATH = ':memory:'
    await initDatabase()
    await ruleEngine.init()
  })
  
  afterAll(async () => {
    await sequelize.close()
  })
  
  describe('OpenAPI 解析器', () => {
    test('应能解析有效的 YAML 格式 OpenAPI', async () => {
      const spec = await openapiParser.parse(goodOpenapiYaml)
      expect(spec).toBeDefined()
      expect(spec.openapi).toBe('3.0.3')
      expect(spec.info.title).toBe('测试 API')
    })
    
    test('应能解析路径信息', async () => {
      const spec = await openapiParser.parse(goodOpenapiYaml)
      expect(spec.paths).toBeDefined()
      expect(spec.paths['/users']).toBeDefined()
    })
    
    test('应能检测 OpenAPI 版本', async () => {
      const spec = await openapiParser.parse(goodOpenapiYaml)
      const version = openapiParser.getOpenApiVersion(spec)
      expect(version).toBe('3.0.3')
    })
    
    test('无效的 YAML 应抛出错误', async () => {
      await expect(openapiParser.parse('invalid: yaml: [')).rejects.toThrow()
    })
  })
  
  describe('资源命名校验器', () => {
    let validator
    
    beforeEach(() => {
      validator = new ResourceNamingValidator()
    })
    
    test('应检测路径中的动词', () => {
      const spec = {
        paths: {
          '/api/getUser': { get: {} },
          '/api/createOrder': { post: {} }
        }
      }
      
      validator.validate(spec)
      const issues = validator.getIssues()
      
      const hasVerbIssue = issues.some(issue => 
        issue.title.includes('动词') || 
        issue.description.includes('getUser') ||
        issue.description.includes('createOrder')
      )
      expect(hasVerbIssue).toBe(true)
    })
    
    test('应检测非 kebab-case 命名', () => {
      const spec = {
        paths: {
          '/UserList': { get: {} },
          '/user_profiles': { get: {} },
          '/api/v2/orderItems': { get: {} }
        }
      }
      
      validator.validate(spec)
      const issues = validator.getIssues()
      
      expect(issues.length).toBeGreaterThan(0)
    })
    
    test('有效的 kebab-case 路径不应触发错误', () => {
      const spec = {
        paths: {
          '/users': { get: {} },
          '/user-profiles': { get: {} },
          '/api/v2/order-items': { get: {} }
        }
      }
      
      validator.validate(spec)
      const issues = validator.getIssues()
      
      const namingIssues = issues.filter(i => 
        i.title.includes('kebab') || 
        i.title.includes('命名')
      )
      expect(namingIssues.length).toBe(0)
    })
  })
  
  describe('HTTP 方法校验器', () => {
    let validator
    
    beforeEach(() => {
      validator = new HttpMethodValidator()
    })
    
    test('应检测 POST 使用 200 状态码', () => {
      const spec = {
        paths: {
          '/users': {
            post: {
              responses: {
                '200': { description: '成功' }
              }
            }
          }
        }
      }
      
      validator.validate(spec)
      const issues = validator.getIssues()
      
      const hasStatusCodeIssue = issues.some(issue => 
        issue.description.includes('201') ||
        issue.title.includes('状态码')
      )
      expect(hasStatusCodeIssue).toBe(true)
    })
    
    test('应检测 GET 用于创建操作', () => {
      const spec = {
        paths: {
          '/create-user': {
            get: {
              summary: '创建用户'
            }
          }
        }
      }
      
      validator.validate(spec)
      const issues = validator.getIssues()
      
      expect(issues.length).toBeGreaterThan(0)
    })
  })
  
  describe('状态码校验器', () => {
    let validator
    
    beforeEach(() => {
      validator = new StatusCodeValidator()
    })
    
    test('应检测缺少错误响应', () => {
      const spec = {
        paths: {
          '/users': {
            get: {
              responses: {
                '200': { description: '成功' }
              }
            }
          }
        }
      }
      
      validator.validate(spec)
      const issues = validator.getIssues()
      
      const hasMissingErrorIssue = issues.some(issue => 
        issue.title.includes('错误') ||
        issue.description.includes('4xx') ||
        issue.description.includes('5xx')
      )
      expect(hasMissingErrorIssue).toBe(true)
    })
    
    test('完整的响应不应触发错误', () => {
      const spec = {
        paths: {
          '/users': {
            get: {
              responses: {
                '200': { description: '成功' },
                '400': { description: '请求错误' },
                '401': { description: '未授权' },
                '404': { description: '未找到' },
                '500': { description: '服务器错误' }
              }
            }
          }
        }
      }
      
      validator.validate(spec)
      const issues = validator.getIssues()
      
      expect(issues.length).toBe(0)
    })
  })
  
  describe('规则引擎', () => {
    test('应能初始化规则', async () => {
      const rules = await Rule.findAll()
      expect(rules.length).toBeGreaterThan(0)
    })
    
    test('规则应包含所有分类', async () => {
      const categories = await Rule.findAll({
        attributes: ['category'],
        group: ['category']
      })
      
      const categoryNames = categories.map(c => c.category)
      expect(categoryNames).toContain('resource-naming')
      expect(categoryNames).toContain('http-method')
      expect(categoryNames).toContain('status-code')
    })
  })
})

describe('API Design Reviewer - API 测试', () => {
  let server
  let testReviewId
  
  beforeAll(async () => {
    process.env.DB_PATH = ':memory:'
    process.env.PORT = '3001'
    await initDatabase()
    await ruleEngine.init()
    
    const http = require('http')
    server = http.createServer(app)
    server.listen(3001)
  })
  
  afterAll(async () => {
    server.close()
    await sequelize.close()
  })
  
  describe('基础端点', () => {
    test('GET / 应返回服务信息', async () => {
      const response = await request(app).get('/')
      expect(response.statusCode).toBe(200)
      expect(response.body.name).toBe('API Design Reviewer')
    })
    
    test('GET /api/v1/stats/health 应返回健康状态', async () => {
      const response = await request(app).get('/api/v1/stats/health')
      expect(response.statusCode).toBe(200)
      expect(response.body.status).toBe('healthy')
    })
    
    test('GET /api/v1/openapi 应返回 OpenAPI 规范', async () => {
      const response = await request(app).get('/api/v1/openapi')
      expect(response.statusCode).toBe(200)
      expect(response.body.openapi).toBeDefined()
    })
  })
  
  describe('规则 API', () => {
    test('GET /api/v1/rules 应返回规则列表', async () => {
      const response = await request(app).get('/api/v1/rules')
      expect(response.statusCode).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
      expect(response.body.length).toBeGreaterThan(0)
    })
    
    test('GET /api/v1/rules?category=resource-naming 应返回分类规则', async () => {
      const response = await request(app).get('/api/v1/rules?category=resource-naming')
      expect(response.statusCode).toBe(200)
      expect(Array.isArray(response.body)).toBe(true)
      response.body.forEach(rule => {
        expect(rule.category).toBe('resource-naming')
      })
    })
  })
  
  describe('评审 API', () => {
    test('POST /api/v1/reviews 应创建新评审', async () => {
      const response = await request(app)
        .post('/api/v1/reviews')
        .field('apiName', '测试 API')
        .field('apiVersion', '1.0.0')
        .attach('openapi', Buffer.from(goodOpenapiYaml), 'openapi.yaml')
      
      expect(response.statusCode).toBe(201)
      expect(response.body.id).toBeDefined()
      expect(response.body.apiName).toBe('测试 API')
      testReviewId = response.body.id
    })
    
    test('GET /api/v1/reviews 应返回评审列表', async () => {
      const response = await request(app).get('/api/v1/reviews')
      expect(response.statusCode).toBe(200)
      expect(response.body).toHaveProperty('data')
      expect(response.body).toHaveProperty('pagination')
    })
    
    test('GET /api/v1/reviews/:id 应返回评审详情', async () => {
      const response = await request(app).get(`/api/v1/reviews/${testReviewId}`)
      expect(response.statusCode).toBe(200)
      expect(response.body.id).toBe(testReviewId)
    })
    
    test('GET /api/v1/reviews/:id/report 应返回 JSON 报告', async () => {
      const response = await request(app).get(`/api/v1/reviews/${testReviewId}/report`)
      expect(response.statusCode).toBe(200)
      expect(response.body.review).toBeDefined()
      expect(response.body.issues).toBeDefined()
    })
    
    test('GET /api/v1/reviews/:id/report?format=markdown 应返回 Markdown 报告', async () => {
      const response = await request(app).get(`/api/v1/reviews/${testReviewId}/report?format=markdown`)
      expect(response.statusCode).toBe(200)
      expect(response.headers['content-type']).toContain('text/markdown')
    })
    
    test('POST /api/v1/reviews/:id/rerun 应重新运行评审', async () => {
      const response = await request(app).post(`/api/v1/reviews/${testReviewId}/rerun`)
      expect(response.statusCode).toBe(200)
      expect(response.body.id).toBe(testReviewId)
    })
    
    test('DELETE /api/v1/reviews/:id 应删除评审', async () => {
      const response = await request(app).delete(`/api/v1/reviews/${testReviewId}`)
      expect(response.statusCode).toBe(200)
    })
    
    test('GET 不存在的评审应返回 404', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000'
      const response = await request(app).get(`/api/v1/reviews/${fakeId}`)
      expect(response.statusCode).toBe(404)
    })
  })
  
  describe('坏样例评审测试', () => {
    test('坏样例应检测出问题', async () => {
      const response = await request(app)
        .post('/api/v1/reviews')
        .field('apiName', '坏样例测试')
        .field('apiVersion', '1.0.0')
        .attach('openapi', Buffer.from(badOpenapiYaml), 'openapi-bad.yaml')
      
      expect(response.statusCode).toBe(201)
      expect(response.body.issueCounts.total).toBeGreaterThan(0)
      
      const detailResponse = await request(app)
        .get(`/api/v1/reviews/${response.body.id}`)
      
      expect(detailResponse.body.issues.length).toBeGreaterThan(0)
    })
  })
})

describe('API Design Reviewer - 集成测试', () => {
  beforeAll(async () => {
    process.env.DB_PATH = ':memory:'
    await initDatabase()
    await ruleEngine.init()
  })
  
  afterAll(async () => {
    await sequelize.close()
  })
  
  test('完整评审流程', async () => {
    const spec = {
      openapi: '3.0.3',
      info: {
        title: '集成测试 API',
        version: '1.0.0'
      },
      paths: {
        '/get-users': {
          get: {
            summary: '获取用户列表',
            responses: {
              '200': { description: '成功' }
            }
          }
        }
      }
    }
    
    const yaml = require('yaml')
    const yamlContent = yaml.stringify(spec)
    const parsedSpec = await openapiParser.parse(yamlContent)
    
    expect(parsedSpec.paths['/get-users']).toBeDefined()
    
    const { ruleEngine: engine } = require('../src/services/ruleEngine')
    const result = await engine.execute(parsedSpec, null)
    
    expect(result).toHaveProperty('issues')
    expect(result).toHaveProperty('score')
    expect(result.issueCounts.total).toBeGreaterThan(0)
  })
  
  test('好样例应获得高分', async () => {
    const spec = {
      openapi: '3.0.3',
      info: {
        title: '好样例 API',
        version: '1.0.0'
      },
      paths: {
        '/users': {
          get: {
            summary: '获取用户列表',
            parameters: [
              { name: 'page', in: 'query', schema: { type: 'integer' } },
              { name: 'page_size', in: 'query', schema: { type: 'integer' } }
            ],
            responses: {
              '200': { description: '成功' },
              '400': { description: '请求错误' },
              '401': { description: '未授权' },
              '500': { description: '服务器错误' }
            }
          },
          post: {
            summary: '创建用户',
            parameters: [
              { name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string' } }
            ],
            responses: {
              '201': { description: '创建成功' },
              '400': { description: '请求错误' }
            }
          }
        }
      }
    }
    
    const yaml = require('yaml')
    const yamlContent = yaml.stringify(spec)
    const parsedSpec = await openapiParser.parse(yamlContent)
    const { ruleEngine: engine } = require('../src/services/ruleEngine')
    const result = await engine.execute(parsedSpec, null)
    
    expect(result.score).toBeGreaterThanOrEqual(70)
  })
})

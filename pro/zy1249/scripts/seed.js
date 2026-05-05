const fs = require('fs')
const path = require('path')
const { initDatabase, sequelize } = require('../src/models')
const { Review, Issue, Rule, OpenApiSpec, RulesConfig } = require('../src/models')
const { ruleEngine } = require('../src/services/ruleEngine')
const { openapiParser } = require('../src/services/openapiParser')
const { reviewService } = require('../src/services/reviewService')

const EXAMPLES_DIR = path.join(__dirname, '..', 'examples')

const seedRules = async () => {
  console.log('正在初始化规则...')
  
  await ruleEngine.init()
  
  const rules = await Rule.findAll()
  console.log(`已加载 ${rules.length} 条评审规则`)
  
  const categories = await Rule.findAll({
    attributes: ['category', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
    group: ['category']
  })
  
  console.log('规则分类统计:')
  categories.forEach(cat => {
    console.log(`  - ${cat.category}: ${cat.dataValues.count} 条`)
  })
}

const seedSampleReviews = async () => {
  console.log('\n正在创建示例评审...')
  
  const goodExamplePath = path.join(EXAMPLES_DIR, 'openapi-good-example.yaml')
  const badExamplePath = path.join(EXAMPLES_DIR, 'openapi-bad-example.yaml')
  const rulesPath = path.join(EXAMPLES_DIR, 'api-rules-example.yaml')
  
  if (fs.existsSync(goodExamplePath)) {
    console.log('  - 评审好样例 OpenAPI...')
    try {
      const openapiContent = fs.readFileSync(goodExamplePath, 'utf8')
      const parsedSpec = await openapiParser.parse(openapiContent)
      
      const review = await reviewService.createReview({
        apiName: '用户管理 API (好样例)',
        apiVersion: parsedSpec.info.version || '1.0.0',
        description: '符合 RESTful 规范的示例 API',
        openapiContent: openapiContent,
        rulesContent: null
      })
      
      console.log(`    评审完成: score=${review.score}, issues=${review.issueCounts?.total || 0}`)
    } catch (error) {
      console.error(`    评审失败: ${error.message}`)
    }
  }
  
  if (fs.existsSync(badExamplePath)) {
    console.log('  - 评审坏样例 OpenAPI...')
    try {
      const openapiContent = fs.readFileSync(badExamplePath, 'utf8')
      const parsedSpec = await openapiParser.parse(openapiContent)
      
      let rulesContent = null
      if (fs.existsSync(rulesPath)) {
        rulesContent = fs.readFileSync(rulesPath, 'utf8')
        console.log('    使用自定义规则配置')
      }
      
      const review = await reviewService.createReview({
        apiName: '错误示例 API (坏样例)',
        apiVersion: parsedSpec.info.version || '1.0.0',
        description: '包含各种不符合 RESTful 规范的示例',
        openapiContent: openapiContent,
        rulesContent: rulesContent
      })
      
      console.log(`    评审完成: score=${review.score}, issues=${review.issueCounts?.total || 0}`)
      
      const issues = await Issue.findAll({
        where: { reviewId: review.id },
        attributes: ['severity', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
        group: ['severity']
      })
      
      console.log('    问题分布:')
      issues.forEach(issue => {
        console.log(`      - ${issue.severity}: ${issue.dataValues.count}`)
      })
    } catch (error) {
      console.error(`    评审失败: ${error.message}`)
    }
  }
}

const showStats = async () => {
  console.log('\n=== Seed 完成 ===')
  
  const reviewCount = await Review.count()
  const issueCount = await Issue.count()
  const ruleCount = await Rule.count()
  
  console.log(`
  数据库统计:
  ├── 评审记录: ${reviewCount} 条
  ├── 问题记录: ${issueCount} 条
  └── 评审规则: ${ruleCount} 条
  `)
  
  const reviews = await Review.findAll({
    attributes: ['id', 'apiName', 'apiVersion', 'score', 'status', 'createdAt'],
    order: [['createdAt', 'DESC']]
  })
  
  if (reviews.length > 0) {
    console.log('  评审列表:')
    reviews.forEach((review, index) => {
      const statusEmoji = review.status === 'completed' ? '✅' : '⏳'
      const scoreColor = review.score >= 80 ? '优秀' : review.score >= 60 ? '一般' : '需要改进'
      console.log(`    ${index + 1}. ${statusEmoji} ${review.apiName} (v${review.apiVersion})`)
      console.log(`       得分: ${review.score} (${scoreColor})`)
      console.log(`       ID: ${review.id}`)
    })
  }
}

const main = async () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    API Design Reviewer                         ║
║                      Seed 数据初始化                           ║
╚══════════════════════════════════════════════════════════════╝
  `)
  
  try {
    console.log('正在初始化数据库...')
    await initDatabase()
    console.log('数据库初始化完成')
    
    await seedRules()
    await seedSampleReviews()
    await showStats()
    
    console.log('\n提示:')
    console.log('  - 运行 npm start 启动服务')
    console.log('  - 访问 http://localhost:3000 查看服务信息')
    console.log('  - 使用 examples/curl-commands.md 中的命令测试 API')
    
    await sequelize.close()
    process.exit(0)
  } catch (error) {
    console.error('Seed 失败:', error)
    await sequelize.close()
    process.exit(1)
  }
}

main()

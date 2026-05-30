import { getDb } from './db.js'
import { v4 as uuidv4 } from 'uuid'

const seedPrompts = [
  {
    title: 'React 组件生成器',
    content: `你是一个专业的 React 前端开发工程师。
请根据用户需求生成高质量的 React 组件代码。
要求：
- 使用 TypeScript 和函数式组件
- 使用 Tailwind CSS 进行样式设计
- 遵循最佳实践，包含适当的错误处理
- 组件应该是可复用和可组合的
- 包含 prop 类型定义
- 如果需要，使用 React Hooks`,
    techStacks: ['React', 'TypeScript', 'Tailwind CSS'],
    rating: 9,
    failureReasons: [],
    tags: ['frontend', 'react', 'component'],
    changeReason: '初始版本',
    confirmedBy: 'admin'
  },
  {
    title: 'REST API 接口生成',
    content: `你是一个后端开发专家。
请为指定的业务场景生成 RESTful API 接口设计和实现代码。
要求：
- 使用 Express.js 框架
- 遵循 RESTful API 设计规范
- 包含适当的请求验证
- 统一的错误处理
- 输入输出示例
- 可选：使用 TypeScript 类型定义`,
    techStacks: ['Node.js', 'Express', 'REST API'],
    rating: 8,
    failureReasons: ['错误处理不够全面'],
    tags: ['backend', 'api', 'express'],
    changeReason: '初始版本',
    confirmedBy: 'admin'
  },
  {
    title: 'SQL 查询优化',
    content: `你是一个数据库性能优化专家。
请分析并优化提供的 SQL 查询语句。
要求：
- 分析查询执行计划
- 识别性能瓶颈
- 提供优化后的 SQL 语句
- 建议合适的索引
- 解释优化的原理和预期效果`,
    techStacks: ['SQL', 'PostgreSQL', 'MySQL'],
    rating: 7,
    failureReasons: ['复杂查询优化效果一般'],
    tags: ['database', 'sql', 'performance'],
    changeReason: '初始版本',
    confirmedBy: 'dba'
  },
  {
    title: 'React 组件生成器 v2',
    content: `你是一个专业的 React 前端开发工程师。
请根据用户需求生成高质量的 React 组件代码。
要求：
- 使用 TypeScript 和函数式组件 + Hooks
- 使用 Tailwind CSS v3 进行样式设计
- 使用 lucide-react 图标库
- 遵循最佳实践，包含适当的错误处理
- 组件应该是可复用和可组合的
- 包含完整的类型定义
- 支持暗色模式
- 代码风格统一，使用 2 空格缩进`,
    techStacks: ['React', 'TypeScript', 'Tailwind CSS'],
    rating: 9,
    failureReasons: [],
    tags: ['frontend', 'react', 'component'],
    changeReason: '升级 React 18 + Tailwind v3，增加暗色模式支持',
    confirmedBy: 'admin'
  },
  {
    title: 'Vue 组件开发',
    content: `你是一个 Vue.js 开发专家。
请生成高质量的 Vue 3 单文件组件。
要求：
- 使用 Vue 3 Composition API
- 使用 TypeScript 类型系统
- 使用 Tailwind CSS 样式
- 遵循 Vue 风格指南
- 包含完整的 props、emit 定义
- 支持插槽（slot）和作用域插槽`,
    techStacks: ['Vue', 'TypeScript', 'Tailwind CSS'],
    rating: 8,
    failureReasons: [],
    tags: ['frontend', 'vue', 'component'],
    changeReason: '初始版本',
    confirmedBy: 'admin'
  },
  {
    title: 'Python 数据分析脚本',
    content: `你是一个 Python 数据分析专家。
请为给定的数据分析需求生成完整的 Python 脚本。
要求：
- 使用 pandas 进行数据处理
- 使用 matplotlib 或 seaborn 进行可视化
- 包含数据清洗步骤
- 异常值处理
- 结果解释和说明
- 代码结构清晰，有适当注释`,
    techStacks: ['Python', 'Pandas', 'Matplotlib'],
    rating: 7,
    failureReasons: ['可视化样式不够美观'],
    tags: ['data', 'python', 'analysis'],
    changeReason: '初始版本',
    confirmedBy: 'data-team'
  },
  {
    title: 'Go 微服务模板',
    content: `你是一个 Go 微服务架构师。
请生成可用于生产环境的 Go 微服务模板代码。
要求：
- 使用 Gin 或 Echo 框架
- 遵循 Go 最佳实践
- 包含日志、监控、链路追踪
- 配置管理（使用 viper）
- 依赖注入
- 数据库集成（GORM）
- Docker 支持`,
    techStacks: ['Go', 'Gin', 'Docker'],
    rating: 9,
    failureReasons: [],
    tags: ['backend', 'go', 'microservice'],
    changeReason: '初始版本',
    confirmedBy: 'platform-team'
  },
  {
    title: '前端单元测试',
    content: `你是一个前端测试专家。
请为给定的 React/Vue 组件生成完整的单元测试代码。
要求：
- 使用 Jest 测试框架
- 使用 Testing Library
- 覆盖主要场景和边界条件
- 包含适当的 Mock
- 测试用例描述清晰
- 测试覆盖率 >= 80%`,
    techStacks: ['Jest', 'Testing Library', 'React'],
    rating: 8,
    failureReasons: ['复杂异步场景测试不够完善'],
    tags: ['testing', 'frontend', 'jest'],
    changeReason: '初始版本',
    confirmedBy: 'qa-team'
  },
  {
    title: '代码审查助手',
    content: `你是一个资深代码审查专家。
请对提供的代码进行全面的代码审查。
要求：
- 检查代码风格和规范
- 识别潜在的 bug 和逻辑问题
- 性能问题分析
- 安全漏洞检查
- 可维护性评估
- 提供具体的改进建议和代码示例`,
    techStacks: ['Code Review', 'Best Practices'],
    rating: 9,
    failureReasons: [],
    tags: ['code-review', 'quality', 'best-practices'],
    changeReason: '初始版本',
    confirmedBy: 'tech-lead'
  },
  {
    title: '数据库迁移脚本',
    content: `你是一个数据库架构师。
请生成数据库迁移脚本和相关文档。
要求：
- 使用 Flyway 或 Liquibase 格式
- 包含升级和回滚脚本
- 数据迁移策略
- 索引优化建议
- 兼容性说明
- 回滚测试步骤`,
    techStacks: ['PostgreSQL', 'Flyway', 'Database'],
    rating: 7,
    failureReasons: ['极端场景下数据迁移可能有问题'],
    tags: ['database', 'migration', 'flyway'],
    changeReason: '初始版本',
    confirmedBy: 'dba'
  }
]

const seedIssues = [
  {
    type: 'duplicate' as const,
    severity: 'high' as const,
    description: 'React 组件生成器有两个高度相似的版本，需要合并或区分用途',
    relatedPromptTitles: ['React 组件生成器', 'React 组件生成器 v2']
  },
  {
    type: 'rating_inconsistency' as const,
    severity: 'medium' as const,
    description: '评分口径需要统一：部分评分偏宽松，部分偏严格',
    relatedPromptTitles: []
  },
  {
    type: 'deprecated_usage' as const,
    severity: 'low' as const,
    description: 'SQL 查询优化提示词已更新新版本，旧版本仍有使用痕迹',
    relatedPromptTitles: ['SQL 查询优化']
  }
]

export function seedDb(): void {
  const db = getDb()

  for (const prompt of seedPrompts) {
    const id = uuidv4()
    const now = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()

    db.transaction(() => {
      db.prepare(`
        INSERT INTO prompts (id, title, content, current_version, status, created_at, updated_at)
        VALUES (?, ?, ?, 1, 'active', ?, ?)
      `).run(id, prompt.title, prompt.content, now, now)

      db.prepare(`
        INSERT INTO prompt_versions (id, prompt_id, version, content, rating, change_reason, confirmed_by, confirmed_at, created_at)
        VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(),
        id,
        prompt.content,
        prompt.rating,
        prompt.changeReason,
        prompt.confirmedBy,
        now,
        now
      )

      for (const tag of prompt.tags) {
        db.prepare('INSERT INTO prompt_tags (id, prompt_id, tag) VALUES (?, ?, ?)').run(uuidv4(), id, tag)
      }

      for (const tech of prompt.techStacks) {
        db.prepare('INSERT INTO prompt_tech_stacks (id, prompt_id, tech_stack) VALUES (?, ?, ?)').run(uuidv4(), id, tech)
      }

      for (const reason of prompt.failureReasons) {
        db.prepare('INSERT INTO prompt_failure_reasons (id, prompt_id, reason) VALUES (?, ?, ?)').run(uuidv4(), id, reason)
      }
    })()
  }

  for (const issue of seedIssues) {
    const relatedIds: string[] = []

    for (const title of issue.relatedPromptTitles) {
      const row = db.prepare('SELECT id FROM prompts WHERE title = ?').get(title) as { id: string } | undefined
      if (row) relatedIds.push(row.id)
    }

    const issueId = uuidv4()
    const now = new Date().toISOString()

    db.transaction(() => {
      db.prepare(`
        INSERT INTO issues (id, type, severity, status, description, created_at, updated_at)
        VALUES (?, ?, ?, 'open', ?, ?, ?)
      `).run(issueId, issue.type, issue.severity, issue.description, now, now)

      for (const pid of relatedIds) {
        db.prepare('INSERT INTO issue_prompt_relations (id, issue_id, prompt_id) VALUES (?, ?, ?)').run(uuidv4(), issueId, pid)
      }

      db.prepare(`
        INSERT INTO issue_logs (id, issue_id, action, actor, comment)
        VALUES (?, ?, 'created', 'system', ?)
      `).run(uuidv4(), issueId, issue.description)
    })()
  }
}

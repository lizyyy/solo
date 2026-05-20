# 搜索同义词发布台

一个面向技术团队的全栈 Web 应用，用于管理搜索同义词的版本、发布、预览和回滚，解决同义词修改影响范围不可控的问题。

## 核心功能

### 数据模型
- **同义词组 (Synonym Group)**: 管理同义词集合，包含名称、同义词列表、应用范围、版本号
- **发布批次 (Publish Batch)**: 批量发布多个同义词组，支持状态流转
- **测试查询 (Test Query)**: 关联到同义词组，用于验证命中变化
- **命中变化 (Hit Change)**: 记录发布前后查询命中数的变化
- **回滚审计 (Rollback Audit)**: 记录每次回滚的版本、原因、操作人
- **状态历史 (Status History)**: 完整记录所有实体的状态流转

### 业务规则
- **版本控制**: 每个同义词组都有版本号，修改会自动递增版本
- **状态流转**: 
  - 同义词组: 草稿 → 待审批 → 已审批 → 已发布 / 已驳回 → 草稿
  - 发布批次: 待处理 → 复核中 → 已审批 → 发布中 → 已发布 / 失败 → 回滚中 → 已回滚
- **预览发布**: 模拟发布，预览命中变化，超过阈值自动拦截
- **命中对比**: 发布前后的命中数对比，可视化变化率
- **回滚审计**: 所有回滚操作都有记录，支持追溯

### API 接口
- **创建**: 同义词组、发布批次、测试查询
- **查询**: 列表、详情、版本历史、状态历史、命中变化、回滚记录
- **状态推进**: 审批、驳回、发布、回滚
- **异常处理**: 重复调用检测、状态校验、错误提示
- **导出**: 导出发布批次的完整数据，包含状态说明

## 技术栈

### 后端
- Node.js + Express
- TypeScript
- SQLite (sqlite3 - 广泛支持的预编译二进制)
- UUID

### 前端
- React 18 + TypeScript
- Vite
- React Router DOM

## 项目结构

```
.
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── index.ts        # 入口文件
│   │   ├── database.ts     # 数据库初始化
│   │   ├── services.ts     # 业务逻辑
│   │   ├── routes.ts       # API 路由
│   │   └── types.ts        # 类型定义
│   ├── data/               # SQLite 数据库文件
│   ├── package.json
│   └── tsconfig.json
├── frontend/               # 前端应用
│   ├── src/
│   │   ├── main.tsx       # 入口文件
│   │   ├── api.ts         # API 客户端
│   │   ├── types.ts       # 类型定义
│   │   └── pages/         # 页面组件
│   │       ├── SynonymGroups.tsx
│   │       ├── SynonymGroupDetail.tsx
│   │       ├── PublishBatches.tsx
│   │       └── BatchDetail.tsx
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── package.json
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
# 安装前后端所有依赖
npm run install:all
```

或者分别安装：

```bash
# 后端
cd backend
npm install

# 前端
cd ../frontend
npm install
```

### 2. 启动服务

**启动后端服务** (端口 3001):
```bash
npm run dev:backend
```

**启动前端服务** (端口 3000):
```bash
npm run dev:frontend
```

需要两个终端窗口分别运行。

### 3. 访问应用

打开浏览器访问: http://localhost:3000

## 功能说明

### 同义词组管理
1. **新建同义词组**: 填写名称、同义词（逗号分隔）、应用范围、描述
2. **提交审批**: 将状态从"草稿"变更为"待审批"
3. **审批通过/驳回**: 审批人可以通过或驳回
4. **查看详情**: 
   - 基本信息: 同义词列表、应用范围、版本等
   - 版本历史: 所有历史版本，支持版本对比
   - 状态变更: 完整的状态流转记录
   - 测试查询: 添加测试查询词，用于验证发布效果

### 发布批次管理
1. **新建发布批次**: 选择多个已审批的同义词组，批量发布
2. **复核流程**: 
   - 开始复核 → 通过复核
   - 支持记录操作原因
3. **模拟发布**: 
   - 预览命中变化
   - 自动检测异常（命中下降超过阈值）
   - 异常拦截，阻止发布
4. **正式发布**: 执行发布，记录命中变化
5. **回滚**: 已发布的批次可以回滚到上一版本，必须填写回滚原因
6. **导出数据**: 导出 CSV 格式，包含所有同义词组的状态说明

### 样例数据
系统启动时会自动创建样例数据，包含：
- 手机类同义词组（已发布）
- 电脑类同义词组（已发布）  
- 服装类同义词组（已驳回）
- 2024年第一季度发布批次（已发布）
- 2024年第二季度发布批次（已回滚）

## API 接口文档

### 同义词组 API
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/synonym-groups | 获取所有同义词组 |
| GET | /api/synonym-groups/:id | 获取指定同义词组 |
| POST | /api/synonym-groups | 创建同义词组 |
| PUT | /api/synonym-groups/:id | 更新同义词组 |
| PUT | /api/synonym-groups/:id/status | 更新状态 |
| GET | /api/synonym-groups/:id/versions | 获取版本历史 |
| GET | /api/synonym-groups/:id/test-queries | 获取测试查询 |
| POST | /api/synonym-groups/:id/test-queries | 添加测试查询 |

### 发布批次 API
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/publish-batches | 获取所有发布批次 |
| GET | /api/publish-batches/:id | 获取指定发布批次 |
| POST | /api/publish-batches | 创建发布批次 |
| GET | /api/publish-batches/:id/items | 获取批次包含的同义词组 |
| PUT | /api/publish-batches/:id/status | 更新批次状态 |
| POST | /api/publish-batches/:id/simulate | 模拟发布 |
| POST | /api/publish-batches/:id/publish | 执行发布 |
| POST | /api/publish-batches/:id/rollback | 执行回滚 |
| GET | /api/publish-batches/:id/hit-changes | 获取命中变化 |
| GET | /api/publish-batches/:id/rollback-audits | 获取回滚记录 |
| GET | /api/publish-batches/:id/export | 导出批次数据 |

### 状态历史 API
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/status-history/:entityType/:entityId | 获取状态历史 |

## 核心设计亮点

### 1. 状态机设计
- 严格的状态流转校验，防止非法操作
- 每次状态变更都记录历史和原因
- 支持状态回退（如：已驳回 → 草稿）

### 2. 发布预览机制
- 模拟发布不影响真实数据
- 命中变化可视化对比
- 阈值检测自动拦截异常发布

### 3. 可追溯性
- 完整的版本历史，支持任意版本对比
- 所有操作都有操作人和时间记录
- 回滚审计记录，方便问题排查

### 4. 导出数据可解释性
导出的 CSV 包含"状态说明"字段，解释该记录为什么到达当前状态，包括：
- 发布失败原因
- 最后一次操作说明
- 同义词组当前状态解释

## 开发说明

### 后端开发
```bash
cd backend
npm run dev    # 开发模式，自动重启
```

### 前端开发
```bash
cd frontend
npm run dev    # 开发模式，热更新
```

### 构建
```bash
npm run build  # 构建前后端
```

## 注意事项

1. **数据持久化**: SQLite 数据库文件位于 `backend/data/` 目录
2. **样例数据**: 首次启动会自动创建样例数据，重启不会重复创建
3. **状态校验**: 所有状态变更都有严格校验，不符合状态机的操作会被拒绝
4. **回滚限制**: 只有已发布的批次才能回滚，回滚会恢复到上一版本
5. **发布拦截**: 模拟发布时如果命中下降超过阈值，会阻止正式发布
6. **构建兼容性**: 使用 `sqlite3` 替代 `better-sqlite3`，不需要 C++20 编译环境，sqlite3 提供广泛的预编译二进制支持

## 技术要点

### 数据库设计
- 所有表都有 created_at 时间戳
- 状态变更记录到单独的 status_history 表
- 同义词使用 JSON 格式存储，支持灵活扩展
- 外键关联保证数据一致性

### 错误处理
- API 统一响应格式: `{ success: boolean, data?: any, error?: string }`
- 所有业务异常都有明确的错误信息
- 前端有友好的错误提示

### 类型安全
- 前后端都使用 TypeScript
- 共享类型定义，保证接口一致性
- 编译时类型检查，减少运行时错误

# 工地安全整改罚款管理系统

一个完整的全栈 Web 应用，用于管理工地安全隐患、整改复查和罚款流程，支持操作追溯和规则校验。

## 技术栈

- **后端**: Node.js + Express + SQLite
- **前端**: 原生 HTML/JavaScript + Tailwind CSS
- **功能模块**: 隐患管理、罚款管理、高危清单、操作日志、导入导出

## 快速开始

### 1. 启动后端服务

```bash
cd backend
npm install
npm start
```

服务将在 `http://localhost:3000` 启动

### 2. 启动前端

直接用浏览器打开 `frontend/index.html` 文件，或者使用任何 HTTP 服务器：

```bash
cd frontend
python -m http.server 8080
# 然后访问 http://localhost:8080
```

### 3. 初始化演示数据

```bash
cd backend
npm run seed
```

这将创建示例班组、隐患数据，并预置四条演示路径的操作日志。

## 功能特性

### 核心业务规则

#### 整改期限变更规则
- ✅ 延期不能超过 7 天，超过需人工审批
- ✅ 新期限不能早于原期限
- ✅ 延期理由长度必须大于 10 个字符
- 🔧 超过 7 天可以通过 `manual_override=true` 强制通过（标记为人工修正）

#### 复查意见校验规则
- ✅ 状态必须是"待复查"才能提交复查
- ✅ 复查意见长度必须大于 5 个字符
- ✅ 禁止包含敏感词（看不懂、不知道、随便、无所谓）
- 🔧 校验失败可以通过 `manual_override=true` 强制通过

#### 逾期罚款计算规则
- ✅ 按风险等级计算日罚款额：
  - 低风险：¥50/天
  - 中风险：¥100/天
  - 高风险：¥200/天
  - 极高风险：¥500/天
- ✅ 最多计算 30 天逾期
- ✅ 罚款生成后状态为"待复核"，需人工确认

#### 幂等性保证
- ✅ 所有写操作支持 `X-Request-ID` 请求头
- ✅ 相同 Request-ID 的重复请求会被拦截（返回 409 Conflict）
- ✅ 请求日志永久保存，可追溯重复提交记录

### 内置四条演示路径

访问前端的"演示路径"标签页，可以一键运行以下流程：

1. **成功路径**: 正常创建隐患 → 提交复查通过
2. **拦截路径**: 在错误状态下提交复查，展示规则拦截
3. **人工修正路径**: 延期超过 7 天被拦截 → 使用 manual_override 强制通过
4. **重复提交路径**: 使用相同 Request-ID 重复提交 → 展示幂等校验

### 数据导入导出

- **导出**: 支持 Excel 和 CSV 格式导出隐患清单和罚款记录
- **导入**: 支持批量导入隐患数据（Excel/CSV），自动匹配班组
- **字段支持**: 隐患描述、位置、风险等级、责任班组、整改期限

## API 接口文档

### 隐患管理接口

#### 获取隐患列表
```http
GET /api/hazards?status=待整改&risk_level=高&keyword=关键词&page=1&pageSize=20
```

#### 创建隐患
```http
POST /api/hazards
Content-Type: application/json
X-Request-ID: optional-request-id

{
  "description": "隐患描述",
  "location": "位置",
  "risk_level": "高",
  "team_id": "班组ID",
  "deadline": "2024-12-31T23:59:59.000Z",
  "operator": "操作人"
}
```

#### 提交复查
```http
POST /api/hazards/:id/review
Content-Type: application/json

{
  "opinion": "复查意见",
  "result": "通过",
  "reviewer": "复查人",
  "manual_override": false
}
```

#### 变更整改期限
```http
PUT /api/hazards/:id/deadline
Content-Type: application/json

{
  "new_deadline": "2024-12-31T23:59:59.000Z",
  "reason": "延期理由",
  "operator": "操作人",
  "manual_override": false
}
```

#### 获取高危清单
```http
GET /api/hazards/high-risk
```

### 罚款管理接口

#### 获取罚款列表
```http
GET /api/fines?status=待复核
```

#### 复核罚款
```http
PUT /api/fines/:id/review
Content-Type: application/json

{
  "status": "已确认",
  "reviewer": "复核人",
  "manual_override": false
}
```

### 班组接口

```http
GET /api/teams
POST /api/teams
```

### 操作日志接口

```http
GET /api/logs?limit=50&hazard_id=xxx
GET /api/logs/timeline/:hazard_id
```

### 导入导出接口

```http
GET /api/export/hazards?format=excel
GET /api/export/fines?format=csv
POST /api/import/hazards (multipart/form-data)
```

## 查看报告

### 前端查看

1. **隐患管理**: 查看所有隐患，支持按状态、风险、班组筛选
2. **隐患详情**: 点击"查看"按钮查看完整信息和操作时间线
3. **罚款管理**: 查看罚款记录，支持复核操作
4. **高危清单**: 专门页面展示高/极高风险隐患，优先处理
5. **操作日志**: 查看所有操作记录，包括成功、拦截、人工修正、重复提交
6. **演示路径**: 一键运行四条演示流程，查看规则生效情况

### 操作结果说明

每条操作会在日志中标记为以下四种结果之一：

| 结果类型 | 颜色 | 说明 |
|---------|------|------|
| ✅ 成功 | 绿色 | 符合所有规则，正常执行 |
| ❌ 拦截 | 红色 | 触发业务规则，操作被阻止 |
| 🔧 人工修正 | 黄色 | 通过 manual_override 强制执行 |
| 🔄 重复提交 | 紫色 | 相同 Request-ID 的重复请求 |

### 时间线追踪

每个隐患的详情页面会展示完整的操作时间线，包括：
- 操作人
- 操作时间
- 操作结果（成功/拦截/人工修正/重复提交）
- 具体原因说明

## 数据库结构

### 主要数据表

- `teams`: 班组信息（ID、名称、负责人、电话）
- `hazards`: 隐患记录（描述、位置、风险、班组、期限、状态）
- `reviews`: 复查记录（隐患ID、意见、结果、复查人）
- `fines`: 罚款记录（隐患ID、金额、原因、状态、复核人）
- `operation_logs`: 操作日志（完整审计追踪）
- `deadline_changes`: 期限变更历史

## 项目目录结构

```
.
├── backend/
│   ├── src/
│   │   ├── server.js          # 服务入口
│   │   ├── config/
│   │   │   └── database.js    # 数据库配置
│   │   ├── routes/
│   │   │   └── index.js       # API 路由
│   │   ├── controllers/       # 业务控制器
│   │   ├── services/          # 规则服务和日志服务
│   │   ├── middleware/        # 幂等中间件
│   │   └── utils/
│   │       └── seed.js        # 演示数据生成器
│   ├── data/                   # SQLite 数据库文件
│   └── package.json
└── frontend/
    ├── index.html              # 主页面
    ├── api.js                  # API 封装
    └── app.js                  # 前端逻辑
```

## 注意事项

1. **数据持久化**: SQLite 数据库文件保存在 `backend/data/` 目录，重启服务数据不会丢失
2. **CORS**: 后端已配置 CORS，支持跨域请求
3. **生产部署**: 生产环境建议使用 MySQL/PostgreSQL 替代 SQLite
4. **身份认证**: 当前为演示版本，未实现用户认证，生产环境请添加

## 常见问题

**Q: 为什么提交复查总是失败？**
A: 请检查隐患状态是否为"待复查"，以及复查意见长度是否大于 5 个字符，是否包含敏感词。

**Q: 如何批量导入历史数据？**
A: 准备 Excel 文件，包含列：隐患描述、位置、风险等级、责任班组、整改期限，然后点击导入按钮。

**Q: 人工修正操作会被记录吗？**
A: 会的，所有使用 manual_override 的操作都会在日志中标记为"人工修正"，操作人和原因都有记录。

**Q: 重启服务后日志还在吗？**
A: 在的，所有操作日志永久保存在数据库中，可以随时查看和审计。

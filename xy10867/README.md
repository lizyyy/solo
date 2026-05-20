# 🛡️ 漏洞包分诊台

一个面向技术团队的漏洞包分诊管理系统，帮助团队高效处理依赖漏洞扫描结果。

## 项目概述

### 背景
依赖漏洞扫描工具通常会产生大量告警，团队难以区分哪些漏洞真正影响运行中的服务。本系统提供了漏洞分诊流程，帮助团队：
- 识别真正有风险的漏洞
- 跟踪漏洞修复进度
- 管理豁免审批
- 导出合规报告

### 核心功能
- **异常队列**: 集中展示所有漏洞，按严重程度和状态分类
- **状态推进**: 标准化的漏洞处理流程（待处理→分析中→修复中→已验证→已关闭）
- **历史轨迹**: 完整的操作审计日志，可追溯每一步变更
- **导出入口**: 支持 CSV/JSON 格式导出，满足合规需求

## 技术栈

### 后端
- **Node.js + Express**: RESTful API 服务
- **SQLite**: 嵌入式数据库，无需额外安装
- **csv-writer**: 导出功能支持

### 前端
- **React 18**: 前端框架
- **Ant Design 5**: UI 组件库
- **Vite**: 构建工具
- **Axios**: HTTP 客户端
- **Day.js**: 日期处理

## 快速开始

### 环境要求
- Node.js >= 16.0.0
- npm 或 yarn

### ⚠️ 重要提示
**必须先安装依赖再运行任何脚本！** `Cannot find module` 或 `command not found` 错误都是因为没有执行 `npm install`。

---

### 一键启动脚本（推荐）

```bash
# 项目根目录执行
# 1. 安装后端依赖并初始化数据库
cd backend && npm install && npm run init-db

# 2. 导入演示数据（可选但推荐）
node scripts/seed-data.js

# 3. 启动后端服务（保持终端运行）
npm start
```

**新开终端启动前端：**

```bash
# 项目根目录执行
cd frontend && npm install && npm run dev
```

---

### 分步详细说明

#### 步骤 1: 后端初始化

```bash
# 进入后端目录
cd backend

# 安装依赖（必须第一步！）
npm install

# 初始化数据库（自动创建 data 目录和表）
npm run init-db

# 导入演示数据（可选）
node scripts/seed-data.js

# 启动后端服务
npm start
# 或开发模式（自动重启）
# npm run dev
```

后端服务将在 `http://localhost:3001` 启动

**验证后端是否正常：**
```bash
curl http://localhost:3001/api/health
```

#### 步骤 2: 前端启动

```bash
# 进入前端目录（新开终端）
cd frontend

# 安装依赖（必须第一步！）
npm install

# 启动开发服务器
npm run dev
```

前端服务将在 `http://localhost:3000` 启动

#### 步骤 3: 访问应用

打开浏览器访问: `http://localhost:3000`

---

### 使用 npm --prefix 的方式（可选）

如果不想 cd 到子目录，可以在项目根目录直接执行：

```bash
# 安装后端依赖
npm --prefix backend install

# 初始化数据库
npm --prefix backend run init-db

# 启动后端
npm --prefix backend start

# 安装前端依赖
npm --prefix frontend install

# 启动前端
npm --prefix frontend run dev
```

## API 接口文档

### 基础信息
- 基础地址: `http://localhost:3001/api`
- Content-Type: `application/json`

### 1. 健康检查

```bash
GET /api/health
```

**响应示例:**
```json
{
  "success": true,
  "message": "漏洞包分诊台 API 运行正常",
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

### 2. 创建漏洞

```bash
POST /api/vulnerabilities
```

**请求体:**
```json
{
  "cveId": "CVE-2024-12345",
  "packageName": "lodash",
  "packageVersion": "4.17.20",
  "ecosystem": "npm",
  "severity": "HIGH",
  "cvssScore": 7.5,
  "description": "原型污染漏洞",
  "affectedServices": ["user-service", "order-service"],
  "operator": "admin"
}
```

### 3. 查询漏洞列表

```bash
GET /api/vulnerabilities?status=PENDING&severity=CRITICAL
```

**参数:**
- `status`: 按状态过滤 (PENDING, ANALYZING, EXEMPTED, FIXING, VERIFIED, CLOSED)
- `severity`: 按严重程度过滤 (CRITICAL, HIGH, MEDIUM, LOW)

### 4. 查询单个漏洞详情

```bash
GET /api/vulnerabilities/{id}
```

### 5. 状态推进操作

#### 5.1 开始分析
```bash
POST /api/vulnerabilities/{id}/analyze
{
  "operator": "security-engineer"
}
```

#### 5.2 申请豁免
```bash
POST /api/vulnerabilities/{id}/exempt
{
  "reason": "该功能未在生产环境使用，风险可控",
  "operator": "security-engineer"
}
```

#### 5.3 开始修复
```bash
POST /api/vulnerabilities/{id}/fix
{
  "fixBatch": "BATCH-2024-01",
  "operator": "dev-lead"
}
```

#### 5.4 验证修复
```bash
POST /api/vulnerabilities/{id}/verify
{
  "verifier": "qa-engineer",
  "result": "PASS",
  "comment": "已在测试环境验证，漏洞已修复"
}
```

#### 5.5 关闭漏洞
```bash
POST /api/vulnerabilities/{id}/close
{
  "operator": "security-lead"
}
```

### 6. 合并漏洞

```bash
POST /api/vulnerabilities/merge
{
  "targetId": "uuid-target",
  "sourceIds": ["uuid-source1", "uuid-source2"],
  "operator": "security-engineer"
}
```

### 7. 查询审计日志

```bash
GET /api/vulnerabilities/{id}/audit-logs
```

### 8. 查询验证记录

```bash
GET /api/vulnerabilities/{id}/verifications
```

### 9. 导出数据

```bash
POST /api/vulnerabilities/export
{
  "format": "csv",
  "filters": {
    "status": "PENDING"
  }
}
```

**格式选项:** `csv` 或 `json`

### 10. 下载导出文件

```bash
GET /api/vulnerabilities/exports/{filename}
```

## 状态机规则

```
PENDING (待处理)
    ↓
ANALYZING (分析中)
    ↓         ↘
EXEMPTED (已豁免)  FIXING (修复中)
    ↓              ↓
CLOSED (已关闭)  VERIFIED (已验证)
                   ↓
              CLOSED (已关闭)
```

### 状态转换限制
- 不允许从 CLOSED 状态转换到任何其他状态
- 不允许从 VERIFIED 转换到 ANALYZING
- 不允许从 EXEMPTED 转换到 FIXING

## 故意失败的路径演示

### 场景 1: 非法状态转换

**目标**: 尝试直接从 "待处理" 跳到 "修复中"（跳过分析阶段）

```bash
# 1. 首先创建一个处于 PENDING 状态的漏洞
POST /api/vulnerabilities
{
  "packageName": "test-pkg",
  "packageVersion": "1.0.0",
  "ecosystem": "npm",
  "severity": "HIGH"
}

# 2. 尝试非法转换：从 PENDING 直接到 FIXING
POST /api/vulnerabilities/{id}/fix
{
  "fixBatch": "BATCH-2024-01",
  "operator": "test-user"
}
```

**预期错误响应:**
```json
{
  "success": false,
  "error": "不允许从 PENDING 转换到 FIXING"
}
```

**原因**: 必须先经过 ANALYZING 状态，确保漏洞影响经过评估。

### 场景 2: 尝试操作已关闭的漏洞

```bash
# 1. 创建并关闭一个漏洞
POST /api/vulnerabilities → 获取 id
POST /api/vulnerabilities/{id}/analyze
POST /api/vulnerabilities/{id}/close

# 2. 尝试重新打开已关闭的漏洞
POST /api/vulnerabilities/{id}/analyze
```

**预期错误响应:**
```json
{
  "success": false,
  "error": "不允许从 CLOSED 转换到 ANALYZING"
}
```

**原因**: 漏洞一旦关闭即为最终状态，不可再变更。

### 场景 3: 豁免但不提供理由

```bash
POST /api/vulnerabilities/{id}/exempt
{
  "operator": "test-user"
  // 缺少 reason 字段
}
```

**预期错误响应:**
```json
{
  "success": false,
  "error": "豁免理由不能为空，请提供详细的豁免说明和风险评估"
}
```

**原因**: 在业务逻辑层做了前置校验，确保豁免理由必填。

### 场景 4: 导出不存在的文件

```bash
GET /api/vulnerabilities/exports/non-existent-file.csv
```

**预期错误响应:**
```json
{
  "success": false,
  "error": "文件不存在"
}
```

## 数据模型

### packages (依赖包表)
- `id`: UUID 主键
- `name`: 包名
- `version`: 版本号
- `ecosystem`: 生态系统 (npm, pypi, maven, gem)
- `created_at`: 创建时间

### vulnerabilities (漏洞表)
- `id`: UUID 主键
- `package_id`: 关联包 ID
- `cve_id`: CVE 编号
- `severity`: 严重程度 (CRITICAL, HIGH, MEDIUM, LOW)
- `cvss_score`: CVSS 分数
- `description`: 漏洞描述
- `status`: 状态
- `affected_services`: 受影响服务列表 (JSON)
- `exempt_reason`: 豁免理由
- `exempt_by`: 豁免操作人
- `exempt_at`: 豁免时间
- `fix_batch`: 修复批次
- `created_at`: 创建时间
- `updated_at`: 更新时间

### verification_records (验证记录表)
- `id`: UUID 主键
- `vulnerability_id`: 关联漏洞 ID
- `verifier`: 验证人
- `result`: 验证结果 (PASS, FAIL)
- `comment`: 备注
- `verified_at`: 验证时间

### audit_logs (审计日志表)
- `id`: UUID 主键
- `vulnerability_id`: 关联漏洞 ID
- `action`: 操作类型
- `previous_status`: 变更前状态
- `new_status`: 变更后状态
- `operator`: 操作人
- `request_data`: 请求数据 (JSON)
- `response_data`: 响应数据 (JSON)
- `created_at`: 操作时间

## 项目结构

```
xy10867/
├── backend/
│   ├── src/
│   │   ├── server.js          # 服务入口
│   │   ├── db/
│   │   │   └── index.js       # 数据库连接
│   │   ├── services/          # 业务逻辑层
│   │   │   ├── vulnerabilityService.js
│   │   │   ├── auditService.js
│   │   │   └── exportService.js
│   │   └── routes/            # API 路由
│   │       ├── vulnerabilities.js
│   │       └── audit.js
│   ├── scripts/
│   │   ├── init-db.js         # 数据库初始化
│   │   └── seed-data.js       # 演示数据
│   ├── data/                  # SQLite 数据库文件
│   ├── exports/               # 导出文件目录
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── main.jsx           # 应用入口
│   │   ├── App.jsx            # 主组件
│   │   ├── index.css          # 样式
│   │   └── services/
│   │       └── api.js         # API 封装
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── README.md
```

## 核心业务规则

### 漏洞归并规则
- 相同包名 + 版本 + 生态的漏洞自动归并
- 支持手动合并重复漏洞
- 合并后源漏洞标记为 CLOSED

### 影响判断规则
- 严重/高危漏洞必须经过分析阶段
- 豁免需要填写详细理由
- 受影响服务列表用于影响范围评估

### 豁免审批规则
- 豁免理由必填
- 豁免操作人记录在案
- 豁免状态可追溯

### 修复跟踪规则
- 修复批次用于批量跟踪
- 修复完成后必须经过验证
- 验证失败保持在 FIXING 状态

### 验证导出规则
- 导出包含完整状态历史
- 支持按状态、严重程度过滤
- 导出格式支持 CSV（报表）和 JSON（数据交换）

## 注意事项

1. **数据持久化**: SQLite 数据库文件存储在 `backend/data/` 目录，刷新页面数据不丢失
2. **审计日志**: 所有状态变更操作都会记录请求和响应数据
3. **状态严格**: 状态机设计严格，防止非法状态转换
4. **操作追溯**: 每条漏洞都有完整的操作轨迹可查

## 后续扩展建议

- [ ] 接入真实漏洞扫描工具 API
- [ ] 添加用户认证和权限管理
- [ ] 支持邮件通知（漏洞分配、审批提醒等）
- [ ] 添加统计仪表盘和趋势分析
- [ ] 支持 Webhook 集成 CI/CD 系统
- [ ] 添加 SLA 到期提醒

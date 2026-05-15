# 团队邀请权限 API

> 解决邀请链接被转发后错误人员加入项目的安全问题的全栈 Web/API 应用

## 📋 目录

- [功能特性](#-功能特性)
- [技术栈](#-技术栈)
- [快速开始](#-快速开始)
- [API 接口文档](#-api-接口文档)
- [数据模型](#-数据模型)
- [核心规则](#-核心规则)
- [样例场景](#-样例场景)

## ✨ 功能特性

- 🔐 **域名校验**：白名单内域名邮箱可直接加入，外部域名需审批
- 📋 **审批流程**：邀请创建、审批、拒绝的完整工作流
- 🚫 **撤销机制**：随时可撤销已发出的邀请
- 📝 **审计追踪**：记录所有操作的输入、结果和责任节点
- 📊 **管理控制台**：Web 界面支持搜索、筛选、查看详情、触发操作
- 📤 **数据导出**：支持导出所有数据进行审计分析

## 🛠 技术栈

- **后端**：Node.js + Express
- **前端**：原生 HTML/CSS/JavaScript
- **数据存储**：JSON 文件（无需数据库）
- **依赖管理**：npm

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 生成样例数据

```bash
npm run seed
```

该命令会生成包含以下场景的样例数据：
- ✅ 成功的邀请创建和使用
- ❌ 邀请链接被转发的失败场景（邮箱不匹配）
- ❌ 重复提交邀请的失败场景
- ⏳ 待审批的外部人员邀请
- 🚫 已撤销的邀请（人工修正）
- ⏰ 已过期的邀请

### 3. 启动服务

```bash
npm start
```

服务启动后访问：
- **前端控制台**：http://localhost:8080
- **API 服务**：http://localhost:8080/api

## 📡 API 接口文档

### 邀请管理

#### 创建邀请
```http
POST /api/invitations
Content-Type: application/json
X-Operator: admin

{
  "inviterEmail": "admin@company.com",
  "inviteeEmail": "user@example.com",
  "roleId": "uuid",
  "projectId": "PROJECT-001"
}
```

**响应**：
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "active | pending",
    "requiresApproval": false,
    "token": "invitation-token"
  }
}
```

#### 查询邀请列表
```http
GET /api/invitations?status=active&search=zhangsan&projectId=PROJECT-001
```

**查询参数**：
- `status`: 状态筛选 (active/pending/used/revoked/expired)
- `search`: 搜索邮箱
- `projectId`: 项目 ID 筛选

#### 查询单个邀请
```http
GET /api/invitations/:id
```

#### 使用邀请
```http
POST /api/invitations/use/:token
Content-Type: application/json
X-Operator: user

{
  "userEmail": "user@example.com"
}
```

**错误响应**：
- `EMAIL_MISMATCH`: 只能由受邀邮箱使用（防止链接被转发）
- `ALREADY_USED`: 邀请已被使用
- `EXPIRED`: 邀请已过期
- `PENDING_APPROVAL`: 邀请待审批

#### 撤销邀请
```http
POST /api/invitations/:id/revoke
Content-Type: application/json
X-Operator: admin

{
  "reason": "安全风险评估"
}
```

### 审批管理

#### 查询审批列表
```http
GET /api/approvals?status=pending
```

#### 处理审批
```http
POST /api/approvals/:id
Content-Type: application/json
X-Operator: approver

{
  "action": "approve | reject",
  "approver": "manager@company.com",
  "reason": "审批通过/拒绝理由"
}
```

### 域名管理

#### 查询域名白名单
```http
GET /api/domains
```

#### 添加域名
```http
POST /api/domains
Content-Type: application/json
X-Operator: admin

{
  "domain": "partner.com"
}
```

### 审计日志

#### 查询审计日志
```http
GET /api/audit?action=create_invitation&status=success
```

**查询参数**：
- `action`: 操作类型 (create_invitation/use_invitation/revoke_invitation/process_approval/add_domain)
- `status`: 操作结果 (success/error)

### 数据导出

#### 导出所有数据
```http
GET /api/export
```

返回包含所有数据的 JSON 文件，用于审计报告。

### 统计信息

#### 获取仪表盘统计
```http
GET /api/stats
```

**响应**：
```json
{
  "success": true,
  "data": {
    "total": 10,
    "active": 3,
    "pending": 2,
    "used": 3,
    "revoked": 2,
    "pendingApprovals": 2,
    "totalUsages": 3,
    "totalRevocations": 2
  }
}
```

## 📊 数据模型

### 邀请 (Invitations)
```json
{
  "id": "uuid",
  "inviterEmail": "邀请人邮箱",
  "inviteeEmail": "受邀人邮箱",
  "roleId": "角色ID",
  "roleName": "角色名称",
  "projectId": "项目ID",
  "status": "active | pending | used | revoked | expired",
  "requiresApproval": true | false,
  "token": "邀请令牌",
  "maxUses": 1,
  "usedCount": 0,
  "createdAt": "创建时间",
  "expiresAt": "过期时间",
  "lastUsedAt": "最后使用时间"
}
```

### 审批 (Approvals)
```json
{
  "id": "uuid",
  "invitationId": "邀请ID",
  "requesterEmail": "申请人邮箱",
  "inviteeEmail": "受邀人邮箱",
  "reason": "审批原因",
  "status": "pending | approved | rejected",
  "approver": "审批人",
  "approvalReason": "审批意见",
  "approvedAt": "审批时间",
  "createdAt": "创建时间"
}
```

### 使用记录 (Usages)
```json
{
  "id": "uuid",
  "invitationId": "邀请ID",
  "userEmail": "使用者邮箱",
  "usedAt": "使用时间",
  "ipAddress": "IP地址"
}
```

### 撤销记录 (Revocations)
```json
{
  "id": "uuid",
  "invitationId": "邀请ID",
  "reason": "撤销原因",
  "revokedBy": "撤销人",
  "revokedAt": "撤销时间"
}
```

### 审计日志 (Audit)
```json
{
  "id": "uuid",
  "action": "操作类型",
  "operator": {
    "user": "操作者",
    "ip": "IP地址"
  },
  "input": "请求输入参数",
  "result": "响应结果",
  "status": "success | error",
  "timestamp": "操作时间",
  "requestId": "请求ID"
}
```

## 🔒 核心规则

### 1. 链接签发
- 邀请链接与受邀邮箱绑定
- 令牌唯一且不可预测
- 默认有效期 7 天
- 单次使用限制

### 2. 域名校验
- 白名单内域名 → 直接生效（status: active）
- 白名单外域名 → 待审批（status: pending）
- 审批通过后激活

### 3. 审批加入
- 外部域名邮箱必须审批
- 审批记录永久保存
- 支持通过/拒绝操作

### 4. 撤销失效
- 任何状态的邀请都可撤销
- 撤销后立即失效
- 记录撤销人和原因

### 5. 使用审计
- 记录每次使用的用户和 IP
- 邮箱不匹配时拒绝使用（防止链接转发）
- 完整的操作日志链

## 🎯 样例场景

### ✅ 场景 1: 成功邀请（白名单内）
```
邀请人: admin@company.com
受邀人: zhangsan@company.com (白名单域名)
结果: 邀请直接生效，zhangsan 可使用邀请链接加入
```

### ❌ 场景 2: 链接被转发攻击
```
原始受邀人: zhangsan@company.com
实际使用人: hacker@evil.com (链接被转发)
结果: ❌ EMAIL_MISMATCH - 只能由受邀邮箱使用
```

### ❌ 场景 3: 重复提交邀请
```
对同一用户多次发送邀请
结果: ❌ DUPLICATE_INVITATION - 该用户已有有效邀请
```

### ⏳ 场景 4: 外部人员待审批
```
邀请人: admin@company.com
受邀人: wangwu@external.com (非白名单域名)
结果: 邀请待审批，需管理员人工审核
```

### 🚫 场景 5: 人工修正（撤销邀请）
```
发现邀请错误，管理员执行撤销操作
记录: 撤销人、撤销原因、撤销时间
结果: 邀请立即失效
```

### 🔍 场景 6: 审计追踪
查看审计日志，发现：
- 谁在什么时间创建了邀请
- 邀请被谁在什么 IP 使用
- 哪些邀请被撤销，原因是什么
- 所有失败的尝试记录

## 📖 使用指南

### 前端控制台功能

1. **仪表盘统计**：查看各类邀请数量汇总
2. **邀请管理**：
   - 创建新邀请
   - 搜索/筛选邀请
   - 查看邀请详情
   - 使用邀请（测试）
   - 撤销邀请
3. **审批中心**：处理待审批的邀请
4. **域名白名单**：管理允许的邮箱域名
5. **审计日志**：查看所有操作记录，支持按类型和结果筛选

### 查看审计报告

1. 访问 http://localhost:8080
2. 点击"审计日志"标签页
3. 可按操作类型和结果筛选
4. 点击"详情"查看完整的请求和响应信息
5. 点击"导出数据"下载完整的审计报告

## 📁 项目结构

```
.
├── package.json          # 项目配置
├── README.md            # 项目文档
├── server/              # 后端代码
│   ├── index.js        # 服务入口和路由
│   ├── service.js      # 业务逻辑
│   ├── storage.js      # 数据存储
│   └── seed.js         # 样例数据生成
├── public/              # 前端代码
│   ├── index.html      # 主页面
│   └── app.js          # 前端逻辑
└── data/                # 数据存储目录 (自动生成)
    ├── invitations.json
    ├── roles.json
    ├── domains.json
    ├── approvals.json
    ├── usages.json
    ├── revocations.json
    └── audit.json
```

## 🔧 开发说明

数据存储在 `data/` 目录下的 JSON 文件中，无需数据库。每次 API 调用都会实时更新文件，刷新页面后数据不会丢失。

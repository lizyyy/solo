# 接口错误字典工作台

一个偏技术方向的全栈Web应用，用于管理和规范API错误码，解决线上错误码混乱、同一个问题返回多种提示的问题。

## 功能特性

### 核心功能
- **错误码管理**：创建、查询、编辑错误码，支持版本控制
- **状态流转**：草稿 → 待审批 → 已通过/已驳回 → 已废弃 → 已归并
- **错误码归并**：将多个相似的错误码合并为一个，统一用户体验
- **团队审批**：按团队划分错误码，支持团队负责人审批
- **调用映射**：记录错误码在各系统之间的映射关系
- **数据导出**：支持JSON和CSV格式导出，包含完整状态说明

### 数据模型
- 错误码：error_code, api_path, user_message, debug_message, troubleshooting, status, version
- 团队：name, leader, email
- 变更历史：action, old_value, new_value, operator, reason, created_at
- 调用映射：source_system, target_code, mapping_rule
- API请求日志：记录所有接口调用，便于审计

## 项目结构

```
.
├── package.json          # 项目配置
├── README.md            # 项目说明
├── server/              # 后端服务
│   ├── index.js        # Express服务器入口
│   ├── database/       # 数据库层
│   │   └── db.js      # SQLite连接
│   ├── services/       # 业务逻辑层
│   │   └── errorCodeService.js  # 错误码服务
│   └── scripts/        # 脚本
│       └── init-db.js # 数据库初始化脚本
├── public/             # 前端静态文件
│   ├── index.html      # 主页面
│   ├── styles.css      # 样式文件
│   └── app.js         # 前端逻辑
└── data/              # 数据库文件目录（自动创建）
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库（创建表和样例数据）

```bash
npm run init-db
```

这将创建：
- 4个团队（支付团队、用户团队、订单团队、商品团队）
- 5个样例错误码（覆盖各种状态）
- 3个调用映射关系
- 多条变更历史记录

### 3. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动

## 使用说明

### 前端控制台功能

1. **筛选功能**：按错误码、接口路径、状态、团队筛选
2. **错误码列表**：查看所有错误码的基本信息
3. **详情查看**：查看完整信息、变更历史、调用映射
4. **状态操作**：
   - 草稿 → 提交审批
   - 待审批 → 通过/驳回/撤回
   - 已通过 → 标记废弃
5. **批量归并**：选择多个错误码，归并为一个新的统一错误码
6. **导出功能**：导出JSON或CSV格式，包含每条记录的状态解释

### API接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/health | 健康检查 |
| GET | /api/error-codes | 查询错误码列表（支持筛选） |
| GET | /api/error-codes/:id | 查询单个错误码详情 |
| POST | /api/error-codes | 创建新错误码 |
| PATCH | /api/error-codes/:id/status | 更新状态 |
| POST | /api/error-codes/merge | 归并错误码 |
| GET | /api/teams | 获取团队列表 |
| GET | /api/export | 导出数据（format=json/csv） |
| GET | /api/requests | 获取API请求日志 |

### 业务规则

1. **版本控制**：同一个错误码+API路径可以有多个版本，新版本从v1开始递增
2. **状态机**：
   - draft → pending_approval | merged
   - pending_approval → approved | rejected | draft
   - approved → deprecated | merged
   - rejected → draft
3. **归并逻辑**：原错误码标记为merged状态，创建新错误码并自动标记为approved
4. **审计日志**：所有状态变更都记录历史，包括操作人、时间、原因

## 样例数据流

### 正常流
1. 用户团队创建 `USER_001` 登录失败错误码（草稿状态）
2. 提交给团队负责人审批
3. 负责人审批通过
4. 该错误码正式生效，各系统可接入使用

### 拦截流
1. 支付团队创建 `PAY_001` 支付失败错误码
2. 提交审批后被驳回，理由是"需要补充更多排查建议"
3. 修改后重新提交审批
4. 审批通过后正式使用

### 归并流
1. 发现多个系统都有类似的"余额不足"错误码
2. 选中所有相关错误码，执行归并操作
3. 创建新的统一错误码 `COMMON_001`
4. 原错误码标记为"已归并"状态，引导使用新错误码

## 导出数据说明

导出的每条记录包含：
- 基本信息（错误码、API路径、文案、团队、状态等）
- 变更历史记录
- 调用映射关系
- **状态解释**：自动生成该错误码为什么到当前状态的说明

这使得导出的数据可以直接用于文档或分享给团队成员，无需额外解释。

## 技术栈

- **后端**：Node.js + Express + SQLite
- **前端**：原生 HTML + CSS + JavaScript
- **数据持久化**：SQLite文件数据库
- **导出格式**：JSON, CSV

## 开发说明

- 数据库文件位于 `data/error-dictionary.db`
- 所有API请求都会被记录到 `api_requests` 表，便于审计
- 样例数据覆盖了所有状态场景，可直接用于测试

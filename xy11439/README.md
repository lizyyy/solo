# 民宿保洁排班权限追责台账服务

## 功能概述

针对民宿行业订单日历、保洁群消息、维修备注等数据管理混乱问题，提供完整的台账管理服务，包括：

- ✅ **数据持久化**：所有数据写入SQLite数据库，重启不丢失
- ✅ **变更历史**：记录每次修改的人、时间、原因、前后值
- ✅ **工作流**：草稿 → 提交 → 驳回/二次确认 → 审计
- ✅ **合并策略**：支持忽略、覆盖、追加三种导入策略
- ✅ **冲突检测**：自动检测房间订单时间冲突
- ✅ **角色权限**：管理员、店长、主管、保洁员、审计员五级权限
- ✅ **敏感字段**：自动脱敏客人姓名、电话、身份证、房门密码
- ✅ **异步任务**：失败分类（等重试/等人工/永久失败）
- ✅ **导出功能**：支持CSV导出，自动脱敏
- ✅ **店长报告**：角色视图、变更原因、问题汇总

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库（创建表和测试用户）

```bash
npm run init-db
```

### 3. 启动服务

```bash
npm start
# 或开发模式（自动重启）
npm run dev
```

服务地址：http://localhost:3000

### 4. 运行完整API测试

```bash
chmod +x scripts/test-api.sh
./scripts/test-api.sh
```

## 内置测试用户

| 用户名 | 姓名 | 角色 | 说明 |
|--------|------|------|------|
| admin | 系统管理员 | admin | 所有权限 |
| manager1 | 张店长 | manager | 店长，可查看敏感数据 |
| supervisor1 | 李主管 | supervisor | 主管 |
| staff1 | 王保洁 | staff | 保洁员，敏感数据自动脱敏 |
| auditor1 | 赵审计 | auditor | 审计员，可导出数据 |

## API 调用方式

所有API需要在Header中传入用户标识：

```bash
# 方式1：通过用户名
curl -H "x-username: manager1" http://localhost:3000/api/health

# 方式2：通过用户ID
curl -H "x-user-id: <user_id>" http://localhost:3000/api/health
```

## 核心API清单

### 订单日历

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/orders | 创建订单 |
| PUT | /api/orders/:id | 修改订单（自动记录变更历史） |
| GET | /api/orders | 订单列表 |
| GET | /api/orders/:id | 订单详情 |
| POST | /api/orders/import | 批量导入 |
| GET | /api/orders/:id/history | 变更历史 |
| GET | /api/orders/:id/workflow | 工作流历史 |
| GET | /api/conflicts/orders | 冲突检测 |

### 保洁群消息

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/messages | 创建消息 |
| PUT | /api/messages/:id | 修改消息 |
| GET | /api/messages | 消息列表 |
| POST | /api/messages/import | 批量导入 |

### 维修备注

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/maintenance | 创建维修单 |
| PUT | /api/maintenance/:id | 修改维修单 |
| GET | /api/maintenance | 维修单列表 |
| POST | /api/maintenance/import | 批量导入 |

### 工作流

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/workflow/submit | 提交审核 |
| POST | /api/workflow/reject | 驳回 |
| POST | /api/workflow/confirm | 二次确认 |
| POST | /api/workflow/audit | 审计通过 |

### 批次管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/batches | 批次列表 |
| GET | /api/batches/:id | 批次详情 |

### 异步任务

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/tasks | 任务列表 |
| GET | /api/tasks/failed | 失败任务清单 |
| POST | /api/tasks/:id/retry | 重试任务 |

### 审计与导出

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/audit/history | 全局变更历史 |
| POST | /api/export/orders | 导出订单CSV |
| POST | /api/export/messages | 导出消息CSV |
| POST | /api/export/maintenance | 导出维修CSV |
| GET | /api/report | 店长报告 |

## 批量导入合并策略

```json
{
  "merge_strategy": "ignore|overwrite|append",
  "orders": [...]
}
```

- **ignore**：已存在的跳过
- **overwrite**：已存在的覆盖
- **append**：全部新增（默认）

## 工作流状态流转

```
draft (草稿)
    ↓ submit
submitted (已提交)
    ↓ confirm / ↓ reject
confirmed (已确认)   rejected (已驳回)
    ↓ audit           ↓ resubmit
audited (已审计)    submitted (重新提交)
```

## 项目结构

```
.
├── src/
│   ├── config/          # 配置
│   ├── controllers/     # 控制器
│   ├── database/        # 数据库
│   ├── middleware/      # 中间件
│   ├── models/          # 数据模型
│   ├── routes/          # 路由
│   ├── utils/           # 工具函数
│   └── index.js         # 入口
├── scripts/             # 测试脚本
├── data/                # 数据库文件
├── exports/             # 导出文件
└── package.json
```

## 数据库表说明

- **users**：用户表
- **batches**：导入批次表
- **order_calendars**：订单日历表
- **cleaning_messages**：保洁群消息表
- **maintenance_notes**：维修备注表
- **change_history**：变更历史表（核心审计表）
- **workflow_records**：工作流记录表
- **async_tasks**：异步任务表

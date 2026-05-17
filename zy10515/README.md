# 客户配置交接API服务

## 项目概述

本服务用于解决售前交给交付的客户配置管理问题，把散落在各处的配置流程统一管理，实现配置入库、来源追踪、状态确认、变更记录、异常处理和交接导出等核心功能。

## 技术栈

- Node.js + Express - Web框架
- SQLite - 数据库
- json2csv - CSV导出

## 项目结构

```
.
├── src/
│   ├── app.js                      # 主应用入口
│   ├── config/
│   │   └── database.js             # 数据库配置和初始化
│   ├── models/
│   │   └── ConfigHandover.js       # 数据模型和业务逻辑
│   ├── controllers/
│   │   └── handoverController.js   # API控制器
│   └── routes/
│       └── handoverRoutes.js       # 路由定义
├── test/
│   └── acceptance.js               # 验收测试脚本
├── data/                           # SQLite数据库文件目录
├── package.json
└── README.md
```

## 数据模型

### 核心实体

1. **customers** - 客户信息
   - customer_id: 客户编号
   - customer_name: 客户名称

2. **config_items** - 配置项
   - id: 配置项ID
   - customer_id: 所属客户
   - config_key: 配置键名
   - config_value: 配置值
   - status: 状态 (pending/confirmed/delivered/completed)

3. **source_materials** - 来源材料
   - 记录配置的来源（截图、邮件、聊天记录等）
   - 包含材料类型、内容、上传人

4. **confirmations** - 确认记录
   - 谁在什么时候确认了配置
   - 支持多人确认

5. **change_records** - 变更记录
   - 每次配置变更都记录旧值、新值
   - 记录操作人和变更原因

6. **handover_summaries** - 交接摘要
   - 按版本生成的交接摘要
   - 包含所有配置的完整信息

7. **exceptions** - 异常记录
   - 保留原始输入和处理依据
   - 支持异常处理流程

## API接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/handover/customers | 创建客户 |
| POST | /api/handover/configs | 创建配置项 |
| GET | /api/handover/configs/:id | 获取配置项详情 |
| GET | /api/handover/customers/:customerId/configs | 获取客户所有配置 |
| POST | /api/handover/configs/:id/status | 推进状态 |
| POST | /api/handover/configs/:id/confirm | 确认配置 |
| POST | /api/handover/configs/:id/correct | 人工修正 |
| POST | /api/handover/configs/:id/sources | 添加来源材料 |
| GET | /api/handover/configs/:id/changes | 获取变更对比 |
| GET | /api/handover/exceptions | 获取异常列表 |
| POST | /api/handover/exceptions/:id/handle | 处理异常 |
| POST | /api/handover/customers/:customerId/summaries | 生成交接摘要 |
| GET | /api/handover/customers/:customerId/summaries | 获取交接摘要列表 |
| GET | /api/handover/customers/:customerId/export | 导出配置 |

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

服务将在 http://localhost:3000 启动

### 3. 运行验收测试

```bash
# 先启动服务
npm start

# 新开终端运行测试
npm test
```

## 验收测试覆盖场景

1. ✅ 正常创建客户和配置项
2. ✅ 查询配置项详情（包含来源材料、确认记录、变更历史）
3. ✅ 导出配置数据（支持JSON和CSV格式）
4. ✅ 重复提交同一配置防重验证
5. ✅ 状态推进防重验证（不能重复推进到同一状态）
6. ✅ 配置确认防重验证（同一确认人不能重复确认）
7. ✅ 来源材料追踪
8. ✅ 变更记录对比
9. ✅ 异常记录留存原始输入
10. ✅ 交接摘要生成

## 核心业务规则

### 配置入库
- 同一客户的同一配置键只能创建一次
- 重复提交会被拦截并提示已存在

### 状态流转
状态只能按顺序向前推进，不能回退或跳过：
```
pending → confirmed → delivered → completed
```

### 防重机制
- 重复状态推进会被拦截
- 同一确认人不能重复确认同一配置
- 异常处理后不能重复处理

### 变更追踪
- 所有配置变更都记录完整历史
- 保留操作人、时间、变更原因
- 支持变更对比查询

### 异常处理
- 所有接口异常都会自动记录
- 保留原始请求输入和错误信息
- 支持人工标记已处理

## 使用示例

### 创建客户
```bash
curl -X POST http://localhost:3000/api/handover/customers \
  -H "Content-Type: application/json" \
  -d '{"customerId": "CUST001", "customerName": "测试客户"}'
```

### 创建配置项
```bash
curl -X POST http://localhost:3000/api/handover/configs \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "CUST001",
    "configKey": "database_url",
    "configValue": "mysql://localhost:3306/test",
    "operatorId": "OP001",
    "operatorName": "张三",
    "sourceMaterial": {
      "type": "screenshot",
      "content": "售前截图确认",
      "uploadedBy": "张三"
    }
  }'
```

### 导出配置
```bash
# JSON格式
curl http://localhost:3000/api/handover/customers/CUST001/export

# CSV格式
curl "http://localhost:3000/api/handover/customers/CUST001/export?format=csv"
```

## 开发说明

- 数据库文件自动生成在 `data/database.db`
- 所有表在服务启动时自动创建
- 支持热重载开发：`npm run dev`

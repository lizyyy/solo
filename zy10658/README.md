# 数据看板服务指标口径变更公告 API

## 项目简介

本项目提供数据看板服务指标口径变更的公告管理功能，支持公告的创建、查询、状态流转、冲突检测和数据导出。

## 核心功能

### 1. 公告管理
- 创建口径变更公告
- 查询公告列表（支持多条件筛选）
- 查询公告详情
- 更新公告信息

### 2. 状态流转
- **草稿** → **待确认** → **已发布** → **已撤回**
- **待人工处理**（冲突检测触发）

### 3. 筛选功能
支持按以下条件筛选：
- 日期范围（开始日期、结束日期）
- 状态
- 负责人
- 业务对象
- 公告人
- 指标名称

### 4. 冲突检测
- 生效日期距当前不足7天时自动检测
- 新旧口径完全相同时检测
- 检测到冲突自动标记为"待人工处理"
- 返回可解释的冲突原因

### 5. 数据导出
- 导出为CSV格式
- 导出字段使用业务语言
- 导出结果与列表查询一致
- 支持带筛选条件导出

## 技术栈

- Node.js
- TypeScript
- Express.js
- Jest（测试）

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式启动

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

### 启动生产服务

```bash
npm start
```

## API 接口

### 基础信息
- 服务地址：`http://localhost:3000`
- API 前缀：`/api`

### 接口列表

#### 1. 查询公告列表
```
GET /api/announcements
```
**查询参数：**
- `startDate` - 开始日期 (YYYY-MM-DD)
- `endDate` - 结束日期 (YYYY-MM-DD)
- `status` - 状态（草稿/待确认/已发布/已撤回/待人工处理）
- `responsiblePerson` - 负责人
- `businessObject` - 业务对象
- `announcer` - 公告人
- `metricName` - 指标名称

**示例：**
```bash
curl "http://localhost:3000/api/announcements?status=已发布&responsiblePerson=李四"
```

#### 2. 查询公告详情
```
GET /api/announcements/:id
```

#### 3. 查询公告历史记录
```
GET /api/announcements/:id/history
```

#### 4. 创建公告
```
POST /api/announcements
Content-Type: application/json

{
  "title": "GMV口径调整公告",
  "changes": [
    {
      "metricName": "GMV",
      "calendarVersion": "v2.0",
      "oldCalendar": "订单金额",
      "newCalendar": "订单金额+运费",
      "changeReason": "业务统计口径调整",
      "effectiveDate": "2024-03-01",
      "affectedDashboards": [{"id": "d1", "name": "交易大盘"}],
      "businessObject": "电商交易"
    }
  ],
  "announcer": "张三",
  "announcerId": "user001",
  "responsiblePerson": "李四",
  "responsiblePersonId": "user002"
}
```

#### 5. 更新公告
```
PUT /api/announcements/:id
Content-Type: application/json

{
  "title": "更新后的标题"
}
```

#### 6. 更新状态
```
POST /api/announcements/:id/status
Content-Type: application/json

{
  "newStatus": "待确认",
  "operator": "张三",
  "operatorId": "user001",
  "remark": "提交审核"
}
```

#### 7. 导出公告CSV
```
GET /api/export/announcements
```
支持与列表查询相同的筛选参数。

#### 8. 查询导出字段
```
GET /api/export/fields
```

#### 9. 查询导入错误记录
```
GET /api/import/errors
```

#### 10. 查询状态枚举
```
GET /api/statuses
```

## 测试数据

系统启动时自动初始化以下测试数据：

### 1. 完整流转公告
- **标题**: DAU口径升级公告-v2.0
- **状态**: 已发布
- **流转过程**: 草稿 → 待确认 → 已发布
- **涉及指标**: 日活跃用户数(DAU)

### 2. 冲突记录公告
- **标题**: 订单转化率口径调整公告
- **状态**: 待人工处理
- **冲突原因**: 历史截图仍按旧口径展示
- **冲突说明**: 检测到历史截图仍按旧口径展示，生效时间早于预期，需人工确认

### 3. 导入坏行记录
- **行号**: 第3行
- **错误**: 标题为空、日期格式错误、负责人不存在

## 导出字段说明

| 字段名 | 说明 |
|--------|------|
| 公告标题 | 公告的标题 |
| 状态 | 当前状态 |
| 公告人 | 发布公告的人员 |
| 负责人 | 负责该口径变更的人员 |
| 涉及指标 | 本次变更涉及的指标名称 |
| 口径版本 | 指标的口径版本号 |
| 影响看板 | 受影响的看板列表 |
| 业务对象 | 所属业务领域 |
| 生效日期 | 口径变更生效日期 |
| 是否有冲突 | 是否检测到潜在冲突 |
| 冲突说明 | 冲突的具体原因 |
| 创建时间 | 公告创建时间 |
| 发布时间 | 公告发布时间 |

## 项目结构

```
.
├── src/
│   ├── types.ts          # 类型定义
│   ├── store.ts          # 数据存储层
│   ├── service.ts        # 业务服务层
│   ├── routes.ts         # 路由层
│   └── index.ts          # 入口文件
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

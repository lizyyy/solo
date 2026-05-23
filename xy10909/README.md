# 工地人员进出API服务

## 项目概述

本项目是一个完整的工地人员进出管理后端API服务，集成了人员档案、闸机事件、访客申请、培训状态、黑名单管理、通行报告等核心功能，并提供完善的数据追溯机制。

## 核心特性

### 1. 核心数据模型
- **人员档案**：员工基本信息、部门、状态管理
- **培训记录**：安全培训状态、有效期、成绩
- **黑名单**：违规人员管理、拦截原因
- **访客申请**：访客预约、接待人、时段管理
- **闸机事件**：通行记录、方向、结果、原因
- **通行报告**：日报导出、CSV格式、统计汇总
- **异常记录**：原始输入、处理结论、追溯关联
- **人工修正**：数据变更审计、原始值保留

### 2. 核心业务规则
- ✅ **通行资格校验**：人员状态 + 培训有效性双重校验
- ✅ **访客时段校验**：检查是否在预约时间段内
- ✅ **黑名单拦截**：身份证匹配即拦截
- ✅ **重复事件去重**：5秒内相同事件自动去重
- ✅ **异常路径记录**：保存原始输入 + 处理结论，不只是日志

### 3. 数据追溯能力
- **人员详情追溯链**：人员 → 培训记录 → 黑名单记录 → 闸机事件
- **闸机事件追溯链**：事件 → 异常记录 → 人工修正记录
- **异常记录追溯链**：异常 → 原始输入 → 处理结论 → 关联人员/事件
- **人工修正追溯链**：修正 → 目标记录 → 原始值 → 修正后值

## 快速开始

### 安装依赖
```bash
npm install
```

### 初始化数据库和样例数据
```bash
npm run setup
```

### 启动服务
```bash
npm start
```

服务将在 `http://localhost:3000` 启动

### 运行样例测试
```bash
npm run test-sample
```

## API接口文档

### 健康检查
```
GET /api/health
```

### 人员档案
```
POST /api/personnel              # 新增人员
GET  /api/personnel              # 查询人员列表
GET  /api/personnel/:id          # 查询单个人员
GET  /api/personnel/:id/details  # 查询人员详情（含培训、黑名单、事件）
PUT  /api/personnel/:id          # 更新人员信息
```

### 培训记录
```
POST /api/personnel/:id/training  # 新增培训记录
GET  /api/personnel/:id/training  # 查询人员培训记录
```

### 黑名单管理
```
POST /api/personnel/:id/blacklist  # 将人员加入黑名单
GET  /api/exceptions               # 查询黑名单（通过异常接口）
```

### 访客申请
```
POST /api/visitors                    # 新增访客申请
GET  /api/visitors                    # 查询访客列表
GET  /api/visitors/:id                # 查询访客详情
PUT  /api/visitors/:id/status         # 更新访客状态
POST /api/visitors/:id/checkin        # 访客签到
POST /api/visitors/:id/checkout       # 访客签离
```

### 闸机事件
```
POST /api/gate-events              # 上报闸机事件（自动校验通行资格）
GET  /api/gate-events              # 查询事件列表
GET  /api/gate-events/:id          # 查询单个事件
GET  /api/gate-events/:id/trace    # 查询事件追溯链（含异常、修正记录）
```

### 异常记录
```
GET  /api/exceptions               # 查询异常列表
GET  /api/exceptions/:id           # 查询单个异常
GET  /api/exceptions/:id/trace     # 查询异常追溯链
PUT  /api/exceptions/:id/resolve   # 标记异常为已解决
```

### 通行报告
```
POST /api/reports/daily            # 生成日常通行报告（CSV导出）
GET  /api/reports                  # 查询报告列表
GET  /api/reports/:id              # 查询单个报告
GET  /api/reports/:id/details      # 查询报告详情
```

### 人工修正
```
POST /api/corrections                           # 创建人工修正（自动应用）
GET  /api/corrections                           # 查询修正列表
GET  /api/corrections/:id                       # 查询单个修正
GET  /api/corrections/target/:table/:recordId   # 查询目标记录的所有修正
```

## 核心数据追溯示例

### 1. 闸机事件完整追溯链
```
GET /api/gate-events/{event-id}/trace

返回结构:
{
  event: { ...闸机事件详情... },
  related: {
    exceptions: [...关联的异常记录...],
    corrections: [...关联的人工修正记录...]
  }
}
```

### 2. 异常记录完整追溯链
```
GET /api/exceptions/{exception-id}/trace

返回结构:
{
  exception: {
    raw_input: "...原始请求内容...",
    processing_result: "...处理结论JSON...",
    error_type: "ACCESS_DENIED",
    error_message: "黑名单拦截: 多次违规闯入"
  },
  related_records: {
    gate_event: ...关联闸机事件...,
    personnel: ...关联人员...,
    training: [...培训记录...],
    blacklist: [...黑名单记录...]
  }
}
```

### 3. 人员完整追溯链
```
GET /api/personnel/{person-id}/details

返回结构:
{
  ...人员基本信息...,
  training_records: [...培训记录...],
  blacklist_records: [...黑名单记录...],
  recent_events: [...近期闸机事件...]
}
```

## 本地持久化

- 数据库：SQLite (文件: `data/access-control.db`)
- 报告导出：`data/reports/` 目录
- 支持随时备份数据库文件

## 项目结构

```
.
├── src/
│   ├── app.js                 # Express应用配置
│   ├── server.js              # 服务启动入口
│   ├── database/
│   │   └── db.js             # 数据库连接
│   ├── routes/                # API路由层
│   │   ├── gateEvents.js
│   │   ├── personnel.js
│   │   ├── visitors.js
│   │   ├── exceptions.js
│   │   ├── reports.js
│   │   └── corrections.js
│   └── services/              # 业务逻辑层
│       ├── accessControlService.js   # 通行资格校验
│       ├── gateEventService.js       # 闸机事件处理
│       ├── personnelService.js       # 人员管理
│       ├── trainingService.js        # 培训管理
│       ├── blacklistService.js       # 黑名单管理
│       ├── visitorService.js         # 访客管理
│       ├── exceptionService.js       # 异常记录
│       ├── reportService.js          # 报告生成
│       └── manualCorrectionService.js # 人工修正
├── scripts/
│   ├── init-db.js            # 数据库表初始化
│   ├── seed-data.js          # 样例数据初始化
│   └── test-sample.js        # API测试脚本
├── data/                      # 数据存储目录
│   ├── access-control.db
│   └── reports/
├── package.json
└── README.md
```

## 技术栈

- **Node.js** - 运行时环境
- **Express** - Web框架
- **SQLite + better-sqlite3** - 本地数据库
- **csv-writer** - CSV报告导出
- **moment** - 日期时间处理
- **uuid** - 唯一ID生成

## 关键设计说明

### 异常路径处理
不同于传统的日志记录方式，本系统所有异常都会持久化到数据库，包含：
- 完整的原始输入JSON
- 错误类型和详细信息
- 处理结论和中间状态
- 关联的人员ID、事件ID
- 解决状态和备注

### 数据可追溯性
所有数据变更和异常都可通过追溯接口查询完整链路，不会只在日志里看到原因，满足审计和问题排查需求。

### 人工修正审计
所有通过人工修正接口进行的数据变更都会保留原始值和修正后的值，可随时回查修正历史。

# 政务热线工单合并服务

## 项目简介

本服务旨在解决政务热线中同一事件被多个市民重复投诉，导致部门分派和答复口径混乱的问题。

### 核心场景
- 多个市民投诉同一问题（如停水、停电、噪音等）
- 需要将相似投诉聚合并合并到一个工单
- 统一分派到对应部门
- 统一答复口径，避免混乱
- 超时督办确保及时处理
- 办结统计用于复查和改进

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 确认功能可用（最简单的方式）

运行功能测试脚本：

```bash
npm test
```

如果所有测试都通过，说明功能正常。测试脚本会依次验证：
- 投诉录入
- 投诉聚类
- 工单创建
- 部门分派
- 答复版本管理
- 超时督办
- 工单合并
- 办结和撤回
- 历史记录
- 重复聚类稳定性
- 统计功能

### 3. 初始化测试数据

```bash
npm run init-data
```

### 4. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动。

## 普通用户验证功能的方法

### 方法一：运行测试脚本（最简单）

```bash
npm test
```

观察控制台输出：
- 如果看到 "测试结果: 通过 11 / 11"，说明所有功能正常
- 如果有失败的测试，会显示具体错误信息

### 方法二：查看服务信息

启动服务后，打开浏览器访问：
```
http://localhost:3000
```

看到返回的 JSON 信息，说明服务已启动。

### 方法三：查看统计数据

打开浏览器访问：
```
http://localhost:3000/api/statistics
```

可以看到实时统计数据。

### 方法四：导出数据

启动服务后，可以在浏览器直接下载 CSV 文件：
- 工单数据：`http://localhost:3000/export/tickets.csv`
- 聚类数据：`http://localhost:3000/export/clusters.csv`
- 答复记录：`http://localhost:3000/export/replies.csv`
- 督办记录：`http://localhost:3000/export/supervision.csv`
- 历史记录：`http://localhost:3000/export/history.csv`

## 核心功能模块

### 1. 投诉聚类（入口）

基于内容相似度和时间窗口，将相似投诉自动聚合成一组。

**算法规则：**
- 内容相似度：使用关键词提取 + Jaccard 相似度
- 时间窗口：默认 24 小时内的投诉才会被考虑合并
- 相似度阈值：默认 0.3 以上认为相似

**稳定性保证：**
- 使用确定的聚类键（日期 + 关键词）
- 同一批数据重跑时，结果完全一致
- 支持 `forceRerun` 参数重新计算

### 2. 工单合并

将聚类转化为工单，支持手动合并关联工单。

**合并规则：**
- 源工单状态变为 `merged`
- 源工单关联的投诉迁移到目标工单
- 保留合并记录和历史日志

### 3. 部门分派

基于投诉内容关键词自动匹配负责部门。

**分派规则：**
- 预置 10 个常见部门及其关键词
- 关键词匹配得分最高的部门获得工单
- 支持手动调整分派
- 分派变更记录历史

### 4. 答复版本

管理多个答复版本，区分正式和非正式答复。

**版本管理：**
- 每个答复自动递增版本号
- 区分官方答复（`is_official: true`）和内部答复
- 可查询最新官方答复

### 5. 超时督办

识别超时工单，支持多级督办。

**督办机制：**
- 自动识别超过截止时间的工单
- 三级督办：提醒(remind) → 警告(warning) → 紧急(urgent)
- 督办记录保留在历史中

### 6. 办结统计

统计各类指标，用于复查和改进。

**统计内容：**
- 投诉总数、聚类总数、工单总数
- 各状态工单数量
- 部门绩效（办结率、超时率、平均处理时间）
- 合并率：衡量聚类效果
- 操作历史审计

### 7. 历史记录

所有关键操作都有历史记录，可追溯。

**记录内容：**
- 创建、更新、删除
- 聚类分配
- 部门分派
- 工单合并
- 答复、督办
- 办结、撤回

**查询方式：**
```
GET /api/history/{entityType}/{entityId}
```

## API 接口说明

### 投诉管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/complaints | 单条录入投诉 |
| POST | /api/complaints/batch | 批量录入投诉 |

### 聚类管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/cluster | 执行聚类分析 |
| GET | /api/clusters | 查询聚类列表 |
| GET | /api/clusters/:id | 查询聚类详情 |

**聚类参数：**
```json
{
  "timeWindowHours": 24,
  "similarityThreshold": 0.3,
  "forceRerun": false
}
```

### 工单管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/tickets/from-clusters | 从聚类创建工单 |
| GET | /api/tickets | 查询工单列表 |
| GET | /api/tickets/:id | 查询工单详情 |
| POST | /api/merge | 合并工单 |
| POST | /api/tickets/:id/close | 办结工单 |
| POST | /api/tickets/:id/withdraw | 撤回工单 |

**合并参数：**
```json
{
  "target_ticket_id": 1,
  "source_ticket_id": 2,
  "reason": "同一事件",
  "operator": "张三"
}
```

### 部门分派

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/departments | 查询部门列表 |
| POST | /api/departments/match | 测试内容匹配部门 |
| POST | /api/tickets/:id/assign | 手动分派部门 |
| POST | /api/tickets/:id/auto-assign | 自动分派单个工单 |
| POST | /api/tickets/auto-assign-all | 自动分派所有待处理工单 |

### 答复管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/tickets/:id/reply | 添加答复 |

**答复参数：**
```json
{
  "content": "答复内容",
  "author": "答复人",
  "is_official": true
}
```

### 督办管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/supervision | 查询督办列表 |
| GET | /api/supervision/overdue | 查询超时工单 |
| POST | /api/tickets/:id/supervise | 添加督办 |

**督办参数：**
```json
{
  "level": "warning",
  "reason": "工单已超时",
  "supervisor": "李四"
}
```

### 统计查询

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/statistics | 获取综合统计 |
| GET | /api/statistics/department-performance | 获取部门绩效 |
| GET | /api/history/:entityType/:entityId | 获取历史记录 |

### 数据导出

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /export/tickets.csv | 导出工单数据 |
| GET | /export/clusters.csv | 导出聚类数据 |
| GET | /export/replies.csv | 导出答复记录 |
| GET | /export/supervision.csv | 导出督办记录 |
| GET | /export/history.csv | 导出历史记录 |

导出的 CSV 文件包含业务相关字段，适合直接用于业务复核，不是调试日志。

## 工单状态说明

| 状态 | 说明 |
|------|------|
| pending | 待处理（刚创建） |
| assigned | 已分派到部门 |
| merged | 已合并到其他工单 |
| closed | 已办结 |
| withdrawn | 已撤回 |

## 项目结构

```
.
├── data/                    # SQLite 数据库文件
├── src/
│   ├── index.js            # 服务入口
│   ├── database/
│   │   └── init.js         # 数据库初始化和模型
│   ├── services/
│   │   ├── clusterService.js    # 聚类算法
│   │   ├── ticketService.js     # 工单管理
│   │   ├── assignService.js     # 部门分派
│   │   ├── supervisionService.js # 督办统计
│   │   └── historyService.js    # 历史记录
│   └── routes/
│       ├── api.js          # API 路由
│       └── export.js       # 导出路由
├── scripts/
│   ├── init-test-data.js   # 初始化测试数据
│   └── reset-db.js         # 重置数据库
├── tests/
│   └── run-test.js         # 功能测试
└── package.json
```

## 常用命令

```bash
# 安装依赖
npm install

# 启动服务
npm start

# 运行功能测试
npm test

# 初始化测试数据
npm run init-data

# 重置数据库
npm run reset
```

## 数据稳定性

同一批数据多次运行聚类时，结果保持稳定的原因：

1. **确定的聚类键**：使用日期 + 关键词生成 `cluster_key`，相同输入产生相同键
2. **稳定的排序**：投诉按创建时间排序后处理
3. **可重复的相似度计算**：关键词提取和相似度算法是确定的
4. **支持强制重跑**：`forceRerun` 参数可清空后重新计算

## 审计追踪

所有重要操作都有历史记录，可通过以下方式查看：

1. **API 查询**：`GET /api/history/ticket/{id}`
2. **CSV 导出**：`GET /export/history.csv`
3. **格式化展示**：API 返回时自动转换为可读格式

历史记录包括：
- 操作类型（创建、更新、分派、合并等）
- 操作人
- 变更前后的值
- 操作时间

无需查看源码，通过历史记录即可追踪工单的完整生命周期。

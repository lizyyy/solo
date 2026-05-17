# 视频点播后台试看权限纠偏系统

## 项目简介

本系统用于处理视频点播后台中多系统写入试看权限记录时的冲突问题，支持权限纠偏全流程管理，包括记录创建、状态流转、冲突检测、历史追踪、数据导入导出等功能。

## 核心特性

1. **冲突处理规则**：自动检测多系统写入的同类记录，标记为异常待判状态，并给出处理建议
2. **业务字段与可读原因**：API返回包含业务状态码和可读的原因描述，不只是通用HTTP状态码
3. **核心数据模型**：包含视频信息、用户信息、试看规则、纠偏原因、操作历史等
4. **四种状态流转**：
   - `can_try` 可试看
   - `abnormal_pending` 异常待判
   - `corrected` 已纠偏
   - `revoked` 已撤销
5. **付费用户特殊处理**：检测付费用户被旧试看规则限制播放的场景，自动标记为异常待判并给出可解释原因
6. **本地运行支持**：使用内存存储，无需外部依赖，缺配置时给出清晰提示
7. **完整的验收测试数据**：服务启动时自动初始化验收数据

## 技术栈

- Node.js + TypeScript
- Express 4.x
- 内存存储（无需数据库）
- CSV 导入/导出支持

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式运行

```bash
npm run dev
```

服务启动后会自动初始化验收测试数据，可通过 `http://localhost:3000` 访问。

### 构建生产版本

```bash
npm run build
npm start
```

## API 文档

### 基础信息

- 基础路径: `/api`
- Content-Type: `application/json`

### 1. 创建纠偏记录

**POST** `/api/corrections`

请求体示例:
```json
{
  "video": {
    "videoId": "v001",
    "videoTitle": "视频标题",
    "videoDuration": 3600,
    "videoCategory": "技术教程"
  },
  "user": {
    "userId": "u001",
    "userName": "用户名",
    "userType": "paid",
    "isPaid": true
  },
  "trialRule": {
    "ruleId": "r001",
    "ruleName": "试看规则名称",
    "ruleVersion": "v1",
    "trialDuration": 300,
    "trialCount": 3,
    "effectiveTime": "2024-01-01"
  },
  "sourceSystem": "vod_backend",
  "operatorId": "admin",
  "operatorName": "管理员"
}
```

响应示例:
```json
{
  "code": 200,
  "message": "创建成功",
  "businessCode": "abnormal_pending",
  "businessMessage": "付费用户(张三)被旧试看规则(标准试看规则)限制播放，需人工复核处理",
  "data": {
    "id": "uuid",
    "video": {...},
    "user": {...},
    "trialRule": {...},
    "status": "abnormal_pending",
    "correctionReason": "paid_user_blocked_by_old_rule",
    "readableReason": "付费用户(张三)被旧试看规则(标准试看规则)限制播放，需人工复核处理",
    "sourceSystem": "vod_backend",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 2. 获取纠偏记录列表

**GET** `/api/corrections`

查询参数:
- `page` - 页码，默认 1
- `pageSize` - 每页数量，默认 20
- `status` - 状态过滤
- `sourceSystem` - 来源系统过滤
- `userId` - 用户ID过滤
- `videoId` - 视频ID过滤
- `keyword` - 关键词搜索

### 3. 获取记录详情

**GET** `/api/corrections/:id`

### 4. 获取记录操作历史

**GET** `/api/corrections/:id/history`

### 5. 更新记录状态

**PUT** `/api/corrections/:id/status`

请求体:
```json
{
  "newStatus": "corrected",
  "operatorId": "admin",
  "operatorName": "管理员",
  "remark": "备注信息"
}
```

状态流转规则:
- `can_try` → `corrected` / `revoked`
- `abnormal_pending` → `can_try` / `corrected` / `revoked`
- `corrected` → `revoked`
- `revoked` → 终止状态

### 6. 付费用户专用纠偏接口

**POST** `/api/corrections/:id/correct-paid`

专门用于处理付费用户被旧规则限制的场景，自动完成纠偏操作。

### 7. 批量导入

**POST** `/api/import`

请求体:
```json
{
  "csvContent": "videoId,videoTitle,userId,userName,userType,ruleId,ruleName,ruleVersion,effectiveTime,sourceSystem\nv001,视频1,u001,用户1,paid,r001,规则1,v1,2024-01-01,vod_backend"
}
```

### 8. 导出CSV

**GET** `/api/export`

查询参数:
- `status` - 按状态过滤
- `sourceSystem` - 按来源系统过滤

### 9. 获取导入坏行记录

**GET** `/api/bad-rows`

查询参数:
- `batchId` - 批次ID

### 10. 获取数据概览

**GET** `/api/summary`

返回总体统计信息，包括各状态数量、各来源系统数量、冲突记录数量等。

## 来源系统枚举

- `vod_backend` - 视频点播后台
- `user_center` - 用户中心
- `order_system` - 订单系统
- `content_management` - 内容管理系统
- `import_batch` - 批量导入

## 冲突处理优先级

当多系统产生冲突时，建议按以下优先级处理:
1. 订单系统 (order_system)
2. 用户中心 (user_center)
3. 视频点播后台 (vod_backend)
4. 内容管理系统 (content_management)
5. 批量导入 (import_batch)

## 验收说明

服务启动时会自动初始化以下验收测试数据:

1. **完整流转记录**：一条经历完整状态流转的记录（可试看 → 已纠偏 → 已撤销）

2. **冲突记录**：同一用户+视频组合被3个不同系统分别写入，触发冲突检测

3. **导入坏行**：通过CSV导入3条格式错误的记录（用户类型错误、来源系统错误、字段缺失）

4. **付费用户限制场景**：一条付费用户被旧版(v1.x)试看规则限制的记录

### 验收验证步骤

1. 查看列表: `GET /api/corrections` - 确认所有记录存在
2. 查看详情: `GET /api/corrections/:id` - 确认业务字段和可读原因
3. 查看历史: `GET /api/corrections/:id/history` - 确认操作历史追踪
4. 查看坏行: `GET /api/bad-rows` - 确认导入失败记录
5. 导出数据: `GET /api/export` - 确认数据可导出
6. 查看概览: `GET /api/summary` - 确认统计数据正确

## 项目结构

```
.
├── src/
│   ├── app.ts                 # 应用入口
│   ├── config/
│   │   └── index.ts           # 配置管理
│   ├── types/
│   │   └── index.ts           # 类型定义
│   ├── storage/
│   │   └── memory.ts          # 内存存储
│   ├── services/
│   │   ├── correction.ts      # 纠偏业务逻辑
│   │   └── importExport.ts    # 导入导出服务
│   └── routes/
│       └── correction.ts      # API路由
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## 配置说明

无需额外配置即可本地运行，如需自定义配置可复制 `.env.example` 为 `.env`:

```env
PORT=3000
HOST=localhost
STORAGE_TYPE=memory
LOG_LEVEL=info
```

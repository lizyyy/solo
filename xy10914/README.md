# 外卖骑手异常单 API 服务

本地后端API服务，用于处理外卖骑手异常单的全流程管理。

## 技术栈

- **后端框架**: Node.js + Express
- **数据库**: SQLite
- **数据导出**: CSV格式

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化样例数据

```bash
npm run seed-data
```

### 3. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动

## 核心数据模型

### 1. 骑手 (Riders)
- 骑手编号、姓名、电话、站点
- 状态管理

### 2. 订单 (Orders)
- 订单编号、客户信息、配送地址
- 餐厅信息、订单金额、预计送达时间
- 关联骑手

### 3. 异常类型 (Exception Types)
- **少餐** (MEAL_SHORTAGE) - 商家漏餐或餐品缺失
- **超时** (DELAY_DELIVERY) - 配送超时未送达
- **改派** (RIDER_REASSIGN) - 骑手申请订单改派
- **餐品损坏** (FOOD_DAMAGE) - 餐品在配送途中损坏
- **地址错误** (WRONG_ADDRESS) - 用户地址错误无法配送
- **恶劣天气** (BAD_WEATHER) - 因恶劣天气导致配送延误
- **交通事故** (TRAFFIC_ACCIDENT) - 骑手发生交通事故
- **系统异常** (SYSTEM_ERROR) - 派单系统或APP异常

### 4. 异常记录 (Exception Records)
- 关联订单、骑手、异常类型
- 描述、状态、报告时间
- **原始输入数据持久化**

### 5. 改派记录 (Reassignment Records)
- 关联异常记录
- 原骑手、目标骑手
- 申请原因、状态、处理人、处理结论
- **处理结论可追溯**

### 6. 申诉证据 (Appeal Evidences)
- 关联异常记录
- 证据类型、文件URL、描述
- 上传者、上传时间、审核状态
- **原始输入数据持久化**

### 7. 仲裁结果 (Arbitration Results)
- 关联异常记录
- 仲裁员、仲裁时间、结果
- 结论、处罚类型/金额
- 重复仲裁拦截机制
- **原始输入和处理结论持久化**

### 8. 处理日志 (Processing Logs)
- 关联异常记录
- 操作类型、操作人
- 状态变更前后
- **原始输入和处理结论完整记录**
- **主记录与明细记录双向关联追溯**

## API 接口列表

### 健康检查
```
GET /health
```

### 异常单管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/exceptions | 创建异常单 |
| GET | /api/exceptions | 查询异常单列表 |
| GET | /api/exceptions/:id | 查询异常单详情（含改派、证据、仲裁、日志） |
| PUT | /api/exceptions/:id/status | 更新异常单状态 |
| POST | /api/exceptions/:id/correct | 人工修正异常单 |

### 改派管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/exceptions/:id/reassignments | 申请改派 |
| PUT | /api/reassignments/:id/process | 处理改派 |
| GET | /api/reassignments | 查询改派列表 |

### 申诉证据管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/exceptions/:id/evidences | 上传申诉证据 |
| PUT | /api/evidences/:id/verify | 审核证据 |
| GET | /api/evidences | 查询证据列表 |

### 仲裁管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/exceptions/:id/arbitrations | 创建仲裁结果 |
| PUT | /api/arbitrations/:id/finalize | 仲裁结果生效（最终裁决，不可重复仲裁） |
| GET | /api/arbitrations | 查询仲裁列表 |

### 数据导出

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/export/exceptions | 导出异常单（CSV） |
| GET | /api/export/arbitrations | 导出仲裁结果（CSV） |

### 基础数据

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/riders | 查询骑手列表 |
| GET | /api/orders | 查询订单列表 |
| GET | /api/exception-types | 查询异常类型列表 |

## 核心业务规则

### 1. 异常分类
- 按类别（food_issue、delivery_issue、rider_issue、user_issue、force_majeure、system_issue）分类
- 按严重程度（low、normal、high、critical）分级

### 2. 改派流程
- 骑手申请 → 站长审核 → 分配新骑手
- 改派状态与异常单状态联动更新

### 3. 申诉与仲裁
- 支持多种证据类型（图片、视频、音频、文字说明等）
- 仲裁结果可分为：sustained（申诉成立）、dismissed（申诉驳回）
- **重复仲裁拦截**：已最终裁决的异常单不可再次仲裁

### 4. 可追溯性设计
- **原始输入保存**：所有操作的请求原始数据均保存到数据库
- **处理结论记录**：每一步操作的结论都单独记录
- **日志关联**：处理日志与主记录关联，状态变更前后清晰
- **双向追溯**：主记录可查看所有明细记录，明细记录可回溯到主记录

## 使用示例

### 1. 创建异常单
```bash
curl -X POST http://localhost:3000/api/exceptions \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": 1,
    "riderId": 1,
    "exceptionTypeId": 1,
    "description": "商家少装了饮料",
    "reportSource": "rider_app"
  }'
```

### 2. 查询异常单详情
```bash
curl http://localhost:3000/api/exceptions/1
```

返回数据包含：
- 异常单基本信息
- 改派记录列表
- 申诉证据列表
- 仲裁结果列表
- 处理日志（含原始输入和结论）

### 3. 上传申诉证据
```bash
curl -X POST http://localhost:3000/api/exceptions/1/evidences \
  -H "Content-Type: application/json" \
  -d '{
    "uploaderId": 1,
    "evidenceType": "image",
    "evidenceUrl": "https://example.com/photo.jpg",
    "description": "餐品与订单对比照片",
    "deviceInfo": "iPhone 14"
  }'
```

### 4. 创建仲裁
```bash
curl -X POST http://localhost:3000/api/exceptions/1/arbitrations \
  -H "Content-Type: application/json" \
  -d '{
    "arbitrator": "admin_01",
    "result": "dismissed",
    "conclusion": "经查实是商家责任",
    "penaltyType": "none",
    "penaltyAmount": 0
  }'
```

### 5. 导出数据
```bash
curl http://localhost:3000/api/export/exceptions --output exceptions.csv
```

## 数据可追溯性说明

### 处理日志字段说明
每条日志都包含：
- `raw_input`: 操作时的原始请求数据（JSON格式）
- `conclusion`: 处理结论文字
- `before_status`: 操作前状态
- `after_status`: 操作后状态
- `operator`: 操作人
- `operation_type`: 操作类型

### 数据追溯路径
```
异常单 → 改派记录 → 处理日志 → 原始输入
异常单 → 申诉证据 → 审核记录 → 处理日志
异常单 → 仲裁结果 → 处罚记录 → 处理日志
```

所有关联都通过外键建立双向关联，支持从任意节点向上追溯。

## 项目结构

```
├── src/
│   ├── app.js                    # 主应用入口
│   ├── database/
│   │   ├── index.js              # 数据库连接
│   │   └── schema.js             # 数据库表结构
│   ├── services/
│   │   ├── exceptionService.js   # 异常单服务
│   │   ├── reassignmentService.js # 改派服务
│   │   ├── evidenceService.js    # 证据服务
│   │   ├── arbitrationService.js # 仲裁服务
│   │   ├── exportService.js      # 导出服务
│   │   └── baseService.js        # 基础数据服务
│   ├── routes/
│   │   └── exceptionRoutes.js    # API路由
│   └── utils/
│       └── generator.js          # 编号生成工具
├── scripts/
│   └── seed-data.js              # 样例数据脚本
├── data/                         # 数据库文件目录
├── package.json
└── README.md
```

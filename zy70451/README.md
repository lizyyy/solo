# 租户开通台后端服务

## 项目概述

基于手写仓库交接单展开的租户开通台后端服务，支持服务版本一致性校验、人工修正、历史记录追踪等功能。

## 启动方式

### 环境要求
- Node.js >= 16
- npm >= 8

### 安装依赖
```bash
npm install
```

### 编译项目
```bash
npm run build
```

### 启动服务
```bash
# 普通启动
npm start

# 启动并初始化样例数据
npm run start:init
```

### 开发模式
```bash
npm run dev
# 或
npm run dev:init  # 启动并初始化样例数据
```

服务启动后访问：http://localhost:3000

## 样例来源

样例数据包含一个租户交接单，内含3个服务记录：

| 服务名称 | 状态 | 说明 |
|---------|------|------|
| 用户认证服务 | normal | 所有版本匹配 |
| 会员续费服务 | abnormal | membership-service版本不一致（期望v3.2.0，实际v3.1.5） |
| 订单管理服务 | normal | 所有版本匹配 |

执行 `npm run init:sample` 可初始化样例数据。

## API 接口

### 1. 健康检查
```
GET /health
```

### 2. 创建交接单
```
POST /api/handover
Content-Type: application/json

{
  "tenantId": "TENANT001",
  "tenantName": "示例公司",
  "handler": "张三",
  "serviceRecords": [
    {
      "serviceName": "用户认证服务",
      "versions": [
        {
          "serviceName": "auth-service",
          "expectedVersion": "v2.1.0",
          "actualVersion": "v2.1.0",
          "isMatch": true
        }
      ]
    }
  ]
}
```

### 3. 获取交接单列表
```
GET /api/handover
```

### 4. 获取交接单详情
```
GET /api/handover/:id
```

### 5. 处理交接单（版本一致性校验）
```
POST /api/handover/:id/process
```

### 6. 人工修正
```
POST /api/handover/:id/manual-fix
Content-Type: application/json

{
  "serviceRecordId": "xxx",
  "manualConclusion": "人工修正：版本差异已确认可兼容",
  "remark": "与技术负责人确认，v3.1.5与v3.2.0在该租户场景下无功能差异",
  "operator": "李四"
}
```

**重要说明**：
- 人工修正不会覆盖系统判断，系统结论保留
- 所有备注都会被记录，形成完整的审计轨迹
- 修正后的服务状态为 manual_fixed

### 7. 添加材料摘要
```
POST /api/handover/:id/material-summary
Content-Type: application/json

{
  "serviceRecordId": "xxx",
  "type": "审批材料",
  "content": "部门负责人审批通过，附件：审批单.pdf"
}
```

### 8. 获取所有历史记录
```
GET /api/handover/history/all
```

### 9. 按资源范围查询历史记录
```
GET /api/handover/history/query?resourceRange=tenant:TENANT001
```

## 主流程说明

### 完整的交接单处理流程：

```
1. 创建交接单
   ↓
2. 系统自动执行版本一致性校验
   ├─ 所有版本匹配 → 服务状态 normal
   ├─ 存在版本不匹配 → 服务状态 abnormal
   └─ 部分正常部分异常 → 表单整体状态 partial_success
   ↓
3. (可选) 添加材料摘要
   ↓
4. (可选) 人工修正异常记录
   ├─ 保留系统原始判断
   ├─ 记录人工结论
   └─ 记录修正备注
   ↓
5. 完成
```

## 失败路径说明

### 场景1：服务版本不一致

**现象**：
- 服务状态标记为 `abnormal`
- 系统结论明确指出哪个服务版本不匹配
- 表单整体状态为 `partial_success`（部分成功）或 `failed`

**处理方式**：
1. 查看系统结论，定位版本不一致的具体服务
2. 核实实际部署版本是否正确
3. 如版本正确但确实存在差异，执行人工修正
4. 人工修正时填写详细说明和操作人

**错误返回示例**：
```json
{
  "code": 200,
  "message": "交接单处理成功",
  "data": {
    "status": "partial_success",
    "serviceRecords": [
      {
        "serviceName": "会员续费服务",
        "status": "abnormal",
        "systemConclusion": "版本不一致: membership-service(期望:v3.2.0,实际:v3.1.5)"
      }
    ]
  }
}
```

### 场景2：参数校验失败

**错误返回示例**：
```json
{
  "code": 400,
  "message": "缺少必填字段",
  "errors": [
    "字段 serviceRecordId 不能为空",
    "字段 manualConclusion 不能为空"
  ]
}
```

### 场景3：资源不存在

**错误返回示例**：
```json
{
  "code": 404,
  "message": "交接单不存在: xxx"
}
```

## 核心特性

### 1. 部分成功保留明细
- 即使交接单整体标记为 `partial_success`，每条服务记录的独立状态都会完整保留
- 不会因为部分失败就将整批标记为失败
- 支持逐条查看和处理每条记录

### 2. 人工修正不覆盖系统判断
- 系统结论永久保留，不被人工操作覆盖
- 所有修改都留下 `remarks` 备注记录
- 备注包含：内容、操作人、时间戳

### 3. 历史记录按资源范围可追溯
- 所有操作（创建、处理、修正等）都会被记录到历史日志
- 历史记录包含 `resourceRange` 字段，支持按资源范围查询
- 例如：`tenant:TENANT001` 可查询该租户下的所有操作历史
- 如果有人补改会员续费流水，可通过资源范围看到改动理由

### 4. 数据持久化
- 所有数据以 JSON 格式存储在 `data/` 目录下
- 服务重启后所有处理结论、材料摘要、历史记录都不会丢失
- 包含两个文件：
  - `handover-forms.json` - 交接单数据
  - `history.json` - 历史操作记录

## 数据结构说明

### 交接单状态 (RecordStatus)
- `pending` - 待处理
- `success` - 全部成功
- `failed` - 全部失败
- `partial_success` - 部分成功

### 服务记录状态 (ServiceStatus)
- `pending` - 待处理
- `normal` - 正常（版本一致）
- `abnormal` - 异常（版本不一致）
- `manual_fixed` - 已人工修正

## 目录结构

```
.
├── src/
│   ├── types.ts              # 类型定义
│   ├── server.ts             # 服务入口
│   ├── start.ts              # 启动脚本
│   ├── initSampleData.ts     # 样例数据初始化
│   ├── services/
│   │   └── handoverService.ts  # 业务逻辑
│   ├── store/
│   │   └── fileStore.ts      # 文件存储
│   └── routes/
│       └── handoverRoutes.ts # 路由定义
├── data/                     # 数据存储目录
│   ├── handover-forms.json
│   └── history.json
├── dist/                     # 编译输出
├── package.json
├── tsconfig.json
└── README.md
```

# 服务降级策略 API

高峰期服务降级管理系统，用于管理和执行服务降级策略，清晰追踪接口影响范围和租户影响。

## 功能特性

- ✅ 策略创建与管理
- ✅ 状态流转控制（待处理 → 已确认 → 被拦截 → 已撤销/已补偿）
- ✅ 接口分组与租户范围匹配
- ✅ 降级级别定义（L1-L4）
- ✅ 恢复条件配置
- ✅ 影响统计与摘要导出
- ✅ 失败路径记录（原始输入、处理依据、最终结论）
- ✅ 人工修正功能
- ✅ 策略匹配接口
- ✅ JSON/CSV 导出

## 数据模型

### 策略核心字段

| 字段 | 说明 |
|------|------|
| strategyName | 策略名称 |
| apiGroups | 接口分组数组 |
| tenantScope | 租户范围配置 |
| degradationLevel | 降级级别（L1-L4） |
| recoveryCondition | 恢复条件 |
| impactSummary | 影响摘要统计 |
| status | 状态 |
| statusHistory | 状态变更历史 |
| failurePath | 失败路径记录 |
| impactRecords | 影响记录列表 |

### 状态定义

| 状态 | 说明 |
|------|------|
| pending | 待处理 - 策略已创建等待审核 |
| confirmed | 已确认 - 策略已审核通过等待执行 |
| blocked | 被拦截 - 策略执行中，接口已被降级 |
| revoked | 已撤销 - 策略已撤销 |
| compensated | 已补偿 - 服务已恢复，补偿完成 |

### 租户范围类型

- `all`: 所有租户
- `include`: 包含指定租户
- `exclude`: 排除指定租户

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
npm start
```

开发模式（自动重启）：

```bash
npm run dev
```

服务默认运行在 `http://localhost:3000`

## API 接口文档

### 基础接口

#### 健康检查
```
GET /api/v1/health
```

#### 获取常量定义
```
GET /api/v1/constants
```

### 策略管理

#### 创建策略
```
POST /api/v1/strategies
```

请求示例：
```json
{
  "strategyName": "高峰期用户查询降级",
  "apiGroups": ["/api/user/query", "/api/user/list"],
  "tenantScope": {
    "type": "include",
    "tenants": ["tenant_001", "tenant_002"]
  },
  "degradationLevel": "L2",
  "recoveryCondition": {
    "type": "threshold",
    "threshold": {
      "metric": "qps",
      "value": 100
    }
  },
  "impactSummary": {
    "description": "对高流量租户的用户查询接口进行降级"
  },
  "operator": "admin",
  "remarks": "双十一高峰期间使用"
}
```

#### 查询策略列表
```
GET /api/v1/strategies?status=pending&degradationLevel=L2&strategyName=查询
```

#### 查询单个策略
```
GET /api/v1/strategies/:id
```

### 状态推进

#### 发布策略
```
POST /api/v1/strategies/:id/publish
```
请求体：
```json
{
  "operator": "admin"
}
```

#### 激活策略（执行降级）
```
POST /api/v1/strategies/:id/activate
```
请求体：
```json
{
  "operator": "admin",
  "reason": "流量超过阈值"
}
```

#### 补偿策略（恢复服务）
```
POST /api/v1/strategies/:id/compensate
```
请求体：
```json
{
  "operator": "admin",
  "reason": "流量已恢复正常"
}
```

#### 撤销策略
```
POST /api/v1/strategies/:id/revoke
```

### 异常处理与修正

#### 记录失败路径
```
POST /api/v1/strategies/:id/failure
```
请求体：
```json
{
  "originalInput": { ...原始请求数据 },
  "processingBasis": "依据规则第3条，租户范围不匹配",
  "finalConclusion": "策略执行失败，未对该请求进行降级"
}
```

#### 人工修正策略
```
POST /api/v1/strategies/:id/manual-correct
```
请求体：
```json
{
  "operator": "admin",
  "correctionData": {
    "tenantScope": {
      "type": "include",
      "tenants": ["tenant_001", "tenant_002", "tenant_003"]
    },
    "remarks": "添加租户003到降级范围"
  }
}
```

### 影响记录与导出

#### 添加影响记录
```
POST /api/v1/strategies/:id/impact-record
```
请求体：
```json
{
  "tenantId": "tenant_001",
  "apiPath": "/api/user/query",
  "requestCount": 1500,
  "impactType": "throttled"
}
```

#### 导出策略列表
```
GET /api/v1/strategies/export?format=json&status=blocked
GET /api/v1/strategies/export?format=csv
```

#### 导出策略影响摘要
```
GET /api/v1/strategies/:id/export-impact?format=csv
```

### 策略匹配

#### 匹配适用的降级策略
```
POST /api/v1/strategies/match
```
请求体：
```json
{
  "apiGroup": "/api/user/query",
  "tenantId": "tenant_001"
}
```

### 统计信息

#### 获取统计数据
```
GET /api/v1/strategies/statistics
```

## 项目结构

```
.
├── src/
│   ├── app.js                 # 应用入口
│   ├── controllers/
│   │   └── strategyController.js  # 控制器
│   ├── routes/
│   │   └── strategyRoutes.js      # 路由配置
│   ├── services/
│   │   └── strategyService.js     # 业务逻辑
│   ├── models/
│   │   ├── Strategy.js            # 策略模型
│   │   ├── constants.js           # 常量定义
│   │   └── store.js               # 数据存储
│   ├── middleware/
│   └── utils/
│       ├── validation.js          # 参数验证
│       └── exporter.js            # 导出工具
├── package.json
└── README.md
```

## 状态流转图

```
pending (待处理)
    ↓
confirmed (已确认)
    ↓
blocked (被拦截)
  ↙   ↘
revoked  compensated
(已撤销)  (已补偿)
```

**注意**：任何状态都可以直接转换到 revoked 状态。

## 降级级别说明

- **L1**: 轻度降级 - 缓存优先，延长超时时间
- **L2**: 中度降级 - 关闭非核心功能，限流
- **L3**: 重度降级 - 只保留核心读写功能
- **L4**: 紧急降级 - 服务熔断，只返回默认值

## 恢复条件类型

- **manual**: 手动恢复
- **time**: 定时恢复，指定分钟数
- **threshold**: 阈值恢复，如 QPS、错误率等

## 技术栈

- Node.js
- Express.js
- Joi (参数验证)
- json2csv (CSV导出)
- uuid (唯一ID生成)

## 注意事项

1. 当前版本使用内存存储，重启后数据会丢失
2. 生产环境建议替换为数据库存储（如 MongoDB、MySQL）
3. 建议添加认证中间件保护 API 接口
4. 建议添加操作日志审计功能

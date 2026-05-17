# 车队调度服务 - 司机临时换班确认系统

## 项目概述

这是一个基于 Node.js + TypeScript + Express + SQLite 的车队调度服务，专门用于管理司机临时换班申请、状态追踪、冲突检测。

## 核心功能

1. **换班申请管理**
   - 创建换班申请
   - 自动冲突检测
   - 状态流转追踪

2. **完整历史记录**
   - 每次状态变更都记录历史
   - 可追溯修改人和修改原因
   - 完整的审计跟踪

3. **行级数据校验**
   - 导入数据校验
   - 实时验证结果返回

4. **智能错误处理**
   - 明确的错误代码和下一步操作
   - 不只是简单的500错误

## 状态流转

```
待确认 (pending_confirm)
    ↓
已换班 (swapped)
    ↓
已完成 (completed)

冲突待判 (conflict_pending)
```

## 技术栈

- **运行时**: Node.js
- **语言**: TypeScript
- **框架**: Express
- **数据库**: SQLite3
- **测试**: Jest
- **导出**: JSON / CSV

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化种子数据

```bash
npm run seed
```

种子数据包含：
- 4位司机（3位在职，1位休假）
- 2辆车辆
- 4个班次
- 4条换班记录（包含完整流转、冲突待判、待确认、已换班）

### 3. 启动开发服务器

```bash
npm run dev
```

服务器将在 http://localhost:3000 启动

## API 文档

### 基础路径: `/api/shift-swaps`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | / | 获取换班记录列表 |
| POST | / | 创建换班申请 |
| GET | /:id | 获取换班详情 |
| GET | /:id/history | 获取换班历史记录 |
| PATCH | /:id/confirm | 确认换班 |
| PATCH | /:id/complete | 标记换班完成 |
| GET | /export | 导出换班记录 |
| POST | /validate-import | 验证导入数据 |

### 请求示例

#### 创建换班申请

```bash
curl -X POST http://localhost:3000/api/shift-swaps \
  -H "Content-Type: application/json" \
  -H "X-User-Id: admin" \
  -d '{
    "originalShiftId": "shift-uuid",
    "originalDriverId": "driver-uuid-1",
    "newDriverId": "driver-uuid-2",
    "swapReason": "personal_affair",
    "reasonDetail": "家里有事"
  }'
```

#### 获取换班列表

```bash
curl http://localhost:3000/api/shift-swaps?status=pending_confirm
```

#### 导出CSV

```bash
curl "http://localhost:3000/api/shift-swaps/export?format=csv"
```

### 响应格式

#### 成功响应

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "pending_confirm",
    ...
  }
}
```

#### 错误响应

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "换班申请验证失败",
    "details": {
      "errors": ["原司机和新司机不能相同"]
    },
    "nextAction": "请检查提交的数据并重试"
  }
}
```

## 验收场景

### 1. 完整流转验证

种子数据中的 swap1 展示了完整的状态流转：
- 待确认 → 已换班 → 已完成

验证历史记录包含3条记录

### 2. 冲突记录验证

swap2 处于冲突待判状态，包含冲突原因详情

### 3. 导入坏行测试

使用以下数据测试导入校验：
```json
{
  "rows": [
    {
      "originalShiftId": "invalid-id",
      "originalDriverId": "driver-id-of-zhaoliu",
      "newDriverId": "same-as-original",
      "swapReason": "invalid"
    }
  ]
}
```

## 项目结构

```
.
├── src/
│   ├── controllers/      # API 控制器层
│   ├── database/         # 数据库相关
│   ├── errors/         # 错误处理类
│   ├── repositories/   # 数据访问层
│   ├── routes/         # 路由定义
│   ├── scripts/        # 脚本（种子数据）
│   ├── services/       # 业务逻辑层
│   ├── types/          # 类型定义
│   └── index.ts       # 应用入口
├── package.json
├── tsconfig.json
└── README.md
```

## 换班原因

- `personal_affair` - 私事
- `sick_leave` - 病假
- `emergency` - 紧急事务
- `other` - 其他

## 常用命令

```bash
npm run dev      # 开发模式
npm run build    # 构建项目
npm start        # 生产模式
npm run seed     # 初始化种子数据
npm test         # 运行测试
npm run lint     # 代码检查
```

# 会议预约后端会议室释放补偿服务

## 项目简介

本项目提供会议室预约、释放申请和费用补偿的完整后端服务，支持状态流转跟踪、冲突检测、批量导入导出和行级数据校验。

## 核心功能

- **预约管理**: 创建、查询会议室预约记录
- **状态流转**: 已预约 → 释放申请 → (待人工处理) → 已释放 → 补偿中 → 已完成
- **释放原因**: 设备故障、会议室不可用、会议取消、重复预订、其他
- **设备故障处理**: 自动标记待人工处理，提供可解释原因
- **冲突检测**: 自动检测同一会议室的时间重叠预约
- **数据校验**: 完整的行级数据校验，失败时显示具体规则
- **历史记录**: 完整的状态变更历史追踪
- **导入导出**: CSV批量导入导出，支持坏行检测

## 技术栈

- Node.js + Express
- SQLite (本地数据库)
- Sequelize (ORM)
- Joi (数据验证)

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化种子数据

```bash
npm run seed
```

### 3. 启动服务

```bash
npm start
```

开发模式(自动重启):
```bash
npm run dev
```

### 4. 运行验收测试

```bash
npm test
```

## API 文档

### 基础信息

- Base URL: `http://localhost:3000/api`
- Content-Type: `application/json`

### API 端点

#### 1. 创建补偿记录
```
POST /compensation
{
  "reservationId": "RES20240115001",
  "roomId": 1,
  "userId": 1,
  "startTime": "2024-01-16T09:00:00Z",
  "endTime": "2024-01-16T11:00:00Z",
  "chargedAmount": 300.00
}
```

#### 2. 获取记录列表
```
GET /compensation?page=1&pageSize=20&status=已预约&roomId=1
```

#### 3. 获取记录详情
```
GET /compensation/:id
```

#### 4. 获取记录历史
```
GET /compensation/:id/history
```

#### 5. 申请释放
```
POST /compensation/:id/release
{
  "releaseReason": "设备故障",
  "releaseReasonDetail": "投影仪无法开机",
  "affectedEquipment": ["投影仪"],
  "changedBy": 2
}
```

#### 6. 审批释放
```
POST /compensation/:id/approve
{
  "approvedBy": 2
}
```

#### 7. 启动补偿
```
POST /compensation/:id/start-compensation
{
  "compensationAmount": 300.00,
  "approvedBy": 2
}
```

#### 8. 完成补偿
```
POST /compensation/:id/complete
{
  "approvedBy": 2
}
```

#### 9. 拒绝记录
```
POST /compensation/:id/reject
{
  "reason": "不符合补偿条件",
  "rejectedBy": 2
}
```

#### 10. 检查冲突
```
GET /compensation/conflicts/check?roomId=1&startTime=2024-01-16T10:00:00Z&endTime=2024-01-16T12:00:00Z
```

#### 11. 导出记录
```
POST /compensation/export
{
  "filePath": "./export.csv"
}
```

## 状态说明

| 状态 | 说明 |
|------|------|
| 已预约 | 预约创建成功，会议室已锁定 |
| 释放申请 | 用户申请释放会议室，待审批 |
| 待人工处理 | 特殊情况(如设备故障)，需人工审核 |
| 已释放 | 会议室已释放，费用待处理 |
| 补偿中 | 补偿流程进行中 |
| 已完成 | 补偿流程完成 |
| 已拒绝 | 申请被拒绝 |

## 释放原因

- `设备故障`: 会议室设备故障导致无法使用
- `会议室不可用`: 会议室因其他原因不可用
- `会议取消`: 会议取消，不需要使用会议室
- `重复预订`: 系统检测到重复预订
- `其他`: 其他原因

## 项目结构

```
.
├── src/
│   ├── config/
│   │   └── database.js          # 数据库配置
│   ├── models/
│   │   ├── index.js             # 模型关联
│   │   ├── Room.js              # 会议室模型
│   │   ├── User.js              # 用户模型
│   │   ├── CompensationRecord.js # 补偿记录模型
│   │   └── StatusHistory.js     # 状态历史模型
│   ├── services/
│   │   ├── compensationService.js    # 业务逻辑
│   │   ├── validationService.js      # 数据校验
│   │   └── importExportService.js    # 导入导出
│   ├── controllers/
│   │   └── compensationController.js # API控制器
│   ├── routes/
│   │   └── compensationRoutes.js     # 路由定义
│   ├── scripts/
│   │   ├── seed.js              # 种子数据脚本
│   │   └── test.js              # 测试脚本
│   └── server.js                # 服务器入口
├── package.json
└── README.md
```

## 验收测试说明

测试脚本包含以下三个验收场景：

### 1. 完整状态流转
- 创建预约 → 申请释放(设备故障) → 自动转待人工处理 → 启动补偿 → 完成补偿
- 验证历史记录完整性

### 2. 冲突记录检测
- 创建基准预约
- 检测时间重叠冲突
- 检测无冲突时间段
- 创建冲突记录

### 3. 坏行导入测试
- 导入包含正确和错误行的CSV
- 检测空预约ID、不存在会议室、无效用户ID、非法日期、负数金额
- 验证列表和详情查询

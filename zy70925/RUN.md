# 培训数据校验API - 本地运行说明

## 项目概述

本项目用于统一处理培训签到、作业和证书发放数据，解决多后台数据导入混乱问题。支持：
- 签到CSV解析与校验
- 作业JSON解析与校验
- 课程规则配置
- 迟到扣分、补签审批、证书撤销规则
- 正常/待确认/失败项分类返回
- 失败记录保留原始字段和处理建议
- 批次提交幂等性（重复提交不重复处理）

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

开发模式（自动重启）：
```bash
npm run dev
```

或编译后运行：
```bash
npm run build
npm start
```

服务默认端口：`3000`

### 3. 运行测试

```bash
chmod +x test-api.sh
./test-api.sh
```

## API 接口

### 健康检查
```bash
GET /health
```

### 处理批次数据
支持文件上传或JSON请求体两种方式：

**方式一：文件上传**
```bash
curl -X POST http://localhost:3000/api/validation/process \
  -F "attendanceFile=@samples/attendance.csv" \
  -F "assignmentsFile=@samples/assignments.json" \
  -F "ruleFile=@samples/course-rule.json"
```

**方式二：JSON请求体**
```bash
curl -X POST http://localhost:3000/api/validation/process \
  -H "Content-Type: application/json" \
  -d '{
    "courseBatch": "2024-Q1-TRAIN01",
    "attendance": [...],
    "assignments": [...],
    "rule": {...}
  }'
```

### 获取批次列表
```bash
GET /api/validation/batches
```

### 获取单个批次处理结果
```bash
GET /api/validation/result/:batchId
```

### 检查证书发放资格
```bash
POST /api/validation/check-certificate
Content-Type: application/json

{
  "employeeId": "E001",
  "rule": {...},
  "attendanceResults": [...],
  "assignmentResults": [...]
}
```

## 响应格式说明

处理结果分为三类：

### 1. normalItems（正常项）
- 无需人工干预
- 符合所有规则要求

### 2. pendingItems（待确认项）
- 需要人工审核
- 包含：迟到、补签待审批、作业迟交、作业未批改等
- 每条记录包含 `reviewAction` 建议操作：
  - `approve`: 可直接通过
  - `request_more_info`: 需要补充材料
  - `reject`: 建议拒绝

### 3. failedItems（失败项）
- 不符合规则要求
- 保留完整原始数据（`original` 字段）
- 包含明确的 `reason`（失败原因）和 `suggestion`（处理建议）

## 规则说明

### 迟到扣分规则
- 超过 `lateThresholdMinutes` 分钟视为迟到
- 每次迟到扣除 `latePenaltyPoints` 分
- 累计迟到超过 `maxLateAllowed` 次影响证书发放

### 补签审批规则
- `allowMakeup`: 是否允许补签
- `makeupDeadlineDays`: 补签申请期限（天）
- 补签需要 `makeupApproved=true` 且填写 `makeupReason`

### 证书撤销条件
- `tooManyLates`: 迟到次数过多
- `lowAttendance`: 出勤率低于 `requiredAttendanceRate`
- `assignmentFailed`: 存在不合格作业
- `cheatingDetected`: 作弊（需外部检测标记）

## 样例数据说明

`samples/` 目录包含测试样例：

| 文件 | 说明 |
|------|------|
| attendance.csv | 签到数据，包含正常、迟到、缺勤、补签等情况 |
| assignments.json | 作业数据，包含通过、未通过、迟交、待批改等情况 |
| course-rule.json | 课程规则配置 |

**特别说明：** 样例中包含一条需要人工修正的记录（E006 孙八 缺勤），处理结果会放在 `failedItems` 中，附带处理建议。

## 目录结构

```
├── src/
│   ├── types/           # 类型定义
│   ├── services/        # 核心服务
│   │   ├── validationEngine.ts    # 校验引擎
│   │   ├── fileParser.ts          # 文件解析
│   │   └── idempotencyService.ts  # 幂等性控制
│   ├── routes/          # API路由
│   └── server.ts        # 服务入口
├── samples/             # 样例数据
├── data/                # 运行时数据（自动生成）
├── test-api.sh          # 测试脚本
└── RUN.md               # 本文件
```

## 常见问题

**Q: 如何清除历史批次数据？**
A: 删除 `data/` 目录即可。

**Q: 如何修改规则配置？**
A: 修改 `samples/course-rule.json` 或在请求体中传入自定义 `rule` 字段。

**Q: 支持哪些CSV字段名？**
A: 支持中英文双语字段名，详见 `src/services/fileParser.ts`。

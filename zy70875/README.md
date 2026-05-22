# 影院排片补贴核算 API 服务

## 项目简介

为院线运营提供自动化的排片补贴核算处理能力，支持数据自动分类、任务状态持久化、审计追溯和报告导出。

## 核心功能

- **数据分类**：自动分为正常、待补充、已拦截三类
- **核算规则**：支持跨日场拆分、退票场扣除、保底协议核算
- **任务状态**：处理中、处理失败、人工确认、已导出（持久化存储）
- **审计追溯**：记录修改人、修改原因、修改前后数据快照
- **报告导出**：生成 CSV 格式核算报告

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
npm start
```

服务默认运行在 `http://localhost:3000`

## API 接口速查

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/batches | 创建批次 |
| GET | /api/batches | 查询批次列表 |
| GET | /api/batches/:id | 查询批次详情 |
| POST | /api/batches/:id/process | 触发核算 |
| GET | /api/tasks/:id | 查询任务状态 |
| POST | /api/tasks/:id/confirm | 人工确认 |
| PUT | /api/tasks/results/:resultId/conclusion | 修改结论 |
| GET | /api/audit/task/:taskId | 查询审计日志 |
| GET | /api/reports/:batchId | 查询报告数据 |
| GET | /api/reports/:batchId/download | 下载报告 |

## 完整流程演示 (curl 命令)

### 1. 检查服务健康状态

```bash
curl -X GET http://localhost:3000/api/health
```

### 2. 创建核算批次

```bash
curl -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "batchName": "2024年5月第一周补贴核算",
    "operator": "张三",
    "period": {
      "startDate": "2024-05-01",
      "endDate": "2024-05-07"
    },
    "rawData": [
      {
        "screeningId": "S001",
        "cinemaId": "C001",
        "cinemaName": "万达影城CBD店",
        "filmId": "F001",
        "filmName": "速度与激情10",
        "startTime": "2024-05-01T19:00:00+08:00",
        "endTime": "2024-05-01T21:30:00+08:00",
        "totalBoxOffice": 15000,
        "refundAmount": 500,
        "audienceCount": 200,
        "hasMinimumGuarantee": false,
        "isCrossDay": false
      },
      {
        "screeningId": "S002",
        "cinemaId": "C001",
        "cinemaName": "万达影城CBD店",
        "filmId": "F002",
        "filmName": "银河护卫队3",
        "startTime": "2024-05-01T23:00:00+08:00",
        "endTime": "2024-05-02T01:30:00+08:00",
        "totalBoxOffice": 8000,
        "refundAmount": 3000,
        "audienceCount": 100,
        "hasMinimumGuarantee": true,
        "guaranteeAmount": 6000,
        "isCrossDay": true
      },
      {
        "screeningId": "S003",
        "cinemaId": "C002",
        "cinemaName": "博纳影城望京店",
        "filmId": "F001",
        "filmName": "速度与激情10",
        "startTime": "2024-05-02T14:00:00+08:00",
        "endTime": "2024-05-02T16:30:00+08:00",
        "totalBoxOffice": 500,
        "refundAmount": 50,
        "audienceCount": 10,
        "hasMinimumGuarantee": false,
        "isCrossDay": false
      }
    ]
  }'
```

**注意**：记录返回的批次 ID（batches.id），后续步骤需要使用。

### 3. 触发核算处理

```bash
# 替换 BATCH_ID 为上一步返回的批次 ID
BATCH_ID="your_batch_id_here"

curl -X POST http://localhost:3000/api/batches/${BATCH_ID}/process
```

**注意**：记录返回的任务 ID（data.task.id）。

### 4. 查询任务状态

```bash
# 替换 TASK_ID 为上一步返回的任务 ID
TASK_ID="your_task_id_here"

curl -X GET http://localhost:3000/api/tasks/${TASK_ID}
```

**说明**：可多次执行此命令查看进度，直到 status 变为 completed 或 pending_confirmation

### 5. 查看核算结果

```bash
curl -X GET http://localhost:3000/api/tasks/${TASK_ID}/results
```

**结果分类说明**：
- `normal`：正常 - 数据完整，核算通过
- `pending`：待补充 - 需要人工确认（如退票率过高、缺少保底金额等）
- `blocked`：已拦截 - 不符合补贴条件（如票房未达标）

### 6. 人工确认（如有待补充记录）

```bash
curl -X POST http://localhost:3000/api/tasks/${TASK_ID}/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "李四"
  }'
```

### 7. 修改核算结论（可选）

```bash
# 替换 RESULT_ID 为核算结果中的某条记录 ID
RESULT_ID="your_result_id_here"

curl -X PUT http://localhost:3000/api/tasks/results/${RESULT_ID}/conclusion \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "李四",
    "category": "normal",
    "subsidyAmount": 450,
    "reason": "经核实，该场次为特殊活动场，同意补贴"
  }'
```

### 8. 查看审计日志

```bash
# 按任务查看
curl -X GET http://localhost:3000/api/audit/task/${TASK_ID}

# 按批次查看
curl -X GET http://localhost:3000/api/audit/batch/${BATCH_ID}
```

### 9. 下载核算报告

```bash
curl -X GET -o "subsidy-report.csv" \
  "http://localhost:3000/api/reports/${BATCH_ID}/download?operator=李四"
```

## 一键测试脚本

也可以使用 Node.js 脚本一键测试完整流程：

```bash
npm test
```

## 核算规则详解

### 1. 跨日场处理
- 识别：`isCrossDay = true`
- 逻辑：按放映时长比例拆分到各日期核算（使用本地时间判断）
- 示例：23:00-01:30 的场次（2.5小时），按 1:1.5 比例拆分到两天（第一天2400元，第二天3600元，总票房6000元）

### 2. 退票场处理
- 公式：净票房 = 总票房 - 退票金额
- 规则：退票率 > 30% 标记为待补充，需人工确认

### 3. 保底协议处理
- 识别：`hasMinimumGuarantee = true`
- 逻辑：取「净票房」与「保底金额」较高值作为核算基数
- 规则：未填写保底金额时标记为待补充

### 4. 补贴计算
- 费率：5%
- 门槛：最终票房 ≥ 1000 元才可享受补贴

## 数据字段溯源

每个核算结果可追溯原始输入字段：

| 报告字段 | 原始字段 | 计算过程 |
|----------|----------|----------|
| 最终票房 | totalBoxOffice | 扣除退票 → 与保底比较 |
| 补贴金额 | finalBoxOffice | 最终票房 × 5% |
| 分类状态 | - | 基于校验规则自动判定 |

## 目录结构

```
.
├── src/
│   ├── index.js          # 服务入口
│   ├── routes/           # API 路由
│   ├── services/         # 业务逻辑
│   └── utils/            # 工具类
├── data/                 # SQLite 数据库文件
├── reports/              # 导出的报告文件
└── package.json
```

## 状态流转

```
created → processing → completed → exported
                    ↘ pending_confirmation ↗
                    ↘ failed
```

- `processing`：处理中
- `pending_confirmation`：人工确认
- `completed`：处理完成
- `exported`：已导出
- `failed`：处理失败

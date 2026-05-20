# 尾箱交接管理系统 API

用于处理尾箱交接记录、柜员排班和差错记录的管理系统，支持金额不平、缺双签、跨日交接等规则校验。

## 功能特性

- ✅ **CSV 交接记录上传解析** - 支持标准格式的尾箱交接记录文件
- ✅ **JSON 排班文件导入** - 支持柜员排班信息导入用于交接验证
- ✅ **三大核心规则校验**：
  - 金额不平校验 - 系统金额与实际金额差额检查
  - 缺双签校验 - 双人确认完整性检查
  - 跨日交接校验 - 日期与排班一致性检查
- ✅ **差错编号追溯** - 通过差错编号可完整追溯来源批次和原始数据
- ✅ **防重复提交** - 同一批数据再次提交会被拦截
- ✅ **当日闭环管理** - 支持差错关闭标记功能

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py          # API 接口
│   ├── models.py        # 数据模型
│   ├── schemas.py       # Pydantic 模式
│   ├── services.py      # 业务逻辑
│   └── database.py      # 数据库配置
├── test_data/           # 测试数据
│   ├── handover_test.csv
│   └── schedule_test.json
├── requirements.txt     # 依赖包
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. 访问文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API 接口说明

### 1. 上传交接记录

**POST** `/api/handover/upload`

上传 CSV 交接记录和 JSON 排班文件，系统会自动校验并返回分类结果。

**请求参数**：
- `handover_csv` - 交接记录 CSV 文件（必选）
- `schedule_json` - 柜员排班 JSON 文件（可选）

**返回示例**：
```json
{
  "batch_number": "BATCH-20240520120000",
  "normal_items": [...],
  "pending_items": [],
  "failed_items": [
    {
      "error_code": "AMT-0001-0001",
      "error_type": "amount_mismatch",
      "error_description": "金额不平：系统与实际差额为-100.00...",
      "suggestion": "请双人现场复点并重新录入...",
      "original_data": {...}
    }
  ],
  "statistics": {
    "total": 4,
    "normal": 1,
    "pending": 0,
    "failed": 3
  }
}
```

### 2. 差错追溯

**GET** `/api/error/trace/{error_code}`

通过差错编号追溯完整来源信息，包括原始数据、批次信息、交接详情。

**示例**：`GET /api/error/trace/AMT-0001-0001`

### 3. 批次详情

**GET** `/api/batch/{batch_number}`

查询批次处理结果详情和差错列表。

### 4. 批次列表

**GET** `/api/batches`

查询所有历史批次，支持分页。

### 5. 关闭差错（当日闭环）

**PUT** `/api/error/close/{error_code}`

标记差错为已关闭，完成当日闭环。

## 差错编号说明

差错编号格式：`{类型前缀}-{批次ID}-{序号}`

| 前缀 | 类型 | 说明 |
|------|------|------|
| AMT | amount_mismatch | 金额不平 |
| SIG | missing_signature | 缺双签 |
| DAY | cross_day | 跨日交接 |
| FMT | data_format | 数据格式 |
| DUP | duplicate | 重复提交 |

**示例**：`AMT-0001-0001` 表示第1批次的第1个金额不平差错

## 测试数据使用

### CSV 文件格式（test_data/handover_test.csv）

```csv
交接日期,网点编号,网点名称,交出柜员,接收柜员,尾箱编号,系统金额,实际金额,差额,确认人1,确认人2,交接时间
2024-05-20,B001,朝阳支行,张三,李四,C001,50000.00,50000.00,0.00,王五,赵六,09:00:00
```

**测试说明**：
- 第1行：正常记录 - 金额一致，双人确认
- 第2行：金额不平 - 实际少100元
- 第3行：缺双签 - 确认人2为空
- 第4行：跨日交接 - 日期为历史日期

### JSON 排班格式（test_data/schedule_test.json）

```json
[
  {
    "排班日期": "2024-05-20",
    "网点编号": "B001",
    "柜员姓名": "张三",
    "班次类型": "早班",
    "是否上班": true
  }
]
```

## 使用 curl 测试

### 上传文件测试

```bash
curl -X POST "http://localhost:8000/api/handover/upload" \
  -F "handover_csv=@test_data/handover_test.csv" \
  -F "schedule_json=@test_data/schedule_test.json"
```

### 差错追溯测试

```bash
curl "http://localhost:8000/api/error/trace/AMT-0001-0001"
```

### 关闭差错测试

```bash
curl -X PUT "http://localhost:8000/api/error/close/AMT-0001-0001"
```

## 核心业务规则

### 1. 金额不平校验
- 计算实际金额 - 系统金额的差额
- 与记录的差额对比，误差超过0.01元触发
- 触发后建议：双人复点、重新录入、当日查明原因登记

### 2. 缺双签校验
- 确认人1和确认人2都不能为空
- 两个确认人不能为同一人
- 触发后建议：联系补签、当日完成确认

### 3. 跨日交接校验
- 交接日期早于当前日期触发
- 交出/接收柜员当日未排班触发
- 触发后建议：核查原因、书面说明、代班需主管授权

## 数据库说明

系统使用 SQLite 数据库，文件位置：`./cashbox_handover.db`

主要表结构：
- `batches` - 批次信息
- `handover_records` - 交接记录
- `error_records` - 差错记录（含原始数据）
- `teller_schedules` - 柜员排班

## 注意事项

1. **重复提交拦截**：相同的交接记录数据再次提交会被系统自动拦截
2. **当日闭环**：差错需当日处理，可通过关闭接口标记完成
3. **原始数据保留**：所有失败记录都会保存完整原始数据，便于追溯
4. **UTF-8 编码**：CSV 文件建议使用 UTF-8 编码（支持 BOM）

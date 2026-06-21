# 深海采样数据清洗 - 使用说明

## 一、先跑哪包样例

样例包位置：[samples/pack01_demo.csv](file:///Users/maca/pro/solo/workspaces/zy73155/samples/pack01_demo.csv)

这包里包含了所有典型脏数据场景：
- 经纬度格式不统一（度分秒、十进制度带方向、空格分隔、方向在前等）
- 单位不统一（温度：°C/°F/K/摄氏度；盐度：PSU/%/千分比；深度：m/ft/km）
- 采样瓶重复
- 数值缺失
- 格式无效
- 阈值异常

## 二、CLI 方式

### 1. 启动命令

在项目根目录执行：

```bash
# 查看可用样例包
python3 main.py list

# 运行清洗（指定样例包）
python3 main.py run -s pack01_demo.csv

# 运行清洗并指定批次ID
python3 main.py run -s pack01_demo.csv -b batch_001
```

### 2. 失败后怎么重来

直接重新运行 `run` 命令即可，支持以下几种重跑方式：

```bash
# 1. 原样重跑（自动生成新批次ID）
python3 main.py run -s pack01_demo.csv

# 2. 同一个批次ID重跑（会覆盖上次结果）
python3 main.py run -s pack01_demo.csv -b batch_001

# 3. 先加人工改判，再重跑
python3 main.py review -r rec_008 -w 阿宁 -n threshold \
  -o "50.0" -v "35.0" \
  -j "船上记录本第12页显示温度传感器校准有偏差" \
  -c "深海调查船记录簿 Vol.7 第12页"
python3 main.py run -s pack01_demo.csv -b batch_001
```

人工改判参数说明：
- `-r`：记录ID
- `-w`：评审人姓名
- `-n`：失败原因（formula=公式 / unit=单位 / threshold=阈值 / format=格式）
- `-f`：改判字段名（temperature/salinity/depth/latitude/longitude）
- `-o`：原始值
- `-v`：改判值
- `-j`：改判理由
- `-c`：来源说明（哪个记录本第几页）

改判记录保存在：[data/reviews.json](file:///Users/maca/pro/solo/workspaces/zy73155/data/reviews.json)

---

## 三、API 服务方式

> 不想用 CLI？直接启动 HTTP 服务调用接口

### 1. 启动服务

在项目根目录执行：

```bash
python3 app.py
```

服务启动后访问：
- 接口根路径：http://localhost:8000/
- 自动文档：http://localhost:8000/docs

### 2. 先跑哪包样例（API 方式）

**步骤1：查看可用样例**
```bash
curl http://localhost:8000/api/samples
```
返回样例包列表，默认使用 `pack01_demo.csv`。

**步骤2：触发清洗**
```bash
curl -X POST http://localhost:8000/api/clean \
  -H "Content-Type: application/json" \
  -d '{"sample_file": "pack01_demo.csv", "batch_id": "batch_api_001"}'
```
返回中包含 `summary` 汇总数据。

### 3. 失败后怎么重跑（API 方式）

**方式1：直接重新调用清洗接口**
```bash
curl -X POST http://localhost:8000/api/clean \
  -H "Content-Type: application/json" \
  -d '{"sample_file": "pack01_demo.csv", "batch_id": "batch_api_001"}'
```
同一个 batch_id 会覆盖上次结果。

**方式2：先加人工改判，再重跑**

添加改判（以 rec_008 温度 50.0→35.0 为例）：
```bash
curl -X POST http://localhost:8000/api/review \
  -H "Content-Type: application/json" \
  -d '{
    "record_id": "rec_008",
    "reviewer": "阿宁",
    "fail_reason": "threshold",
    "field_name": "temperature",
    "original_value": "50.0",
    "overridden_value": "35.0",
    "justification": "船上记录本第12页显示该站位温度传感器校准有偏差",
    "source_note": "深海调查船记录簿 Vol.7 第12页"
  }'
```

然后重新调用清洗接口，改判值会自动生效。

### 4. 从哪个接口看返回

| 接口 | 方法 | 说明 |
|---|---|---|
| `/api/samples` | GET | 列出可用样例包 |
| `/api/clean` | POST | 触发一次清洗，返回 summary |
| `/api/result/latest` | GET | 最近一次清洗完整结果（含 records/anomaly_details/duplicate_details） |
| `/api/result/{batch_id}` | GET | 按批次ID取结果 |
| `/api/anomalies` | GET | 异常明细，支持按 batch_id 和 anomaly_type 过滤 |
| `/api/duplicates` | GET | 重复采样瓶明细 |
| `/api/review/chain/{record_id}` | GET | 某条记录的改判追溯链 |
| `/api/manual_reviews` | GET | 所有人工改判记录 |

**示例：查看 rec_008 改判是否生效**
```bash
# 先触发清洗
curl -X POST http://localhost:8000/api/clean \
  -H "Content-Type: application/json" \
  -d '{"sample_file": "pack01_demo.csv", "batch_id": "batch_api_001"}'

# 查看结果中 rec_008 的 temperature_c 应为 35.0，anomalies 应为空
curl http://localhost:8000/api/result/latest
```

返回结构：
```json
{
  "batch_id": "批次ID",
  "sample_file": "样例文件名",
  "run_time": "运行时间",
  "summary": {
    "total_records": 15,
    "valid_records": 8,
    "anomaly_records": 7,
    "valid_rate": 53.33,
    "anomaly_by_type": { ... },
    "fail_reason_counts": { "format": 8, "threshold": 1 },
    "manual_review_overridden": 1,
    ...
  },
  "records": [
    {
      "record_id": "rec_008",
      "temperature_c": 35.0,
      "anomalies": [],
      "review": {
        "field_name": "temperature",
        "fail_reason": "threshold",
        "original_value": "50.0",
        "overridden_value": "35.0",
        "justification": "...",
        "source_note": "..."
      }
    }
  ],
  "anomaly_details": [ ... ],
  "duplicate_details": [ ... ]
}
```

---

## 四、从哪里看结果（CLI 方式）

### 1. 汇总结果（项目经理视角）

```bash
# 查看最近一批的汇总
python3 main.py summary

# 查看指定批次的汇总
python3 main.py summary -b batch_001
```

汇总包含：总记录数、有效数、异常数、合格率、异常类型分布、失败原因分布、重复采样瓶组数、待人工改判数。

### 2. 异常明细

```bash
# 查看所有异常明细
python3 main.py anomalies -b batch_001

# 按类型过滤异常（如只看重复采样瓶）
python3 main.py anomalies -b batch_001 -t duplicate_bottle
```

异常类型：
- `duplicate_bottle`：采样瓶重复
- `missing_value`：值缺失
- `lat_lon_format`：经纬度格式错误
- `unit_mismatch`：单位不匹配
- `formula_error`：公式错误
- `threshold_outlier`：阈值异常
- `invalid_value`：值无效

### 3. 重复采样瓶明细

```bash
python3 main.py duplicates -b batch_001
```

每组重复瓶会列出：站位+瓶号、重复次数、所有关联记录ID、采样时间。

### 4. 改判追溯链

```bash
# 查看某条记录的所有改判历史
python3 main.py chain -r rec_008
```

每条改判记录包含：评审ID、评审人、时间、状态、失败原因、原始值、改判值、理由、来源。

### 5. 完整接口返回文件

所有清洗结果以 JSON 格式保存在 [output/](file:///Users/maca/pro/solo/workspaces/zy73155/output) 目录下，文件名即批次ID。

返回结构：
```json
{
  "batch_id": "批次ID",
  "sample_file": "样例文件名",
  "run_time": "运行时间",
  "summary": { ... 汇总数据 ... },
  "records": [ ... 每条记录的清洗结果 ... ],
  "anomaly_details": [ ... 所有异常明细 ... ],
  "duplicate_details": [ ... 所有重复瓶明细 ... ]
}
```

## 五、代码位置速查

| 功能 | 文件 |
|------|------|
| 数据模型 | [deep_sea_cleaner/models.py](file:///Users/maca/pro/solo/workspaces/zy73155/deep_sea_cleaner/models.py) |
| 清洗引擎（经纬度/单位/阈值） | [deep_sea_cleaner/cleaner.py](file:///Users/maca/pro/solo/workspaces/zy73155/deep_sea_cleaner/cleaner.py) |
| 脏数据检测（重复瓶等） | [deep_sea_cleaner/detector.py](file:///Users/maca/pro/solo/workspaces/zy73155/deep_sea_cleaner/detector.py) |
| 人工改判追踪 | [deep_sea_cleaner/review_tracker.py](file:///Users/maca/pro/solo/workspaces/zy73155/deep_sea_cleaner/review_tracker.py) |
| 汇总报表 | [deep_sea_cleaner/reporter.py](file:///Users/maca/pro/solo/workspaces/zy73155/deep_sea_cleaner/reporter.py) |
| 主入口 | [main.py](file:///Users/maca/pro/solo/workspaces/zy73155/main.py) |

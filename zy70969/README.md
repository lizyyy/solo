# 园林养护药剂喷洒作业管理系统

## 项目概述

解决园林项目药剂喷洒数据导入混乱问题，实现：
- 作业记录自动校验（风速限制、用量超标、安全间隔）
- 结果分类返回（正常、待确认、失败、重复）
- 失败记录保留原始数据和处理建议
- 同一批材料重复提交不重复生效
- 单条记录可追踪到最终报告

## 快速开始

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 启动服务
```bash
# 方式1
uvicorn main:app --reload

# 方式2
python main.py
```

服务启动后访问：
- API 文档：http://localhost:8000/docs
- 根路径：http://localhost:8000

### 3. 运行演示脚本
```bash
# 新终端执行
python quick_start.py
```

## 核心功能

### 1. 数据导入

#### 导入药剂库存（JSON）
```bash
curl -X POST "http://localhost:8000/api/chemicals/import" \
  -F "file=@sample_data/chemicals.json"
```

#### 导入天气记录（JSON）
```bash
curl -X POST "http://localhost:8000/api/weather/import" \
  -F "file=@sample_data/weather.json"
```

#### 上传作业记录（CSV）
```bash
curl -X POST "http://localhost:8000/api/spray/upload" \
  -F "file=@sample_data/spray_records.csv"
```

### 2. 验证规则

| 规则类型 | 说明 | 判定标准 |
|---------|------|---------|
| 风速限制 | 检查喷洒时风速是否超过药剂限制 | 实际风速 > 药剂风速限制 |
| 用量超标 | 检查药剂用量是否超过标准 | 用量 > 上限×1.2 标记为失败<br/>用量 > 上限 标记为待确认 |
| 安全间隔 | 检查同一区域同一药剂喷洒间隔 | 距上次喷洒天数 < 最小间隔天数 |

### 3. 结果分类

- **正常（normal）**：所有规则通过
- **待确认（confirm）**：存在违规但不严重，需主管确认
- **失败（failed）**：严重违规，必须修正
- **重复（duplicate）**：已存在相同记录，不重复生效

### 4. 追踪查询

#### 查看所有批次
```bash
curl "http://localhost:8000/api/batches"
```

#### 查看批次处理报告
```bash
# JSON格式
curl "http://localhost:8000/api/report/{batch_no}"

# 纯文本格式
curl "http://localhost:8000/api/report/{batch_no}/text"
```

#### 查看单条记录详情
```bash
curl "http://localhost:8000/api/records/{record_id}"
```

## 数据格式说明

### 药剂库存 JSON 字段
| 字段 | 类型 | 说明 |
|------|------|------|
| chemical_code | string | 药剂编码（唯一） |
| name | string | 药剂名称 |
| max_dosage_per_100m2 | float | 每100平方米最大用量（g） |
| min_interval_days | int | 最小安全间隔（天） |
| wind_speed_limit | float | 风速限制（m/s） |
| hazard_level | string | 危害等级 |
| notes | string | 备注 |

### 天气记录 JSON 字段
| 字段 | 类型 | 说明 |
|------|------|------|
| weather_code | string | 天气编码（唯一） |
| record_date | string | 记录日期（YYYY-MM-DD） |
| wind_speed | float | 风速（m/s） |
| temperature | float | 温度（℃） |
| humidity | float | 湿度（%） |
| rainfall | float | 降雨量（mm） |
| weather_condition | string | 天气状况 |

### 作业记录 CSV 字段
| 字段 | 类型 | 说明 |
|------|------|------|
| chemical_code | string | 药剂编码 |
| area_code | string | 区域编码 |
| spray_date | string | 喷洒日期（YYYY-MM-DD） |
| dosage | float | 用量（g/100㎡） |
| operator | string | 操作人员 |
| weather_code | string | 对应天气编码 |

## 项目结构

```
.
├── main.py              # FastAPI 主入口
├── models.py            # 数据库模型
├── schemas.py           # Pydantic 数据结构
├── services.py          # 业务逻辑服务
├── rules.py             # 规则验证引擎
├── database.py          # 数据库配置
├── requirements.txt     # 依赖列表
├── quick_start.py       # 快速演示脚本
├── sample_data/         # 示例数据
│   ├── chemicals.json
│   ├── weather.json
│   └── spray_records.csv
└── lawn_care.db         # SQLite数据库（运行后生成）
```

## 复跑说明

### 完整复现步骤
```bash
# 1. 清理旧数据库
rm -f lawn_care.db

# 2. 安装依赖
pip install -r requirements.txt

# 3. 启动服务
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 4. 新终端运行演示
python quick_start.py
```

### 验证去重功能
```bash
# 运行两次演示脚本，第二次会显示重复记录
python quick_start.py
python quick_start.py
```

### 验证追踪功能
1. 运行演示脚本后，访问 http://localhost:8000/docs
2. 调用 GET /api/batches 获取批次列表
3. 调用 GET /api/report/{batch_no}/text 查看完整报告
4. 调用 GET /api/records/1 查看单条记录的完整信息链

## 排查路径

单条记录 → 对应批次 → 批次报告

```
GET /api/records/{id}
    ↓ 包含 batch_no
GET /api/report/{batch_no}/text
    ↓ 查看该批次所有问题记录和处理建议
```

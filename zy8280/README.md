# Lab Guardian - 实验室传感器数据复核工具

一个用于实验室安全员批量复核传感器和手工记录中单位与阈值的科学计算小工具。

## 功能特性

- **单位归一化**: 支持浓度、压力、温度、流量等多种量纲的单位转换
- **智能别名**: 自动识别不同书写格式的单位别名（如 mg/l, MG/L, milligram per liter）
- **阈值判定**: 支持正常、预警、超限三级状态判定
- **错误处理**: 遇到未知单位、量纲不匹配或阈值区间反写时给出清晰错误
- **多接口**: 提供 CLI 命令行工具和 FastAPI REST 接口
- **多格式导出**: 支持导出 Markdown 报告和 CSV 明细

## 支持的单位转换

### 浓度 (concentration)
- mg/L ↔ μg/mL ↔ mg/dm3 ↔ g/L ↔ g/m3 ↔ μg/L ↔ ppm ↔ ppb

### 压力 (pressure)
- kPa ↔ bar ↔ MPa ↔ Pa ↔ atm ↔ psi ↔ mmHg

### 温度 (temperature)
- °C ↔ K ↔ °F (支持偏移量转换)

### 流量 (flow)
- m3/h ↔ L/min ↔ L/s ↔ m3/min ↔ m3/s

### 质量和体积
- 质量: kg ↔ g ↔ mg ↔ μg ↔ lb ↔ oz
- 体积: L ↔ m3 ↔ mL ↔ cm3 ↔ dm3

## 安装

```bash
# 安装依赖
pip install -r requirements.txt
```

## 数据文件格式

### samples.csv (样本数据)
```csv
id,parameter,value,unit,source
S001,temperature,25,°C,sensor
S002,pressure,101.325,kPa,sensor
S003,concentration,5.0,mg/L,manual
```

### unit_aliases.yaml (单位别名)
```yaml
concentration:
  mg/L:
    - mg/l
    - MG/L
    - milligram per liter
pressure:
  kPa:
    - kpa
    - kilopascal
```

### thresholds.json (阈值配置)
```json
{
  "temperature": {
    "target_unit": "°C",
    "ranges": [
      { "status": "normal", "min": 15.0, "max": 30.0 },
      { "status": "warning", "min": 30.0, "max": 40.0 },
      { "status": "critical", "min": 40.0, "max": 1000.0 }
    ]
  }
}
```

## CLI 使用方法

### validate - 验证数据

验证数据完整性和格式正确性：

```bash
python cli.py validate --samples samples.csv --aliases unit_aliases.yaml --thresholds thresholds.json
```

**选项：**
- `--samples, -s`: 样本数据CSV文件（必需）
- `--aliases, -a`: 单位别名YAML文件（可选）
- `--thresholds, -t`: 阈值配置JSON文件（可选）

### analyze - 分析数据

分析数据并判定状态：

```bash
python cli.py analyze --samples samples.csv --aliases unit_aliases.yaml --thresholds thresholds.json --output results.json
```

**选项：**
- `--samples, -s`: 样本数据CSV文件（必需）
- `--aliases, -a`: 单位别名YAML文件（可选）
- `--thresholds, -t`: 阈值配置JSON文件（可选）
- `--output, -o`: 输出JSON结果文件（可选）

### export - 导出结果

导出分析结果为Markdown报告和CSV明细：

```bash
python cli.py export --samples samples.csv --aliases unit_aliases.yaml --thresholds thresholds.json --markdown report.md --csv results.csv
```

**选项：**
- `--samples, -s`: 样本数据CSV文件（必需）
- `--aliases, -a`: 单位别名YAML文件（可选）
- `--thresholds, -t`: 阈值配置JSON文件（可选）
- `--markdown, -m`: 输出Markdown报告文件（可选）
- `--csv, -c`: 输出CSV明细文件（可选）

## FastAPI 接口

### 启动服务

```bash
# 直接运行
python api.py

# 或使用 uvicorn
uvicorn api:app --reload --host 0.0.0.0 --port 8000
```

### API 文档

启动后访问：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 接口列表

#### 1. 健康检查

```http
GET /health
```

**响应示例：**
```json
{
  "status": "healthy",
  "version": "0.1.0"
}
```

#### 2. 分析数据 (JSON格式)

```http
POST /api/analyze
Content-Type: application/json
```

**请求示例：**
```json
{
  "samples": [
    {
      "id": "S001",
      "parameter": "temperature",
      "value": 25,
      "unit": "°C",
      "source": "sensor"
    },
    {
      "id": "S002",
      "parameter": "temperature",
      "value": 300,
      "unit": "K",
      "source": "sensor"
    }
  ],
  "thresholds": {
    "temperature": {
      "target_unit": "°C",
      "ranges": [
        { "status": "normal", "min": 15, "max": 30 },
        { "status": "warning", "min": 30, "max": 40 },
        { "status": "critical", "min": 40, "max": 1000 }
      ]
    }
  }
}
```

**响应示例：**
```json
{
  "statistics": {
    "total": 2,
    "by_status": {
      "normal": 2
    },
    "by_parameter": {
      "temperature": {
        "count": 2,
        "by_status": {
          "normal": 2
        }
      }
    },
    "by_source": {
      "sensor": {
        "count": 2,
        "by_status": {
          "normal": 2
        }
      }
    }
  },
  "results": [
    {
      "id": "S001",
      "parameter": "temperature",
      "original_value": 25,
      "original_unit": "°C",
      "normalized_value": 25,
      "target_unit": "°C",
      "status": "normal",
      "message": "Value 25.0000 °C in normal range",
      "source": "sensor"
    },
    {
      "id": "S002",
      "parameter": "temperature",
      "original_value": 300,
      "original_unit": "K",
      "normalized_value": 26.85,
      "target_unit": "°C",
      "status": "normal",
      "message": "Value 26.8500 °C in normal range",
      "source": "sensor"
    }
  ]
}
```

#### 3. 分析数据 (文件上传)

```http
POST /api/analyze/files
Content-Type: multipart/form-data
```

**参数：**
- `samples`: CSV样本文件（必需）
- `aliases`: YAML单位别名文件（可选）
- `thresholds`: JSON阈值配置文件（必需）

### CURL 演示

#### 1. 健康检查

```bash
curl http://localhost:8000/health
```

#### 2. 使用JSON数据进行分析

```bash
curl -X POST http://localhost:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "samples": [
      {"id": "S001", "parameter": "temperature", "value": 25, "unit": "°C", "source": "sensor"},
      {"id": "S002", "parameter": "temperature", "value": 100, "unit": "°C", "source": "sensor"},
      {"id": "S003", "parameter": "pressure", "value": 200, "unit": "kPa", "source": "manual"}
    ],
    "thresholds": {
      "temperature": {
        "target_unit": "°C",
        "ranges": [
          {"status": "normal", "min": 15, "max": 30},
          {"status": "warning", "min": 30, "max": 40},
          {"status": "critical", "min": 40, "max": 1000}
        ]
      },
      "pressure": {
        "target_unit": "kPa",
        "ranges": [
          {"status": "normal", "min": 90, "max": 120},
          {"status": "warning", "min": 120, "max": 150},
          {"status": "critical", "min": 150, "max": 10000}
        ]
      }
    }
  }'
```

#### 3. 上传文件进行分析

```bash
curl -X POST http://localhost:8000/api/analyze/files \
  -F "samples=@samples.csv" \
  -F "aliases=@unit_aliases.yaml" \
  -F "thresholds=@thresholds.json"
```

## 错误处理

系统会清晰地报告以下错误情况：

1. **未知单位**:
   ```
   Unknown unit: 'xyz'. No conversion available.
   ```

2. **量纲不匹配**:
   ```
   Dimension mismatch: Cannot convert mg/L (concentration) to kPa (pressure)
   ```

3. **阈值区间反写**:
   ```
   Invalid threshold range for 'temperature': min (100) > max (0)
   ```

4. **缺失配置**:
   ```
   Missing 'target_unit' for parameter 'temperature'
   Missing 'ranges' for parameter 'temperature'
   ```

## 示例运行

```bash
# 1. 验证示例数据
python cli.py validate -s samples.csv -a unit_aliases.yaml -t thresholds.json

# 2. 分析数据并输出JSON
python cli.py analyze -s samples.csv -a unit_aliases.yaml -t thresholds.json -o results.json

# 3. 导出Markdown报告和CSV明细
python cli.py export -s samples.csv -a unit_aliases.yaml -t thresholds.json -m report.md -c results.csv

# 4. 查看生成的文件
cat report.md
cat results.csv
```

## 项目结构

```
lab-guardian/
├── lab_guardian/
│   ├── __init__.py
│   └── core.py           # 核心逻辑：单位转换、阈值判定
├── cli.py                # 命令行接口
├── api.py                # FastAPI接口
├── requirements.txt      # 依赖文件
├── samples.csv           # 示例样本数据
├── unit_aliases.yaml     # 示例单位别名配置
├── thresholds.json       # 示例阈值配置
└── README.md             # 本文档
```

## 许可证

MIT License

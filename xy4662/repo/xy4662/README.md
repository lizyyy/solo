# 水质检测数据管理 API 服务

本地 REST API 服务，用于小型水质检测站数据管理，支持送检水样、采样点、仪器读数和复检备注的导入、查询、修复和导出。

## 功能特性

- **幂等导入**: 支持反复上传同一批或部分重叠文件，通过批次号、样品瓶码和行内容指纹保证幂等
- **脏行隔离**: 验证失败的记录不会混进正式结果，隔离记录包含原因、原文件和行号
- **SQLite 持久化**: 所有数据本地存储，无需额外数据库服务
- **人工修复**: 支持标记隔离记录为已修复，重新计算风险等级
- **数据导出**: 支持导出 clean.csv、rejects.json 和 Markdown 交接报告
- **查询接口**: 完整的查询 API，支持查询重复记录、隔离记录等

## 快速开始

### 环境要求

- Node.js 16+
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动

### 开发模式（自动重启）

```bash
npm run dev
```

## API 文档

### 健康检查

```bash
curl http://localhost:3000/health
```

### 数据导入

支持导入以下类型的数据：
- `water_sample` - 送检水样
- `instrument_reading` - 仪器读数
- `recheck_note` - 复检备注
- `sampling_point` - 采样点
- `instrument` - 仪器信息

#### 导入采样点

```bash
curl -X POST http://localhost:3000/api/import/sampling_point \
  -F "file=@./test-data/sampling_points.csv" \
  -F "batchNumber=BATCH-2024-05-01"
```

#### 导入仪器信息

```bash
curl -X POST http://localhost:3000/api/import/instrument \
  -F "file=@./test-data/instruments.csv" \
  -F "batchNumber=BATCH-2024-05-01"
```

#### 导入有效水样数据

```bash
curl -X POST http://localhost:3000/api/import/water_sample \
  -F "file=@./test-data/water_samples_valid.csv" \
  -F "batchNumber=BATCH-2024-05-01"
```

#### 导入包含错误的水样数据（测试隔离功能）

```bash
curl -X POST http://localhost:3000/api/import/water_sample \
  -F "file=@./test-data/water_samples_with_errors.csv" \
  -F "batchNumber=BATCH-2024-05-02"
```

#### 导入仪器读数

```bash
curl -X POST http://localhost:3000/api/import/instrument_reading \
  -F "file=@./test-data/instrument_readings.csv" \
  -F "batchNumber=BATCH-2024-05-01"
```

#### 导入复检备注

```bash
curl -X POST http://localhost:3000/api/import/recheck_note \
  -F "file=@./test-data/recheck_notes.csv" \
  -F "batchNumber=BATCH-2024-05-01"
```

### 查询接口

#### 获取所有批次

```bash
curl http://localhost:3000/api/batches
```

#### 查询水样记录

```bash
# 查询所有水样
curl http://localhost:3000/api/samples

# 按批次号查询
curl "http://localhost:3000/api/samples?batchNumber=BATCH-2024-05-01"

# 按瓶码查询
curl "http://localhost:3000/api/samples?bottleCode=B001"
```

#### 查询仪器读数

```bash
# 查询所有读数
curl http://localhost:3000/api/readings

# 按读数类型查询
curl "http://localhost:3000/api/readings?readingType=pH"
```

#### 查询复检记录

```bash
curl http://localhost:3000/api/rechecks
```

#### 查询采样点

```bash
curl http://localhost:3000/api/sampling-points
```

#### 查询仪器信息

```bash
curl http://localhost:3000/api/instruments
```

#### 查询隔离记录

```bash
# 查询所有隔离记录
curl http://localhost:3000/api/rejected

# 按批次查询
curl "http://localhost:3000/api/rejected?batchNumber=BATCH-2024-05-02"

# 按风险等级查询
curl "http://localhost:3000/api/rejected?riskLevel=high"

# 按处理状态查询
curl "http://localhost:3000/api/rejected?isFixed=false"

# 按ID查询单条隔离记录详情
curl http://localhost:3000/api/rejected/<rejected_id>
```

#### 查询重复记录

```bash
# 查询所有重复记录
curl http://localhost:3000/api/duplicates

# 按批次查询
curl "http://localhost:3000/api/duplicates?batchNumber=BATCH-2024-05-01"
```

#### 获取统计信息

```bash
curl http://localhost:3000/api/statistics
```

### 修复和风险重算接口

#### 标记隔离记录为已修复

```bash
curl -X PUT http://localhost:3000/api/rejected/<rejected_id>/mark-fixed \
  -H "Content-Type: application/json" \
  -d '{
    "fixedContent": "{\"sample_code\":\"S005\",\"bottle_code\":\"B005\",\"sampling_point_code\":\"SP002\",\"sampling_time\":\"2024-05-02 09:15:00\",\"collector\":\"钱七\",\"sample_type\":\"地表水\",\"temperature\":\"23.1\",\"ph\":\"7.5\"}",
    "fixedBy": "管理员",
    "notes": "修正了采样时间格式"
  }'
```

#### 重新计算风险等级

```bash
# 自动重新计算
curl -X PUT http://localhost:3000/api/rejected/<rejected_id>/recalculate-risk \
  -H "Content-Type: application/json" \
  -d '{"assessedBy": "管理员"}'

# 人工指定风险等级
curl -X PUT http://localhost:3000/api/rejected/<rejected_id>/recalculate-risk \
  -H "Content-Type: application/json" \
  -d '{
    "manualOverride": true,
    "riskLevel": "low",
    "riskScore": 1,
    "assessedBy": "管理员",
    "notes": "人工评估为低风险"
  }'
```

#### 处理已修复的记录（导入到正式数据）

```bash
curl -X POST http://localhost:3000/api/rejected/<rejected_id>/process
```

#### 查询风险评估历史

```bash
curl http://localhost:3000/api/rejected/<rejected_id>/risk-history
```

#### 批量重新计算风险

```bash
curl -X POST http://localhost:3000/api/rejected/bulk-recalculate-risk \
  -H "Content-Type: application/json" \
  -d '{
    "riskLevel": "high",
    "batchNumber": "BATCH-2024-05-02"
  }'
```

### 导出接口

#### 导出 clean.csv（有效数据）

```bash
# JSON 格式
curl http://localhost:3000/api/export/clean

# CSV 格式（直接下载）
curl "http://localhost:3000/api/export/clean?format=csv" -o clean.csv

# 按批次导出
curl "http://localhost:3000/api/export/clean?batchNumber=BATCH-2024-05-01&format=csv" -o clean_batch1.csv
```

#### 导出 rejects.json（隔离记录）

```bash
# 导出所有隔离记录
curl http://localhost:3000/api/export/rejects -o rejects.json

# 按批次导出
curl "http://localhost:3000/api/export/rejects?batchNumber=BATCH-2024-05-02" -o rejects_batch2.json

# 按风险等级导出
curl "http://localhost:3000/api/export/rejects?riskLevel=high" -o rejects_high_risk.json
```

#### 导出 Markdown 交接报告

```bash
# Markdown 格式
curl http://localhost:3000/api/export/report -o report.md

# HTML 格式
curl "http://localhost:3000/api/export/report?format=html" -o report.html

# 按批次生成报告
curl "http://localhost:3000/api/export/report?batchNumber=BATCH-2024-05-01" -o report_batch1.md
```

## 完整 curl 验证链

以下是一个完整的测试流程，演示所有核心功能：

### 步骤 1: 启动服务并检查健康状态

```bash
# 启动服务（新终端窗口）
npm start

# 检查健康状态
curl http://localhost:3000/health
```

### 步骤 2: 导入基础数据（采样点、仪器）

```bash
# 导入采样点
curl -X POST http://localhost:3000/api/import/sampling_point \
  -F "file=@./test-data/sampling_points.csv" \
  -F "batchNumber=SETUP-2024-001"

# 导入仪器信息
curl -X POST http://localhost:3000/api/import/instrument \
  -F "file=@./test-data/instruments.csv" \
  -F "batchNumber=SETUP-2024-001"
```

### 步骤 3: 导入第一批水样数据

```bash
curl -X POST http://localhost:3000/api/import/water_sample \
  -F "file=@./test-data/water_samples_valid.csv" \
  -F "batchNumber=BATCH-2024-05-01"
```

### 步骤 4: 验证幂等性（重复导入相同文件）

```bash
# 再次导入相同文件，应该显示重复记录
curl -X POST http://localhost:3000/api/import/water_sample \
  -F "file=@./test-data/water_samples_valid.csv" \
  -F "batchNumber=BATCH-2024-05-01"
```

### 步骤 5: 导入包含错误的数据（测试隔离功能）

```bash
curl -X POST http://localhost:3000/api/import/water_sample \
  -F "file=@./test-data/water_samples_with_errors.csv" \
  -F "batchNumber=BATCH-2024-05-02"
```

### 步骤 6: 查询隔离记录

```bash
# 查看所有隔离记录
curl http://localhost:3000/api/rejected

# 查看高风险隔离记录
curl "http://localhost:3000/api/rejected?riskLevel=high"
```

### 步骤 7: 导入仪器读数和复检记录

```bash
# 导入仪器读数
curl -X POST http://localhost:3000/api/import/instrument_reading \
  -F "file=@./test-data/instrument_readings.csv" \
  -F "batchNumber=BATCH-2024-05-01"

# 导入复检记录
curl -X POST http://localhost:3000/api/import/recheck_note \
  -F "file=@./test-data/recheck_notes.csv" \
  -F "batchNumber=BATCH-2024-05-01"
```

### 步骤 8: 查询统计信息

```bash
curl http://localhost:3000/api/statistics
```

### 步骤 9: 修复并处理隔离记录

```bash
# 1. 首先获取隔离记录ID
REJECTED_ID=$(curl -s "http://localhost:3000/api/rejected?batchNumber=BATCH-2024-05-02" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

echo "隔离记录ID: $REJECTED_ID"

# 2. 标记为已修复（需要替换 <REJECTED_ID> 为实际ID）
curl -X PUT http://localhost:3000/api/rejected/<REJECTED_ID>/mark-fixed \
  -H "Content-Type: application/json" \
  -d '{
    "fixedBy": "测试员",
    "notes": "人工审核通过"
  }'

# 3. 处理已修复的记录（导入正式数据）
curl -X POST http://localhost:3000/api/rejected/<REJECTED_ID>/process
```

### 步骤 10: 导出数据

```bash
# 导出有效数据
curl "http://localhost:3000/api/export/clean?format=csv" -o clean_data.csv

# 导出隔离记录
curl http://localhost:3000/api/export/rejects -o rejects.json

# 生成交接报告
curl http://localhost:3000/api/export/report -o handover_report.md
curl "http://localhost:3000/api/export/report?format=html" -o handover_report.html
```

### 步骤 11: 验证查询功能

```bash
# 查询水样
curl "http://localhost:3000/api/samples?batchNumber=BATCH-2024-05-01"

# 查询仪器读数
curl http://localhost:3000/api/readings

# 查询重复记录
curl http://localhost:3000/api/duplicates

# 查询批次
curl http://localhost:3000/api/batches
```

## 数据格式说明

### 水样数据 (water_sample) CSV 格式

| 字段名 | 说明 | 示例 |
|--------|------|------|
| sample_code | 样品编号 | S001 |
| bottle_code | 样品瓶码（必填） | B001 |
| sampling_point_code | 采样点编码 | SP001 |
| sampling_time | 采样时间 | 2024-05-01 08:30:00 |
| collector | 采集人 | 张三 |
| sample_type | 样品类型 | 地表水 |
| temperature | 温度(°C) | 22.5 |
| ph | pH值(0-14) | 7.2 |

### 仪器读数 (instrument_reading) CSV 格式

| 字段名 | 说明 | 示例 |
|--------|------|------|
| bottle_code | 样品瓶码 | B001 |
| instrument_code | 仪器编码 | INS001 |
| reading_type | 读数类型（必填） | pH |
| reading_value | 读数值（必填） | 7.2 |
| reading_unit | 单位 | NTU |
| reading_time | 读数时间 | 2024-05-01 09:00:00 |
| operator | 操作员 | 技术员A |

### 复检记录 (recheck_note) CSV 格式

| 字段名 | 说明 | 示例 |
|--------|------|------|
| bottle_code | 样品瓶码 | B001 |
| recheck_reason | 复检原因（必填） | pH值接近临界值 |
| recheck_operator | 复检操作员 | 质检员A |
| recheck_time | 复检时间 | 2024-05-02 14:00:00 |
| original_value | 原始值 | 7.2 |
| recheck_value | 复检值 | 7.25 |
| conclusion | 结论 | 结果正常 |

### 采样点 (sampling_point) CSV 格式

| 字段名 | 说明 | 示例 |
|--------|------|------|
| point_code | 采样点编码（必填） | SP001 |
| point_name | 采样点名称 | 城东取水口 |
| location | 位置 | 长江东路123号 |
| description | 描述 | 主要城市饮用水取水点 |

### 仪器 (instrument) CSV 格式

| 字段名 | 说明 | 示例 |
|--------|------|------|
| instrument_code | 仪器编码（必填） | INS001 |
| instrument_name | 仪器名称 | pH检测仪 |
| model | 型号 | PH-2024 |
| last_calibration | 上次校准日期 | 2024-01-15 |
| status | 状态 | active |

## 项目结构

```
water-quality-api/
├── data/                    # SQLite 数据库存储目录
├── src/
│   ├── app.js              # 主应用入口
│   ├── database.js         # 数据库配置和模型
│   ├── utils.js            # 工具函数（哈希、验证）
│   ├── importService.js    # 导入服务
│   ├── queryService.js     # 查询服务
│   ├── fixService.js       # 修复和风险重算服务
│   └── exportService.js    # 导出服务
├── test-data/              # 测试数据文件
│   ├── sampling_points.csv
│   ├── instruments.csv
│   ├── water_samples_valid.csv
│   ├── water_samples_with_errors.csv
│   ├── instrument_readings.csv
│   └── recheck_notes.csv
├── package.json
└── README.md
```

## 数据库表结构

### 核心业务表

- `batches` - 批次信息
- `water_samples` - 水样记录
- `instrument_readings` - 仪器读数
- `recheck_notes` - 复检记录
- `sampling_points` - 采样点
- `instruments` - 仪器信息

### 系统支撑表

- `record_hashes` - 记录哈希（用于幂等检查）
- `rejected_records` - 隔离记录
- `duplicate_records` - 重复记录日志
- `risk_assessments` - 风险评估历史

## 风险等级说明

系统自动评估隔离记录的风险等级：

| 等级 | 分数范围 | 说明 |
|------|----------|------|
| low | 0-2 | 低风险，格式问题为主 |
| medium | 3-5 | 中风险，数值问题 |
| high | 6+ | 高风险，缺失关键数据 |
| unknown | - | 未评估 |

## 注意事项

1. **幂等性**: 系统通过 SHA256 哈希值检测重复记录，相同内容重复导入会被自动跳过
2. **隔离机制**: 验证失败的记录会被隔离到 `rejected_records` 表，不会污染正式数据
3. **数据修复**: 隔离记录需要先标记为已修复，然后才能处理导入正式数据
4. **风险评估**: 风险等级可以自动计算或人工覆盖
5. **数据导出**: 导出接口支持多种格式，便于数据交接和审计

## 许可证

MIT License

# 机务工具间管理 REST API

本地 REST API 服务，用于航线维修前的工卡、工具借出归还、扭矩扳手校准证书和航材批次表的复核管理。

## 功能特性

- **数据导入**: 支持 CSV/JSON 格式导入工卡、工具、校准证书、航材批次表
- **工具管理**: 借出、归还、改判记录
- **风险预警**:
  - 检测未校准/过期工具
  - 检测同一工具挂在两张工卡（双重借出）
  - 检测航材批号和机尾号不匹配
- **导出功能**:
  - Markdown 格式交班单
  - JSON 格式审计包
- **SQLite 本地存储**: 无需数据库服务器

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python app.py
```

服务将在 `http://127.0.0.1:5000` 启动。

### 3. 健康检查

```bash
curl http://127.0.0.1:5000/api/health
```

## API 接口文档

### 数据导入接口

#### 导入工卡 (CSV)

```bash
curl -X POST http://127.0.0.1:5000/api/import/csv \
  -H "Content-Type: application/json" \
  -d '{
    "file_path": "'"$(pwd)/sample_data/work_cards.csv"'",
    "type": "work_cards"
  }'
```

CSV 格式:
```csv
card_number,title,aircraft_registration,status
WC-2026-001,B-737NG 左发燃油滤更换,B-5521,active
```

#### 导入工具 (CSV)

```bash
curl -X POST http://127.0.0.1:5000/api/import/csv \
  -H "Content-Type: application/json" \
  -d '{
    "file_path": "'"$(pwd)/sample_data/tools.csv"'",
    "type": "tools"
  }'
```

CSV 格式:
```csv
tool_number,name,category,location,status
TW-001,扭矩扳手 10-100N·m,Torque Wrench,工具柜 A-01,available
```

#### 导入工具 (JSON)

```bash
curl -X POST http://127.0.0.1:5000/api/import/json \
  -H "Content-Type: application/json" \
  -d '{
    "file_path": "'"$(pwd)/sample_data/tools.json"'",
    "type": "tools"
  }'
```

#### 导入校准证书

```bash
curl -X POST http://127.0.0.1:5000/api/import/csv \
  -H "Content-Type: application/json" \
  -d '{
    "file_path": "'"$(pwd)/sample_data/calibrations.csv"'",
    "type": "calibrations"
  }'
```

CSV 格式:
```csv
tool_number,certificate_number,calibration_date,expiry_date,status,calibrated_by
TW-001,CAL-2026-001,2026-01-15,2026-12-31,valid,计量中心 张三
```

#### 导入航材批次表

```bash
curl -X POST http://127.0.0.1:5000/api/import/csv \
  -H "Content-Type: application/json" \
  -d '{
    "file_path": "'"$(pwd)/sample_data/materials.csv"'",
    "type": "materials"
  }'
```

CSV 格式:
```csv
part_number,batch_number,description,quantity,aircraft_registration,expiry_date,status
PN-FUEL-001,BATCH-F2026-001,燃油滤芯,2,B-5521,2027-06-30,available
```

### 核心业务接口

#### 工具借出

```bash
curl -X POST http://127.0.0.1:5000/api/tool/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "tool_number": "TW-001",
    "card_number": "WC-2026-001",
    "checkout_by": "张机务",
    "notes": "左发燃油滤更换用"
  }'
```

**返回示例**:
```json
{
  "success": true,
  "checkout_id": 1,
  "tool_number": "TW-001",
  "card_number": "WC-2026-001",
  "warnings": [],
  "checkout_time": "2026-05-05T10:30:00"
}
```

**警告场景**:
- 如果工具未校准或过期：返回 `calibration_warning`
- 如果工具已在其他工卡借出：返回 `double_booking_warning`

#### 工具归还

```bash
curl -X POST http://127.0.0.1:5000/api/tool/return \
  -H "Content-Type: application/json" \
  -d '{
    "checkout_id": 1,
    "return_by": "张机务",
    "notes": "工具完好，已清洁"
  }'
```

#### 改判借出记录

用于修正错误的借出记录，支持修改备注和状态（如作废）。

```bash
curl -X POST http://127.0.0.1:5000/api/checkout/1/revise \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "修正：实际用于右发",
    "status": "void"
  }'
```

**状态值**: `checked_out`, `returned`, `void`

### 风险计算接口

#### 重算工卡风险

自动检测以下风险因子：
1. **未校准工具** (CRITICAL, +50分)
2. **双重借出** (HIGH, +40分)
3. **过期航材** (HIGH, +30分)

```bash
curl -X POST http://127.0.0.1:5000/api/work-card/1/recalculate-risk \
  -H "Content-Type: application/json" \
  -d '{
    "reviewer": "李质控",
    "notes": "航线维修前复核"
  }'
```

**返回示例**:
```json
{
  "success": true,
  "review_id": 1,
  "risk_analysis": {
    "work_card_id": 1,
    "card_number": "WC-2026-001",
    "risk_score": 50.0,
    "risk_level": "critical",
    "risk_factors": [
      {
        "type": "uncalibrated_tool",
        "tool_number": "TW-003",
        "tool_name": "扭矩扳手 20-200N·m (过期)",
        "message": "Calibration expired on 2025-12-31",
        "severity": "critical"
      }
    ],
    "checked_out_tools": 2
  },
  "review_time": "2026-05-05T10:35:00"
}
```

**风险等级**:
- `critical`: >= 50 分
- `high`: >= 30 分
- `medium`: >= 10 分
- `low`: < 10 分

### 导出接口

#### 导出 Markdown 交班单

```bash
curl http://127.0.0.1:5000/api/work-card/1/export/markdown \
  -o handover-WC-2026-001.md
```

**交班单内容**:
- 工卡基本信息
- 风险评估结果（含风险因子）
- 工具借出记录（含校准状态）
- 关联航材列表
- 生成时间戳

#### 导出 JSON 审计包

```bash
curl http://127.0.0.1:5000/api/work-card/1/export/audit \
  -o audit-WC-2026-001.json
```

**审计包内容**:
- 工卡完整信息
- 所有工具借出记录（含校准历史）
- 所有复核记录（含风险因子）
- 风险摘要统计
- 关联航材信息
- 导出时间戳

### 查询接口

#### 列出所有工卡

```bash
curl http://127.0.0.1:5000/api/work-cards
```

#### 列出所有工具

```bash
curl http://127.0.0.1:5000/api/tools
```

返回包含校准状态：
```json
{
  "tool_number": "TW-001",
  "name": "扭矩扳手 10-100N·m",
  "calibrated": true,
  "status": "available"
}
```

#### 列出借出记录

```bash
# 所有记录
curl http://127.0.0.1:5000/api/checkouts

# 仅当前借出
curl "http://127.0.0.1:5000/api/checkouts?status=checked_out"

# 已归还
curl "http://127.0.0.1:5000/api/checkouts?status=returned"
```

## 完整测试流程

以下是一套完整的 curl 测试命令，可直接复制执行：

```bash
# 1. 健康检查
curl http://127.0.0.1:5000/api/health

# 2. 导入工卡
curl -X POST http://127.0.0.1:5000/api/import/csv \
  -H "Content-Type: application/json" \
  -d '{"file_path":"'"$(pwd)/sample_data/work_cards.csv"'","type":"work_cards"}'

# 3. 导入工具
curl -X POST http://127.0.0.1:5000/api/import/csv \
  -H "Content-Type: application/json" \
  -d '{"file_path":"'"$(pwd)/sample_data/tools.csv"'","type":"tools"}'

# 4. 导入校准证书
curl -X POST http://127.0.0.1:5000/api/import/csv \
  -H "Content-Type: application/json" \
  -d '{"file_path":"'"$(pwd)/sample_data/calibrations.csv"'","type":"calibrations"}'

# 5. 导入航材
curl -X POST http://127.0.0.1:5000/api/import/csv \
  -H "Content-Type: application/json" \
  -d '{"file_path":"'"$(pwd)/sample_data/materials.csv"'","type":"materials"}'

# 6. 借出有效工具 (TW-001 校准有效)
curl -X POST http://127.0.0.1:5000/api/tool/checkout \
  -H "Content-Type: application/json" \
  -d '{"tool_number":"TW-001","card_number":"WC-2026-001","checkout_by":"张机务"}'

# 7. 借出过期工具 (TW-003 校准过期，会返回警告)
curl -X POST http://127.0.0.1:5000/api/tool/checkout \
  -H "Content-Type: application/json" \
  -d '{"tool_number":"TW-003","card_number":"WC-2026-001","checkout_by":"张机务"}'

# 8. 重算风险 (应检测到过期工具)
curl -X POST http://127.0.0.1:5000/api/work-card/1/recalculate-risk \
  -H "Content-Type: application/json" \
  -d '{"reviewer":"李质控"}'

# 9. 借出同一工具到另一工卡 (双重借出警告)
curl -X POST http://127.0.0.1:5000/api/tool/checkout \
  -H "Content-Type: application/json" \
  -d '{"tool_number":"TW-001","card_number":"WC-2026-002","checkout_by":"李机务"}'

# 10. 再次重算风险 (应检测到双重借出)
curl -X POST http://127.0.0.1:5000/api/work-card/1/recalculate-risk \
  -H "Content-Type: application/json" \
  -d '{"reviewer":"李质控"}'

# 11. 归还工具
curl -X POST http://127.0.0.1:5000/api/tool/return \
  -H "Content-Type: application/json" \
  -d '{"checkout_id":1,"return_by":"张机务"}'

# 12. 导出交班单
curl http://127.0.0.1:5000/api/work-card/1/export/markdown \
  -o handover-WC-2026-001.md

# 13. 导出审计包
curl http://127.0.0.1:5000/api/work-card/1/export/audit \
  -o audit-WC-2026-001.json

# 14. 查看借出记录
curl "http://127.0.0.1:5000/api/checkouts?status=checked_out"
```

## 数据库结构

使用 SQLite 数据库 (`maintenance.db`)，包含以下表：

| 表名 | 说明 |
|------|------|
| `work_cards` | 工卡表 |
| `tools` | 工具表 |
| `calibrations` | 校准证书表 |
| `materials` | 航材批次表 |
| `tool_checkouts` | 工具借出记录表 |
| `reviews` | 复核记录表 |

## 风险检测逻辑

### 1. 校准过期检测

- 检查工具的最新校准记录
- 对比当前日期与有效期
- 返回 `Calibration expired on YYYY-MM-DD`

### 2. 双重借出检测

- 检查同一工具是否有多个 `checked_out` 状态的借出记录
- 排除当前记录（用于风险重算）

### 3. 航材过期检测

- 检查航材的有效期
- 关联到对应机尾号的工卡

## 项目结构

```
.
├── app.py              # 主应用 (Flask + 路由)
├── models.py           # 数据模型定义
├── db.py               # 数据库初始化
├── requirements.txt    # Python 依赖
├── sample_data/        # 样例数据
│   ├── work_cards.csv
│   ├── tools.csv
│   ├── tools.json
│   ├── calibrations.csv
│   └── materials.csv
├── maintenance.db      # SQLite 数据库 (运行时生成)
└── README.md           # 本文档
```

## 注意事项

1. **本地服务**: 此服务设计为本地运行，不包含用户认证
2. **文件路径**: 导入接口使用服务器端文件路径，请确保路径正确
3. **日期格式**: 支持多种日期格式 (YYYY-MM-DD, MM/DD/YYYY 等)
4. **风险评分**: 可根据实际需求调整 `calculate_risk` 函数中的权重

## 故障排查

### 导入失败

- 检查 CSV 文件编码 (应为 UTF-8)
- 检查必填字段是否完整
- 检查日期格式是否可解析

### 风险计算异常

- 确认工卡已关联工具借出记录
- 确认工卡 `aircraft_registration` 与航材匹配

### 数据库锁定

- 停止服务后删除 `maintenance.db` 重新初始化
- 或检查是否有其他进程占用数据库文件

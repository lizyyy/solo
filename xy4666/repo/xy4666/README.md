# 纺织品检测实验室 REST API 服务

一个用于纺织品检测实验室的数据管理系统，支持布样登记、色差仪读数、洗涤/摩擦测试记录的导入和管理，特别关注异常样本的处理和追踪。

## 功能特性

- **多格式数据导入**：支持CSV和JSON格式的数据导入
- **异常检测**：自动检测编号异常、读数越界、缺字段等问题
- **完整数据追踪**：正常样本、重复样本和异常样本全部存入数据库
- **异常修复**：支持人工标记修复异常样本
- **风险评估**：自动计算样本风险等级
- **报告导出**：支持Markdown检测报告和JSON审计包导出
- **审计日志**：记录所有重要操作的审计信息

## 项目结构

```
.
├── app.py              # 主应用入口
├── config.py           # 配置文件
├── models.py           # 数据库模型
├── routes.py           # API路由
├── import_service.py   # 数据导入服务
├── report_service.py   # 报告导出服务
├── requirements.txt    # Python依赖
├── textile_lab.db      # SQLite数据库（运行时创建）
└── uploads/            # 上传文件目录（运行时创建）
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python app.py
```

服务将在 `http://localhost:5000` 启动。

### 3. 健康检查

```bash
curl http://localhost:5000/health
```

## API 接口

### 数据导入

#### 1. 导入布样登记 CSV

```bash
# 准备测试数据
cat > registration.csv << 'EOF'
sample_id,sample_name,fabric_type
TF-2024-001,纯棉白布,cotton
TF-2024-002,涤纶混纺,polyester
TF-2024-003,羊毛面料,wool
TF-2024-004,丝绸面料,silk
INVALID,无效编号,test
,缺失编号,test
EOF

# 导入CSV
curl -X POST -F "file=@registration.csv" -F "data_type=registration" \
  http://localhost:5000/api/import/csv
```

#### 2. 导入色差仪读数 JSON

```bash
# 准备测试数据（包含正常和越界数据）
cat > colorimeter.json << 'EOF'
[
  {"sample_id": "TF-2024-001", "delta_e": 2.3, "delta_l": 0.5, "delta_a": 1.2, "delta_b": 1.8},
  {"sample_id": "TF-2024-002", "delta_e": 6.5, "delta_l": 2.1, "delta_a": 4.5, "delta_b": 3.2},
  {"sample_id": "TF-2024-003", "delta_e": 1.5, "delta_l": 0.3, "delta_a": 0.8, "delta_b": 1.0}
]
EOF

# 导入JSON
curl -X POST -F "file=@colorimeter.json" -F "data_type=colorimeter" \
  http://localhost:5000/api/import/json
```

#### 3. 导入摩擦测试记录

```bash
# 准备测试数据
cat > friction.csv << 'EOF'
sample_id,friction_dry_grade,friction_wet_grade
TF-2024-001,4,3
TF-2024-002,2,1
TF-2024-003,5,4
TF-2024-005,0,6
EOF

# 导入CSV
curl -X POST -F "file=@friction.csv" -F "data_type=friction" \
  http://localhost:5000/api/import/csv
```

#### 4. 导入洗涤测试记录

```bash
# 准备测试数据
cat > washing.csv << 'EOF'
sample_id,washing_color_fastness,washing_staining
TF-2024-001,4,3
TF-2024-002,2,2
TF-2024-003,5,4
EOF

# 导入CSV
curl -X POST -F "file=@washing.csv" -F "data_type=washing" \
  http://localhost:5000/api/import/csv
```

#### 5. 导入人工复核备注

```bash
# 准备测试数据
cat > review.csv << 'EOF'
sample_id,review_notes,reviewed_by,reviewed_at
TF-2024-001,经复核，样本质量合格,张三,2024-01-15T10:30:00
TF-2024-002,色差超标，建议重新测试,李四,2024-01-15T11:00:00
EOF

# 导入CSV
curl -X POST -F "file=@review.csv" -F "data_type=review" \
  http://localhost:5000/api/import/csv
```

### 数据查询

#### 1. 查询样本列表

```bash
# 基本查询
curl "http://localhost:5000/api/samples"

# 分页查询
curl "http://localhost:5000/api/samples?page=1&per_page=10"

# 按风险等级筛选
curl "http://localhost:5000/api/samples?risk_level=critical"

# 按样本编号搜索
curl "http://localhost:5000/api/samples?sample_id=TF-2024"
```

#### 2. 查询单个样本详情

```bash
# 通过数据库ID查询
curl "http://localhost:5000/api/samples/1"

# 通过样本编号查询
curl "http://localhost:5000/api/samples/by-code/TF-2024-001"
```

#### 3. 查询异常样本

```bash
# 查询所有异常
curl "http://localhost:5000/api/anomalies"

# 查询待修复异常
curl "http://localhost:5000/api/anomalies?is_fixed=false"

# 查询已修复异常
curl "http://localhost:5000/api/anomalies?is_fixed=true"

# 按异常类型筛选
curl "http://localhost:5000/api/anomalies?anomaly_type=out_of_range"

# 查询单个异常详情
curl "http://localhost:5000/api/anomalies/1"
```

#### 4. 查询重复样本

```bash
# 查询所有重复
curl "http://localhost:5000/api/duplicates"

# 查询待处理重复
curl "http://localhost:5000/api/duplicates?status=pending"
```

#### 5. 获取统计信息

```bash
curl "http://localhost:5000/api/stats"
```

### 数据操作

#### 1. 修复异常样本

```bash
# 先查询待修复异常
curl "http://localhost:5000/api/anomalies?is_fixed=false"

# 修复异常（假设异常ID为1）
curl -X POST -H "Content-Type: application/json" \
  -d '{
    "sample_id": "TF-2024-005",
    "sample_name": "修复后的样本",
    "fix_notes": "人工修正了样本编号",
    "fixed_by": "管理员"
  }' \
  http://localhost:5000/api/anomalies/1/fix
```

#### 2. 解决重复样本

```bash
# 查询待处理重复
curl "http://localhost:5000/api/duplicates?status=pending"

# 合并重复（假设重复ID为1）
curl -X POST -H "Content-Type: application/json" \
  -d '{
    "action": "merge",
    "resolved_by": "管理员",
    "notes": "合并了重复数据，使用最新值"
  }' \
  http://localhost:5000/api/duplicates/1/resolve

# 或者丢弃重复
curl -X POST -H "Content-Type: application/json" \
  -d '{
    "action": "discard",
    "resolved_by": "管理员",
    "notes": "确认是重复导入，丢弃此数据"
  }' \
  http://localhost:5000/api/duplicates/1/resolve
```

#### 3. 重新计算风险

```bash
# 重新计算单个样本风险（假设样本数据库ID为1）
curl -X POST "http://localhost:5000/api/samples/1/recalculate-risk"
```

### 报告导出

#### 1. 导出Markdown检测报告

```bash
# 获取报告内容（包含所有异常样本）
curl "http://localhost:5000/api/reports/markdown"

# 不包含已修复异常
curl "http://localhost:5000/api/reports/markdown?include_all_anomalies=false"

# 下载报告文件
curl -O -J "http://localhost:5000/api/reports/markdown/download"
```

#### 2. 导出JSON审计包

```bash
# 获取审计包内容
curl "http://localhost:5000/api/reports/audit"

# 下载审计包文件
curl -O -J "http://localhost:5000/api/reports/audit/download"
```

## 异常类型说明

系统会检测以下类型的异常：

| 异常类型 | 说明 | 示例 |
|----------|------|------|
| `missing_field` | 缺失必需字段 | 样本编号为空 |
| `invalid_id` | 无效的样本编号 | 包含特殊字符、长度不符合要求 |
| `out_of_range` | 数值越界 | ΔE > 5.0 或 < 0.0，测试等级不在1-5之间 |
| `duplicate` | 重复样本 | 相同编号的样本已存在 |

## 风险评估规则

风险评分基于以下规则计算：

| 条件 | 分值 |
|------|------|
| ΔE ≥ 4.0 | +50 |
| ΔE ≥ 3.0 | +30 |
| ΔE ≥ 2.0 | +10 |
| 干摩擦等级 < 3 | +25 |
| 湿摩擦等级 < 3 | +35 |
| 洗涤色牢度 < 3 | +30 |
| 洗涤沾色 < 3 | +25 |

风险等级：
- **critical (严重)**: 总分 ≥ 70
- **warning (警告)**: 总分 ≥ 40 且 < 70
- **normal (正常)**: 总分 < 40

## 数据类型说明

导入时需要指定数据类型：

| 数据类型 | 说明 | 必需字段 |
|----------|------|----------|
| `registration` | 布样登记 | sample_id |
| `colorimeter` | 色差仪读数 | sample_id, delta_e |
| `friction` | 摩擦测试 | sample_id, friction_dry_grade |
| `washing` | 洗涤测试 | sample_id, washing_color_fastness |
| `review` | 人工复核 | sample_id |

## 测试数据示例

你可以使用以下测试数据来验证系统功能：

### 正常数据示例

**registration.csv:**
```csv
sample_id,sample_name,fabric_type
TF-2024-001,纯棉白布,cotton
TF-2024-002,涤纶混纺,polyester
TF-2024-003,羊毛面料,wool
```

**colorimeter.json:**
```json
[
  {"sample_id": "TF-2024-001", "delta_e": 2.3, "delta_l": 0.5, "delta_a": 1.2, "delta_b": 1.8},
  {"sample_id": "TF-2024-002", "delta_e": 3.8, "delta_l": 2.1, "delta_a": 1.5, "delta_b": 2.2}
]
```

### 异常数据示例

**abnormal_registration.csv:**
```csv
sample_id,sample_name,fabric_type
TF-2024-001,纯棉白布,cotton
INVALID@ID,无效编号,test
,缺失编号,test
TF-2024-002,A,test
```

**abnormal_colorimeter.json:**
```json
[
  {"sample_id": "TF-2024-003", "delta_e": 6.5, "delta_l": 2.1},
  {"sample_id": "TF-2024-004", "delta_e": -1.5}
]
```

## 常见问题

### Q: 异常样本被保存到哪里了？
A: 所有异常样本都保存在 `anomaly_samples` 表中，包含原文件名、行号、原始数据和异常原因，不会被静默丢弃。

### Q: 如何查看所有异常样本？
A: 使用 `GET /api/anomalies` 接口，或在导出的Markdown报告中查看全部异常详情。

### Q: 修复异常后，原始异常记录会被删除吗？
A: 不会。原始异常记录会被保留，只会标记为 `is_fixed=true`，并记录修复信息和关联到新创建的样本。

### Q: 如何自定义风险评估规则？
A: 修改 `import_service.py` 中的 `_calculate_risk` 方法，或调整 `config.py` 中的阈值配置。

## 许可证

本项目仅供内部使用。

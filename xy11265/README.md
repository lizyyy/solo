
# 客服质检系统

针对外包转写文本经常漏掉道歉、退款承诺和敏感词的问题，提供自动化质检、人工复核、汇总导出功能。

## 功能特性

### 核心功能
- **导入功能**: 批量导入转录数据，支持去重和幂等操作
- **扫描质检**: 自动检测转录中的问题
- **人工复核**: 对检测结果进行人工确认
- **汇总统计**: 按时间段、坐席等维度统计
- **数据导出**: 支持CSV/JSON格式导出

### 检测规则
1. **说话人缺失**: 检测说话人信息缺失或数量不足
2. **时间戳重叠**: 检测对话时间戳异常重叠
3. **道歉用语缺失**: 检测客服对话中是否缺少必要的道歉
4. **退款承诺缺失**: 检测有投诉时是否缺少退款承诺
5. **敏感词检测**: 检测对话中的敏感词汇

## 安装

```bash
pip install -r requirements.txt
```

## 使用方法

### 1. 导入转录数据
```bash
python cli.py import sample_data.json --user admin
```

### 2. 扫描质检
```bash
# 扫描所有未扫描的转录
python cli.py scan

# 扫描指定转录
python cli.py scan --transcript-id TRANS_001

# 强制重新扫描
python cli.py scan --transcript-id TRANS_001 --force
```

### 3. 人工复核
```bash
# 复核单个问题（标记为已解决）
python cli.py review --issue-id 1 --resolved --user reviewer --comment "已确认"

# 复核整个转录
python cli.py review --transcript-id TRANS_001 --result confirmed --comment "质检通过"

# 批量复核
python cli.py review --batch '["TRANS_001", "TRANS_002"]' --result confirmed
```

### 4. 汇总统计
```bash
# 整体统计
python cli.py summary

# 指定转录统计
python cli.py summary --transcript-id TRANS_001

# 按时间范围统计
python cli.py summary --start-date 2024-01-01T00:00:00 --end-date 2024-12-31T23:59:59

# 按坐席统计
python cli.py summary --agent-id AGENT_001
```

### 5. 数据导出
```bash
# 导出所有数据为CSV
python cli.py export --format csv --output results.csv

# 导出有问题的记录
python cli.py export --format csv --has-issues True --output issues.csv

# 导出JSON格式问题详情
python cli.py export --format json --transcript-id TRANS_001 --output issues.json
```

### 6. 查看转录详情
```bash
python cli.py show TRANS_001
```

### 7. 规则更新后重新扫描
```bash
python cli.py rescan
```

## 数据模型

### 主要表结构
- **batch_imports**: 导入批次记录
- **transcripts**: 转录主记录
- **utterances**: 单条对话记录
- **quality_rules**: 质检规则配置
- **scan_results**: 扫描结果记录
- **scan_batches**: 扫描批次记录
- **export_records**: 导出记录
- **audit_logs**: 操作审计日志

## 架构说明

### 存储层 (models.py)
- 使用SQLAlchemy ORM
- 支持SQLite数据库
- 完整的审计日志功能

### 规则引擎 (rule_engine.py)
- 可扩展的规则框架
- 支持自定义正则规则
- 规则版本管理

### 业务服务层 (services.py)
- ImportService: 数据导入，保证幂等性
- ScanService: 扫描服务，支持增量和全量
- ReviewService: 复核服务，单个和批量操作
- SummaryService: 统计汇总服务
- ExportService: 数据导出服务

### 命令行接口 (cli.py)
- 完整的CLI操作界面
- 支持所有核心功能

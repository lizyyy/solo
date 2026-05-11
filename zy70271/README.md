# 科研样本伦理到期 CLI

科研样本使用要跟伦理批件、样本用途和到期日期对应，续期经常漏办。这个 CLI 工具解决这个问题。

## 安装运行

```bash
# 安装依赖
pip install -e .

# 验证安装
sample-ethics --help
```

## 样例入口

样例数据在 `examples/` 目录：

```
examples/
├── samples.csv                 # 样本档案
├── samples.json
├── ethics_approvals.csv        # 伦理批件
├── ethics_approvals.json
├── usage_registrations.csv     # 用途登记
├── usage_registrations.json
├── results.csv                 # 结果数据
└── results.json
```

## 核心操作

### 1. 导入样本档案

```bash
sample-ethics import samples examples/samples.csv --batch batch-001
```

### 2. 导入伦理批件

```bash
sample-ethics import ethics examples/ethics_approvals.csv --batch batch-002
```

### 3. 导入用途登记

```bash
sample-ethics import usage examples/usage_registrations.csv --batch batch-003
```

### 4. 导入结果数据

```bash
sample-ethics import results examples/results.csv --batch batch-004
```

### 5. 检查到期情况

```bash
# 检查即将到期（30天内）
sample-ethics check expiring

# 检查即将到期（60天内）并导出报告
sample-ethics check expiring --days 60 --export

# 检查已过期
sample-ethics check expired --export
```

### 6. 查看系统状态

```bash
sample-ethics status

# 导出状态报告
sample-ethics status --export
```

### 7. 导出数据

```bash
# 导出所有数据
sample-ethics export all

# 导出批次处理摘要
sample-ethics export batch batch-001

# 导出状态报告
sample-ethics export report
```

## 检查结果

### 命令输出说明

每次导入会显示：
- 总行数
- 处理成功行数
- 跳过行数及原因
- 需要人工确认的记录

### 输出文件

- 数据库文件：`sample_ethics.db`（当前目录）
- 导出文件：`output/` 目录
  - `samples_*.csv` - 样本数据
  - `ethics_approvals_*.csv` - 伦理批件数据
  - `usage_registrations_*.csv` - 用途登记数据
  - `results_*.csv` - 结果数据
  - `expiring_*.csv/json` - 即将到期报告
  - `expired_*.csv/json` - 已过期报告
  - `status_report_*.csv/json` - 状态报告
  - `batch_*_summary_*.json` - 批次处理摘要

### 重跑同一批数据

使用相同的 `--batch` 名称重跑时，系统会自动检测并跳过，不会重复导入，保证统计和状态一致。

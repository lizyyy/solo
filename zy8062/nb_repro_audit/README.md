# nb_repro_audit

Jupyter Notebook Reproducibility Audit Tool - 本地代码提交前的 notebook 自查工具。

## 功能特性

- **执行顺序解析**: 检测 `execution_count` 乱序、跳跃等问题
- **数据引用扫描**: 解析 notebook 中引用的数据文件，验证是否在 `datasets_manifest.yaml` 中声明
- **路径逃逸检测**: 检测 `../` 等相对路径逃逸模式
- **随机种子识别**: 识别 `np.random.seed()`、`torch.manual_seed()` 等随机种子设置
- **大输出检测**: 检测并清理超过阈值（默认 100KB）的 cell 输出
- **风险评分**: 基于规则引擎生成可执行性风险评分
- **报告导出**: 生成 `audit_report.md` 和 `missing_assets.csv`

## 安装

```bash
pip install -e .
```

或直接使用：

```bash
python -m nb_repro_audit --help
```

## 快速开始

### 审计命令

```bash
python -m nb_repro_audit audit \
    --notebooks-dir ./notebooks \
    --datasets-manifest datasets_manifest.yaml \
    --env-file requirements.txt \
    --output-dir ./audit_output \
    --clean
```

### 预期输出示例

```
Scanning notebooks in: ./notebooks
Output directory: ./audit_output
Found 2 notebook(s)
  Parsing: data_analysis.ipynb
  Scanning dependencies: data_analysis.ipynb
  Parsing: model_training.ipynb
  Scanning dependencies: model_training.ipynb

============================================================
AUDIT RESULTS
============================================================
Total Risk Score: 73/100
Risk Rating: HIGH
Risk Percentage: 73.00%
Total Findings: 8

Scores by Category:
  execution: 30
  output: 15
  path: 12
  reproducibility: 8
  data: 8

Findings by Severity:
  ERROR: 2
  WARNING: 5
  INFO: 1

Cleaning notebooks...
  ✓ Cleaned: ./audit_output/cleaned_notebooks/data_analysis_cleaned.ipynb (1 cells, 200000 bytes removed)
  ✓ Cleaned: ./audit_output/cleaned_notebooks/model_training_cleaned.ipynb (0 cells, 0 bytes removed)

============================================================
⚠️  WARNING: High risk detected! Review findings before submission.
```

### 单独清理命令

```bash
python -m nb_repro_audit clean notebook.ipynb \
    --output-dir ./cleaned \
    --threshold 500
```

### 查看帮助

```bash
python -m nb_repro_audit --help
python -m nb_repro_audit audit --help
```

## 项目结构

```
nb_repro_audit/
├── __init__.py           # 包入口
├── parser.py             # Notebook 解析：执行顺序、大输出、路径逃逸
├── scanner.py            # 依赖/数据引用扫描
├── engine.py             # 规则引擎：风险评分
├── cleaner.py            # 清理大输出、导出 cleaned notebook
├── exporter.py           # 导出 audit_report.md、missing_assets.csv
├── cli.py                # CLI 命令行接口
└── sample_data/          # 示例数据
    ├── notebooks/        # 示例 .ipynb 文件
    ├── datasets/         # 数据文件目录
    ├── datasets_manifest.yaml  # 数据集清单
    └── requirements.txt  # 环境依赖
```

## 已知坑点

### 1. execution_count 乱序

Jupyter notebook 的 `execution_count` 可能因为以下原因出现乱序：

- 手动删除或添加 cell
- 内核重启后继续执行
- 从其他 notebook 复制 cell

工具会检测以下情况并报告：
- 执行序号跳跃（如 1 → 3）
- 执行序号回退（如 4 → 2）

### 2. 相对路径逃逸

检测以下路径逃逸模式：
- `../` 逃逸到父目录
- `/absolutepath` 绝对路径
- Windows 盘符路径如 `C:\`

## 风险评分说明

| 评分范围 | 风险等级 | 说明 |
|---------|---------|------|
| 0-20%   | LOW     | 可安全提交 |
| 20-50%  | MEDIUM  | 建议检查警告 |
| 50-75%  | HIGH    | 需要修复错误 |
| 75-100% | CRITICAL| 禁止提交 |

## 规则列表

| 规则ID | 名称 | 风险等级 | 分数 |
|-------|------|---------|------|
| EXEC001 | 执行顺序错误 | ERROR | 15 |
| EXEC002 | 跳过执行号 | WARNING | 10 |
| EXEC003 | 未执行的 notebook | ERROR | 20 |
| PATH001 | 相对路径逃逸 | WARNING | 12 |
| PATH002 | 绝对路径使用 | WARNING | 8 |
| DATA001 | 缺失数据文件 | ERROR | 18 |
| DATA002 | 未在 manifest 声明 | WARNING | 10 |
| SEED001 | 未设置随机种子 | WARNING | 8 |
| SEED002 | 多个随机种子 | WARNING | 12 |
| OUTPUT001 | 大输出检测 | WARNING | 5 |
| OUTPUT002 | 过大输出 | ERROR | 15 |
| DEPS001 | 未知外部依赖 | WARNING | 7 |
| DEPS002 | 无环境文件 | INFO | 3 |

## 许可证

MIT License

# GitHub Actions 矩阵抖动分析工具

用于分析 GitHub Actions CI 矩阵偶发失败的命令行工具，帮助识别不稳定的矩阵组合。

## 功能特性

- 🔍 **日志解析**: 自动解析 GitHub Actions 日志，提取矩阵参数和失败信息
- 📊 **矩阵聚合**: 按矩阵组合聚合多次运行结果
- 🎯 **抖动评分**: 多维度评分系统（稳定性、一致性、失败模式）
- 🔄 **重跑对比**: 对比多次重跑的状态变化
- 📋 **报告生成**: 生成交互式 HTML 报告和 CSV 导出

## 安装

```bash
pip install -e .
```

依赖:
- Python 3.8+
- click >= 8.0
- jinja2 >= 3.0
- python-dateutil >= 2.8

## 使用方法

### 1. 基本分析

```bash
# 分析单个日志目录
gha-shake analyze ./logs/

# 分析单个日志文件
gha-shake analyze ./job.log

# 生成 CSV 格式报告
gha-shake analyze ./logs/ -o ./reports -f csv

# 显示详细信息
gha-shake analyze ./logs/ -v
```

### 2. 列出矩阵配置

```bash
gha-shake list ./logs/
```

### 3. 查看不稳定组合

```bash
# 默认阈值 60 分
gha-shake unstable ./logs/

# 自定义阈值
gha-shake unstable ./logs/ -t 70
```

## 日志格式要求

工具会自动识别以下格式的日志：

1. **矩阵参数格式**:
   - `matrix: os=ubuntu, python=3.9`
   - `##[set-output name=matrix.os]ubuntu`
   - `MATRIX_OS=ubuntu`

2. **失败标识**:
   - `##[error]`
   - `Error:` / `error:`
   - `FAILED` / `failed`
   - `AssertionError` / `Exception`
   - `exit code 1`

3. **Run ID 识别**:
   - 目录名: `run_12345/`
   - 文件名: `job_run12345_attempt1.log`

## 评分说明

### 评分维度

1. **稳定性 (50%)**: 基于成功率计算
2. **一致性 (30%)**: 基于状态切换频率计算
3. **失败模式 (20%)**: 基于失败类型多样性计算

### 等级划分

- **S (90-100)**: 非常稳定
- **A (80-89)**: 稳定
- **B (70-79)**: 良好
- **C (60-69)**: 需关注
- **D (50-59)**: 不稳定
- **F (0-49)**: 非常不稳定

## 示例数据

项目包含示例日志数据，可直接运行测试：

```bash
gha-shake analyze sample_logs/ -v
```

示例数据包含:
- 3 次运行 (run_12345, run_12346, run_12347)
- 3 个矩阵组合:
  - os=ubuntu, python=3.9 (不稳定，偶发网络超时)
  - os=windows, python=3.9 (中等稳定)
  - os=ubuntu, python=3.10 (完全稳定)

## 模块架构

```
gha_matrix_shake/
├── parser.py       # 日志解析器
├── aggregator.py   # 矩阵聚合器
├── scoring.py      # 抖动评分引擎
├── comparison.py   # 重跑对比模块
├── report.py       # 报告生成器
└── cli.py          # 命令行入口
```

## 输出示例

### HTML 报告

- 汇总卡片：矩阵总数、总运行次数、成功率、不稳定组合数
- 评分排行：按稳定性排序，支持按等级筛选
- 重跑对比：显示每次重跑的状态变化和抖动率
- 失败详情：列出所有失败的具体信息和来源

### 控制台输出

```
🔍 正在解析日志: sample_logs/
✅ 解析完成，共 9 个作业记录
📊 聚合完成，共 3 个矩阵组合
🎉 HTML报告已生成: /path/to/report.html

📋 不稳定组合前10名:
  1. [D] os=ubuntu|python=3.9 - 54.0分
```

## 最佳实践

1. **收集足够数据**: 建议收集至少 5 次重跑的日志以获得可靠评分
2. **结构化日志**: 在 CI 中输出清晰的矩阵参数，便于解析
3. **定期分析**: 将此工具集成到 CI 流程中，定期监控稳定性
4. **关注 F/D 级**: 优先修复 F 和 D 级别的矩阵组合

## License

MIT

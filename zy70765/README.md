# HAR延迟分桶异常样本保留排查CLI

一个用于快速分析HAR文件性能问题的Python命令行工具，帮助研发人员快速定位慢请求所在的域名和资源类型。

## 功能特性

- **HAR文件解析**：完整解析浏览器导出的HAR文件，提取关键性能指标
- **域名聚合统计**：按域名分组统计请求数、延迟分布、状态码分布
- **资源类型统计**：按资源类型(HTML/JS/CSS/图片/字体等)统计性能
- **耗时分桶**：五级分桶(fast/normal/slow/very_slow/extreme)统计
- **异常样本保留**：自动检测异常慢请求，保留原始位置信息
- **来源追踪**：坏行(解析失败的条目)保留原文件位置，便于溯源
- **结果稳定**：按原始索引排序，重复运行结果一致，无差异
- **多格式输出**：支持HTML可视化报告和CSV详细数据导出

## 耗时分桶定义

| 分桶名称 | 耗时范围 | 说明 |
|---------|---------|------|
| fast | 0 - 100ms | 快速响应 |
| normal | 100 - 500ms | 正常响应 |
| slow | 500 - 1000ms | 慢速响应 |
| very_slow | 1000 - 3000ms | 非常慢 |
| extreme | > 3000ms | 极端慢 |

## 安装

```bash
# 安装依赖
pip install -r requirements.txt

# 以开发模式安装CLI
pip install -e .
```

## 使用方法

### 基本用法

```bash
har-analyzer your_file.har
```

### 指定输出目录

```bash
har-analyzer your_file.har -o ./results
```

### 仅生成HTML报告

```bash
har-analyzer your_file.har -o ./results -f html
```

### 仅生成CSV报告

```bash
har-analyzer your_file.har -o ./results -f csv
```

### 控制台仅输出摘要（不生成文件）

```bash
har-analyzer your_file.har --no-output
```

### 自定义异常检测参数

```bash
# 保留前30个异常样本
har-analyzer your_file.har --anomaly-samples 30

# 调整异常阈值倍数(P95 * 2.0)
har-analyzer your_file.har --anomaly-threshold 2.0
```

### 查看帮助

```bash
har-analyzer -h
```

## 输出说明

### 控制台输出

- 概览统计：总请求数、有效/坏行数量、域名数
- 延迟统计：P50/P90/P95/P99 百分位数据
- 耗时分桶分布：各分桶请求数量及占比
- 域名统计TOP10：按请求数排序的域名及平均延迟
- 异常慢请求TOP5：最慢请求及其原始位置
- 坏行记录：解析失败条目的原始索引和原因

### HTML报告 (`*_analysis.html`)

可视化报告，包含：
- 概览统计卡片
- 域名详细统计表格
- 资源类型统计表格
- 耗时分桶分布
- 异常慢请求样本详情(含原始位置)
- 坏行详情

### CSV报告 (`*_analysis.csv`)

详细数据导出，包含：
- 域名统计
- 资源类型统计
- 异常慢请求样本
- 坏行记录
- 所有请求详情(按原始顺序)

## 项目结构

```
har_analyzer/
├── __init__.py          # 包初始化
├── parser.py            # HAR文件解析模块
│   ├── HarEntry         # 请求条目数据类
│   ├── BadEntry         # 坏行数据类
│   └── HarParser        # 解析器
├── analyzer.py          # 分桶统计分析模块
│   ├── BucketConfig     # 分桶配置
│   └── HarAnalyzer      # 分析器
├── tracker.py           # 来源追踪模块
│   └── SourceTracker    # 来源追踪器
├── reporter.py          # 报告生成模块
│   └── Reporter         # 报告生成器
└── main.py              # CLI入口
```

## 核心设计原则

1. **模块拆分**：解析、规则判断、来源追踪、报告生成完全分离
2. **来源可追溯**：所有条目保留原始索引位置(raw_index)
3. **坏行保留**：解析失败的条目不丢弃，保留原位置及错误原因
4. **结果稳定**：所有排序基于原始索引，重复运行无差异
5. **错误容错**：单条解析失败不影响整体分析流程

## 示例

使用项目中的测试示例：

```bash
har-analyzer example.har -o ./output
```

## 技术栈

- Python 3.8+
- Jinja2 (HTML模板渲染)

## License

MIT

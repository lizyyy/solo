# Alert规则消噪CLI

用于分析告警历史、识别噪声规则、生成消噪建议的命令行工具。

## 功能特性

- ✅ **多格式解析**: 支持 JSON 和 CSV 格式的告警、规则、静默配置数据
- ✅ **历史聚合**: 按规则聚合告警统计，包括触发次数、时间范围、标签分布等
- ✅ **静默匹配**: 检测哪些规则已被静默规则覆盖
- ✅ **噪声评分**: 基于触发频率、标签多样性、持续时长、告警级别计算噪声评分
- ✅ **候选建议**: 根据评分结果生成静默、优化、调整标签等建议
- ✅ **多格式输出**: 终端摘要、机器可读 JSON、同事可读 Markdown 报告
- ✅ **坏行处理**: 保留原始位置和错误原因，不影响正常数据解析
- ✅ **自检功能**: 内置测试命令验证解析、边界样本和报告生成功能

## 安装

```bash
npm install
npm run build
```

## 使用方法

### 基本分析

```bash
npm start -- analyze \
  --alerts sample-data/alerts.json \
  --rules sample-data/rules.json \
  --silences sample-data/silences.json
```

### 只输出终端摘要

```bash
npm start -- analyze -a alerts.json -f terminal
```

### 指定输出目录和阈值

```bash
npm start -- analyze -a alerts.json -r rules.json -o ./my-output -t 40
```

### 运行自检（验证所有功能）

```bash
npm run test
# 或者
npm start -- self-test
```

## 输出说明

### 1. 终端摘要

在控制台显示统计摘要、Top 触发规则、消噪建议和解析错误。

### 2. JSON 结果 (`denoise-result.json`)

机器可读的完整分析结果，包含：
- 元数据和统计信息
- 告警聚合明细
- 噪声评分详情
- 静默匹配情况
- 消噪候选建议
- 所有解析错误（含行号和原始内容）

### 3. Markdown 报告 (`denoise-report.md`)

适合发给同事阅读的格式化报告，包含表格统计、评分明细、建议详情。

## 噪声评分算法

| 因素 | 权重 | 说明 |
|------|------|------|
| 触发频率 | 35% | 触发次数越多，噪声评分越高 |
| 标签多样性 | 25% | 标签值越分散，噪声评分越高 |
| 持续时长 | 25% | 持续时间越长，噪声评分越高 |
| 告警级别 | 15% | info > warning > critical |

### 建议等级

- 🔴 **建议静默**: 噪声评分 ≥ 80
- 🟡 **建议优化**: 噪声评分 60-79
- 🟠 **建议关注**: 噪声评分 ≥ 阈值（默认50）
- 🟢 **保留**: 噪声正常

## 示例数据

`sample-data/` 目录包含示例数据：
- `alerts.json` - 示例告警历史
- `rules.json` - 示例规则配置
- `silences.json` - 示例静默配置

## 项目结构

```
.
├── src/
│   ├── types.ts      # 类型定义
│   ├── parser.ts     # 数据解析器
│   ├── denoiser.ts   # 消噪引擎
│   ├── reporter.ts   # 报告生成器
│   ├── self-test.ts  # 自检模块
│   ├── cli.ts        # CLI入口
│   └── index.ts      # 导出入口
├── sample-data/      # 示例数据
├── package.json
└── tsconfig.json
```
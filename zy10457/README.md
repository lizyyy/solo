# Prometheus 告警静默审计 CLI

一个功能完整的 Prometheus Alertmanager 静默规则审计工具，帮助你发现无人认领的静默规则、过期规则、宽匹配规则等潜在风险。

## 功能特性

- ✅ **参数解析与校验**: 完整的命令行参数解析和输入验证
- 📊 **标签匹配分析**: 检测过宽的匹配规则和正则通配符
- ⏰ **过期识别**: 自动标记已过期和即将过期的规则
- 🎯 **命中统计**: 结合历史告警数据统计静默规则命中情况
- 🚨 **风险分级**: 四级风险等级（严重/高/中/低）自动评估
- 📋 **多格式输出**: 终端摘要、机器可读JSON、同事友好的HTML报告
- 🔍 **错误追溯**: 坏行或异常记录可追溯到原文件位置
- 🔄 **重复运行安全**: 支持强制覆盖或防止污染已有输出

## 快速开始

### 安装依赖

```bash
npm install
```

### 运行审计

使用示例数据运行：

```bash
# 基础用法
node src/index.js -i data/silences.json -o audit-output --force

# 使用严格模式（遇到错误立即退出）
node src/index.js -i data/silences.json -o audit-output -f -s

# 自定义风险阈值（5天内过期标记为高风险）
node src/index.js -i data/silences.json --risk-threshold 5

# 带历史告警数据（用于命中统计）
node src/index.js -i data/silences.json -a data/alerts.json
```

### 查看帮助

```bash
node src/index.js --help
```

## 命令行参数

| 参数 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| `--input <path>` | `-i` | 静默规则导出文件路径 (JSON格式) | `./data/silences.json` |
| `--alerts <path>` | `-a` | 历史告警数据文件路径 (可选) | - |
| `--output <dir>` | `-o` | 输出目录 | `./audit-output` |
| `--force` | `-f` | 强制覆盖已存在的输出目录 | `false` |
| `--strict` | `-s` | 严格模式：遇到任何错误立即退出 | `false` |
| `--risk-threshold <days>` | - | 高风险阈值：过期前N天标记为高风险 | 7 |
| `--match-threshold <percent>` | - | 标签匹配率阈值 | 80 |
| `--no-color` | - | 禁用彩色输出 | - |
| `--version` | `-v` | 显示版本号 | - |
| `--help` | - | 显示帮助信息 | - |

## 输出文件说明

运行后会在输出目录生成以下文件：

| 文件名 | 说明 |
|--------|------|
| `summary.txt` | 终端摘要（同时打印到控制台） |
| `results.json` | 机器可读的完整审计结果，包含所有详细分析数据 |
| `report.html` | 可分享的HTML审计报告，包含可视化图表和筛选功能 |
| `errors.json` | 无法处理的记录及位置追溯信息（有错误时才生成） |

## 风险评估规则

工具根据以下因素进行风险评分：

| 因素 | 分值 | 说明 |
|------|------|------|
| 规则已过期 | +50 | 最严重，可能导致关键告警被永久静默 |
| 3天内即将过期 | +30 | 需尽快处理 |
| 阈值内即将过期 | +20 | 需要关注 |
| 宽匹配规则 | +25 | 可能意外静默大量告警 |
| 未命中任何告警 | +15 | 规则可能已失效 |
| 命中严重级别告警 | +20 | 静默关键告警需要审查 |
| 说明过短或缺失 | +10 | 无法追溯规则目的 |
| 长期运行 (>30天) | +10 | 临时规则可能被遗忘 |

**风险等级阈值：**
- **严重 (CRITICAL)**: ≥ 50分
- **高 (HIGH)**: ≥ 30分
- **中 (MEDIUM)**: ≥ 15分
- **低 (LOW)**: < 15分

## 数据格式

### 静默规则数据格式

支持 Alertmanager API 标准格式：

```json
[
  {
    "id": "规则ID",
    "status": { "state": "active/expired/pending" },
    "startsAt": "开始时间 ISO格式",
    "endsAt": "结束时间 ISO格式",
    "createdAt": "创建时间 ISO格式",
    "createdBy": "创建人邮箱",
    "comment": "说明备注",
    "matchers": [
      { "name": "标签名", "value": "标签值", "isRegex": false, "isEqual": true }
    ]
  }
]
```

也支持嵌套在 `data` 字段内的格式：`{ "data": [...] }`

## 典型使用场景

### 1. 值班前审计

每次值班前运行，确保没有关键告警被静默：

```bash
node src/index.js -i ./current-silences.json -o ./audit-$(date +%Y%m%d) --force
```

### 2. 定期清理审计

每周运行一次，清理过期和无用的静默规则：

```bash
node src/index.js -i silences.json --risk-threshold 14 -o weekly-audit
```

### 3. 集成到CI/CD流程

使用严格模式，发现高风险规则时直接失败：

```bash
node src/index.js -i silences.json -s
if [ $? -ne 0 ]; then
  echo "发现高风险静默规则，请审查！"
  exit 1
fi
```

## 项目结构

```
.
├── src/
│   ├── index.js          # CLI入口，参数解析
│   ├── validators.js     # 输入校验和数据验证
│   ├── parser.js         # JSON解析和数据加载
│   ├── auditor.js        # 核心审计逻辑
│   ├── reporter.js       # 报告生成器
│   └── utils.js          # 工具函数
├── data/
│   └── silences.json     # 示例数据
├── package.json
└── README.md
```

## 常见问题

**Q: 如何获取 Alertmanager 的静默规则？**

A: 使用 Alertmanager API 导出：
```bash
curl http://alertmanager:9093/api/v2/silences > silences.json
```

**Q: 输出目录已存在怎么办？**

A: 使用 `--force` 参数覆盖，或指定其他输出目录。

**Q: 如何只导出高风险规则？**

A: 查看生成的 `results.json` 文件，`highRiskSilences` 字段包含所有高风险规则。

## License

MIT

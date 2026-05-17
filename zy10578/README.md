# 正则规则回归测试 CLI

正则规则写了很多年，改一条就可能误伤历史样本。这个工具可以帮你做回归测试，确保修改规则不会破坏已有匹配。

## 功能特性

- ✅ 正则批量执行：批量运行多条正则规则 against 样本库
- ✅ 样本对比：对比预期结果，自动识别误报和漏报
- ✅ 差异分组：按类型分组差异项，方便排查
- ✅ 误伤保留：保留异常样本的原始位置和错误原因
- ✅ 多格式报告：终端摘要、机器可读JSON、适合发同事的Markdown报告
- ✅ 内置自检：一键验证工具功能完整性

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 运行自检，确保工具正常工作

```bash
npm test
# 或者
node bin/regex-regress.js self-test
```

### 3. 生成示例数据，快速上手

```bash
node bin/regex-regress.js init --dir ./my-test
```

这会在 `./my-test` 目录下生成：
- `rules.json` - 示例规则文件
- `samples/` - 样本目录
- `expected.json` - 预期标签文件

### 4. 运行回归测试

```bash
node bin/regex-regress.js run \
  -r ./my-test/rules.json \
  -s ./my-test/samples \
  -e ./my-test/expected.json \
  -o ./my-test/results
```

## 命令说明

### `regex-regress run` - 运行回归测试

| 参数 | 缩写 | 必填 | 说明 |
|------|------|------|------|
| `--rules` | `-r` | ✅ | 规则文件路径 (JSON格式) |
| `--samples` | `-s` | ✅ | 样本目录路径 |
| `--expected` | `-e` | ❌ | 预期标签文件路径 |
| `--output` | `-o` | ❌ | 输出目录，默认 `./regression-results` |
| `--verbose` | `-v` | ❌ | 显示详细输出 |

### `regex-regress self-test` - 运行自检

验证工具的正则解析、边界样本处理、报告导出等功能是否正常。

### `regex-regress init` - 初始化示例数据

| 参数 | 缩写 | 必填 | 说明 |
|------|------|------|------|
| `--dir` | `-d` | ❌ | 目标目录，默认 `./regex-demo` |

## 文件格式说明

### 规则文件 (rules.json)

支持两种格式：

**格式1：详细格式（推荐）**
```json
[
  {
    "id": "email_rule",
    "name": "邮箱地址匹配",
    "pattern": "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
    "flags": "g",
    "category": "contact"
  }
]
```

**格式2：简化格式**
```json
[
  "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
  "1[3-9]\\d{9}"
]
```

### 样本文件

样本目录下的 `.txt`、`.json`、`.csv`、`.log` 文件都会被加载，按行分割为样本。

样本ID格式：`文件名:行号`，例如 `data.txt:5`

### 预期标签文件 (expected.json)

```json
{
  "data.txt:1": {
    "shouldMatch": true,
    "rules": ["email_rule"]
  },
  "data.txt:2": {
    "shouldMatch": false
  }
}
```

| 字段 | 说明 |
|------|------|
| `shouldMatch` | true=预期命中，false=预期不命中 |
| `rules` | 可选，预期命中的规则ID列表 |

## 输出说明

运行测试后，输出目录包含：

### 1. `results.json` - 机器可读结果

完整的测试结果，包含：
- 统计数据
- 所有匹配详情
- 误报/漏报列表
- 差异项
- 错误记录

### 2. `regression-report.md` - 同事友好报告

适合直接发给同事看的Markdown报告，包含：
- 测试结果总览
- 误报/漏报详情
- 差异项分组说明
- 规则命中统计
- 错误记录

### 3. 终端摘要

实时显示测试进度和关键指标。

## 工作流程

1. 修改规则前，先对现有样本跑一次，保存 baseline
2. 修改规则后，再跑一次回归测试
3. 对比两次报告，检查是否有误伤（新增的误报/漏报）
4. 确认无问题后，将新样本加入预期标签库

## 典型场景

### 场景1：优化正则性能

```bash
# 修改前
node bin/regex-regress.js run -r rules-old.json -s samples -o baseline

# 修改后
node bin/regex-regress.js run -r rules-new.json -s samples -o regression
# 对比两个目录下的报告
```

### 场景2：新增规则，检查不误伤已有样本

```bash
# 在rules.json中追加新规则
node bin/regex-regress.js run -r rules.json -s samples -e expected.json
# 检查误报数是否为0
```

## 常见问题

### Q: 样本ID怎么对应到原始文件？

A: 样本ID格式是 `文件名:行号`，可以直接定位到原始位置。

### Q: 正则转义注意什么？

A: JSON中反斜杠需要双重转义，例如 `\d` 写成 `\\d`。

### Q: 怎么处理中文/Unicode？

A: 在规则的 `flags` 中加上 `u` 标志即可。

## 项目结构

```
.
├── bin/
│   └── regex-regress.js    # CLI入口
├── src/
│   ├── engine.js           # 核心测试引擎
│   ├── reporter.js         # 报告生成器
│   └── self-test.js        # 自检模块
├── package.json
└── README.md
```

# CSV 转 NDJSON 规整 CLI 工具

一个偏工程实用的命令行工具，专门处理运营提供的 CSV 文件，输出稳定的 NDJSON 事件流。支持编码探测、列名归一、坏行留存、重复导入幂等功能。

## ✨ 核心特性

- 🔍 **智能编码探测**: 自动识别 UTF-8, GBK, GB2312 等常见编码
- 🏷️ **列名归一化**: 自动将中文/空格/特殊字符的列名转为标准 snake_case
- 🗺️ **自定义列映射**: 支持通过 JSON 文件自定义列名映射
- 🚫 **坏行留存机制**: 坏数据不中断流程，单独留存可追溯
- 🔄 **重复导入幂等**: 支持基于主键列检测重复行
- 📊 **三重输出报告**: 终端摘要 + 机器可读 JSON + 同事可读 Markdown

## 📦 安装

### 环境要求
- Node.js >= 18.0.0

### 安装步骤

```bash
# 进入项目目录
cd csv-to-ndjson-cli

# 安装依赖
npm install

# 全局链接（可选，方便任意目录使用）
npm link

# 验证安装
csv2ndjson --help
```

## 📁 目录结构

### 输入目录建议

```
data/
├── raw/                    # 原始CSV文件（运营提供）
│   ├── orders_202401.csv
│   └── users_utf8.csv
└── mappings/               # 列映射配置（可选）
    ├── orders-map.json
    └── users-map.json
```

### 输出目录结构（自动生成）

```
output/
├── orders_202401.ndjson       # NDJSON 输出文件（下游使用）
├── orders_202401-bad-rows.csv # 坏行记录（可追溯到原行号）
└── reports/
    ├── orders_202401-result.json   # 机器可读结果（供 CI/CD 使用）
    └── orders_202401-report.md     # 同事可读报告（可直接转发）
```

## 🚀 使用示例

### 基础用法

```bash
# 最简单的转换
csv2ndjson ./data/raw/orders.csv

# 指定输出目录
csv2ndjson ./data/raw/orders.csv -o ./my-output
```

### 列映射配置

```bash
# 内联 JSON 映射
csv2ndjson ./data/raw/orders.csv -m '{"订单号": "order_id", "购买人姓名": "user_name"}'

# 使用映射文件
csv2ndjson ./data/raw/orders.csv -m ./data/mappings/orders-map.json
```

映射文件 `orders-map.json` 格式：
```json
{
  "订单号": "order_id",
  "购买人姓名": "user_name",
  "下单时间": "created_at",
  "支付金额": "amount"
}
```

### 幂等去重

```bash
# 基于订单号列去重
csv2ndjson ./data/raw/orders.csv -k "订单号"

# 基于多列组合去重
csv2ndjson ./data/raw/orders.csv -k "用户ID,订单日期"
```

### 编码处理

```bash
# 自动探测编码（默认）
csv2ndjson ./data/raw/orders_gbk.csv

# 强制指定编码
csv2ndjson ./data/raw/orders_gbk.csv -e GBK
```

### 空值规则

```bash
# 自定义空值标识
csv2ndjson ./data/raw/orders.csv -n "NA,N/A,--,空,无"
```

### 跳过标题行

```bash
# 跳过前2行（常用于有多行标题的文件）
csv2ndjson ./data/raw/orders.csv -s 2
```

### 完整示例

```bash
csv2ndjson ./data/raw/orders_202401.csv \
  -o ./output \
  -m ./data/mappings/orders-map.json \
  -k "order_id" \
  -n "NA,N/A,,null,NULL" \
  -f
```

## 🔧 完整参数说明

| 参数 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| `input-file` | - | 输入 CSV 文件路径（必填） | - |
| `--output-dir` | `-o` | 输出目录 | `./output` |
| `--column-map` | `-m` | 列映射 JSON 字符串或文件路径 | - |
| `--encoding` | `-e` | 强制指定编码（不指定则自动探测） | - |
| `--null-values` | `-n` | 空值标识列表（逗号分隔） | `NA,N/A,,na,null,NULL` |
| `--id-columns` | `-k` | 幂等键列名（逗号分隔，用于检测重复） | - |
| `--delimiter` | `-d` | CSV 分隔符 | `,` |
| `--skip-rows` | `-s` | 跳过开头行数 | `0` |
| `--force` | `-f` | 覆盖已存在的输出文件 | - |
| `--quiet` | `-q` | 静默模式，只输出错误 | - |
| `--help` | `-h` | 显示帮助信息 | - |
| `--version` | `-v` | 输出版本号 | - |

## 📊 输出说明

### 1. NDJSON 输出

文件位置: `output/{filename}.ndjson`

格式说明：每行一个独立的 JSON 对象，字段名已归一化。

示例：
```json
{"order_id":"1001","user_name":"张三","amount":"99.00","created_at":"2024-01-01"}
{"order_id":"1002","user_name":"李四","amount":"199.00","created_at":"2024-01-02"}
```

### 2. 坏行记录

文件位置: `output/{filename}-bad-rows.csv`

格式说明：包含坏行的完整信息，可追溯到原文件行号。

| 列名 | 说明 |
|------|------|
| `_line_number` | 原文件中的行号 |
| `_error` | 错误信息 |
| `_raw_content` | 原始行内容（JSON 格式） |
| 原始列名... | 原始 CSV 的所有列 |

### 3. 机器可读结果

文件位置: `output/reports/{filename}-result.json`

用于 CI/CD 流水线或自动化脚本读取。

```json
{
  "meta": {
    "version": "1.0.0",
    "generatedAt": "2024-01-15T10:30:00.000Z",
    "inputFile": "/path/to/orders.csv",
    "outputFile": "/path/to/output/orders.ndjson",
    "badRowsFile": "/path/to/output/orders-bad-rows.csv"
  },
  "summary": {
    "success": true,
    "detectedEncoding": "UTF-8",
    "totalRows": 1000,
    "successRows": 995,
    "badRows": 3,
    "duplicateRows": 2,
    "successRate": "99.50%",
    "durationMs": 125
  },
  "columns": {
    "original": ["订单号", "姓名", "金额"],
    "normalized": ["order_id", "name", "amount"],
    "mapping": {"订单号": "order_id"}
  },
  "badRows": [...],
  "duplicateRows": [...],
  "error": null
}
```

### 4. 同事可读报告

文件位置: `output/reports/{filename}-report.md`

Markdown 格式，适合直接转发给同事查看。包含：
- 转换摘要表格
- 列名映射对照表
- 坏行样本（前10条）
- 重复行样本（前10条）
- 所有输出文件位置

## ❌ 坏数据处理说明

### 什么是坏行？

转换过程中遇到以下情况会被标记为坏行：
- 解析 CSV 时发生错误
- 幂等键列不存在或为空
- 其他处理异常

### 坏数据时的返回结果

1. **退出码**: 
   - `0`: 转换成功（允许存在坏行）
   - `1`: 全部行都是坏行，或发生致命错误

2. **坏行不会中断转换**：工具会跳过坏行继续处理，不会因为几行坏数据导致整个文件转换失败。

3. **坏行完整留存**：所有坏行会完整保存到 `{filename}-bad-rows.csv`，包含：
   - 原文件行号（可直接定位到 Excel 行号）
   - 具体错误信息
   - 原始行的完整内容
   - 原始 CSV 的所有列值

### 如何处理坏数据

1. 查看终端输出的坏行数量
2. 打开坏行文件，根据 `_line_number` 定位原文件位置
3. 根据 `_error` 了解具体错误原因
4. 修正原始 CSV 后重新运行

## 💡 最佳实践

1. **使用列映射文件**：对于固定格式的运营数据，维护一份映射文件，确保下游字段稳定
2. **启用幂等检测**：导入数据库前务必指定 `-k` 参数去重
3. **定期归档输出**：输出目录可按日期归档，便于追溯
4. **CI/CD 集成**：使用机器可读结果文件做质量门禁，坏行超过阈值时报警

## 📝 常见问题

**Q: 为什么有些列名被自动改了？**
A: 工具会自动将列名归一化为标准的 snake_case 格式，确保下游字段稳定。如果需要自定义列名，请使用 `-m` 参数。

**Q: GBK 编码的文件能处理吗？**
A: 可以，工具会自动探测编码，也可以用 `-e GBK` 强制指定。

**Q: 坏行会影响下游使用吗？**
A: 不会，坏行只存在于坏行文件中，NDJSON 输出只包含成功转换的行。

**Q: 如何实现增量导入？**
A: 使用 `-k` 参数指定唯一键列，重复行会被自动跳过。

## 📄 许可证

MIT

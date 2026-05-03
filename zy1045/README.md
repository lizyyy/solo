# Data Masker - 数据脱敏CLI工具

一个本地运行的数据脱敏命令行工具，用于批量处理 CSV/JSON 文件中的敏感数据，保持跨文件的一致性映射。

## 功能特性

- **跨文件一致性映射**：同一个手机号、邮箱、姓名在不同文件中脱敏后保持一致
- **稳定可复现**：基于 salt 生成稳定的映射关系，相同输入 + 相同 salt = 相同输出
- **多种敏感类型**：支持手机号、邮箱、姓名、地址、订单号、工单号、自由文本
- **智能自由文本扫描**：自动识别并遮蔽自由文本中混有的手机号和邮箱
- **风险检查**：自动检测可能遗漏的敏感字段
- **报告生成**：输出 Markdown/JSON 格式的交付报告
- **Dry Run 预览**：支持预览模式，不实际写入文件

## 安装

### 环境要求

- Node.js >= 18.0.0
- npm 或 yarn

### 安装步骤

```bash
# 1. 克隆项目或下载源码
cd data-masker

# 2. 安装依赖
npm install

# 3. 编译 TypeScript
npm run build

# 4. （可选）全局链接
npm link
```

## 快速开始

### 目录结构

```
data-masker/
├── examples/           # 示例数据和配置
│   ├── users.csv       # 用户数据示例
│   ├── orders.csv      # 订单数据示例
│   ├── tickets.json    # 工单数据示例
│   ├── mask-config.yaml  # YAML 格式配置
│   └── mask-config.json  # JSON 格式配置
├── src/                # 源代码
├── dist/               # 编译输出
└── package.json
```

### 运行示例

```bash
cd examples

# 1. 先校验配置（推荐）
npx ts-node ../src/bin/cli.ts validate mask-config.yaml

# 2. 预览模式（不实际写入文件）
npx ts-node ../src/bin/cli.ts mask mask-config.yaml --dry-run

# 3. 实际执行脱敏
npx ts-node ../src/bin/cli.ts mask mask-config.yaml

# 4. 执行并生成详细报告
npx ts-node ../src/bin/cli.ts mask mask-config.yaml --mapping-details
```

或者编译后运行：

```bash
# 编译
npm run build

# 运行
node dist/bin/cli.js validate examples/mask-config.yaml
node dist/bin/cli.js mask examples/mask-config.yaml
```

## 命令说明

### validate - 校验配置

检查配置文件的正确性，包括：
- 配置语法是否正确
- 文件是否存在
- 字段是否存在
- 风险检测（可能遗漏的敏感字段）

```bash
data-masker validate <config> [options]

# 参数
# <config> - 配置文件路径（YAML 或 JSON）

# 选项
# --json - 输出 JSON 格式结果
```

**示例：**

```bash
# 基础校验
data-masker validate mask-config.yaml

# 输出 JSON 格式
data-masker validate mask-config.yaml --json
```

### mask - 执行脱敏

读取源文件，执行脱敏处理，输出脱敏文件和报告。

```bash
data-masker mask <config> [options]

# 参数
# <config> - 配置文件路径

# 选项
# --dry-run        - 预览模式，不实际写入文件
# --output <dir>   - 覆盖配置中的输出目录
# --no-report      - 不生成报告
# --mapping-details - 报告中包含详细映射关系
# --json           - 输出 JSON 格式结果
```

**示例：**

```bash
# 基础执行
data-masker mask mask-config.yaml

# 预览模式
data-masker mask mask-config.yaml --dry-run

# 指定输出目录
data-masker mask mask-config.yaml --output ./my_output

# 生成详细报告
data-masker mask mask-config.yaml --mapping-details
```

### report - 重新生成报告

基于已有的结果重新生成报告。

```bash
data-masker report <summary> [options]

# 参数
# <summary> - 之前生成的 report.json 或 summary.json

# 选项
# --format <format>   - 输出格式：markdown|json (默认: markdown)
# --output <path>     - 输出文件路径
# --mapping-details   - 包含详细映射关系
```

**示例：**

```bash
# 基于 report.json 重新生成 Markdown 报告
data-masker report masked_output/report_2024-03-15T10-30-00.json

# 生成 JSON 格式报告
data-masker report masked_output/report_xxx.json --format json

# 输出到指定文件
data-masker report masked_output/report_xxx.json --output ./custom_report.md
```

## 配置文件说明

配置文件支持 YAML 和 JSON 两种格式。

### 完整配置示例

```yaml
version: "1.0"
salt: "my_secret_salt_2024"      # 必填：用于一致性映射的盐值
outputDir: "./masked_output"      # 输出目录
dryRun: false                      # 是否预览模式
preserveOriginalFilenames: true   # 是否保留原文件名（添加 _masked 后缀）

# 全局忽略字段
globalIgnoreFields:
  - "id"
  - "created_at"
  - "updated_at"

# 文件配置列表
files:
  - path: "./users.csv"
    type: "csv"                     # csv 或 json
    ignoreFields:                   # 该文件特有的忽略字段
      - "internal_id"
    fields:                         # 字段映射配置
      real_name:
        type: "name"                # 字段类型
      email:
        type: "email"
      phone:
        type: "phone"
      address:
        type: "address"

  - path: "./orders.json"
    type: "json"
    fields:
      user_info.name:               # 支持嵌套字段（点号分隔）
        type: "name"
      user_info.phone:
        type: "phone"
      remark:
        type: "free_text"           # 自由文本，自动扫描其中的手机号/邮箱
```

### 字段类型说明

| 类型 | 说明 | 示例 |
|------|------|------|
| `phone` | 手机号 | `13812345678` → `186xxxx1234` |
| `email` | 邮箱 | `zhangsan@example.com` → `userxxxx@masked.example.com` |
| `name` | 姓名 | `张三` → `李明` |
| `address` | 地址 | `北京市朝阳区...` → `上海市浦东新区...` |
| `order_number` | 订单号 | `ORD2024001` → `ORD20240315ABC123` |
| `ticket_number` | 工单号 | `TK001` → `TKABC123` |
| `free_text` | 自由文本 | 自动扫描并遮蔽其中的手机号和邮箱 |

### 自由文本处理

`free_text` 类型会自动识别并遮蔽文本中混有的：
- 手机号：`13812345678`、`138-1234-5678`、`+86 13812345678`
- 邮箱：`user@example.com`

**示例：**
```
原文本：用户电话13812345678，邮箱zhangsan@example.com，请联系
脱敏后：用户电话186xxxx1234，邮箱userxxxx@masked.example.com，请联系
```

## 异常输入示例

### 场景1：配置文件不存在

```bash
data-masker validate non_existent.yaml
# 输出：❌ 错误: 配置文件不存在: /path/to/non_existent.yaml
```

### 场景2：配置文件语法错误

```yaml
# bad-config.yaml
version: "1.0"
salt:  # 缺失值
files:
  - path: "./users.csv"
```

```bash
data-masker validate bad-config.yaml
# 输出警告和风险提示
```

### 场景3：字段不存在

```yaml
# wrong-field.yaml
files:
  - path: "./users.csv"
    fields:
      non_existent_field:  # 该字段不存在于文件中
        type: "phone"
```

```bash
data-masker validate wrong-field.yaml
# 输出中风险：配置的字段 "non_existent_field" 在文件中不存在
```

### 场景4：同名字段类型不一致

```yaml
# inconsistent.yaml
files:
  - path: "./users.csv"
    fields:
      phone:
        type: "phone"
  - path: "./orders.csv"
    fields:
      phone:
        type: "name"   # 同一个字段名，类型不同！
```

```bash
data-masker validate inconsistent.yaml
# 输出高风险：字段 "phone" 类型不一致，可能导致跨文件映射不一致
```

## 输出说明

### 输出目录结构

```
masked_output/
├── users_masked.csv           # 脱敏后的用户数据
├── orders_masked.csv          # 脱敏后的订单数据
├── tickets_masked.json        # 脱敏后的工单数据
├── report_2024-03-15T10-30-00.md    # Markdown 格式报告
├── report_2024-03-15T10-30-00.json  # JSON 格式报告
└── mappings_2024-03-15T10-30-00.json # 映射详情（使用 --mapping-details 时）
```

### 报告内容

报告包含以下部分：

1. **处理概览**：处理文件数、总记录数、脱敏字段总数
2. **各类型统计**：每种类型的唯一值数量
3. **文件处理详情**：每个文件的脱敏字段统计、警告、错误
4. **风险检查结果**：高/中/低风险项及建议

### 一致性映射示例

**输入：**

users.csv:
| user_id | real_name | phone |
|---------|-----------|-------|
| U001 | 张三 | 13812345678 |

orders.csv:
| order_id | user_name | user_phone |
|----------|-----------|------------|
| ORD001 | 张三 | 13812345678 |

**输出（脱敏后）：**

users_masked.csv:
| user_id | real_name | phone |
|---------|-----------|-------|
| U001 | 李明 | 186a1b2c3d4 |

orders_masked.csv:
| order_id | user_name | user_phone |
|----------|-----------|------------|
| ORD001 | 李明 | 186a1b2c3d4 |

**注意**：同一个 "张三" 在两个文件中都被映射为 "李明"，同一个手机号映射结果也保持一致。

## 安全建议

1. **Salt 管理**：使用唯一的、随机的 salt 值，不要使用默认值或简单值
   
   ```yaml
   # 好的示例
   salt: "a3f9c2e1d5b7a3c9e2d4f6a1b8c3d5e"
   
   # 不好的示例
   salt: "salt123"
   salt: "default_salt"
   ```

2. **风险检查**：每次运行前先执行 `validate` 检查风险

3. **Dry Run**：首次处理新数据时，先用 `--dry-run` 预览结果

4. **数据备份**：实际执行前备份原始数据

5. **映射关系**：映射关系不保存原始数据的可逆向信息，只能正向映射

## 依赖说明

- `commander` - CLI 命令解析
- `csv-parse` / `csv-stringify` - CSV 文件读写
- `js-yaml` - YAML 配置解析
- `chalk` - 终端颜色输出
- `typescript` / `ts-node` - TypeScript 支持

## License

MIT

# 问卷回收数据配额补样计算 CLI

一个可靠的命令行工具，用于处理问卷回收数据，检测无效样本、重复答卷，并计算各地域配额需补样人数。

## 功能特性

- ✅ **无效样本检测**：根据自定义规则检测无效问卷（空值、范围、枚举、逻辑校验）
- ✅ **重复答卷检测**：支持多字段组合去重
- ✅ **配额补样计算**：按地域/性别等维度计算需补样人数
- ✅ **详细输出**：生成无效样本清单、重复答卷清单、最终有效样本、配额计算结果
- ✅ **试运行模式**：dry-run 预览结果不生成文件
- ✅ **覆盖开关**：force 强制覆盖已存在的输出文件

## 安装

```bash
npm install
```

## 使用说明

### 命令参数

```
survey-quota [选项]

选项:
  -V, --version          输出版本号
  -i, --input <path>     问卷回收数据输入路径 (CSV 文件) (必需)
  -r, --rules <path>     配额规则文件路径 (JSON 文件) (必需)
  -o, --output <dir>     结果输出目录 (必需)
  -d, --dry-run          试运行，不生成输出文件
  -f, --force            覆盖已存在的输出文件
  -h, --help             显示命令帮助
```

### 完整命令链示例

#### 1. 查看帮助

```bash
node src/cli.js --help
```

#### 2. 试运行（预览结果，不生成文件）

```bash
node src/cli.js \
  --input examples/survey_data.csv \
  --rules examples/quota_rules.json \
  --output output \
  --dry-run
```

#### 3. 正常执行（生成输出文件）

```bash
node src/cli.js \
  --input examples/survey_data.csv \
  --rules examples/quota_rules.json \
  --output output
```

#### 4. 强制覆盖已存在的文件

```bash
node src/cli.js \
  --input examples/survey_data.csv \
  --rules examples/quota_rules.json \
  --output output \
  --force
```

#### 5. 使用简写参数

```bash
node src/cli.js -i examples/survey_data.csv -r examples/quota_rules.json -o output -f
```

## 规则文件说明

规则文件为 JSON 格式，包含以下配置项：

```json
{
  "name": "规则名称",
  "version": "1.0",
  "invalidChecks": [
    {
      "field": "年龄",
      "type": "empty",
      "reason": "年龄不能为空"
    },
    {
      "field": "年龄",
      "type": "range",
      "min": 18,
      "max": 70,
      "reason": "年龄应在18-70岁之间"
    },
    {
      "field": "性别",
      "type": "enum",
      "values": ["男", "女"],
      "reason": "性别只能为男或女"
    }
  ],
  "duplicateKeys": ["受访者ID", "IP地址"],
  "quotaFields": [
    {
      "field": "所在城市",
      "targets": [
        { "value": "北京", "count": 100 },
        { "value": "上海", "count": 100 }
      ]
    }
  ]
}
```

### 校验类型说明

| 类型 | 说明 | 配置参数 |
|------|------|----------|
| empty | 检查字段是否为空 | field, reason |
| range | 检查数值范围 | field, min, max, reason |
| enum | 检查枚举值 | field, values[], reason |

## 输出文件说明

执行成功后，输出目录将包含以下文件：

| 文件名 | 说明 |
|--------|------|
| `无效样本清单.csv` | 所有被判定为无效的问卷记录，包含无效原因 |
| `重复答卷清单.csv` | 所有重复的答卷记录，包含重复标识 |
| `最终有效样本.csv` | 经过无效检测和去重后的有效样本 |
| `配额补样计算结果.json` | 配额计算的完整结果，包含统计数据和补样明细 |

## 测试验证

### 正常路径测试

```bash
# 1. 安装依赖
npm install

# 2. 试运行验证
node src/cli.js -i examples/survey_data.csv -r examples/quota_rules.json -o output --dry-run

# 3. 正式执行
node src/cli.js -i examples/survey_data.csv -r examples/quota_rules.json -o output

# 4. 查看结果
ls -la output/
cat output/配额补样计算结果.json
```

### 异常路径测试

```bash
# 测试：输入文件不存在
node src/cli.js -i not_found.csv -r examples/quota_rules.json -o output

# 测试：规则文件不存在
node src/cli.js -i examples/survey_data.csv -r not_found.json -o output

# 测试：不使用 --force 覆盖已有文件
node src/cli.js -i examples/survey_data.csv -r examples/quota_rules.json -o output
```

## 项目结构

```
.
├── src/
│   ├── cli.js          # CLI 入口和参数解析
│   └── processor.js    # 核心业务逻辑
├── examples/
│   ├── survey_data.csv # 样例问卷数据
│   └── quota_rules.json # 样例配额规则
├── output/             # 输出目录（自动创建）
├── package.json
└── README.md
```

## License

MIT

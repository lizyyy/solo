# 托育园保健室托育晨检汇总 CLI

让一线同事照着流程跑，不再靠负责人临时解释。

## ✨ 功能特点

- ✅ **保留原始行号和文件名**：每条记录都标记来源，方便追溯
- ✅ **详细异常报告**：不只是给总数，每条异常都有具体位置和原因
- ✅ **容错处理**：体温复测、兄妹同园、可复跑等特殊情况不会让整批任务失败
- ✅ **业务场景真实**：专门针对托育园晨检流程设计
- ✅ **可配置规则**：默认口径清晰，方便接手人先跑样例再改规则

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 运行测试命令

```bash
npm run test
```

或者运行详细模式：

```bash
npm run test:detail
```

### 3. 查看输出

运行后会生成两个文件：
- `examples/sample-output.csv` - 处理结果（带原始行号）
- `examples/sample-output-report.txt` - 详细报告

## 📖 使用方法

### 基础用法

```bash
node src/index.js --input 输入文件.csv --output 输出文件.csv
```

### 带自定义配置

```bash
node src/index.js --input 输入文件.csv --output 输出文件.csv --config config/default.json
```

### 显示详细处理过程

```bash
node src/index.js --input 输入文件.csv --output 输出文件.csv --verbose
```

## 📋 命令参数

| 参数 | 简写 | 必填 | 说明 |
|------|------|------|------|
| `--input` | `-i` | ✅ | 输入CSV文件路径 |
| `--output` | `-o` | ✅ | 输出CSV文件路径 |
| `--config` | `-c` | ❌ | 规则配置文件路径(JSON) |
| `--verbose` | `-v` | ❌ | 显示详细处理过程 |
| `--help` | `-h` | ❌ | 显示帮助信息 |

## 🏥 业务规则（默认口径）

### 体温检查
- **正常范围**：≤ 37.3℃ → 正常通过
- **需复测**：37.3℃ < 体温 ≤ 37.5℃ → 仅提醒，不影响通过状态
- **异常不通过**：> 37.5℃ → 严重异常，标记不通过

### 健康检查
- **手足口检查**：发现异常标记提醒
- **皮肤状况**：皮疹、红肿等异常标记提醒

### 特殊情况（仅提醒，不影响通过状态）
- **兄妹同园**：有兄弟姐妹在本园，需关注
- **可复跑**：需要进行复测确认的记录

### 数据校验
- 幼儿姓名不能为空
- 班级信息不能为空
- 只有输入路径本身不可读时才会失败退出

## 📄 输入文件格式

CSV文件，支持以下字段名（部分可兼容）：

| 字段名 | 兼容字段名 | 必填 | 说明 |
|--------|-----------|------|------|
| 幼儿姓名 | 姓名 | ✅ | 幼儿姓名 |
| 班级 | 所在班级 | ✅ | 班级名称 |
| 体温 | | | 数字，单位℃ |
| 手足口检查 | 手足口 | | 正常/异常/有/是 |
| 皮肤状况 | 皮肤 | | 正常/皮疹/红肿等 |
| 兄妹同园 | 兄弟姐妹 | | 是/否 |
| 需复测 | 复测 | | 是/否 |
| 晨检日期 | | | 日期 |
| 晨检人 | | | 晨检医生姓名 |

示例请查看：[examples/sample-input.csv](file:///Users/mac/pro/solo/workspaces/xy11167/examples/sample-input.csv)

## 📊 输出说明

### 结果CSV字段
除原始字段外，额外增加：
- `_原始行号`：来源文件行号，方便追溯
- `_源文件`：来源文件名
- `_处理状态`：通过/不通过
- `_异常数量`：异常项数量
- `_提醒数量`：提醒项数量

### 报告文件内容
- 基本统计（总记录数、通过/不通过人数）
- 异常详情（带文件名和行号）
- 特殊情况提醒（体温复测、兄妹同园、可复跑）
- 当前使用的规则配置

## ⚙️ 配置文件

默认配置：[config/default.json](file:///Users/mac/pro/solo/workspaces/xy11167/config/default.json)

### 修改规则步骤：

1. 复制默认配置：
   ```bash
   cp config/default.json config/custom.json
   ```

2. 根据园所实际情况修改配置

3. 运行时指定配置：
   ```bash
   node src/index.js -i 输入.csv -o 输出.csv -c config/custom.json
   ```

### 配置项说明

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `normalTemperatureMax` | 37.3 | 正常体温上限(℃) |
| `abnormalTemperatureMax` | 37.5 | 异常体温上限(℃) |
| `requireHandFootMouthCheck` | true | 是否启用手足口检查 |
| `requireSkinCheck` | true | 是否启用皮肤检查 |
| `siblingSameGarden` | "recheck" | 兄妹同园策略 |
| `allowRerun` | true | 是否支持可复跑 |

## 🧪 测试命令

```bash
# 基础测试
npm run test

# 详细模式（显示每行处理情况）
npm run test:detail

# 自定义配置测试
node src/index.js -i examples/sample-input.csv -o examples/test-output.csv -c config/default.json -v
```

## 📂 项目结构

```
.
├── src/
│   └── index.js          # CLI主程序
├── config/
│   └── default.json      # 默认规则配置
├── examples/
│   ├── sample-input.csv  # 样例输入文件
│   ├── sample-output.csv # 样例输出文件（运行后生成）
│   └── sample-output-report.txt # 样例报告
├── package.json
└── README.md
```

## 🔧 工作流程

1. 保健老师将晨检数据录入CSV文件
2. 运行本工具处理数据
3. 查看生成的报告和结果文件
4. 根据异常信息跟进处理
5. 如需调整规则，修改配置文件后重新运行

## ❌ 常见问题

**Q: 运行时报错 "输入文件不存在"？**
> A: 请检查输入文件路径是否正确，文件是否存在

**Q: 如何修改体温阈值？**
> A: 复制 config/default.json 为自定义配置，修改对应数值后用 --config 参数指定

**Q: 兄妹同园记录会影响通过状态吗？**
> A: 不会，仅作为提醒信息，不影响通过状态

**Q: 只有个别记录有问题，其他记录还能处理吗？**
> A: 可以，除了输入文件本身不可读外，其他异常都不会导致整批失败

---

**接手人指南**：先运行 `npm run test` 看样例效果，再根据实际园所情况修改配置文件。
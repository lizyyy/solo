# Feature Flag 清理CLI工具

一个专业的Feature Flag清理工具，帮助你安全排查和清理代码中已经下线的开关。

## ✨ 功能特性

- **多格式输入支持**: 支持CSV和JSON格式的开关清单
- **智能代码扫描**: 自动扫描代码目录中的开关引用
- **多因素风险评估**: 基于引用数、文件数、逻辑复杂度等因素进行风险分级
- **多格式输出**:
  - 终端彩色摘要
  - 机器可读JSON结果
  - 交互式HTML报告（支持筛选和搜索）
- **异常记录追踪**: 自动记录无法处理的记录和源文件位置
- **安全输出管理**: 支持重复运行不污染，--force参数强制覆盖

## 📦 安装

```bash
npm install
```

## 🚀 快速开始

### 基本用法

```bash
node bin/ff-clean.js --flags examples/flags.csv --code ./src --output ./results
```

### 使用force参数覆盖已有输出

```bash
node bin/ff-clean.js --flags examples/flags.csv --code ./src --output ./results --force
```

### 只输出JSON格式

```bash
node bin/ff-clean.js --flags examples/flags.csv --code ./src --json-only
```

### 自定义默认值和文件扩展名

```bash
node bin/ff-clean.js --flags examples/flags.csv --code ./src --default-value true --extensions js,ts,vue
```

## 📋 命令行参数

| 参数 | 说明 | 默认值 | 必填 |
|------|------|--------|------|
| `--flags <path>` | 开关清单CSV/JSON文件路径 | - | ✅ |
| `--code <path>` | 要扫描的代码目录路径 | - | ✅ |
| `--output <path>` | 输出目录路径 | `./ff-clean-results` | ❌ |
| `--default-value <true/false>` | 全局默认开关值 | `false` | ❌ |
| `--extensions <list>` | 扫描的文件扩展名（逗号分隔） | `js,ts,jsx,tsx,vue` | ❌ |
| `--exclude <pattern>` | 排除的目录模式（逗号分隔） | `node_modules,.git,dist,build` | ❌ |
| `--force` | 覆盖已有输出目录 | `false` | ❌ |
| `--json-only` | 只输出JSON结果，禁用终端格式 | `false` | ❌ |
| `-v, --version` | 显示版本号 | - | ❌ |
| `-h, --help` | 显示帮助信息 | - | ❌ |

## 📄 开关清单格式

### CSV格式

```csv
name,defaultValue,status,owner,description
enable_new_checkout,true,deprecated,team-a,新结算流程开关
enable_v2_api,false,active,team-b,V2版本API开关
```

### JSON格式

```json
[
  {
    "name": "enable_new_checkout",
    "defaultValue": true,
    "status": "deprecated",
    "owner": "team-a",
    "description": "新结算流程开关"
  }
]
```

### 字段说明

| 字段 | 说明 | 必填 |
|------|------|------|
| `name` | 开关名称（用于代码扫描匹配） | ✅ |
| `defaultValue` | 开关的默认值，用于风险评估 | ❌ |
| `status` | 开关状态（如: active/deprecated/off） | ❌ |
| `owner` | 负责团队或人员 | ❌ |
| `description` | 开关功能描述 | ❌ |

## 🎯 风险等级说明

| 等级 | 颜色 | 说明 | 建议 |
|------|------|------|------|
| ✅ 安全 | 绿色 | 风险较低，可以直接删除 | 可以安全删除 |
| ⚠️ 注意 | 黄色 | 有一定引用，建议人工确认 | 建议人工复核后删除 |
| ❌ 高风险 | 红色 | 引用较多或涉及复杂逻辑 | 需要详细评估，谨慎删除 |
| ❓ 未知 | 灰色 | 信息不足 | 需要补充信息 |

## 📊 输出文件说明

运行后会在输出目录生成以下文件：

1. **report.html** - 交互式HTML报告，支持：
   - 按风险等级筛选
   - 搜索开关名称
   - 查看每个开关的详细信息
   - 查看代码引用上下文
   - 查看风险因素分析

2. **results.json** - 机器可读的完整分析结果，包含：
   - 元数据（生成时间、扫描统计）
   - 所有开关的详细分析结果
   - 风险分级汇总

3. **invalid-records.json** - 无法处理的记录（仅在存在时生成），包含：
   - 原始内容
   - 错误信息
   - 源文件位置

## 🧪 示例运行

```bash
# 使用示例数据运行
node bin/ff-clean.js --flags examples/flags.csv --code test-code --output ./demo-results
```

## 📁 项目结构

```
.
├── bin/
│   └── ff-clean.js          # CLI入口文件
├── src/
│   ├── index.js             # 主程序入口
│   ├── cli/
│   │   ├── validator.js     # 参数校验模块
│   │   └── terminal-summary.js  # 终端摘要输出
│   ├── core/
│   │   ├── file-parser.js   # 文件解析模块
│   │   ├── reference-scanner.js # 代码引用扫描
│   │   ├── risk-assessor.js # 风险评估模块
│   │   └── output-manager.js # 输出管理模块
│   └── report/
│       └── generator.js     # HTML报告生成器
├── examples/
│   └── flags.csv            # 示例开关清单
├── test-code/               # 测试代码目录
└── package.json
```

## 🎯 使用场景

1. **技术债清理**: 定期清理代码中已下线的Feature Flag
2. **重构准备**: 在大规模重构前识别可以安全移除的开关
3. **代码审计**: 检查Feature Flag的使用情况和风险
4. **团队协作**: 生成清晰的报告，方便团队讨论和决策

## 💡 最佳实践

1. **定期运行**: 建议每个迭代或发布周期运行一次
2. **先删低风险**: 先处理"安全"等级的开关，再处理高风险的
3. **保留记录**: 保存每次的扫描报告，便于追踪变化
4. **团队审核**: 高风险开关建议团队审核后再删除
5. **灰度测试**: 删除高风险开关后建议进行灰度测试

## 🔧 自定义扩展

可以通过修改以下模块来扩展功能：

- `src/core/reference-scanner.js` - 自定义扫描模式
- `src/core/risk-assessor.js` - 自定义风险评估规则
- `src/report/generator.js` - 自定义报告样式和内容

## 📝 许可证

MIT License

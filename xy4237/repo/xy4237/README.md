# 换景清单巡检员 (Stage Scene Checker)

🎭 剧院舞台监督自动化脚本包 - 确保每场演出换景零失误

## 功能特性

- **🔍 自动扫描** - 自动识别演出目录中的道具清单、灯光Cue、演员出入场表和临时备注
- **📋 多格式解析** - 支持 XLSX/CSV/JSON/MD 多种文件格式
- **⚙️  规则引擎** - 内置8条核心检测规则，自动发现问题
- **✅ 复核确认** - 支持任务确认记录落盘，双人确认机制
- **📤 多格式导出** - 导出 Markdown 巡检单、CSV 风险表、JSON 审计包
- **📜 历史追溯** - 保存巡检历史，支持审计回溯

## 解决的痛点

- 😰 **漏搬道具** - 自动检测场景道具完整性
- ⏱️ **换景超时** - 监控换景时间是否超过阈值
- 🤷 **负责人缺失** - 检查危险道具是否有明确负责人
- ⚠️ **危险道具未确认** - 强制危险道具双人确认机制
- 🔀 **Cue冲突** - 检测重复Cue和演员出场时间冲突

## 安装

```bash
# 克隆项目
git clone <repository-url>
cd stage-scene-checker

# 安装依赖
npm install

# 全局安装（可选）
npm link
```

## 快速开始

### 1. 准备演出目录

在项目中创建你的演出目录结构：

```
my-show/
├── 道具清单.csv          # 或 .xlsx
├── 灯光cue.json          # 灯光Cue数据
├── 演员出入场表.csv      # 演员上下场安排
└── 临时改动备注.md        # 或 .txt
```

### 2. 运行巡检

```bash
# 基本巡检
node src/cli.js check ./my-show

# 带导出的巡检
node src/cli.js check ./my-show --export

# 指定输出目录和格式
node src/cli.js check ./my-show --export --output ./reports --format md,csv,json
```

### 3. 使用示例数据

项目包含演示数据，可以直接运行：

```bash
# 运行演示
node src/cli.js check ./examples/demo-show --export
```

## 命令说明

### `scan <directory>` - 扫描目录

仅扫描目录并列出文件，不执行完整检查。

```bash
node src/cli.js scan ./my-show
node src/cli.js scan ./my-show -v  # 详细模式
```

### `check <directory>` - 执行完整巡检

核心命令，执行完整的换景巡检流程。

**选项：**
- `-e, --export` - 导出巡检报告
- `-o, --output <path>` - 输出目录（默认 `./output`）
- `-f, --format <formats>` - 导出格式（默认 `md,csv,json`）
- `-t, --time-limit <seconds>` - 换景时间阈值（默认 120 秒）
- `--no-confirm-check` - 跳过确认状态检查
- `-v, --verbose` - 显示详细任务信息

**示例：**
```bash
# 基础检查
node src/cli.js check ./my-show

# 完整检查并导出
node src/cli.js check ./my-show -e -o ./reports -f md,json

# 自定义时间阈值
node src/cli.js check ./my-show -t 180  # 180秒
```

### `confirm <taskId> <inspector>` - 确认任务

手动确认一个任务已完成。

```bash
node src/cli.js confirm prop_0 "张三"
node src/cli.js confirm prop_0 "张三" -n "已检查，状态良好"
```

### `history` - 查看巡检历史

```bash
node src/cli.js history
node src/cli.js history -n 20  # 显示最近20条
node src/cli.js history -v     # 详细模式
```

### `export <directory>` - 单独导出报告

```bash
node src/cli.js export ./my-show -o ./output -f md,csv
```

### `clear` - 清除确认记录

```bash
node src/cli.js clear              # 清除所有记录
node src/cli.js clear -d ./my-show  # 清除指定目录的记录
node src/cli.js clear -y           # 跳过确认提示
```

## 文件格式要求

### 道具清单 (CSV/XLSX)

**必需字段：**
- `名称` / `name` / `item` - 道具名称
- `场景` / `scene` - 所属场景

**推荐字段：**
| 字段名 | 说明 | 示例 |
|--------|------|------|
| `Cue` / `cue` | 触发时间点 | Cue01 |
| `位置` / `location` | 存放位置 | 后台道具区A |
| `负责人` / `responsible` | 负责人 | 张三 |
| `时间` / `time` | 预计秒数 | 30 |
| `优先级` / `priority` | 优先级 | 高/中/低 |
| `备注` / `notes` | 特殊说明 | 易碎品 |

**示例：**
```csv
名称,场景,Cue,位置,负责人,时间(秒),优先级,备注
王座,第一幕,Cue01,后台道具区A,张三,30,高,木质仿古王座
宝剑,第一幕,Cue02,武器架,李四,15,中,危险道具-未开刃
```

### 灯光 Cue (JSON)

**格式：**
```json
[
  {
    "cueNumber": 1,
    "scene": "第一幕",
    "description": "开场白光 - 全灯亮",
    "time": 0,
    "responsible": "灯光师A",
    "intensity": "100%",
    "colorTemp": "5600K"
  }
]
```

### 演员出入场表 (CSV/XLSX)

**字段：**
| 字段名 | 说明 |
|--------|------|
| `演员` / `actor` | 演员/角色名 |
| `场景` / `scene` | 场景 |
| `Cue` / `cue` | 时间点 |
| `动作` / `action` | 行为描述 |
| `入场口` / `entrance` | 上场位置 |
| `退场口` / `exit` | 下场位置 |
| `负责人` / `responsible` | 剧务负责人 |

### 临时改动备注 (MD/TXT)

支持 Markdown 格式，自动识别标题、字段和列表。

**格式示例：**
```markdown
## 【紧急】第二幕Cue06调整

**场景**: 第二幕
**Cue**: Cue06
**负责人**: 道具师
**优先级**: 高
**紧急**: 是

**改动内容**:
- 原计划使用真枪模型，改为塑料仿真枪
- 增加安全检查步骤
```

## 检测规则说明

### 内置规则

| 规则名称 | 类型 | 说明 |
|----------|------|------|
| `missing_responsible` | 错误 | 危险道具缺少负责人 |
| `missing_responsible_warning` | 警告 | 普通任务缺少负责人 |
| `dangerous_unconfirmed` | 错误 | 危险道具未经确认 |
| `time_exceeded` | 错误 | 换景时间超过阈值 |
| `time_near_limit` | 警告 | 换景时间接近阈值 |
| `duplicate_cue` | 错误 | 同场景存在重复Cue |
| `cue_gap` | 警告 | 灯光Cue编号不连续 |
| `scene_no_props` | 警告 | 场景有灯光/演员但无道具 |
| `too_many_tasks` | 警告 | 同一时间点任务过多 |
| `no_high_priority` | 警告 | 无高优先级任务 |
| `actor_conflict` | 错误 | 演员同一时间点冲突 |

### 危险道具检测

自动识别包含以下关键词的道具为危险道具：
- 中文：危险、易燃、易爆、有毒、尖锐、重物、火、电、刀、枪
- 英文：dangerous, fire, electric, sharp

### 自定义规则

可以通过代码扩展规则：

```javascript
const RuleEngine = require('./src/rules');

const rules = new RuleEngine();

rules.addRule((tasks, parsedData, byScene, options) => {
  const issues = [];
  const warnings = [];
  
  // 你的自定义检测逻辑
  // ...
  
  return { issues, warnings };
});
```

## 导出格式说明

### Markdown 巡检单

包含：
- 执行摘要表格
- 检测到的问题（带详细说明）
- 警告信息
- 按场景分组的任务清单
- 危险道具清单
- 待确认任务列表

### CSV 风险表

用于导入 Excel 进行分析：

```csv
类型,级别,场景,任务名称,优先级,负责人,时间,确认状态,危险道具,消息,建议
问题,high,第一幕,宝剑,中,李四,15,待确认,是,危险道具"宝剑"未经确认,请立即复核
```

### JSON 审计包

完整的结构化数据，包含：
- 版本信息和导出时间
- 巡检摘要统计
- 文件元数据
- 完整任务列表
- 问题和警告详情
- 确认记录

## 项目结构

```
stage-scene-checker/
├── src/
│   ├── index.js          # 主控制类
│   ├── cli.js            # CLI 入口
│   ├── scanner.js        # 目录扫描器
│   ├── parser.js         # 文件解析器
│   ├── rules.js          # 规则引擎
│   ├── storage.js        # 状态存储
│   └── exporter.js       # 导出模块
├── examples/
│   └── demo-show/        # 示例数据
│       ├── 道具清单.csv
│       ├── 灯光cue.json
│       ├── 演员出入场表.csv
│       └── 临时改动备注.md
├── tests/                # 测试文件
│   ├── scanner.test.js
│   ├── parser.test.js
│   └── rules.test.js
├── output/               # 默认输出目录
├── .scene-checker/       # 数据存储目录
│   ├── confirmations.json
│   ├── history.json
│   └── settings.json
├── package.json
└── README.md
```

## 验证流程

### 1. 安装依赖

```bash
npm install
```

### 2. 运行测试

```bash
npm test
```

### 3. 运行演示

```bash
# 扫描演示目录
node src/cli.js scan ./examples/demo-show

# 执行完整巡检
node src/cli.js check ./examples/demo-show

# 执行巡检并导出
node src/cli.js check ./examples/demo-show --export
```

### 4. 查看导出结果

```bash
ls -la ./output/
```

### 5. 确认任务

```bash
# 查看巡检报告中的任务ID
node src/cli.js check ./examples/demo-show -v

# 确认一个危险道具任务
node src/cli.js confirm prop_1 "张三" -n "已检查宝剑，状态良好"
```

### 6. 查看历史

```bash
node src/cli.js history -v
```

## 配置选项

可以通过 `.scene-checker/settings.json` 配置：

```json
{
  "maxHistory": 50,
  "autoConfirm": false,
  "defaultTimeLimit": 120
}
```

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `maxHistory` | 50 | 保留历史记录数量 |
| `autoConfirm` | false | 是否自动确认 |
| `defaultTimeLimit` | 120 | 默认换景时间阈值（秒） |

## API 使用

除了 CLI，也可以作为 Node.js 模块使用：

```javascript
const SceneChecker = require('./src/index');

const checker = new SceneChecker({
  outputDir: './reports'
});

// 执行巡检
const result = await checker.run('./my-show', {
  export: true,
  exportFormats: ['md', 'json']
});

// 确认任务
await checker.confirmTask('prop_0', '张三', '已检查');

// 获取任务列表
const tasks = await checker.getTasks('./my-show');
```

## 常见问题

### Q: 如何让系统识别我的文件？

A: 文件名需要包含以下关键词：
- 道具清单：道具、prop、inventory
- 灯光Cue：灯光、light、cue
- 演员出入场：演员、actor、出场、入场
- 临时备注：备注、note、改动、临时

### Q: 危险道具检测不准确怎么办？

A: 可以通过 `备注` 字段明确标记：
- 在备注中包含"危险"、"火"、"电"等关键词
- 或者在代码中扩展危险关键词列表

### Q: 如何添加自定义检测规则？

A: 参考"自定义规则"章节，使用 `addRule` 方法扩展。

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。

---

🎭 **让每场演出换景零失误**

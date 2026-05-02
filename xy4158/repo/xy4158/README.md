# 离线采集包验收器 (Offline Collection Validator)

专为野外传感器维护员设计的本地端侧数据质量校验工具。解决野外多设备数据采集后常见的时间漂移、同名文件覆盖、缺测时段遗漏等问题。

## 功能特性

- **项目规则初始化** - 配置设备参数和校验规则
- **多格式支持** - 支持 CSV 数据文件、照片、设备日志
- **时间线校准** - 按设备校准时间，处理时间漂移
- **智能校验** - 自动识别：
  - 缺测时段
  - 重复文件
  - 损坏/无效文件
  - 跨设备时间冲突
- **报告导出** - 生成 Markdown 验收报告、CSV 问题清单、JSON 清洗索引
- **隔离机制** - 生成 `quarantine.json` 记录所有问题

## 安装

```bash
# 克隆项目后安装依赖
npm install

# 编译 TypeScript
npm run build

# （可选）全局安装 CLI
npm link
```

## 快速开始：临时目录验证流程

以下是一个完整的端到端验证流程，使用示例数据快速体验工具功能。

### 1. 准备环境

```bash
# 创建临时工作目录
mkdir -p /tmp/ocv-demo

# 进入项目目录并编译
cd /path/to/xy4158
npm run build
```

### 2. 初始化项目

```bash
# 初始化项目
node dist/cli/index.js init "野外采集验收-20260428" \
  -d "2026年4月28日野外传感器数据验收" \
  -D /tmp/ocv-demo
```

输出：
```
success 项目已初始化: 野外采集验收-20260428
项目目录: /tmp/ocv-demo

下一步:
  1. 添加设备: ocv add-device
  2. 导入采集包: ocv import <path>
```

### 3. 添加设备配置

添加本次采集使用的设备：

```bash
# 添加记录仪 1
node dist/cli/index.js add-device \
  -i LOGGER001 \
  -n "温湿度记录仪 #1" \
  -t logger \
  -I 5 \
  -O -15 \
  -D /tmp/ocv-demo

# 添加记录仪 2
node dist/cli/index.js add-device \
  -i LOGGER002 \
  -n "温湿度记录仪 #2" \
  -t logger \
  -I 5 \
  -D /tmp/ocv-demo

# 添加传感器
node dist/cli/index.js add-device \
  -i SENSOR003 \
  -n "电压传感器" \
  -t sensor \
  -I 1 \
  -D /tmp/ocv-demo
```

**参数说明：**
- `-i, --id`: 设备ID（必须与文件名中的标识一致）
- `-n, --name`: 设备名称
- `-t, --type`: 设备类型 (logger/camera/sensor)
- `-I, --interval`: 预期采集间隔（分钟）
- `-O, --offset`: 时间偏移（分钟，正数表示设备时间比实际慢）
- `-D, --dir`: 项目目录

查看已添加的设备：

```bash
node dist/cli/index.js list-devices -D /tmp/ocv-demo
```

### 4. 导入采集包

将示例数据导入项目：

```bash
node dist/cli/index.js import ./examples/collection-package -D /tmp/ocv-demo
```

**扫描过程说明：**

工具会自动执行以下操作：

1. **文件扫描** - 递归扫描目录中的所有允许格式文件
2. **设备识别** - 从文件名或CSV内容中提取设备ID
3. **时间提取** - 从文件名和CSV记录中提取时间戳
4. **哈希计算** - 计算文件哈希用于重复检测
5. **时间线构建** - 为每个设备建立时间线

示例数据中包含的测试场景：

| 文件名 | 场景说明 |
|--------|----------|
| `LOGGER001_20260428_080000.csv` | 正常数据文件（08:00-09:00） |
| `LOGGER001_20260428_100000.csv` | 正常数据文件（10:00-10:30）|
| `LOGGER002_20260428_080500.csv` | 第二台设备数据 |
| `SENSOR003_20260428_083000.csv` | 传感器数据（5秒间隔）|
| `LOGGER001_20260428_080000_duplicate.csv` | **重复文件** |
| `small_file.csv` | **文件过小**（仅7字节）|
| `device_log_20260428.log` | **无设备ID文件名** |

### 5. 运行规则校验

```bash
node dist/cli/index.js validate -D /tmp/ocv-demo
```

**校验规则说明：**

| 规则类型 | 检测内容 | 严重程度 |
|----------|----------|----------|
| `missing_records` | 时间线中缺失的数据段 | Critical |
| `time_drift` | 设备时间偏移超过阈值 | High |
| `duplicate_file` | 内容相同的重复文件 | Medium |
| `corrupted_file` | 无法读取或解析的文件 | Critical |
| `invalid_filename` | 无法识别设备ID | High |
| `cross_device_conflict` | 多设备时间线冲突 | Medium |
| `file_too_small` | 文件大小低于阈值 | High |
| `unexpected_extension` | 不支持的文件格式 | Medium |

**预期的校验结果：**

根据示例数据，你会看到以下问题被检测到：

1. **缺测时段 (Missing Records)** - LOGGER001 在 09:00-10:00 之间没有数据
2. **时间漂移 (Time Drift)** - LOGGER001 设置了 -15 分钟偏移
3. **重复文件 (Duplicate File)** - LOGGER001 的两个文件内容完全相同
4. **文件过小 (File Too Small)** - `small_file.csv` 只有 7 字节
5. **无效文件名 (Invalid Filename)** - `device_log_20260428.log` 无法识别设备ID
6. **跨设备冲突 (Cross Device Conflict)** - 多设备在同一时间点有记录

校验完成后会自动生成 `quarantine.json` 文件。

### 6. 查看项目状态

```bash
node dist/cli/index.js status -D /tmp/ocv-demo
```

### 7. 导出报告

#### 导出 Markdown 验收报告

```bash
node dist/cli/index.js export report -D /tmp/ocv-demo
```

报告保存在：`/tmp/ocv-demo/reports/validation-report.md`

报告包含：
- 项目摘要
- 统计数据（总文件数、有效文件数、问题分布）
- 设备状态概览
- 问题详情（按严重程度分类）

#### 导出 CSV 问题清单

```bash
node dist/cli/index.js export csv -D /tmp/ocv-demo
```

文件保存在：`/tmp/ocv-demo/issues.csv`

CSV 格式便于导入 Excel 或其他工具进行后续处理。

#### 导出 JSON 清洗索引

```bash
node dist/cli/index.js export json -D /tmp/ocv-demo
```

文件保存在：`/tmp/ocv-demo/clean-index.json`

清洗索引包含：
- 每个设备的有效文件列表
- 时间偏移校正值
- 归一化时间线

### 8. 隔离问题文件（可选）

对于有问题的文件，可以将其隔离：

```bash
# 查看 quarantine.json 获取 issueId 和 fileId
# 然后执行：
node dist/cli/index.js quarantine <fileId> <issueId> -D /tmp/ocv-demo
```

隔离的文件会被复制到 `quarantine/` 目录，并在 `quarantine.json` 中记录。

## 项目目录结构

```
项目目录/
├── ocv-project.json      # 项目配置和状态
├── quarantine.json       # 隔离记录和问题列表
├── data/                 # 数据目录（可选）
├── quarantine/           # 隔离文件存放区
├── reports/              # 导出的报告
│   └── validation-report.md
├── issues.csv            # 导出的问题清单
└── clean-index.json      # 导出的清洗索引
```

## CLI 命令参考

### 全局选项

| 选项 | 说明 |
|------|------|
| `-D, --dir` | 指定项目目录（默认为当前目录）|
| `-h, --help` | 显示帮助 |
| `-v, --version` | 显示版本 |

### 命令列表

#### `init [name]` - 初始化新项目

```bash
ocv init "项目名称" -d "项目描述" -D /path/to/project
```

| 选项 | 说明 |
|------|------|
| `-d, --description` | 项目描述 |

#### `add-device` - 添加/更新设备

```bash
ocv add-device -i DEV001 -n "设备名称" -t logger -I 5 -O -10
```

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `-i, --id` | 设备ID（必需）| - |
| `-n, --name` | 设备名称（必需）| - |
| `-t, --type` | 设备类型 | logger |
| `-I, --interval` | 预期采集间隔（分钟）| 5 |
| `-O, --offset` | 时间偏移（分钟）| 0 |

#### `list-devices` - 列出所有设备

```bash
ocv list-devices
```

#### `import <path>` - 导入采集包

```bash
ocv import /path/to/collection -f
```

| 选项 | 说明 |
|------|------|
| `-f, --force` | 强制重新扫描 |

#### `validate` - 运行规则校验

```bash
ocv validate
```

#### `export <type>` - 导出报告

```bash
# 导出 Markdown 报告
ocv export report -o /path/to/report.md

# 导出 CSV 问题清单
ocv export csv -o /path/to/issues.csv

# 导出 JSON 清洗索引
ocv export json -o /path/to/index.json
```

| 选项 | 说明 |
|------|------|
| `-o, --output` | 输出文件路径 |

#### `status` - 显示项目状态

```bash
ocv status
```

#### `quarantine <fileId> <issueId>` - 隔离问题文件

```bash
ocv quarantine abc123-def456 issue-xyz789
```

## 默认校验规则

项目初始化时使用以下默认规则：

```json
{
  "allowedExtensions": [".csv", ".jpg", ".jpeg", ".png", ".log", ".txt"],
  "maxMissingIntervals": 3,
  "maxTimeDriftMinutes": 15,
  "minFileSize": 10,
  "maxDuplicateThreshold": 2,
  "requireDeviceIdInFilename": true
}
```

可以通过编辑 `ocv-project.json` 文件来自定义规则。

## 文件名格式建议

为了获得最佳的自动识别效果，建议使用以下命名格式：

```
{设备ID}_{YYYYMMDD}_{HHMMSS}.{扩展名}
```

示例：
- `LOGGER001_20260428_080000.csv`
- `CAM002_20260428_143000.jpg`
- `SENSOR003_20260428.log`

### 时间戳格式支持

工具能够识别以下时间戳格式：

- ISO 8601: `2026-04-28T08:00:00Z`
- 压缩格式: `20260428_080000`
- 日期格式: `2026-04-28`

## 开发指南

### 运行测试

```bash
npm test
```

### 项目结构

```
src/
├── cli/              # 命令行接口
│   └── index.ts
├── scanner/          # 文件扫描模块
│   └── index.ts
├── timeline/         # 时间线校准模块
│   └── index.ts
├── validator/        # 规则校验模块
│   └── index.ts
├── storage/          # 存储模块
│   └── index.ts
├── exporter/         # 导出模块
│   └── index.ts
├── utils/            # 工具函数
│   └── index.ts
└── types/            # 类型定义
    └── index.ts
```

### 模块说明

| 模块 | 职责 |
|------|------|
| `Scanner` | 文件系统扫描、类型识别、哈希计算 |
| `TimelineCalibrator` | 时间线构建、时间偏移校准、冲突检测 |
| `RuleValidator` | 规则引擎、问题检测、严重程度评估 |
| `ProjectStorage` | 项目持久化、状态管理、文件隔离 |
| `DataExporter` | 报告生成、数据导出 |

## 常见问题

### Q: 如何处理设备时间漂移？

A: 使用 `-O, --offset` 参数设置时间偏移，或在 `ocv-project.json` 中配置 `calibrationPoints` 进行多点校准。

### Q: 如何添加自定义设备ID识别规则？

A: 修改 `src/utils/index.ts` 中的 `extractDeviceIdFromFilename` 函数，添加自定义正则表达式。

### Q: quarantine.json 的作用是什么？

A: 该文件记录所有检测到的问题和隔离操作，用于：
- 问题追踪和审计
- 后续数据清洗的参考
- 导出报告的数据源

### Q: 可以处理哪些类型的文件？

A: 目前支持：
- **CSV** - 解析数据记录和时间戳
- **JPG/PNG/GIF** - 照片文件（从文件名提取时间）
- **LOG/TXT** - 日志文件（从文件名和内容提取时间）

## License

MIT

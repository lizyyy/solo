# 疫苗温度异常复盘台

社区卫生服务站冷链数据分析工具，帮助冷链管理员快速识别温度异常、追踪疫苗批次风险。

## 核心功能

### 解决的痛点

1. **短时超温漏看** - 智能检测温度异常，包括短时超温和低温
2. **探头断线误判** - 识别探头断线/故障情况，避免将异常低温误判为正常
3. **转移责任不清** - 追踪疫苗跨冰箱转移过程中的温度空档，明确责任链条

### 主要功能

- **数据解析** - 支持多种CSV格式的温度记录、开门记录、疫苗批次清单
- **异常检测** - 7种检测规则：
  - 超温检测 (over_temp)
  - 低温检测 (under_temp)
  - 缺测检测 (missing_data)
  - 温度波动检测 (rapid_change)
  - 探头断线检测 (probe_disconnect)
  - 长时间开门检测 (door_open_long)
  - 转移空档检测 (transfer_gap)
- **风险评估** - 按疫苗批次生成风险片段和处置建议
- **会话存储** - 保存和加载复盘会话
- **报告导出** - 支持 Markdown、CSV、JSON 三种格式

## 快速开始

### 环境要求

- Node.js >= 18.0.0
- npm 或 yarn

### 安装

```bash
# 克隆项目（或直接使用项目目录）
cd /path/to/project

# 安装依赖
npm install
```

### 编译

```bash
npm run build
```

## 使用方法

### 1. 快速演示

使用内置示例数据运行演示分析：

```bash
# 使用 ts-node 直接运行（开发模式）
npm run dev -- demo

# 或编译后运行
npm start -- demo

# 保存会话
npm run dev -- demo -s --name "我的演示分析"
```

### 2. 生成示例数据

生成示例CSV文件用于测试：

```bash
# 在当前目录生成示例文件
npm run dev -- generate-samples

# 指定输出目录
npm run dev -- generate-samples -o ./data
```

将生成以下文件：
- `temperature-sample.csv` - 温度记录（包含超温、低温、探头断线等异常）
- `door-sample.csv` - 开门记录（包含长时间开门）
- `vaccine-sample.csv` - 疫苗批次清单（包含跨冰箱转移）

### 3. 导入并分析数据

导入自己的CSV文件：

```bash
# 导入温度记录（必需）
npm run dev -- import -t ./temperature-sample.csv

# 导入所有三种文件
npm run dev -- import -t ./temperature-sample.csv -d ./door-sample.csv -v ./vaccine-sample.csv

# 导入多个温度文件
npm run dev -- import -t ./fridge1.csv ./fridge2.csv

# 保存会话
npm run dev -- import -t ./temperature-sample.csv -s --name "2026-05-01 复盘"
```

### 4. 会话管理

列出现有会话：

```bash
# 列出所有会话
npm run dev -- sessions -l

# 加载指定会话
npm run dev -- sessions -L <session-id>

# 删除会话
npm run dev -- sessions -d <session-id>
```

### 5. 导出报告

导出分析报告：

```bash
# 导出 Markdown 格式（默认）
npm run dev -- export

# 导出 CSV 格式
npm run dev -- export -f csv

# 导出 JSON 格式
npm run dev -- export -f json

# 指定输出目录
npm run dev -- export -f markdown -o ./reports

# 使用指定会话ID导出
npm run dev -- export -i <session-id> -f markdown
```

## 数据格式要求

### 温度记录 CSV

支持的列名（中英文均可）：
- `时间` 或 `timestamp` 或 `DateTime`
- `冰箱ID` 或 `fridgeId` 或 `FridgeID`
- `探头ID` 或 `probeId` 或 `ProbeID` 或 `SensorID`
- `温度` 或 `temperature` 或 `temp`

示例：
```csv
时间,冰箱ID,探头ID,温度,状态
2026-05-01 08:00:00,FRIDGE-001,PROBE-01,4.5,正常
2026-05-01 08:05:00,FRIDGE-001,PROBE-01,9.5,超温
2026-05-01 08:10:00,FRIDGE-001,PROBE-01,ERROR,异常
```

### 开门记录 CSV

支持的列名：
- `时间` 或 `timestamp`
- `冰箱ID` 或 `fridgeId`
- `事件` 或 `event` 或 `类型`（"开门"/"open" 或 "关门"/"close"）
- `持续时间(分钟)` 或 `duration`
- `操作员` 或 `operator`

示例：
```csv
时间,冰箱ID,事件,持续时间(分钟),操作员
2026-05-01 09:00:00,FRIDGE-001,开门,2,张护士
2026-05-01 09:02:00,FRIDGE-001,关门,2,张护士
```

### 疫苗批次清单 CSV

支持的列名：
- `批次号` 或 `batchId` 或 `批号`
- `疫苗名称` 或 `vaccineName` 或 `名称`
- `生产厂家` 或 `manufacturer` 或 `厂家`
- `数量` 或 `quantity` 或 `库存`
- `最低温度` 或 `minTemp` 或 `低温`
- `最高温度` 或 `maxTemp` 或 `高温`
- `有效期开始` 或 `validFrom` 或 `生效日期`
- `有效期结束` 或 `validTo` 或 `失效日期` 或 `有效期`
- `冰箱ID` 或 `fridgeId` 或 `存储位置` 或 `位置`
- `入库日期` 或 `entryDate` 或 `入库时间`
- `出库日期` 或 `exitDate` 或 `出库时间`（可选，用于跨冰箱转移）
- `目标冰箱` 或 `targetFridgeId` 或 `转移目标`（可选）
- `备注` 或 `notes` 或 `说明`

示例：
```csv
批次号,疫苗名称,生产厂家,数量,最低温度,最高温度,有效期开始,有效期结束,冰箱ID,入库日期,出库日期,目标冰箱,备注
VAC-2026-001,新冠灭活疫苗,中生集团,100,2,8,2026-01-01,2026-12-31,FRIDGE-001,2026-04-01,,,常规库存
VAC-2026-003,流感疫苗,华兰生物,80,2,8,2025-09-01,2026-08-31,FRIDGE-002,2026-02-20,2026-05-02,FRIDGE-001,跨冰箱转移
```

## 本地验证流程

### 步骤 1：安装依赖

```bash
npm install
```

### 步骤 2：运行类型检查

```bash
npm run typecheck
```

### 步骤 3：运行测试

```bash
npm test
```

### 步骤 4：运行演示

```bash
npm run dev -- demo
```

预期输出：
```
🧪 开始演示分析...

📊 数据统计:
  - 温度记录: 576 条
  - 开门记录: 6 条
  - 疫苗批次: 3 个

🔍 运行规则引擎分析...

📋 分析概要:
  时间范围: 2026-05-01 08:00 - 2026-05-02 08:00
  总记录数: 576
  异常事件: X 个
  风险片段: X 个
  受影响批次: X 个

⚠️  异常类型分布:
  - 超温: X 个
  - 低温: X 个
  - 探头断线: X 个
  ...

✅ 演示分析完成！
```

### 步骤 5：生成示例文件并导入

```bash
# 生成示例文件
npm run dev -- generate-samples -o ./test-data

# 导入并分析
npm run dev -- import -t ./test-data/temperature-sample.csv -d ./test-data/door-sample.csv -v ./test-data/vaccine-sample.csv -s
```

### 步骤 6：导出报告

```bash
# 导出 Markdown 报告
npm run dev -- export -f markdown -o ./reports

# 导出 CSV 报告
npm run dev -- export -f csv -o ./reports

# 导出 JSON 报告
npm run dev -- export -f json -o ./reports
```

## 项目结构

```
xy4122/
├── src/
│   ├── cli/              # CLI 命令行界面
│   │   └── index.ts
│   ├── exporters/        # 报告导出模块
│   │   ├── index.ts
│   │   ├── markdownExporter.ts
│   │   ├── csvExporter.ts
│   │   └── jsonExporter.ts
│   ├── parsers/          # 数据解析模块
│   │   ├── index.ts
│   │   ├── temperatureParser.ts
│   │   ├── doorParser.ts
│   │   └── vaccineParser.ts
│   ├── rules/            # 规则引擎模块
│   │   ├── index.ts
│   │   ├── types.ts
│   │   ├── ruleEngine.ts
│   │   ├── riskAssessor.ts
│   │   ├── timelineBuilder.ts
│   │   └── rules/
│   │       ├── overTempRule.ts
│   │       ├── underTempRule.ts
│   │       ├── missingDataRule.ts
│   │       ├── probeDisconnectRule.ts
│   │       ├── rapidChangeRule.ts
│   │       ├── doorOpenLongRule.ts
│   │       └── transferGapRule.ts
│   ├── samples/          # 示例数据
│   │   ├── index.ts
│   │   └── sampleData.ts
│   ├── storage/          # 会话存储模块
│   │   ├── index.ts
│   │   └── sessionStorage.ts
│   ├── types/            # 类型定义
│   │   └── index.ts
│   └── index.ts          # 主模块入口
├── tests/                # 测试用例
│   ├── parsers.test.ts
│   └── rules.test.ts
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

## 配置说明

### 默认阈值设置

在 `src/rules/types.ts` 中可以调整检测阈值：

```typescript
const DEFAULT_CONFIG = {
  thresholds: {
    overTempThreshold: 8,        // 超温阈值 (°C)
    underTempThreshold: 2,        // 低温阈值 (°C)
    missingDataMinutes: 30,       // 缺测阈值 (分钟)
    rapidChangeThreshold: 2,      // 温度波动阈值 (°C)
    doorOpenMinutes: 5,            // 长时间开门阈值 (分钟)
  },
  defaultVaccineMinTemp: 2,      // 疫苗默认最低存储温度
  defaultVaccineMaxTemp: 8,       // 疫苗默认最高存储温度
  probeDisconnectThreshold: -80,  // 探头断线温度阈值
  transferGapThresholdMinutes: 15, // 转移空档阈值
};
```

## 风险等级说明

| 等级 | 颜色 | 说明 |
|------|------|------|
| 高风险 | 🔴 红色 | 严重超温/低温超过2小时，或多个临界异常 |
| 中风险 | 🟡 黄色 | 超温/低温超过1小时，或多个警告级异常 |
| 低风险 | 🟢 绿色 | 轻微超温/低温，或短时间异常 |
| 无风险 | ⚪ 白色 | 正常状态 |

## 处置建议优先级

| 优先级 | 说明 | 时限 |
|--------|------|------|
| 立即 | 需要立即采取行动 | 2小时内 |
| 紧急 | 需要紧急处理 | 24小时内 |
| 标准 | 常规处理 | 72小时内 |
| 监控 | 持续观察 | 无时限 |

## 异常类型说明

| 类型 | 说明 | 检测逻辑 |
|------|------|----------|
| 超温 | 温度超过设定阈值 | 温度 > 8°C |
| 低温 | 温度低于设定阈值 | 温度 < 2°C |
| 缺测 | 温度记录缺失 | 相邻记录间隔 > 30分钟 |
| 温度波动 | 温度快速变化 | 5分钟内变化 > 2°C |
| 探头断线 | 探头故障/断线 | 温度极低 (< -80°C) 或无效值 |
| 长时间开门 | 冰箱门开启过久 | 开门持续 > 5分钟 |
| 转移空档 | 疫苗转移期间无监控 | 转移过程中温度记录空档 |

## 许可证

MIT License

## 技术栈

- **TypeScript** - 类型安全的 JavaScript 超集
- **Node.js** - JavaScript 运行时
- **date-fns** - 日期处理库
- **commander** - CLI 命令行解析
- **csv-parse / csv-stringify** - CSV 解析和生成
- **fs-extra** - 文件系统操作
- **uuid** - 唯一标识符生成
- **Jest** - 测试框架

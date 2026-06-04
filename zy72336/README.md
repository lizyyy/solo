# 核密度客流峰值分析系统

带完整自检和追踪功能的客流峰值分析工具，确保手算反例可追溯、导出数据一致。

## 功能特性

- ✅ **核密度峰值计算** - 基于高斯核的客流密度分析
- ✅ **重复导入检测** - 防止同一文件重复导入
- ✅ **负数样本追踪** - 标记负数样本待人工复核，不自动当成缺失值
- ✅ **缺失值处理** - 边界案例标记和追踪
- ✅ **手算反例记录** - 保留原始行号、人工改动、处理状态
- ✅ **补录后重算** - 问卷原始行补录后支持重新计算
- ✅ **统一数据源** - 页面展示/API返回/导出明细读取同一份结果
- ✅ **导出一致性检查** - 自动验证各维度计数一致
- ✅ **边界样本报告** - 学生助教复核用的详细报告

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 运行完整演示

```bash
npm run demo
```

演示将完整覆盖三步流程：
1. **第一次导入** - 导入初始客流数据，自动检测负数样本和缺失值
2. **补录后重算** - 模拟问卷原始行补录到群里后重新计算
3. **边界样本更新** - 人工复核负数样本并生成报告

### 3. 运行基本自检

```bash
npm run self-check
```

自检覆盖以下检查点：
- 重复导入检测
- 负数样本处理（待复核状态）
- 缺失值标记
- 补录后重算功能
- 导出一致性
- 页面/API/导出同数据源

### 4. 生成边界样本报告

```bash
npm run boundary-report
```

生成学生助教复核用的边界样本详细报告。

## 使用说明

### 基础用法

```javascript
const NuclearDensityPeakAnalysis = require('./src/index');

// 创建分析实例
const analysis = new NuclearDensityPeakAnalysis({
  dataDir: './data',
  calculator: { bandwidth: 30, gridSize: 50 }
});

// 1. 导入数据
await analysis.importData('./data/raw/sample-flow-data-part1.csv', '初始导入');

// 2. 运行分析
analysis.analyze('flow');

// 3. 查看边界案例
const boundaryCases = analysis.getBoundaryCases();

// 4. 人工复核后应用修改
analysis.applyManualEdit(
  recordIndex,
  'flow',
  '50',
  '问卷核对后确认应为50',
  '运营规划-阿岚'
);

// 5. 重算
analysis.recalculateAfterSupplement();

// 6. 导出
analysis.export('./data/exports');
```

### 数据目录结构

```
data/
├── raw/                    # 原始数据文件
│   ├── sample-flow-data-part1.csv
│   └── sample-flow-data-part2-supplement.csv
├── processed/             # 处理后数据
├── exports/               # 导出的报告
│   ├── detailed-records-*.csv
│   ├── boundary-cases-*.csv
│   ├── manual-calculation-audit-*.csv
│   ├── peak-results-*.csv
│   └── full-export-*.json
└── audit/                 # 审计日志和报告
    ├── audit-log.jsonl
    ├── self-check-report.json
    └── boundary-report.json
```

### 手算反例追踪系统

每条手算反例记录包含：

| 字段 | 说明 |
|------|------|
| `originalLineNumber` | 原始CSV行号，学生助教可追溯 |
| `currentStatus` | 当前处理状态（pending_review/manual_confirmed等） |
| `issues` | 检测到的问题列表（负数、缺失、重复等） |
| `manualEdits` | 人工改动历史（原值/新值/原因/操作人/时间） |
| `rawData` | 原始数据快照 |

### 记录状态说明

- `pending_review` - 待人工复核（负数样本）
- `manual_confirmed` - 人工已确认
- `auto_processed` - 自动处理（正常数据）
- `boundary_case` - 边界案例（缺失值等）
- `excluded` - 已排除

## 典型工作流程

### 三步标准流程（运营规划阿岚 ➔ 学生助教）

#### 第一步：第一次导入
```bash
# 导入初始数据
await analysis.importData('./data/raw/part1.csv', '第一次导入');

# 发现负数样本自动标记为 pending_review，不急着归正常
```

#### 第二步：问卷原始行补录后重算
```bash
# 群里补了问卷原始行，导入补充数据
await analysis.importData('./data/raw/part2-supplement.csv', '补录导入');

# 补录后重算
analysis.recalculateAfterSupplement();
```

#### 第三步：边界样本报告更新
```bash
# 生成边界样本报告，学生助教按报告复核
npm run boundary-report

# 助教复核后应用人工修改
analysis.applyManualEdit(
  recordIndex,
  'flow',
  correctedValue,
  '问卷核对后修正',
  '学生助教-张三'
);

# 最终重算并导出
analysis.recalculateAfterSupplement();
analysis.export('./data/exports');
```

## 自检清单

- [x] 重复导入检测 - 同一文件不会被导入两次
- [x] 负数样本处理 - 标记为 `pending_review`，不自动当成缺失
- [x] 缺失值处理 - 标记为 `boundary_case`
- [x] 补录后重算 - 支持增量导入后重新计算
- [x] 导出一致性 - 各维度计数自动校验
- [x] 统一数据源 - 页面/API/导出读取同一份结果
- [x] 手算反例追踪 - 原始行号、人工改动、处理状态完整保留
- [x] 审计日志 - 所有操作记录到 audit-log.jsonl

## API 参考

### NuclearDensityPeakAnalysis

#### `importData(filePath, sourceName)`
导入CSV数据，自动检测重复导入和数据问题。

#### `analyze(valueField = 'flow')`
运行核密度峰值分析。

#### `recalculateAfterSupplement()`
补录数据后重新计算。

#### `applyManualEdit(recordIndex, field, newValue, reason, operator)`
应用人工修改并记录审计轨迹。

#### `export(exportDir)`
导出所有报告（CSV + JSON）。

#### `getConsistencyCheck()`
执行导出一致性检查。

#### `getBoundaryCases()`
获取所有边界案例。

#### `getNegativeSamples()`
获取所有负数样本。

#### `getManualCalculationExamples()`
获取手算反例完整记录（含原始行号和改动历史）。

#### `getPageDisplayData()`
获取页面展示用的数据结构。

#### `getAPIResponse()`
获取API响应格式的数据。

## 项目结构

```
├── src/
│   ├── index.js                 # 主入口
│   ├── core/
│   │   └── nuclear-density.js   # 核密度算法
│   ├── data/
│   │   └── data-manager.js      # 数据管理和追踪
│   └── export/
│       └── unified-export.js    # 统一导出和一致性检查
├── scripts/
│   ├── demo.js                  # 完整演示脚本
│   ├── self-check.js            # 自检脚本
│   └── boundary-report.js       # 边界样本报告
├── data/
│   └── raw/                     # 样例数据
└── README.md
```

## 常见问题

### Q: 负数样本为什么不急着归正常？
A: 负数可能是录入错误，也可能是真实的调账记录。系统保留原始证据，留给学生助教对照问卷原始行进行复核，避免误判。

### Q: 手算反例的原始行号在哪里看？
A: 在以下位置都能找到：
- `getManualCalculationExamples()` 返回的 `originalLineNumber` 字段
- 导出的 manual-calculation-audit-*.csv
- 边界样本报告 boundary-report.json

### Q: 如何确认页面、API、导出的数据一致？
A: 三者都通过 `dataManager.getUnifiedResults()` 读取同一份数据源，可运行 `npm run self-check` 验证。

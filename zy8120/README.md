# 无人机电力巡检影像预检工具 (Drone Inspection Precheck)

一个用于无人机电力巡检影像交付包离线预检的 Node.js/TypeScript CLI 工具。

## 功能特性

- ✅ **漏拍航点检查** - 对比航线计划与实际拍摄，检测未拍摄的航点
- ✅ **重复/缺失文件检查** - 检测清单中的重复条目和实际缺失的图片文件
- ✅ **时间异常检查** - 检测时间倒流、异常时间间隔、跨时区时间
- ✅ **坐标异常检查** - 检测实际拍摄坐标与计划航点偏差过大
- ✅ **缺陷标注 bbox 越界检查** - 检测缺陷标注框是否超出图像边界
- ✅ **断点重飞片段合并** - 自动识别同一杆塔的多次重飞，合并生成最终覆盖结论

## 边界情况覆盖

- 🕐 **跨时区时间** - 支持 UTC+08:00、Asia/Shanghai 等多种时区格式
- 🔄 **同一杆塔多次重飞** - 自动识别重飞片段，合并计算最终覆盖情况

## 项目结构

```
zy8120/
├── src/
│   ├── types/              # TypeScript 类型定义
│   ├── parsers/            # 文件解析器
│   │   ├── yamlParser.ts   # YAML (route.yaml)
│   │   ├── csvParser.ts    # CSV (manifest.csv)
│   │   ├── jsonlParser.ts  # JSONL (defects.jsonl)
│   │   └── imageParser.ts  # 图片 EXIF 读取
│   ├── checkers/           # 检查器模块
│   │   ├── waypointChecker.ts    # 漏拍航点检查
│   │   ├── fileChecker.ts        # 文件重复/缺失检查
│   │   ├── anomalyChecker.ts     # 时间/坐标异常检查
│   │   ├── bboxChecker.ts        # bbox 越界检查
│   │   └── coverageChecker.ts    # 重飞片段合并
│   ├── reporters/          # 报告生成器
│   │   ├── markdownReporter.ts   # report.md
│   │   ├── csvReporter.ts        # issues.csv
│   │   └── jsonReporter.ts       # clean_manifest.json
│   ├── precheckEngine.ts   # 核心预检引擎
│   ├── cli.ts              # CLI 入口
│   └── index.ts            # 模块导出
├── sample/                 # 示例测试数据
│   ├── route.yaml
│   ├── manifest.csv
│   ├── defects.jsonl
│   └── images/
├── scripts/
│   └── generateTestImages.js
├── package.json
├── tsconfig.json
└── README.md
```

## 安装

```bash
npm install
```

## 编译

```bash
npm run build
```

## 使用方法

### 命令格式

```bash
# 开发模式（使用 ts-node）
npm run dev -- check -i <输入目录> -o <输出目录>

# 生产模式（编译后）
npm start -- check -i <输入目录> -o <输出目录>

# 或直接使用编译后的文件
node dist/cli.js check -i <输入目录> -o <输出目录>
```

### 参数说明

| 参数 | 必填 | 说明 | 默认值 |
|------|------|------|--------|
| `-i, --input` | 是 | 输入目录路径（包含 route.yaml, manifest.csv, defects.jsonl, images/） | - |
| `-o, --output` | 是 | 输出目录路径 | - |
| `-t, --timezone` | 否 | 时区，如 Asia/Shanghai 或 UTC | `Asia/Shanghai` |
| `--coord-tolerance` | 否 | 坐标容差（度） | `0.001` |
| `--time-tolerance` | 否 | 时间容差（分钟） | `30` |
| `--strict` | 否 | 严格模式，发现问题时退出码为 1 | `false` |

### 快速演示

使用示例数据运行预检：

```bash
# 1. 生成测试图片
node scripts/generateTestImages.js

# 2. 运行预检
npm run dev -- check -i ./sample -o ./sample/output

# 或编译后运行
npm run build
npm start -- check -i ./sample -o ./sample/output
```

### 输入目录结构

输入目录需要包含以下文件和目录：

```
<输入目录>/
├── route.yaml       # 航线计划文件
├── manifest.csv     # 拍摄清单
├── defects.jsonl    # 缺陷标注（可选）
└── images/          # 图片目录
    ├── *.jpg
    ├── *.jpeg
    └── ...
```

## 输出文件

运行后会在输出目录生成以下文件：

| 文件名 | 格式 | 说明 |
|--------|------|------|
| `report.md` | Markdown | 详细的预检报告，包含所有问题和覆盖情况 |
| `issues.csv` | CSV | 问题清单表格，方便导入其他工具 |
| `clean_manifest.json` | JSON | 清理后的清单（去重、移除无效条目） |
| `precheck_result.json` | JSON | 完整的预检结果数据 |

## 示例数据说明

`sample/` 目录包含了各种边界情况的测试数据：

### 包含的测试场景

1. **漏拍航点** - TOWER-D 的 WP-TOWER-D-002 未拍摄
2. **重复文件** - TOWER-A_002_20260503_090010.jpg 在清单中出现两次
3. **时间倒流** - TOWER-C 的第3张照片时间早于第1、2张
4. **跨时区时间** - TOWER-B 的重飞照片使用 `+08:00` 时区格式
5. **同一杆塔多次重飞** - TOWER-B 有 3 次飞行（主飞 + 2次重飞）
6. **bbox 越界** - 多个缺陷标注：
   - DEF-003: x+width=4100 > imageWidth=4000（超出右边界）
   - DEF-004: x=-50（坐标为负）
   - DEF-005: y+height=3100 > imageHeight=3000（超出下边界）
   - DEF-006: 引用不存在的图片

### 示例数据覆盖情况

| 杆塔 | 状态 | 总航点 | 已覆盖 | 重飞次数 |
|------|------|--------|--------|----------|
| TOWER-A | ✅ 完全覆盖 | 4 | 4 | 0 |
| TOWER-B | ✅ 完全覆盖（重飞合并） | 3 | 3 | 2 |
| TOWER-C | ✅ 完全覆盖 | 3 | 3 | 0 |
| TOWER-D | ⚠️ 部分覆盖 | 2 | 1 | 0 |

## API 参考

### 作为模块使用

```typescript
import { PrecheckEngine, PrecheckOptions } from 'drone-inspection-precheck';

const options: PrecheckOptions = {
  inputDir: '/path/to/input',
  outputDir: '/path/to/output',
  timezone: 'Asia/Shanghai',
  coordinateTolerance: 0.001,
  timeToleranceMinutes: 30,
  strict: false,
};

const engine = new PrecheckEngine(options);
const result = await engine.run();

console.log(`总问题数: ${result.summary.totalIssues}`);
console.log(`严重问题: ${result.summary.criticalIssues}`);
console.log(`检查通过: ${result.success}`);
```

## 问题严重级别

| 级别 | 说明 | 示例 |
|------|------|------|
| `critical` | 严重问题，必须处理 | 杆塔完全未覆盖、所有航点漏拍 |
| `major` | 主要问题，建议处理 | 漏拍航点、bbox 越界、覆盖不完整 |
| `minor` | 次要问题，可选处理 | 时间间隔异常、时区不一致 |
| `info` | 信息提示，仅供参考 | 检测到重飞片段 |

## 依赖项

- `commander` - CLI 参数解析
- `csv-parser` - CSV 文件解析
- `csv-writer` - CSV 文件写入
- `exifreader` - 图片 EXIF 数据读取
- `js-yaml` - YAML 文件解析
- `luxon` - 日期时间处理（时区支持）
- `zod` - 数据验证

## License

MIT

# 口播时间轴缝合台 (Podcast Timeline Stitcher)

一款给播客剪辑师用的本地音频章节整理工具。导入录音WAV、片段CSV、字幕SRT和广告表，生成统一时间轴，自动检测常见问题，支持人工修正并本地保存。

## 功能特性

### 核心功能
- **多源导入**: 支持 WAV 音频、片段 CSV、字幕 SRT、广告时间表
- **统一时间轴**: 合并所有数据源，生成完整的时间轴视图
- **自动检测**:
  - 🔴 **片段重叠**: 检测时间轴上的片段重叠
  - ⚠️ **时间空洞**: 检测片段之间的空白间隙
  - 🔇 **静音未裁剪**: 检测片段内残留的静音区域
  - 🔊 **响度峰值**: 检测音频中的响度超标
  - 📢 **广告重叠**: 检测广告是否压到正文内容
  - 💬 **字幕漂移**: 检测字幕与片段时间不匹配
  - 🔢 **顺序错误**: 检测片段序号与时间顺序不一致

### 导出功能
- 📄 **Markdown 交付单**: 完整的节目交付文档
- 📋 **章节 JSON**: 结构化的章节时间轴数据
- 📊 **问题清单 CSV**: 可编辑的问题列表

### 本地持久化
- 所有数据保存为本地 JSON 文件
- 支持人工修正记录
- 问题解决状态跟踪

## 项目结构

```
xy4133/
├── src/
│   ├── index.js              # CLI 入口
│   ├── types.js              # 类型定义和工具函数
│   ├── core/
│   │   ├── index.js
│   │   └── stitcher.js       # 核心业务逻辑
│   ├── parsers/
│   │   ├── index.js
│   │   ├── srtParser.js      # SRT 字幕解析
│   │   ├── csvParser.js      # CSV 片段解析
│   │   ├── adParser.js       # 广告表解析
│   │   └── wavParser.js      # WAV 音频解析
│   ├── timeline/
│   │   ├── index.js
│   │   └── timelineMerger.js # 时间轴合并
│   ├── detectors/
│   │   ├── index.js
│   │   ├── audioDetector.js  # 音频检测
│   │   └── ruleEngine.js     # 规则引擎
│   ├── persistence/
│   │   ├── index.js
│   │   └── projectStore.js   # 项目存储
│   └── exporters/
│       ├── index.js
│       └── exporters.js      # 导出功能
├── test/
│   ├── types.test.js
│   ├── parsers.test.js
│   ├── timeline.test.js
│   └── detectors.test.js
├── examples/
│   ├── sample_clips.csv      # 示例片段数据
│   ├── sample_subtitles.srt  # 示例字幕
│   └── sample_ads.txt        # 示例广告表
├── package.json
└── README.md
```

## 安装

### 环境要求
- Node.js >= 18.0.0
- npm 或 yarn

### 安装步骤

```bash
# 进入项目目录
cd /Users/mac/pro/solocoder/pro/xy4133/repo/xy4133

# 安装依赖
npm install
```

## 快速开始

### 1. 查看帮助

```bash
# 查看所有命令
node src/index.js --help

# 查看具体命令帮助
node src/index.js import --help
```

### 2. 使用示例数据测试

项目提供了包含故意制造问题的示例数据，用于测试检测功能。

#### 方式一：一步完成

```bash
# 导入示例文件并创建项目
node src/index.js import \
  --name "测试节目_第001期" \
  --clips examples/sample_clips.csv \
  --subtitles examples/sample_subtitles.srt \
  --ads examples/sample_ads.txt
```

#### 方式二：分步执行

```bash
# 创建新项目
node src/index.js create "测试节目_第001期"

# 导入文件 (替换项目文件路径)
node src/index.js import \
  --project "测试节目_第001期.pts.json" \
  --clips examples/sample_clips.csv \
  --subtitles examples/sample_subtitles.srt \
  --ads examples/sample_ads.txt
```

### 3. 运行检测

```bash
# 运行所有检测
node src/index.js check --project "测试节目_第001期.pts.json"

# 显示详细问题
node src/index.js check --project "测试节目_第001期.pts.json" --verbose
```

### 4. 查看报告

```bash
# 打印完整报告
node src/index.js report --project "测试节目_第001期.pts.json"
```

### 5. 导出文件

```bash
# 导出所有格式到 output 目录
node src/index.js export --project "测试节目_第001期.pts.json" --output ./output

# 只导出特定格式
node src/index.js export --project "测试节目_第001期.pts.json" --markdown
node src/index.js export --project "测试节目_第001期.pts.json" --chapters
node src/index.js export --project "测试节目_第001期.pts.json" --issues
```

### 6. 查看项目列表

```bash
# 查看当前目录下的所有项目
node src/index.js list

# 查看指定目录
node src/index.js list --dir ./output
```

## 输入文件格式说明

### 1. 片段 CSV 格式

支持多种列名命名方式：

| 必需列 | 支持的列名 | 说明 |
|--------|-----------|------|
| 开始时间 | start, startTime, start_time, 开始时间, 入点 | 支持 `HH:MM:SS.mmm` 或秒数 |
| 结束时间 | end, endTime, end_time, 结束时间, 出点 | 同上 |
| 名称 | name, title, 名称, 标题, 片段名 | 片段名称 |

**示例:**
```csv
序号,片段名,开始时间,结束时间,时长,类型
1,开场问候,0:00:00.000,0:00:15.500,15.5,正文
2,第一章,0:00:15.500,0:02:30.000,134.5,章节
```

### 2. 字幕 SRT 格式

标准 SRT 格式：

```
1
00:00:00,500 --> 00:00:03,200
字幕文本第一行
字幕文本第二行

2
00:00:03,500 --> 00:00:07,000
下一条字幕
```

### 3. 广告表格式

支持多种格式：

**CSV 格式:**
```csv
序号,名称,开始时间,结束时间,时长(秒),位置
1,"某品牌咖啡广告",0:02:28.000,0:03:00.000,32.0,中场
```

**简单文本格式:**
```
02:28 某品牌咖啡广告 (中场)
06:30 赞助商鸣谢 (结尾)
```

**时间格式支持:**
- `HH:MM:SS.mmm` - 完整格式
- `MM:SS` - 分:秒
- `XX秒` / `XX分` - 带单位

## 检测规则说明

### 默认阈值

| 检测项 | 默认阈值 | 说明 |
|--------|---------|------|
| 片段重叠 | 50ms | 超过此值视为重叠 |
| 时间空洞 | 1000ms | 超过此值视为空洞 |
| 静音残留 | 100ms | 片段内静音超过此值 |
| 响度峰值 | -3 dBFS | 超过此值标记 |
| 广告安全距离 | 100ms | 广告与内容的最小间距 |
| 字幕漂移 | 500ms | 字幕与片段的最大时差 |

### 问题严重程度

- 🔴 **CRITICAL (致命)**: 片段重叠、顺序错误、广告压正文
- 🟠 **HIGH (高)**: 时间空洞、响度峰值、严重字幕漂移
- 🟡 **MEDIUM (中)**: 静音未裁剪、广告安全距离不足
- 🟢 **LOW (低)**: 轻微字幕漂移、结尾空白

## 编程接口 (API)

除了 CLI 工具，也可以作为 Node.js 模块使用：

```javascript
import { PodcastTimelineStitcher } from './src/core/index.js';

// 创建实例
const stitcher = new PodcastTimelineStitcher({
  gapThreshold: 1000,
  peakThreshold: -3
});

// 创建新项目
stitcher.createNewProject('我的节目');

// 导入文件
const parsedData = await stitcher.importFiles({
  clipsCsv: './clips.csv',
  subtitlesSrt: './subtitles.srt',
  adSchedule: './ads.txt',
  wav: './audio.wav'
});

// 生成时间轴
const timeline = stitcher.generateTimeline(parsedData);

// 运行检测
const issues = stitcher.runAllChecks();

// 保存项目
stitcher.saveProject('./my-project.pts.json');

// 导出
const markdown = stitcher.exportDeliveryNote();
const chapters = stitcher.exportChapters();
const issuesCsv = stitcher.exportIssuesCSV();
```

## 测试

### 运行单元测试

```bash
# 运行所有测试
npm test

# 或者直接使用
node --test test/
```

### 测试覆盖

- `types.test.js`: 时间转换和常量
- `parsers.test.js`: SRT/CSV/广告表解析
- `timeline.test.js`: 时间轴合并和更新
- `detectors.test.js`: 重叠/空洞/顺序检测

## 示例数据说明

`examples/` 目录下的示例数据故意包含以下问题，用于测试检测功能：

| 问题类型 | 位置 | 说明 |
|---------|------|------|
| 片段重叠 | 开场问候 vs 第一章 | 14s 开始 vs 15.5s 结束 |
| 时间空洞 | 第二章与第三章之间 | 3:00 结束 vs 3:05 开始 (5s 空洞) |
| 静音未裁剪 | 静音片段内 | 标记为静音类型 |
| 广告重叠 | 广告1 vs 第一章 | 广告 2:28 开始，第一章 2:30 结束 |
| 字幕漂移 | 多处 | 字幕时间与片段不完全匹配 |
| 顺序问题 | 第三章 vs 结尾音乐 | 时间线可能有交错 |

运行检测后应该能检测到这些问题。

## 本地验证流程

### 完整验证步骤

1. **安装依赖**
   ```bash
   npm install
   ```

2. **创建项目并导入示例数据**
   ```bash
   node src/index.js import \
     --name "验证测试" \
     --clips examples/sample_clips.csv \
     --subtitles examples/sample_subtitles.srt \
     --ads examples/sample_ads.txt
   ```

3. **运行检测**
   ```bash
   node src/index.js check --project "验证测试.pts.json" --verbose
   ```
   预期: 应该检测到多个问题（重叠、空洞、字幕漂移等）

4. **查看报告**
   ```bash
   node src/index.js report --project "验证测试.pts.json"
   ```

5. **导出文件**
   ```bash
   node src/index.js export --project "验证测试.pts.json" --output ./test-output
   ```
   检查 `./test-output` 目录下的文件：
   - `验证测试_交付单.md`
   - `验证测试_章节.json`
   - `验证测试_问题清单.csv`
   - `验证测试.pts.json`

6. **运行单元测试**
   ```bash
   npm test
   ```

7. **查看项目列表**
   ```bash
   node src/index.js list
   ```

### 预期输出

运行检测后，应该看到类似这样的输出：

```
🎙️ 口播时间轴缝合台 - 运行检测

已加载项目: 验证测试

运行音频检测...
✅ 检测完成

--- 检测结果 ---

总计: N 个问题
🔴 致命: X | 🟠 高: Y | 🟡 中: Z | 🟢 低: W

🔴 [0:14] 开场问候 和 第一章:技术话题引入 重叠 1.50s
🟠 [3:00] 第二章:深入讨论 和 第三章:总结 之间有 5.00s 的空白
...
```

## 注意事项

1. **WAV 分析**: 响度检测需要真实的 WAV 文件。示例数据不包含 WAV，因此不会检测到静音和响度问题。

2. **文件编码**: 建议使用 UTF-8 编码保存输入文件，避免中文乱码。

3. **时间格式**: 时间轴统一使用毫秒 (ms) 进行计算，显示时转换为可读格式。

4. **项目文件**: 项目文件 (`*.pts.json`) 包含完整数据，可以随时重新加载继续编辑。

## 故障排除

### 常见问题

**Q: 导入文件时提示找不到文件？**
A: 确保使用绝对路径或相对于当前工作目录的正确相对路径。

**Q: SRT 解析失败？**
A: 检查 SRT 格式是否正确，特别是时间码格式 `HH:MM:SS,mmm`（注意是逗号不是点）。

**Q: CSV 列名不识别？**
A: 参考"输入文件格式说明"，使用支持的列名，或修改 CSV 头部。

**Q: 没有检测到任何问题？**
A: 检查阈值设置，可能是阈值太宽松。可以通过调整参数或使用示例数据验证检测功能。

## 许可证

MIT License

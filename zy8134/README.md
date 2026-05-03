# HLS Preflight

HLS 交付包上线前预检工具，用于验证直播回看 HLS 交付包的完整性和正确性。

## 功能特性

- **码率梯度检查**：验证各 variant 码率梯度是否合理
- **切片时长检查**：验证所有切片时长是否在目标方差范围内
- **Discontinuity 检查**：检测意外的不连续性标记
- **加密 Key 检查**：验证加密密钥一致性
- **缺片/重复片检测**：自动检测缺失和重复的切片
- **CDN 状态检查**：检查 CDN 404 错误和响应时间
- **跨午夜时间戳检测**：警告时间戳跨越午夜边界的情况
- **Variant 一致性检查**：检测某一路 variant 缺片但其他路正常的边界情况

## 项目结构

```
hls-preflight/
├── src/
│   ├── cli.ts              # CLI 入口
│   ├── index.ts            # 模块导出
│   ├── types.ts            # TypeScript 类型定义
│   ├── parsers/            # 解析器模块
│   │   ├── index.ts
│   │   ├── m3u8-parser.ts  # M3U8 解析
│   │   ├── csv-parser.ts   # CSV 解析
│   │   ├── jsonl-parser.ts # JSONL 解析
│   │   └── yaml-parser.ts  # YAML 解析
│   ├── rules/              # 规则引擎模块
│   │   └── index.ts
│   ├── reports/            # 报告生成模块
│   │   └── index.ts
│   └── validator/          # 验证器模块
│       └── index.ts
├── samples/
│   └── event-a/            # 示例测试数据
│       ├── master.m3u8
│       ├── variant_360p.m3u8
│       ├── variant_480p.m3u8
│       ├── variant_480p_alt.m3u8
│       ├── variant_1080p.m3u8
│       ├── segments_manifest.csv
│       ├── cdn_access.jsonl
│       └── rules.yaml
├── package.json
├── tsconfig.json
└── README.md
```

## 安装

```bash
npm install
```

## 使用方法

### 验证 HLS 交付包

```bash
npm run dev -- validate <输入目录> [选项]
```

**选项：**
- `-o, --output <output-dir>`: 输出报告目录（默认：输入目录下的 output）
- `-r, --rules <rules-file>`: 自定义规则 YAML 文件
- `-v, --verbose`: 启用详细输出
- `--no-output`: 跳过生成输出文件，仅显示摘要

**示例：**

```bash
npm run dev -- validate samples/event-a
```

### 列出所有可用规则

```bash
npm run dev -- list-rules
```

## 示例演示

### 快速开始

运行以下命令验证示例数据：

```bash
npm run dev -- validate samples/event-a
```

**预期输出：**

```
📦 Validating HLS package: /path/to/samples/event-a
   Generating reports to: /path/to/samples/event-a/output

✅ Validation complete!

📊 Summary:
   Errors:   3
   Warnings: 7
   Infos:    0
   Total:    10

📋 Issues found:

  ❌ Errors:
     1. [segment_duration] Segment duration variance exceeds threshold: 11.2s (target: 10s, variance: 1.20s)
        Location: variant_480p.m3u8, segment #1001
     2. [encryption_key] Inconsistent encryption: 1 variant(s) encrypted, 3 variant(s) unencrypted
     3. [cdn_404] Found 1 CDN 404 error(s)

  ⚠️  Warnings:
     1. [bitrate_gradient] Bitrates too close: 800000 bps and 850000 bps (ratio: 1.06)
     2. [bitrate_gradient] Bitrates too far apart: 850000 bps and 3000000 bps (ratio: 3.53)
     3. [discontinuity] Variant contains 1 discontinuity(ies)
     4. [variant_consistency] Variants have inconsistent segment counts
     5. [variant_consistency] Variants have inconsistent total durations
     ... and 2 more

📄 Generated reports:
   - /path/to/samples/event-a/output/issues.csv
   - /path/to/samples/event-a/output/review_report.md
   - /path/to/samples/event-a/output/timeline.html
```

### 示例数据说明

`samples/event-a/` 目录包含故意设计的问题数据，用于演示工具的检测能力：

| 问题类型 | 说明 |
|---------|------|
| 码率梯度问题 | `variant_480p.m3u8` (800kbps) 和 `variant_480p_alt.m3u8` (850kbps) 码率太近 |
| 码率梯度问题 | `variant_480p_alt.m3u8` (850kbps) 和 `variant_1080p.m3u8` (3Mbps) 码率太远 |
| 切片时长异常 | `variant_480p.m3u8` 中 #1001 切片时长 11.2s（目标 10s，方差 1.2s > 阈值 0.5s） |
| Discontinuity | `variant_480p.m3u8` 包含 `#EXT-X-DISCONTINUITY` |
| 加密不一致 | 仅 `variant_1080p.m3u8` 加密，其他未加密 |
| CDN 404 | `cdn_access.jsonl` 中记录了一个 404 错误 |
| CDN 响应慢 | `cdn_access.jsonl` 中记录了一个 1890ms 的慢响应（阈值 1000ms） |
| 跨午夜时间戳 | `variant_1080p.m3u8` 的时间戳从 23:58 跨越到 00:02 |
| 缺片 | `variant_480p.m3u8` 只有 4 个切片，其他 variant 有 5 个 |
| 重复片 | `variant_480p_alt.m3u8` 中 #1001 切片重复出现 |
| Variant 一致性 | 某一路 variant 缺片但其他路正常（#1004 在 480p 中缺失） |

## 输入文件格式

### 必需文件

| 文件名 | 说明 |
|-------|------|
| `master.m3u8` | 主播放列表，包含所有 variant 引用 |
| `variant_*.m3u8` | 多个 variant 播放列表文件 |
| `segments_manifest.csv` | 切片清单（可选） |
| `cdn_access.jsonl` | CDN 访问日志（可选） |
| `rules.yaml` | 自定义规则配置（可选） |

### segments_manifest.csv 格式

```csv
uri,path,size,duration,sequenceNumber,variant,md5,programDateTime
segment_360p_1000.ts,/cdn/360p/1000.ts,156789,10.0,1000,360p,a1b2c3d4e5f6,2024-05-03T23:58:00.000+08:00
```

### cdn_access.jsonl 格式

每行一个 JSON 对象：

```json
{"uri":"https://cdn.example.com/segment.ts","statusCode":200,"responseTimeMs":145,"timestamp":"2024-05-04T00:10:00.000Z","byteSize":156789}
```

### rules.yaml 格式

```yaml
thresholds:
  maxSegmentDurationVariance: 0.5
  minBitrateBps: 100000
  maxBitrateBps: 50000000
  maxResponseTimeMs: 1000

rules:
  - id: bitrate_gradient
    name: Bitrate Gradient Check
    severity: warning
    enabled: true
  # ... 更多规则
```

## 输出文件

### issues.csv

包含所有检测到的问题，列包括：
- `#`: 序号
- `SEVERITY`: 严重级别（ERROR/WARNING/INFO）
- `RULE_ID`: 规则 ID
- `MESSAGE`: 问题描述
- `LOCATION`: 位置
- `DETAILS`: 详细信息

### review_report.md

Markdown 格式的详细报告，包含：
- 基本信息
- 检查概要
- 按严重级别分类的问题详情
- Variant 信息分析
- CDN 状态分析
- 跨午夜时间戳警告

### timeline.html

交互式时间线可视化页面，功能包括：
- 各 variant 的切片时间线展示
- 颜色编码：绿色=正常，红色=缺失，黄色=重复
- 过滤功能：全部、仅问题、仅缺失、仅重复
- 悬停提示显示切片详情
- 统计信息汇总

## 构建

```bash
npm run build
```

构建产物输出到 `dist/` 目录。

## 类型检查

```bash
npm run typecheck
```

## 许可证

MIT

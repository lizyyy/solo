# 短视频素材质检 CLI

一个用于短视频制作团队的本地 CLI 工具，用于质检交付给不同平台的素材包。

## 功能特性

- **文件命名检查**: 验证素材文件是否存在，检测同名不同后缀的文件
- **时长偏差检查**: 比对实际时长与期望时长，检测超出容忍范围的偏差
- **字幕时间越界检查**: 检测字幕时间是否超出视频时长
- **画幅/码率检查**: 根据平台规则验证视频分辨率和码率是否达标
- **报告导出**: 生成 Markdown 和 CSV 格式的问题报告

## 快速开始

### 安装依赖

```bash
npm install
```

### 运行演示

使用内置样例数据快速体验：

```bash
npm run demo
```

或使用 CLI 命令：

```bash
npx vqc demo
```

演示完成后，报告将生成在 `demo_report` 目录。

## 命令行用法

### check 命令

执行素材质量检查：

```bash
vqc check [选项]

选项：
  -d, --media-dir <path>    素材目录路径 (默认: ./media)
  -c, --csv <path>          镜头清单 CSV 文件路径 (默认: ./shot_list.csv)
  -m, --metadata <path>     ffprobe 导出的媒体元数据 JSON 文件路径 (默认: ./metadata.json)
  -s, --srt <path>          字幕 SRT 文件路径 (默认: ./subtitle.srt)
  -r, --rules <path>        平台规则 YAML 文件路径 (默认: ./rules.yaml)
  -o, --output <path>       报告输出目录 (默认: ./reports)
```

### demo 命令

运行内置样例数据的演示：

```bash
vqc demo
```

## 输入文件格式

### 镜头清单 CSV

| 字段 | 说明 |
|------|------|
| id | 镜头唯一标识 |
| filename | 文件名 |
| duration | 期望时长（秒） |
| platform | 目标平台 |

示例：
```csv
id,filename,duration,platform
S01,scene_01.mp4,10.5,douyin
S02,scene_02.mp4,8.3,kuaishou
```

### 媒体元数据 JSON

由 ffprobe 导出的 JSON 格式元数据：

```bash
ffprobe -v quiet -print_format json -show_streams -show_format input.mp4 > metadata.json
```

### 平台规则 YAML

```yaml
duration:
  tolerance: 0.5

subtitle:
  safetyMargin: 0.5

platforms:
  douyin:
    resolution: 1080x1920
    minBitrate: 4000
    maxBitrate: 8000
  
  kuaishou:
    resolution: 1080x1920
    minBitrate: 3500
    maxBitrate: 7000
  
  bilibili:
    resolution: 1920x1080
    minBitrate: 5000
    maxBitrate: 10000
```

## 项目结构

```
.
├── bin/                    # CLI 入口
│   └── vqc                 # 命令行脚本
├── src/
│   ├── cli/                # CLI 模块
│   ├── parsers/            # 解析模块
│   │   ├── csvParser.js    # CSV 解析
│   │   ├── jsonParser.js   # JSON 解析
│   │   ├── srtParser.js    # SRT 解析
│   │   └── yamlParser.js   # YAML 解析
│   ├── rules/              # 规则检查模块
│   │   ├── fileNaming.js   # 文件命名检查
│   │   ├── durationCheck.js # 时长检查
│   │   ├── subtitleCheck.js # 字幕检查
│   │   └── formatCheck.js  # 格式检查
│   └── reports/            # 报告生成模块
│       ├── markdownReport.js
│       └── csvReport.js
├── sample/                 # 样例数据
├── test/                   # 测试用例
└── package.json
```

## 测试

```bash
npm test
```

## License

MIT
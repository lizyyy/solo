# FFmpeg 批量转码计划 CLI

一个本地命令行工具，用于批量转码前估算体积、检测失败风险、生成转码计划。

## ✨ 功能特性

- 📊 **媒体探测**: 集成 ffprobe 自动分析视频文件信息
- 🎯 **智能码率**: 根据内容特性自动匹配最优码率规则
- ⚠️ **风险检测**: VFR、音轨缺失、字幕流冲突等问题提前预警
- 📏 **体积估算**: 精确预估转码后文件大小
- 📝 **计划生成**: 自动生成 FFmpeg 转码命令
- 📈 **多种输出**: 终端摘要、JSON、Markdown 报告
- 🎨 **风险分级**: CRITICAL / HIGH / MEDIUM / LOW / SAFE
- 📜 **历史案例**: 基于失败样本库提供参考

## 📋 系统要求

- Node.js >= 16.0.0
- FFmpeg (包含 ffprobe)

## 🚀 安装

### 1. 安装依赖

```bash
npm install
```

### 2. 全局链接（可选）

```bash
npm link
```

### 3. 验证 FFmpeg

确保系统已安装 FFmpeg：

```bash
ffprobe -version
ffmpeg -version
```

如果未安装，请前往 [FFmpeg 官网](https://ffmpeg.org/download.html) 下载安装。

## 🎮 快速开始

### 基本用法

```bash
# 分析单个视频文件
node src/cli.js video.mp4

# 或全局链接后使用
transcode-plan video.mp4
```

### 常用命令

```bash
# 分析目录下所有视频，目标 1080p
transcode-plan ./videos -t 1080p

# 自定义码率 4Mbps
transcode-plan ./videos -b 4M

# 生成批处理脚本
transcode-plan ./videos --batch-script

# 使用配置文件
transcode-plan ./videos -c ./config/example.yaml

# 指定输出目录
transcode-plan ./videos -o ./reports

# 显示所有文件和转码命令
transcode-plan ./videos --show-all --show-commands
```

### 子命令

```bash
# 仅探测媒体信息
transcode-plan probe ./videos -o probe-results.json

# 列出内置目标规格
transcode-plan list-profiles

# 列出内置码率规则
transcode-plan list-rules
```

## ⚙️ 命令行参数

### 主命令参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `<input>` | 输入媒体文件、目录或 ffprobe JSON | 必填 |
| `-t, --target <profile>` | 目标规格: 480p, 720p, 1080p, 4k | 自动检测 |
| `-b, --bitrate <bitrate>` | 自定义视频码率 (如: 5M, 5000k) | - |
| `-m, --multiplier <factor>` | 码率乘数 | 1.0 |
| `-c, --config <path>` | 配置文件路径 (YAML/JSON) | - |
| `-o, --output-dir <path>` | 输出目录 | ./transcode-plan |
| `--no-markdown` | 不生成 Markdown 报告 | - |
| `--no-json` | 不生成 JSON 报告 | - |
| `--batch-script` | 生成批处理脚本 | - |
| `--show-commands` | 显示生成的转码命令 | - |
| `--show-all` | 显示所有文件 | 只显示有风险的 |
| `--min-risk <level>` | 最低显示风险等级 | LOW |
| `--concurrency <num>` | 并行探测数 | 2 |
| `--ffprobe-path <path>` | ffprobe 路径 | ffprobe |
| `--quiet` | 静默模式 | - |
| `--extra-options <options>` | 额外 FFmpeg 参数 | - |

### 退出码

| 退出码 | 含义 |
|--------|------|
| 0 | 成功，无严重问题 |
| 1 | 未指定输入 |
| 2 | 无效输入 |
| 3 | 未找到 ffprobe |
| 4 | 检测到严重风险 |
| 5 | 部分文件分析失败 |
| 6 | IO 错误 |

## 📁 输入目录结构

### 推荐结构

```
videos/
├── project1/
│   ├── video01.mp4
│   ├── video02.mkv
│   └── subtitles/
│       └── video01.srt
├── project2/
│   ├── film.avi
│   └── extra_audio.mp3
└── batch.json          # 可选：预先生成的 ffprobe 结果
```

### 支持的视频格式

- `.mp4`, `.mkv`, `.avi`, `.mov`, `.wmv`
- `.flv`, `.webm`, `.m4v`, `.mpg`, `.mpeg`
- `.ts`, `.m2ts`, `.ogv`, `.3gp`

### 使用预生成的 ffprobe 数据

如果已有 ffprobe 输出的 JSON 文件，可以直接使用：

```bash
# 先用 probe 子命令生成
transcode-plan probe ./videos -o probe-data.json

# 再分析已有的探测数据
transcode-plan probe-data.json
```

## ⚠️ 风险检测

### 可变帧率 (VFR)

- **检测方式**: 分析帧时间戳变异系数
- **风险等级**: LOW / MEDIUM / HIGH
- **典型问题**: 音画不同步、播放卡顿
- **建议**: 添加 `-fpsmax 60` 或 `-r 30` 参数

### 音轨缺失

- **检测方式**: 音频轨道数为 0
- **风险等级**: MEDIUM
- **典型问题**: 输出无音频
- **建议**: 添加 `-an` 参数明确禁用音频

### 多音轨

- **检测方式**: 音频轨道数 > 1
- **风险等级**: LOW / MEDIUM
- **典型问题**: 音轨选择错误
- **建议**: 使用 `-map 0:a:<index>` 指定音轨

### 字幕流冲突

- **检测方式**: 图像字幕、同语言多字幕
- **风险等级**: HIGH / MEDIUM
- **典型问题**: 字幕丢失、乱码、转码失败
- **建议**: 使用 MKV 容器或烧录字幕

### 其他风险

- **缺失视频轨**: CRITICAL
- **未知编码**: HIGH
- **超高分辨率**: HIGH
- **零时长文件**: CRITICAL

## 📐 码率规则

### 内置规格

| 规格 | 分辨率 | 默认码率 | 码率范围 |
|------|--------|----------|----------|
| 480p | 854x480 | 1 Mbps | 0.5 - 1.5 Mbps |
| 720p | 1280x720 | 2.5 Mbps | 1.5 - 4 Mbps |
| 1080p | 1920x1080 | 5 Mbps | 3 - 8 Mbps |
| 4k | 3840x2160 | 15 Mbps | 10 - 25 Mbps |

### 内置规则

| 规则 | 条件 | 乘数 | 优先级 |
|------|------|------|--------|
| 高动态内容 | 1080p+ 且 50fps+ | 1.5x | 10 |
| 可变帧率 | 检测到 VFR | 1.1x | 9 |
| 源文件高质量 | 源码率/目标 > 1.5 | 1.2x | 8 |
| 源文件低质量 | 源码率/目标 < 0.8 | 0.9x | 7 |
| 低动态内容 | 25fps 以下 | 0.8x | 5 |

### 自定义配置

创建 `config.yaml`：

```yaml
targetProfiles:
  'my-1080p':
    name: 'my-1080p'
    width: 1920
    height: 1080
    defaultBitrate: 6000000
    minBitrate: 4000000
    maxBitrate: 10000000

bitrateRules:
  - id: 'my-rule'
    name: '我的规则'
    conditions:
      resolutionMin: 1080
    multiplier: 1.1
    priority: 20
```

使用配置：

```bash
transcode-plan ./videos -c config.yaml -t my-1080p
```

## 📊 输出说明

### 终端输出

```
============================================================
           FFmpeg 转码计划汇总
============================================================

📊 基本统计
  总文件数: 10
  成功分析: 9 | 失败: 1
  总时长: 2h 34m 15s

💾 体积估算
  原始大小: 4.23 GB
  预估大小: 1.87 GB
  节省空间: 2.36 GB
  压缩比: 2.26x (减少 55.8%)

⚠️ 风险统计
  CRITICAL: 1 | HIGH: 2 | MEDIUM: 3 | LOW: 2 | SAFE: 2
  预估失败率: 12.5%
```

### 生成的文件

```
transcode-plan/
├── transcode-plan-2024-01-15T10-30-00.json
├── transcode-plan-2024-01-15T10-30-00.md
└── transcode-plan-2024-01-15T10-30-00.sh  # 仅 --batch-script
```

### JSON 结构

```json
{
  "generatedAt": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0",
  "summary": { /* 汇总统计 */ },
  "files": [
    {
      "file": "video.mp4",
      "path": "/path/to/video.mp4",
      "success": true,
      "mediaInfo": { /* 媒体信息 */ },
      "targetProfile": { /* 目标规格 */ },
      "bitrate": { /* 码率计算 */ },
      "estimatedSize": { /* 体积估算 */ },
      "risks": [ /* 风险列表 */ ],
      "riskScore": { /* 风险评分 */ },
      "command": { /* 转码命令 */ }
    }
  ]
}
```

## 🐛 坏数据处理

### 损坏的文件

- **现象**: ffprobe 无法解析
- **处理**: 标记为 CRITICAL 风险，跳过分析
- **报告**: 显示错误信息，建议检查源文件

### 零时长文件

- **现象**: duration = 0
- **处理**: 标记为 CRITICAL 风险
- **建议**: 检查文件是否完整下载

### 不支持的编码

- **现象**: 视频编码为 'unknown'
- **处理**: 标记为 HIGH 风险
- **建议**: 更新 FFmpeg 或转码前预处理

### 空目录

- **现象**: 目录下没有支持的视频文件
- **处理**: 显示警告，生成空报告

### 权限问题

- **现象**: 无法读取文件
- **处理**: 跳过该文件，记录错误
- **建议**: 检查文件权限

## 💡 使用技巧

### 1. 大规模批量处理

```bash
# 先快速探测所有文件
transcode-plan probe ./library -o full-probe.json

# 分析探测数据（可以重复运行调整参数）
transcode-plan full-probe.json -t 720p -b 2M -o ./plan-720p
transcode-plan full-probe.json -t 1080p -b 5M -o ./plan-1080p
```

### 2. 集成到脚本

```bash
#!/bin/bash
transcode-plan ./videos --quiet --batch-script

if [ $? -eq 4 ]; then
  echo "检测到严重风险，请审查报告"
  exit 1
fi

# 自动执行转码
latest_script=$(ls -t transcode-plan/*.sh | head -1)
bash "$latest_script"
```

### 3. 自定义过滤

```bash
# 只处理高风险文件
transcode-plan ./videos --min-risk HIGH

# 显示所有文件详细信息
transcode-plan ./videos --show-all --show-commands
```

## 📁 项目结构

```
.
├── src/
│   ├── cli.js          # CLI 入口
│   └── index.js        # 模块入口
├── modules/
│   ├── probe.js        # 媒体探测
│   ├── rules.js        # 规则匹配
│   ├── risks.js        # 风险检测
│   ├── planner.js      # 计划生成
│   └── reporter.js     # 报告输出
├── config/
│   └── example.yaml    # 配置示例
├── examples/           # 使用示例
├── package.json
└── README.md
```

## 🔧 开发

```bash
# 运行测试
npm test

# 代码检查
npm run lint

# 本地测试
node src/cli.js --help
```

## 📝 常见问题

### Q: 为什么预估体积和实际有差异？

A: 预估基于目标码率计算，实际大小受编码复杂度、运动内容、音频复杂度等因素影响，误差通常在 ±15% 以内。

### Q: VFR 视频一定要转成 CFR 吗？

A: 不一定。如果播放器支持 VFR，可以保留，但大多数在线平台和设备偏好 CFR。建议添加 `-fpsmax 60` 限制最高帧率。

### Q: 如何添加自定义失败样本？

A: 编辑 `modules/risks.js` 中的 `FAILURE_SAMPLES` 数组，或提交 PR 扩充样本库。

### Q: 可以处理蓝光原盘吗？

A: 可以检测 M2TS 文件，但复杂的多轨结构可能需要手动配置映射参数。

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 PR！

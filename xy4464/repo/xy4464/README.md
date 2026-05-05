# Stage Supervisor - 小剧场舞台监督自动化工具

## 功能概述

这是一个专为小剧场舞台监督设计的本地自动化工具，帮助您在演出前快速检查各种潜在问题。

### 主要功能

- **一键扫描**：自动检测以下问题
  - Cue 编号缺失
  - 灯光场景不存在
  - 音频文件断链
  - 演员换场时间不足
- **数据存储**：所有扫描结果和备注信息存储到本地 SQLite 数据库
- **CLI 接口**：完整的命令行界面，支持扫描、查询、备注、导出
- **导出功能**：支持导出 Markdown 交接单和 JSON 审计包

## 安装

```bash
pip install -r requirements.txt
pip install -e .
```

## 使用方法

### 1. 准备项目目录

在项目目录中放置以下文件：
- `cue_list.csv` - 导演 Cue 单
- `lighting_scenes.json` - 灯光台导出的场景数据
- `audio_files.csv` - 音频文件清单
- `actor_schedule.csv` - 演员上下场表

### 2. 执行扫描

```bash
stage-supervisor scan /path/to/project
```

### 3. 查询问题

```bash
stage-supervisor query
```

### 4. 添加备注

```bash
stage-supervisor note <issue_id> "备注内容"
```

### 5. 导出文件

```bash
# 导出 Markdown 交接单
stage-supervisor export markdown output.md

# 导出 JSON 审计包
stage-supervisor export json output.json
```

## 文件格式说明

### Cue 单 (CSV)

| cue_id | description | type  | time  |
|--------|-------------|-------|-------|
| C001   | 开场灯光    | light | 00:00 |
| C002   | 音效1       | audio | 00:10 |

### 灯光场景 (JSON)

```json
{
  "scenes": [
    {"id": "S001", "name": "开场灯光", "intensity": 100},
    {"id": "S002", "name": "中场灯光", "intensity": 80}
  ]
}
```

### 音频文件清单 (CSV)

| cue_id | filename | path |
|--------|----------|------|
| C002   | intro.wav | /audio/intro.wav |

### 演员上下场表 (CSV)

| actor_name | scene_id | enter_time | exit_time | notes |
|------------|----------|------------|-----------|-------|
| 张三       | S01      | 00:05      | 00:15     | 从左侧上 |

## 示例数据

项目包含示例数据，位于 `examples/` 目录，可用于测试工具功能。

## 许可证

MIT License

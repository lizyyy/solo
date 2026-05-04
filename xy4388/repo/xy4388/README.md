# 口述影像检查工具 (NarrTool)

给口述影像志愿者使用的本地命令行工具。

## 快速开始

### 安装

```bash
pip install -r requirements.txt
```

### 使用示例数据测试

**方式一：命令行**

```bash
# 导入数据并运行检查
python -m narrtool.cli import-data "示例电影" "2024-05-01T14:00:00" 120 \
  --srt examples/subtitles.srt \
  --script examples/script.json \
  --run-check

# 查看所有场次
python -m narrtool.cli list

# 导出结果
python -m narrtool.cli export 1 --format all
```

**方式二：Web 界面**

```bash
# 启动服务
python -m narrtool.cli serve
```

然后访问：
- 复核界面: http://127.0.0.1:8000/
- API 文档: http://127.0.0.1:8000/docs

## 命令行命令

| 命令 | 说明 |
|------|------|
| `import-data` | 导入场次数据 |
| `list` | 列出所有场次 |
| `check` | 运行场次检查 |
| `update` | 更新检查结果状态 |
| `export` | 导出检查结果 |
| `delete` | 删除场次 |
| `serve` | 启动 Web 服务 |

查看帮助：`python -m narrtool.cli --help`

## 数据格式

**SRT 字幕**: 标准 SRT 格式

**口述稿 JSON**:
```json
[
  {"index": 1, "start_time": 0.0, "end_time": 4.0, 
   "text": "口述内容", "is_critical": 1}
]
```

**志愿者排班 CSV**:
```csv
volunteer_name,screening_time,duration,role,movie_name
张三,2024-05-01 14:00:00,120,口述,示例电影
```

## 项目结构

```
narrtool/
├── cli.py          # 命令行入口
├── config.py       # 配置
├── database/       # 数据库模型和会话
├── importers/      # 数据导入器
├── checkers/       # 检查逻辑
├── services/       # 业务服务
├── exporters/      # 导出功能
└── api/            # Web API 和静态页面
examples/           # 示例数据
```

## 检查类型

1. **口述压住对白**: 口述段落与字幕时间重叠检测
2. **关键场景问题**: 关键场景内容为空或过短
3. **志愿者冲突**: 同一志愿者排班时间冲突

## 示例数据说明

`examples/` 目录中的数据**故意设置了问题**用于演示：
- 口述段落与字幕时间重叠
- 关键场景内容过短
- 志愿者排班冲突

运行检查后应该能检测到这些问题。

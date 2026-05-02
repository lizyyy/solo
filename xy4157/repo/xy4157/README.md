# 镜头连续性巡检员

> 短剧后期统筹自动化工具

每天收工会拿到通告单 CSV、场记 JSON、镜头截图清单和道具服化规则，最怕同一场戏里角色服装跳变、关键道具少拍、镜头命名和场次不一致。

本工具可以帮助你：
- **import** 导入各类制作文件
- **check** 自动校验场次顺序、角色/道具连续性、缺失截图、重复镜号和跨天补拍冲突
- **review** 保存人工放行意见
- **export** 导出 Markdown 风险报告、CSV 问题表和 JSON 审计包

## 项目结构

```
continuity_inspector/
├── __init__.py           # 包初始化
├── cli.py                # 命令行入口
├── models.py             # 数据模型定义
├── parsers/              # 数据解析模块
│   ├── __init__.py
│   ├── csv_parser.py     # CSV解析器（通告单等）
│   ├── json_parser.py    # JSON解析器（场记、规则等）
│   └── screenshot_parser.py  # 截图清单解析器
├── rules/                # 连续性规则引擎
│   ├── __init__.py
│   └── engine.py         # 核心检查逻辑
├── review/               # 复核存储模块
│   ├── __init__.py
│   └── storage.py        # 复核意见管理
├── exporters/            # 导出模块
│   ├── __init__.py
│   ├── markdown.py       # Markdown报告导出
│   ├── csv_exporter.py   # CSV问题表导出
│   └── json_exporter.py  # JSON审计包导出
├── examples/             # 示例数据
│   ├── __init__.py
│   └── generator.py      # 示例数据生成器
└── tests/                # 测试模块
    ├── __init__.py
    ├── test_parsers.py   # 解析器测试
    └── test_rules.py     # 规则引擎测试
```

## 快速开始

### 环境要求

- Python 3.8+
- pip

### 安装依赖

```bash
# 创建虚拟环境
python3 -m venv .venv

# 激活虚拟环境
source .venv/bin/activate  # macOS/Linux
# 或
.venv\Scripts\activate     # Windows

# 安装依赖
pip install click
```

### 临时目录验证流程

#### 1. 生成示例数据

首先生成用于测试的示例数据：

```bash
cd /Users/mac/pro/solocoder/pro/xy4157/repo/xy4157

# 创建临时测试目录
mkdir -p /tmp/continuity_test/examples

# 生成示例数据
python -c "
from continuity_inspector.examples.generator import ExampleGenerator
gen = ExampleGenerator()
gen.generate_all('/tmp/continuity_test/examples')
print('示例数据已生成到 /tmp/continuity_test/examples')
"
```

查看生成的文件：

```bash
ls -la /tmp/continuity_test/examples/
```

应该可以看到：
- `call_sheet.csv` - 通告单
- `script_notes.json` - 场记（包含有意的连续性问题）
- `screenshots.csv` - 截图清单（故意缺少一些截图）
- `costume_rules.json` - 服装规则
- `prop_rules.json` - 道具规则

#### 2. 导入数据

导入所有文件到项目数据：

```bash
# 创建输出目录
mkdir -p /tmp/continuity_test/output

# 导入数据
python main.py import-data \
    --call-sheet /tmp/continuity_test/examples/call_sheet.csv \
    --script-notes /tmp/continuity_test/examples/script_notes.json \
    --screenshots /tmp/continuity_test/examples/screenshots.csv \
    --costume-rules /tmp/continuity_test/examples/costume_rules.json \
    --prop-rules /tmp/continuity_test/examples/prop_rules.json \
    --project-name "测试短剧项目" \
    --production-day "2026-05-01" \
    --output /tmp/continuity_test/output/project.json
```

#### 3. 执行连续性检查

```bash
python main.py check \
    --project-file /tmp/continuity_test/output/project.json \
    --output /tmp/continuity_test/output/project_checked.json
```

你应该能看到检测出的问题，包括：

1. **服装连续性问题** - 李雷的领带颜色从黑变到红
2. **跨天补拍冲突** - 补拍时李雷穿了灰色西装而不是蓝色
3. **缺失截图** - 部分镜头缺少截图
4. **重复镜号** - 同一场景同一镜号出现多次
5. **命名不一致** - 场记中有通告单没有的镜头
6. **道具缺失** - 部分镜头缺少关键道具

#### 4. 复核问题

查看检测出的问题后，可以对某些问题进行放行：

```bash
# 首先查看有哪些问题（看check输出）
# 然后选择放行某个问题

# 例如放行第一个问题
python main.py review \
    --project-file /tmp/continuity_test/output/project_checked.json \
    --issue-id "ISS-20260502-0001" \
    --approve \
    --notes "这是导演要求的故意跳变，艺术处理" \
    --user "统筹A"
```

#### 5. 导出报告

```bash
# 导出所有格式
python main.py export \
    --project-file /tmp/continuity_test/output/project_checked.json \
    --output-dir /tmp/continuity_test/exports
```

查看导出的文件：

```bash
ls -la /tmp/continuity_test/exports/
```

应该能看到：
- `连续性报告_*.md` - Markdown格式风险报告
- `问题列表_*.csv` - CSV格式问题表
- `审计包_*.json` - JSON格式审计包

查看 Markdown 报告：

```bash
cat /tmp/continuity_test/exports/连续性报告_*.md
```

## CLI 使用详解

### 命令列表

```bash
# 查看帮助
python main.py --help

# 查看子命令帮助
python main.py import-data --help
python main.py check --help
python main.py review --help
python main.py export --help
python main.py generate-examples --help
```

### import-data - 导入数据

```bash
python main.py import-data \
    --call-sheet /path/to/call_sheet.csv \
    --script-notes /path/to/script_notes.json \
    --screenshots /path/to/screenshots.csv \
    --costume-rules /path/to/costume_rules.json \
    --prop-rules /path/to/prop_rules.json \
    --project-name "我的短剧项目" \
    --production-day "2026-05-01" \
    --output /path/to/project.json
```

**参数说明：**
- `--call-sheet / -c`: 通告单 CSV 文件路径（必需）
- `--script-notes / -s`: 场记 JSON 文件路径（必需）
- `--screenshots / -i`: 镜头截图清单文件路径（必需）
- `--costume-rules / -r`: 服装规则文件路径（必需）
- `--prop-rules / -p`: 道具规则文件路径（必需）
- `--project-name / -n`: 项目名称（默认：未命名项目）
- `--production-day / -d`: 拍摄日期，格式 YYYY-MM-DD（默认：当天）
- `--output / -o`: 输出项目数据文件路径（可选）

### check - 执行连续性检查

```bash
python main.py check \
    --project-file /path/to/project.json \
    --output /path/to/project_checked.json \
    --category 服装连续性 \
    --category 道具连续性 \
    --severity 高
```

**参数说明：**
- `--project-file / -f`: 项目数据文件路径（必需）
- `--output / -o`: 输出更新后的项目文件（默认覆盖原文件）
- `--category / -c`: 指定检查类别，可多次使用（可选）
  - 可选值：场次顺序, 服装连续性, 道具连续性, 缺失截图, 重复镜号, 补拍冲突, 命名不一致
- `--severity / -s`: 最小报告严重程度（默认：中）
  - 可选值：低, 中, 高, 严重

**执行的检查项：**

| 检查类别 | 说明 |
|---------|------|
| 场次顺序 | 检查同一场戏的镜头是否按顺序排列，是否有跳号或顺序混乱 |
| 服装连续性 | 检查同一场戏内同一角色的服装是否一致，是否与服装规则匹配 |
| 道具连续性 | 检查关键道具是否在指定场次出现，同一场戏内道具状态是否一致 |
| 缺失截图 | 检查已拍摄的镜头是否有对应的截图 |
| 重复镜号 | 检查同一场戏内是否有重复的镜号 |
| 补拍冲突 | 检查跨天补拍的服装、道具是否与原始拍摄一致 |
| 命名不一致 | 检查通告单和场记中的场次号、镜号是否一致 |

### review - 复核问题

```bash
# 放行一个问题
python main.py review \
    --project-file /path/to/project.json \
    --issue-id "ISS-20260502-0001" \
    --approve \
    --notes "导演确认，艺术处理" \
    --user "统筹A"

# 拒绝一个问题（标记为需要重拍）
python main.py review \
    --project-file /path/to/project.json \
    --issue-id "ISS-20260502-0002" \
    --reject \
    --notes "服装确实错了，需要重拍" \
    --user "统筹B"
```

**参数说明：**
- `--project-file / -f`: 项目数据文件路径（必需）
- `--issue-id / -i`: 问题ID（必需）
- `--approve / -a`: 放行该问题
- `--reject / -r`: 拒绝该问题（与 --approve 二选一）
- `--notes / -n`: 备注说明
- `--user / -u`: 操作人（默认：匿名）

### export - 导出报告

```bash
# 导出所有格式
python main.py export \
    --project-file /path/to/project.json \
    --output-dir /path/to/exports

# 只导出 Markdown
python main.py export \
    --project-file /path/to/project.json \
    --output-dir /path/to/exports \
    --format markdown

# 导出 CSV 和 JSON
python main.py export \
    --project-file /path/to/project.json \
    --output-dir /path/to/exports \
    --format csv \
    --format json
```

**参数说明：**
- `--project-file / -f`: 项目数据文件路径（必需）
- `--output-dir / -o`: 输出目录路径（必需）
- `--format / -t`: 导出格式，可多次使用（默认：全部三种）
  - 可选值：markdown, csv, json

**导出内容：**

| 格式 | 文件名 | 内容 |
|------|--------|------|
| Markdown | `连续性报告_时间戳.md` | 完整的风险报告，包含统计摘要、问题详情、复核记录 |
| CSV | `问题列表_时间戳.csv` | 问题清单表格，可直接用Excel打开 |
| JSON | `审计包_时间戳.json` | 完整的审计数据包，包含所有信息 |

### generate-examples - 生成示例数据

```bash
python main.py generate-examples \
    --output-dir /path/to/examples
```

## 输入文件格式说明

### 通告单 CSV 格式

```csv
scene_id,shot_number,description,characters,props,scheduled_time,location,page_count
1-01,1,老街区全景 - 李雷独自走在街上,李雷,旧照片,09:00,老街区,1.5
1-01,2,中景 - 李雷掏出旧照片查看,李雷,旧照片,09:30,老街区,0.8
1-02,1,咖啡馆内 - 李雷和韩梅梅对坐,李雷,韩梅梅,咖啡杯,旧照片,10:30,咖啡馆,2.0
```

**字段说明：**
- `scene_id`: 场次号，如 "1-01", "2-03"
- `shot_number`: 镜号，如 "1", "2A", "3B"
- `description`: 镜头描述
- `characters`: 出场角色，逗号分隔
- `props`: 道具，逗号分隔
- `scheduled_time`: 预计时间
- `location`: 场景地点
- `page_count`: 页数

### 场记 JSON 格式

```json
{
  "script_notes": [
    {
      "scene_id": "1-01",
      "shot_number": "1",
      "take": 1,
      "status": "已拍摄",
      "characters": ["李雷"],
      "costumes": {
        "李雷": "蓝色西装+白衬衫+黑领带"
      },
      "props": ["旧照片"],
      "notes": "情绪到位，阳光角度好",
      "shot_date": "2026-05-01",
      "camera_angle": "全景",
      "lens": "24mm",
      "duration": "00:01:30"
    }
  ]
}
```

**字段说明：**
- `scene_id`: 场次号
- `shot_number`: 镜号
- `take`: 条号
- `status`: 状态，可选值："已拍摄", "跳过", "补拍"
- `characters`: 出场角色列表
- `costumes`: 服装字典，键是角色名，值是服装描述
- `props`: 道具列表
- `notes`: 备注
- `shot_date`: 拍摄日期，格式 YYYY-MM-DD
- `camera_angle`: 镜头角度
- `lens`: 镜头焦距
- `duration`: 时长，格式 HH:MM:SS

### 截图清单 CSV 格式

```csv
file_path,scene_id,shot_number,take,timestamp
/footage/1-01_01_take1.000001.jpg,1-01,1,1,2026-05-01 09:15:00
/footage/1-01_02_take1.000001.jpg,1-01,2,1,2026-05-01 09:45:00
```

**字段说明：**
- `file_path`: 截图文件路径
- `scene_id`: 场次号
- `shot_number`: 镜号
- `take`: 条号（可选）
- `timestamp`: 时间戳（可选）

### 服装规则 JSON 格式

```json
{
  "costume_rules": [
    {
      "character": "李雷",
      "scene_id": "1-*",
      "description": "蓝色西装+白衬衫+黑领带",
      "accessories": ["手表", "戒指"],
      "notes": "第一幕，回忆场景，统一西装颜色要一致"
    }
  ]
}
```

**字段说明：**
- `character`: 角色名
- `scene_id`: 场景模式，支持通配符，如 "1-*" 表示所有 1 开头的场次
- `description`: 服装描述
- `accessories`: 配饰列表
- `notes`: 备注说明

### 道具规则 JSON 格式

```json
{
  "prop_rules": [
    {
      "prop_name": "旧照片",
      "scene_id": "1-*",
      "required": true,
      "state": "泛黄、有折痕",
      "notes": "关键剧情道具，第一幕必须一致"
    }
  ]
}
```

**字段说明：**
- `prop_name`: 道具名称
- `scene_id`: 场景模式
- `required`: 是否必需
- `state`: 道具状态描述
- `notes`: 备注说明

## 运行测试

```bash
# 安装测试依赖
pip install pytest

# 运行所有测试
python -m pytest continuity_inspector/tests/ -v

# 运行特定测试
python -m pytest continuity_inspector/tests/test_parsers.py -v
python -m pytest continuity_inspector/tests/test_rules.py -v
```

## 示例检测问题说明

生成的示例数据中包含以下有意制造的问题，用于演示检测功能：

1. **服装跳变**（场次 1-01）：
   - 镜号 1：李雷 - 蓝色西装+白衬衫+**黑领带**
   - 镜号 2：李雷 - 蓝色西装+白衬衫+**红领带**

2. **跨天补拍冲突**（场次 1-01）：
   - 5月1日拍摄：李雷 - 蓝色西装
   - 5月2日补拍：李雷 - **灰色西装**

3. **缺失截图**：
   - 镜号 1-02_3 没有截图记录
   - 镜号 3-01_1 没有截图记录

4. **重复镜号**：
   - 场次 1-01 镜号 1 出现了两次（take 1 和 take 2）

5. **命名不一致**：
   - 通告单中没有场次 3-01，但场记中有（临时加拍）
   - 通告单中有 1-02_3，但场记中没有（可能未拍摄）

6. **道具缺失**：
   - 场次 1-02 镜号 3 中缺少关键道具"旧照片"

## 常见问题

### Q: 如何处理大型项目数据？

A: 本工具使用纯内存处理，对于大多数短剧项目（几百条记录）完全没问题。如果数据量非常大（数千条以上），建议：
1. 分场次检查
2. 使用 `--category` 参数指定只检查特定类别

### Q: 支持哪些日期格式？

A: 推荐使用 ISO 格式 `YYYY-MM-DD`（如 2026-05-01）。工具也会尝试解析其他常见格式。

### Q: 如何自定义规则？

A: 目前规则是内置的。你可以：
1. 修改 `continuity_inspector/rules/engine.py` 中的检查逻辑
2. 创建新的检查方法
3. 提交 Pull Request 贡献新功能

## License

MIT License

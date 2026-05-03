# 小剧场舞台监督工具

一个用于管理小剧场演出的本地桌面工具，帮助舞台监督在演出前自动排出每一幕的道具上场/撤场清单，并智能检测各种潜在问题。

## 功能特性

### 📥 数据导入
- **场次 CSV**: 导入演出场次信息（幕、场、场景名称、时长等）
- **演员到场 JSON**: 导入演员名单及到场状态
- **道具 CSV**: 导入道具清单及各场景使用情况
- **提示词 CSV**: 导入灯光、音效、演员等提示词
- **道具照片目录**: 自动扫描道具照片，建立道具与照片的关联

### 📋 道具清单管理
- 按场景自动排列道具上场/撤场清单
- 支持标记道具核对状态（待核对/已核对/有问题）
- 可按状态、类型筛选道具
- 支持搜索道具名称

### 🔍 规则检查（异常检测）
- **道具冲突检测**: 检测同一道具在连续场景中同时需要上场的冲突
- **演员未到检测**: 检测有台词/道具任务的演员未到场的情况
- **照片缺失检测**: 检测使用中的道具没有对应照片的情况
- **换场时间预警**: 检测复杂换场（需要撤场和上场大量道具）可能时间不足

### 💾 本地保存
- 项目数据本地 JSON 格式保存
- 支持新建、打开、保存项目
- 退出时自动询问是否保存

### 📤 导出功能
- **Markdown 导出**: 导出完整的演出道具清单报告，包含概览、道具清单、按场景分类、异常报告、演员状态
- **CSV 导出**: 
  - 道具清单 CSV
  - 异常报告 CSV  
  - 提示词 CSV

## 项目结构

```
stage_manager/
├── main.py              # 主入口文件
├── models.py            # 核心数据模型定义
├── importers.py         # 数据导入解析模块
├── rules.py             # 规则检查模块
├── storage.py           # 状态存储模块
├── exporters.py         # 导出模块
├── gui.py               # GUI 界面
├── test_models.py       # 模型测试
├── test_rules.py        # 规则测试
├── requirements.txt     # 依赖包列表
└── sample_data/         # 示例数据
    ├── scenes.csv       # 场次示例
    ├── actors.json      # 演员示例
    ├── props.csv        # 道具示例
    └── cues.csv         # 提示词示例
```

## 安装与运行

### 环境要求
- Python 3.7+
- PyQt5
- pandas（可选，用于增强 CSV 处理）

### 安装步骤

1. 安装依赖：
```bash
pip install -r requirements.txt
```

2. 运行程序：
```bash
python main.py
```

## 使用指南

### 快速开始

1. **运行程序**后，点击工具栏的「加载示例数据」按钮，或者选择「工具」→「加载示例数据」

2. **运行规则检查**：点击工具栏的「检查」按钮，或者选择「工具」→「运行规则检查」，系统会自动检测潜在问题

3. **查看结果**：
   - 「场次管理」标签页：查看各场景的道具和提示词
   - 「道具清单」标签页：查看所有道具列表，可标记核对状态
   - 「异常检查」标签页：查看检测到的问题

### 导入自己的数据

#### 1. 准备场次 CSV 文件
格式示例：
```csv
scene_id,scene_name,act,scene_number,duration,notes
scene_1,开场 - 茶馆清晨,1,1,15,第一幕开场
scene_2,中场 - 秦仲义来访,1,2,20,冲突升级
```

#### 2. 准备演员 JSON 文件
格式示例：
```json
[
    {
        "id": "actor_1",
        "name": "王利发",
        "is_present": true,
        "notes": "茶馆老板"
    },
    {
        "id": "actor_2",
        "name": "秦仲义",
        "is_present": false,
        "notes": "迟到中"
    }
]
```

#### 3. 准备道具 CSV 文件
格式示例：
```csv
prop_id,prop_name,scene_id,usage_type,actor_id,actor_name,notes
prop_1,茶壶,scene_1,上场,actor_1,王利发,开场必备
prop_2,茶碗x4,scene_1,上场,,,注意数量
```

#### 4. 准备提示词 CSV 文件
格式示例：
```csv
cue_id,scene_id,cue_type,content,actor_id,actor_name,notes
cue_1,scene_1,灯光,开场灯光渐亮,,,
cue_2,scene_1,演员,王利发上场,actor_1,王利发,从侧幕上台
```

#### 5. 导入数据
在「数据导入」标签页：
1. 点击各「选择...」按钮选择对应文件
2. 点击「道具照片目录」选择存放道具照片的文件夹（照片文件名应与道具名称匹配）
3. 点击「导入所有数据」

### 标记核对状态

1. 在「道具清单」或「场次管理」标签页
2. 点击表格中的「操作」列或状态列
3. 在弹出的对话框中选择：
   - 标记待核对
   - 标记已核对
   - 标记有问题

### 导出报告

1. 切换到「导出」标签页
2. 选择导出格式：
   - **Markdown**: 导出完整报告，适合分享和打印
   - **CSV**: 分别导出道具、异常、提示词，适合在 Excel 中查看
3. 选择保存路径

## 模块说明

### models.py
定义核心数据类：
- `Actor`: 演员信息（ID、姓名、到场状态、备注）
- `Prop`: 道具信息（ID、名称、照片路径、备注）
- `Scene`: 场景信息（包含道具列表和提示词列表）
- `PropUsage`: 道具在场景中的使用记录
- `Cue`: 提示词
- `Alert`: 异常警告
- `ShowData`: 完整演出数据容器

### importers.py
数据导入解析：
- `CSVImporter`: 解析 CSV 文件（场次、道具、提示词）
- `JSONImporter`: 解析 JSON 文件（演员）
- `PhotoScanner`: 扫描道具照片目录
- `DataImporter`: 统一导入接口

### rules.py
规则检查引擎：
- `PropConflictChecker`: 道具冲突检测
- `ActorPresenceChecker`: 演员到场检测
- `PhotoChecker`: 照片缺失检测
- `TransitionTimeChecker`: 换场时间检测
- `RuleEngine`: 统一规则引擎，支持筛选和统计

### storage.py
状态存储管理：
- `StorageManager`: 项目文件的保存/加载
- `StatusManager`: 道具和异常的状态管理

### exporters.py
数据导出：
- `MarkdownExporter`: 导出 Markdown 格式报告
- `CSVExporter`: 导出 CSV 格式文件

### gui.py
PyQt5 图形界面：
- 5 个标签页：数据导入、场次管理、道具清单、异常检查、导出
- 菜单和工具栏
- 状态管理对话框

## 运行测试

运行单元测试：
```bash
python -m pytest test_models.py -v
python -m pytest test_rules.py -v
```

或者使用 unittest：
```bash
python test_models.py
python test_rules.py
```

## 快捷键

- `Ctrl+N`: 新建项目
- `Ctrl+O`: 打开项目
- `Ctrl+S`: 保存项目
- `F5`: 运行规则检查

## 数据保存位置

项目数据默认保存在用户目录下的 `.stage_manager/projects/` 文件夹中。

## 示例数据

`sample_data/` 文件夹包含完整的示例数据，基于话剧《茶馆》片段：
- `scenes.csv`: 4 个场景
- `actors.json`: 6 个演员（其中 2 个标记为未到）
- `props.csv`: 8 个道具，包含上场/撤场安排
- `cues.csv`: 16 个提示词（灯光、音效、演员、道具）

## 技术栈

- **GUI 框架**: PyQt5
- **数据格式**: JSON, CSV
- **测试框架**: unittest/pytest

## 许可证

MIT License

# 社区应急避难点复盘工具

一个本地运行的Web前端工具，用于帮助社区应急避难点管理员复盘暴雨转移安置情况。

## 功能特性

- **数据导入**：支持导入 `shelters.json`、`evacuees.csv`、`supply_rules.yaml` 三种格式的数据文件
- **数据解析**：跨模块的数据解析引擎，支持JSON、CSV、YAML格式
- **规则校验**：自动检测以下问题：
  - 床位超配
  - 婴儿/老人物资缺失
  - 同一人员重复登记
  - 跨午夜统计错误
- **状态计算**：实时计算床位使用情况、物资消耗、特殊人群照护状态
- **数据可视化**：
  - 时间线图表展示事件发展
  - 详细表格展示人员到达、床位分配、物资消耗
  - 问题检测记录汇总
- **筛选功能**：支持按避难点、时段、问题类型进行筛选
- **报告导出**：支持导出完整的复盘报告（review_report.md）

## 项目结构

```
zy8240/
├── index.html              # 主页面
├── README.md               # 本文档
├── css/
│   └── styles.css          # 样式文件
├── js/
│   ├── app.js              # 主应用入口
│   ├── dataParser.js       # 数据解析模块
│   ├── ruleEngine.js       # 规则校验引擎
│   ├── stateCalculator.js  # 状态计算模块
│   ├── ui.js               # UI交互模块
│   └── reportExporter.js   # 报告导出模块
└── data/
    ├── shelters.json       # 避难点信息示例数据
    ├── evacuees.csv        # 转移人员信息示例数据
    └── supply_rules.yaml   # 物资分配规则示例数据
```

## 本地预览步骤

### 方法一：使用Python内置HTTP服务器（推荐）

1. **确保已安装Python**
   ```bash
   python --version
   # 或
   python3 --version
   ```

2. **进入项目目录**
   ```bash
   cd /path/to/zy8240
   ```

3. **启动本地服务器**
   ```bash
   # Python 3
   python3 -m http.server 8000
   
   # 或 Python 2
   python -m SimpleHTTPServer 8000
   ```

4. **在浏览器中访问**
   ```
   http://localhost:8000
   ```

### 方法二：使用Node.js的http-server

1. **安装http-server（如果尚未安装）**
   ```bash
   npm install -g http-server
   ```

2. **进入项目目录并启动服务器**
   ```bash
   cd /path/to/zy8240
   http-server -p 8000
   ```

3. **在浏览器中访问**
   ```
   http://localhost:8000
   ```

### 方法三：使用VS Code的Live Server插件

1. **在VS Code中安装Live Server插件**
   - 打开VS Code
   - 按 `Ctrl+Shift+X` 打开扩展面板
   - 搜索 "Live Server" 并安装

2. **打开项目目录**
   ```bash
   code /path/to/zy8240
   ```

3. **启动Live Server**
   - 右键点击 `index.html` 文件
   - 选择 "Open with Live Server"
   - 或点击右下角的 "Go Live" 按钮

## 使用指南

### 1. 加载数据

#### 方式一：使用示例数据
点击页面顶部的 **"加载示例数据"** 按钮，系统将自动加载 `data/` 目录下的示例数据文件。

#### 方式二：导入自定义数据
1. 点击 **"导入数据文件"** 按钮，或使用左侧的文件上传区域
2. 选择以下三个文件（可以同时选择或分批选择）：
   - `shelters.json` - 避难点信息
   - `evacuees.csv` - 转移人员信息
   - `supply_rules.yaml` - 物资分配规则
3. 也可以将文件直接拖拽到上传区域

### 2. 数据筛选

数据加载完成后，可以使用左侧的筛选条件：

- **选择避难点**：按特定避难点筛选数据
- **开始时间/结束时间**：按时间范围筛选
- **问题类型筛选**：选择需要关注的问题类型：
  - 床位超配
  - 物资缺失
  - 重复登记
  - 跨午夜统计

点击 **"应用筛选"** 按钮更新视图。

### 3. 查看复盘结果

数据加载后，页面将显示以下内容：

#### 复盘概览
- 避难点数量
- 转移人员总数
- 检测到的问题数
- 物资缺口总数

#### 事件时间线
- 堆叠柱状图展示人员到达和问题发生的时间分布
- 详细时间线列表展示每个事件的时间、标题和描述

#### 详细表格
- **人员到达与床位分配**：显示每位转移人员的到达时间、分配床位和状态
- **物资消耗与缺口**：显示各避难点的物资需求、分配和缺口情况
- **特殊人群照护**：显示婴幼儿、老年人、残疾人、孕妇等特殊人群的照护状态
- **问题检测记录**：列出所有检测到的问题，包括严重程度、描述和状态

### 4. 导出复盘报告

1. 确认数据已加载并分析完成
2. 点击页面顶部的 **"导出复盘报告"** 按钮
3. 系统将生成并下载 `review_report.md` 文件
4. 可以使用任何Markdown编辑器查看报告内容

## 数据格式说明

### shelters.json（避难点信息）

```json
[
    {
        "id": "shelter_001",
        "name": "阳光社区避难点",
        "capacity": 50,
        "location": "阳光路123号",
        "contact_person": "张主任",
        "contact_phone": "13800138001",
        "initial_supplies": {
            "milk_powder": 20,
            "diapers": 50,
            "walking_aid": 10,
            "medical_kit": 15,
            "blanket": 60,
            "water": 100,
            "food": 80
        }
    }
]
```

**字段说明**：
- `id`: 避难点唯一标识
- `name`: 避难点名称
- `capacity`: 床位容量
- `location`: 位置信息
- `contact_person`: 联系人
- `contact_phone`: 联系电话
- `initial_supplies`: 初始物资储备

### evacuees.csv（转移人员信息）

CSV格式，包含以下字段：

| 字段 | 说明 | 示例 |
|------|------|------|
| id | 人员唯一标识 | E001 |
| name | 姓名 | 张三 |
| age | 年龄 | 35 |
| gender | 性别 | 男 |
| arrival_time | 到达时间 | 2024-07-15 14:30:00 |
| shelter_id | 避难点ID | shelter_001 |
| special_needs | 特殊需求 | 婴幼儿/老年人/孕妇/残疾人 |
| medical_conditions | 医疗状况 | 高血压/糖尿病 |
| bed_assigned | 分配床位 | B101 |

**注意**：
- 时间格式建议使用 ISO 格式：`YYYY-MM-DD HH:MM:SS`
- 特殊需求字段可以标识需要特殊照护的人群，系统将据此进行物资分配和问题检测

### supply_rules.yaml（物资分配规则）

```yaml
supply_types:
  - id: milk_powder
    name: 奶粉
    unit: 罐
    description: 婴幼儿配方奶粉
    priority: high

rules:
  - id: rule_infant_milk
    name: 婴幼儿奶粉分配
    condition:
      age_range:
        min: 0
        max: 2
    action:
      supply_type: milk_powder
      quantity: 1
```

**规则结构说明**：
- `supply_types`: 定义可用的物资类型
- `rules`: 定义分配规则
  - `condition`: 适用条件，支持 `age_range`（年龄范围）和 `special_needs`（特殊需求）
  - `action`: 分配动作，指定物资类型和数量

## 问题检测机制

### 1. 床位超配检测
- 检测条件：避难点入住人数 > 床位容量
- 严重程度：高
- 影响：超配人员可能无法获得床位

### 2. 物资缺失检测
- 检测条件：根据物资分配规则计算的需求 > 实际分配
- 严重程度：根据缺口数量判定（>5为高，否则为中）
- 影响：婴幼儿、老年人等特殊人群可能缺乏必要物资

### 3. 重复登记检测
- 检测条件：同一人员ID或姓名出现多次
- 严重程度：ID重复为高，姓名相同为中（疑似）
- 影响：可能导致数据统计错误和物资重复分配

### 4. 跨午夜统计警告
- 检测条件：数据时间跨越午夜
- 严重程度：中
- 影响：可能存在统计误差，建议按日期分段查看

### 5. 特殊人群照护提醒
- 检测条件：存在婴幼儿、老年人、残疾人、孕妇等人群
- 严重程度：根据数量判定
- 影响：需要特殊照护和物资供应

## 技术栈

- **前端框架**: 原生HTML/CSS/JavaScript（无框架依赖）
- **图表库**: Chart.js（用于时间线可视化）
- **YAML解析**: js-yaml（用于解析YAML格式数据）
- **数据格式**: JSON, CSV, YAML

## 注意事项

1. **跨域问题**: 由于浏览器安全限制，直接打开HTML文件可能无法加载示例数据。请务必使用本地HTTP服务器运行。

2. **数据格式**: 确保导入的数据文件格式符合规范，否则可能导致解析错误。

3. **时间格式**: 建议使用ISO标准时间格式（`YYYY-MM-DD HH:MM:SS`），以确保时间线和筛选功能正常工作。

4. **浏览器兼容性**: 建议使用现代浏览器（Chrome、Firefox、Safari）以获得最佳体验。

## 扩展开发

### 添加新的问题检测规则

1. 在 `js/ruleEngine.js` 中添加新的检测函数
2. 在 `runAllChecks` 函数中调用新函数
3. 更新 `ISSUE_TYPES` 常量（如需要）

### 添加新的物资分配规则

1. 在 `supply_rules.yaml` 中定义新规则
2. 确保 `condition` 和 `action` 格式正确
3. 系统会自动应用新规则进行计算

### 自定义UI样式

1. 修改 `css/styles.css` 文件
2. 支持响应式设计，已适配移动端

## 许可证

本工具仅供学习和内部使用。

## 联系方式

如有问题或建议，请联系项目维护者。

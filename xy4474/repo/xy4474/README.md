# 证件照影楼交付前复核工具

一个用于证件照影楼在交付前自动检测各种问题的自动化工具。

## 功能特性

### 🔍 问题检测
- **漏尺寸检测**: 检查订单要求的尺寸是否在导出文件夹中缺失
- **背景色不符检测**: 检测图片实际背景色与订单要求是否一致
- **文件命名撞单检测**: 检测同一订单号对应多个不同客户或规格
- **未修完进打印检测**: 检测修图未完成的订单是否进入了打印队列
- **加急单超时检测**: 检测加急单是否超出规定时间限制
- **文件缺失检测**: 检测订单记录存在但对应文件不存在
- **多余文件检测**: 检测导出文件夹中有未在订单中记录的文件

### 💾 数据存储
- 使用 SQLite 数据库持久化存储
- 支持多会话管理
- 人工备注功能
- 问题解决状态追踪

### 📊 查询与导出
- 本地查询接口（按订单号、问题类型、严重程度）
- 导出 Markdown 交付清单
- 导出 JSON 审计包
- 完整数据库备份

## 目录结构

```
xy4474/
├── config.py           # 核心配置文件
├── utils.py          # 工具类（文件名解析、图像分析、数据验证等）
├── data_reader.py    # 数据读取模块（CSV、JSON、文件夹扫描）
├── issue_detector.py # 问题检测引擎
├── storage.py        # 存储模块（SQLite、查询接口）
├── exporter.py       # 导出模块（Markdown、JSON）
├── main.py           # 主程序入口
├── data/             # 数据目录
│   ├── orders.csv        # 订单CSV示例
│   ├── retouch.json     # 修图记录JSON示例
│   ├── print_queue.json # 打印队列JSON示例
│   └── export/          # 导出图片目录（放置待检测图片）
├── exports/          # 导出结果目录
├── output/           # 输出目录
└── review_data.db    # SQLite数据库（运行后生成）
```

## 安装要求

- Python 3.7+
- 可选依赖：
  - Pillow (用于图像尺寸和背景色分析)
  - numpy (用于背景色计算)

### 安装依赖

```bash
pip install pillow numpy
```

或使用最小安装（不安装可选依赖时，图像分析功能将被禁用）：

```bash
# 无需安装额外依赖即可使用核心功能
```

## 快速开始

### 1. 准备数据

将以下文件放入 `data/` 目录：

- `orders.csv` - 订单CSV文件
- `retouch.json` - 修图记录JSON文件
- `print_queue.json` - 打印队列JSON文件
- `export/` 目录 - 放置导出的图片文件

项目已包含示例数据，可直接用于测试。

### 2. 运行工具

#### 交互模式（推荐）

```bash
python main.py
```

进入交互式菜单，选择相应操作：

```
============================================================
证件照影楼交付前复核工具 - 交互模式
============================================================

请选择操作:
  1. 执行完整复核流程
  2. 查询订单详情
  3. 添加备注
  4. 标记问题为已解决
  5. 导出结果
  6. 查看历史会话
  7. 关闭当前会话
  0. 退出
```

#### 命令行模式

```bash
# 执行完整复核流程
python main.py --review

# 执行复核并导出结果
python main.py --review --export

# 查询指定订单
python main.py --query 20260501001

# 查看历史会话
python main.py --sessions

# 指定数据目录
python main.py --review --data-dir /path/to/data
```

## 文件名规范

工具期望的图片文件命名格式：

```
订单号_客户姓名_尺寸_背景色.扩展名
```

示例：
- `20260501001_张三_一寸_白色.jpg`
- `20260501002_李四_二寸_蓝色.png`

支持的图片格式：`.jpg`, `.jpeg`, `.png`, `.bmp`, `.tiff`, `.tif`

## 配置说明

主要配置在 `config.py` 文件中：

### 标准尺寸配置

```python
STANDARD_SIZES = {
    "一寸": {"width": 295, "height": 413, "dpi": 300},
    "二寸": {"width": 413, "height": 579, "dpi": 300},
    "小一寸": {"width": 260, "height": 378, "dpi": 300},
    # ... 更多尺寸
}
```

### 标准背景色配置

```python
STANDARD_BACKGROUNDS = {
    "白色": {"hex": "#FFFFFF", "rgb": (255, 255, 255), "tolerance": 30},
    "蓝色": {"hex": "#438EDB", "rgb": (67, 142, 219), "tolerance": 30},
    "红色": {"hex": "#FF0000", "rgb": (255, 0, 0), "tolerance": 30},
    # ... 更多背景色
}
```

### 加急单配置

```python
URGENT_CONFIG = {
    "time_limit_hours": 2,  # 加急单限时2小时
    "priority_levels": ["普通", "加急", "特急"],
    "urgent_keywords": ["加急", "特急", "紧急", "urgent", "URGENT"],
}
```

### 问题严重程度

| 级别 | 说明 |
|------|------|
| critical (严重) | 加急单超时，需要立即处理 |
| high (高) | 漏尺寸、背景色不符、未修完进打印、文件缺失 |
| medium (中) | 文件命名撞单 |
| low (低) | 多余文件 |

## 数据格式说明

### 订单CSV格式

必需字段（列名可灵活匹配）：
- `订单号` / `order_id` / `id`
- `客户姓名` / `姓名` / `customer_name`
- `尺寸` / `规格` / `sizes`
- `背景色` / `背景` / `background`

可选字段：
- `状态` / `status`
- `优先级` / `priority` / `加急`
- `创建时间` / `create_time`
- `数量` / `quantity`
- `备注` / `remarks`

示例：
```csv
订单号,客户姓名,尺寸,背景色,状态,优先级,创建时间,数量,备注
20260501001,张三,一寸,白色,已完成,普通,2026-05-01 09:30:00,1,
20260501002,李四,一寸,蓝色,已完成,普通,2026-05-01 10:15:00,2,
```

### 修图记录JSON格式

```json
[
    {
        "order_id": "20260501001",
        "status": "completed",
        "start_time": "2026-05-01 09:35:00",
        "end_time": "2026-05-01 10:15:00",
        "retoucher": "李师傅",
        "steps": ["裁剪尺寸", "背景替换", "磨皮美白", "色彩校正", "锐化输出"],
        "issues": []
    }
]
```

状态值：`pending` (待修图), `in_progress` (修图中), `completed` (已完成), `reviewing` (审核中), `approved` (已审核), `rejected` (已驳回)

### 打印队列JSON格式

```json
[
    {
        "order_id": "20260501001",
        "added_time": "2026-05-01 10:30:00",
        "status": "completed",
        "printer": "打印机A-01",
        "copies": 1,
        "priority": "普通"
    }
]
```

## 示例数据说明

项目包含的示例数据设计了以下测试场景：

| 订单号 | 客户 | 测试场景 |
|--------|------|----------|
| 20260501005 | 钱七 | 特急单，修图中，但已进入打印队列（测试未修完进打印、加急单超时） |
| 20260501009 | 郑十一 | 加急单，审核中，已进入打印队列（测试未修完进打印） |
| 20260501004 | 赵六 | 多尺寸订单（一寸、二寸），测试漏尺寸检测 |
| 20260501010 | 王十二 | 多尺寸多背景订单，测试复杂场景 |

## API 使用示例

```python
from main import ReviewTool

# 创建工具实例
tool = ReviewTool()

# 执行复核
result = tool.run_review("测试复核")

# 查询订单
order_detail = tool.query_order("20260501001")

# 添加备注
tool.add_note("20260501001", "已联系客户确认", "操作员A")

# 标记问题已解决
tool.resolve_issue(1, "已补充缺失的一寸照片", "操作员B")

# 导出结果
exported = tool.export_results()

# 关闭会话
tool.close_session("复核完成，所有问题已处理")
```

## 导出文件说明

### Markdown 交付清单

包含以下内容：
- 基本信息（会话名称、时间）
- 统计概览（订单数、问题数、解决状态）
- 问题严重程度分布
- 问题类型分布
- 问题详情（按严重程度分组）
- 订单清单表格

### JSON 审计包

包含完整的审计数据：
- 会话信息
- 统计数据
- 所有问题详情
- 所有订单（含关联问题和备注）
- 问题类型定义

## 数据库表结构

```
review_sessions (复核会话)
├── id, session_name, start_time, end_time, status
├── total_orders, total_issues, resolved_issues
└── notes, created_at

orders (订单)
├── id, session_id, order_id, customer_name
├── sizes, background, priority, status
├── create_time, raw_data, created_at
└── FOREIGN KEY (session_id) → review_sessions

issues (问题)
├── id, session_id, order_id, issue_type, issue_name
├── severity, details, detected_time
├── resolved, resolved_time, resolved_by, resolution_notes
└── FOREIGN KEY (session_id) → review_sessions

notes (备注)
├── id, session_id, order_id, issue_id
├── note_type, content, author
├── created_at, updated_at
└── FOREIGN KEY (session_id) → review_sessions
   FOREIGN KEY (issue_id) → issues
```

## 常见问题

### Q: 图像分析功能为什么没有启用？

A: 需要安装 Pillow 和 numpy 库：
```bash
pip install pillow numpy
```

如果不安装这些库，工具仍可运行，但以下功能会被禁用：
- 图像尺寸检测
- 背景色分析

### Q: 如何自定义标准尺寸和背景色？

A: 修改 `config.py` 中的 `STANDARD_SIZES` 和 `STANDARD_BACKGROUNDS` 配置。

### Q: 如何修改加急单超时时间？

A: 修改 `config.py` 中的 `URGENT_CONFIG["time_limit_hours"]`。

### Q: CSV 文件的列名必须严格匹配吗？

A: 不需要。工具会自动尝试匹配多种可能的列名，例如：
- `订单号`、`订单编号`、`order_id`、`id` 都会被识别为订单号
- `客户姓名`、`姓名`、`客户`、`customer_name` 都会被识别为客户姓名

## 更新日志

### v1.0.0 (2026-05-05)
- 初始版本发布
- 实现核心问题检测功能
- 实现数据存储和查询接口
- 实现 Markdown 和 JSON 导出功能
- 提供交互模式和命令行模式
- 包含示例数据

## 许可证

本工具仅供内部使用。

---

**注意**：使用前请确保备份重要数据，并在测试环境中验证后再用于生产环境。

# 撤展装箱核验台

博物馆临展撤展装箱管理系统 - 本地桌面应用

## 项目简介

"撤展装箱核验台"是专为博物馆临展撤展小组设计的本地桌面应用，旨在解决撤展装箱过程中的常见问题：
- 同一件展品被装进两个箱子（重复装箱）
- 易碎品缺少缓冲材料确认
- 温湿度记录缺失
- 人员签名缺失
- 照片证据不匹配
- 漏扫展品

系统提供完整的导入、校验、展示、复核和导出功能，所有数据持久化到本地SQLite数据库，确保数据安全和可追溯。

## 功能特性

### 📥 数据导入
- **展品清单CSV导入**：支持中英文表头，自动识别字段
- **装箱扫描JSONL导入**：逐行解析扫描记录，灵活的日期格式
- **照片目录扫描**：从文件名智能提取展品编号和箱号

### 🔍 规则引擎校验
系统内置7条校验规则，按严重程度分级：

| 规则 | 严重程度 | 描述 |
|------|----------|------|
| 漏扫检查 | critical | 展品清单中有但未扫描的展品 |
| 重复装箱检查 | critical | 同一展品被扫描到不同箱子 |
| 签名缺失检查 | high | 扫描记录缺少人员签名 |
| 照片证据检查 | high | 扫描记录缺少对应照片 |
| 易碎品缓冲检查 | high | 易碎品缺少缓冲材料确认 |
| 温湿度记录检查 | medium | 高价值展品缺少温湿度记录 |
| 未知展品检查 | high | 扫描了不在清单中的展品 |

### 📊 数据展示
- **展品清单**：完整的展品列表，支持筛选和排序
- **装箱扫描**：按箱号分组的扫描记录
- **扫描时间线**：按时间顺序展示的扫描历史
- **异常清单**：校验发现的问题，支持严重程度筛选
- **照片证据**：已导入的照片列表

### ✅ 异常复核
- 提交复核意见
- 标记异常为已解决
- 记录复核人、时间和处理结果
- 支持后续跟进标记

### 📤 数据导出
- **Markdown交接单**：完整的交接报告，包含统计、清单、异常、复核等
- **CSV异常表**：异常数据导出，便于数据分析
- **CSV装箱清单**：装箱记录导出
- **JSON审计包**：完整的审计数据，包含元数据、摘要和原始数据

### 💾 数据持久化
- 本地SQLite数据库
- 支持多项目管理
- 项目数据完整保存和加载
- 已解决异常状态保留

## 技术栈

- **语言**：Python 3.8+
- **GUI框架**：Tkinter（Python内置，无需额外安装）
- **数据库**：SQLite（Python内置）
- **依赖库**：
  - `python-dateutil`：日期解析
  - `pytest`：单元测试
  - `pytest-cov`：测试覆盖率
  - `black`：代码格式化
  - `flake8`：代码检查

## 安装说明

### 1. 环境要求
- Python 3.8 或更高版本
- pip（Python包管理器）

### 2. 安装依赖

```bash
# 进入项目目录
cd xy4154

# 安装依赖
pip install -r requirements.txt
```

## 快速开始

### 启动应用

```bash
python main.py
```

### 验证流程

#### 步骤1：启动GUI
运行 `python main.py` 启动应用界面。

#### 步骤2：导入示例数据

1. **导入展品清单CSV**
   - 菜单：导入 → 展品清单CSV
   - 选择文件：`sample_data/exhibit_list.csv`

2. **导入装箱扫描JSONL**
   - 菜单：导入 → 装箱扫描JSONL
   - 选择文件：`sample_data/scan_records.jsonl`

3. **导入照片目录**
   - 菜单：导入 → 照片目录
   - 选择目录：`sample_data/photos/`

#### 步骤3：执行校验
- 菜单：操作 → 执行校验
- 或点击工具栏"校验"按钮

#### 步骤4：查看异常
- 切换到"异常清单"标签页
- 可以看到示例数据中故意设置的问题：
  - EX-010 漏扫（critical）
  - EX-006 重复装箱到 BOX-B01 和 BOX-B02（critical）
  - SCAN-007 缺少签名（high）
  - EX-007 易碎品缺少缓冲确认（high）
  - EX-UNKNOWN 未知展品（high）

#### 步骤5：复核异常
1. 在异常清单中选择一条异常
2. 在下方复核区域输入复核人姓名和复核意见
3. 点击"提交复核"按钮
4. 可以选择"标记已解决"来关闭异常

#### 步骤6：导出数据
- **导出Markdown交接单**：导出 → Markdown交接单
- **导出CSV异常表**：导出 → CSV异常表
- **导出JSON审计包**：导出 → JSON审计包

#### 步骤7：保存项目
- 菜单：文件 → 保存项目
- 选择保存位置和文件名
- 下次可以通过"文件 → 打开项目"加载

## 数据格式说明

### 展品清单CSV格式

支持中英文表头，以下字段名称均可识别：

| 字段 | 支持的表头名 | 必填 | 说明 |
|------|--------------|------|------|
| exhibit_id | 展品编号, 编号, exhibit_id, id | 是 | 展品唯一标识 |
| name | 名称, 展品名称, name | 是 | 展品名称 |
| category | 类别, 分类, category | 否 | 展品分类 |
| is_fragile | 是否易碎, 易碎, fragile, is_fragile | 否 | 是否易碎品 |
| estimated_value | 估值, estimated_value, value | 否 | 估计价值 |
| special_requirements | 特殊要求, special_requirements | 否 | 特殊要求说明 |

**示例**：
```csv
展品编号,名称,类别,是否易碎,估值,特殊要求
EX-001,青铜器-鼎,青铜器,否,150000,
EX-002,瓷器-花瓶,瓷器,是,80000,小心轻放
```

### 装箱扫描JSONL格式

每行一个JSON对象，支持以下字段：

| 字段 | 必填 | 类型 | 说明 |
|------|------|------|------|
| scan_id | 否 | string | 扫描记录ID，自动生成 |
| exhibit_id | 是 | string | 展品编号 |
| box_number | 是 | string | 箱号 |
| scan_time | 是 | string/datetime | 扫描时间，支持多种格式 |
| operator | 否 | string | 操作员姓名 |
| temperature | 否 | float | 温度（摄氏度） |
| humidity | 否 | float | 湿度（百分比） |
| buffer_verified | 否 | boolean | 缓冲材料是否确认 |
| has_signature | 否 | boolean | 是否有签名 |
| notes | 否 | string | 备注 |

**日期格式支持**：
- ISO格式：`"2024-05-15T09:30:00"`
- 年月日：`"2024-05-15 09:30:00"`
- 中文格式：`"2024年5月15日 9:30:00"`
- 时间戳（毫秒）：`1715765400000`

**示例**：
```jsonl
{"scan_id": "SCAN-001", "exhibit_id": "EX-001", "box_number": "BOX-A01", "scan_time": "2024-05-15T09:30:00", "operator": "张三", "temperature": 22.5, "humidity": 55.0, "buffer_verified": true, "has_signature": true}
{"scan_id": "SCAN-002", "exhibit_id": "EX-002", "box_number": "BOX-A01", "scan_time": "2024-05-15T09:45:00", "operator": "李四", "buffer_verified": false, "has_signature": false}
```

### 照片文件命名规范

照片文件名应包含展品编号和箱号，支持以下格式：

- `{展品编号}_{箱号}_{时间}.jpg`
- `{展品编号}_{箱号}.jpg`
- `{展品编号}-{箱号}-{时间}.jpg`
- `{箱号}_{展品编号}_{时间}.jpg`

**示例**：
- `EX-001_BOX-A01_20240515_093000.jpg`
- `EX-002_BOX-A01.jpg`
- `BOX-A01_EX-001_20240515.jpg`

## 项目结构

```
xy4154/
├── main.py                    # 主程序入口
├── requirements.txt           # 依赖配置
├── core/                      # 核心模块
│   ├── __init__.py
│   ├── models.py              # 数据模型定义
│   ├── parser.py              # 数据解析器
│   ├── validator.py           # 校验规则引擎
│   ├── database.py            # 数据库管理
│   └── exporter.py            # 导入导出模块
├── gui/                       # GUI界面
│   ├── __init__.py
│   └── main_window.py         # 主窗口
├── sample_data/               # 示例数据
│   ├── __init__.py
│   ├── exhibit_list.csv       # 示例展品清单
│   ├── scan_records.jsonl     # 示例扫描记录
│   └── photos/                # 示例照片目录
│       ├── README.md
│       ├── EX-001_BOX-A01_20240515_093000.jpg
│       ├── EX-002_BOX-A01_20240515_094500.jpg
│       └── EX-003_BOX-B01_20240515_101500.jpg
└── tests/                     # 测试用例
    ├── __init__.py
    ├── test_parser.py         # 解析器测试
    ├── test_validator.py      # 校验规则测试
    ├── test_database.py       # 数据库测试
    └── test_exporter.py       # 导出器测试
```

## 运行测试

### 运行所有测试

```bash
pytest tests/ -v
```

### 运行特定测试文件

```bash
# 运行解析器测试
pytest tests/test_parser.py -v

# 运行校验规则测试
pytest tests/test_validator.py -v

# 运行数据库测试
pytest tests/test_database.py -v

# 运行导出器测试
pytest tests/test_exporter.py -v
```

### 查看测试覆盖率

```bash
pytest tests/ --cov=core --cov-report=term-missing
```

## 数据存储位置

默认数据库存储位置：
- macOS: `~/.exhibit_verifier/exhibit_verifier.db`
- Windows: `%USERPROFILE%\.exhibit_verifier\exhibit_verifier.db`
- Linux: `~/.exhibit_verifier/exhibit_verifier.db`

可以通过修改 `core/database.py` 中的 `DB_PATH` 变量来自定义存储位置。

## 示例数据说明

`sample_data/` 目录包含用于测试的示例数据：

### exhibit_list.csv
包含10件展品，涵盖：
- 青铜器、瓷器、书画、雕塑等多个类别
- 易碎品和非易碎品
- 不同估值范围（含高价值展品）
- 部分展品有特殊要求

### scan_records.jsonl
包含10条扫描记录，故意设置了以下问题用于测试：
- EX-010 漏扫（展品清单有但没有扫描记录）
- EX-006 被扫描到 BOX-B01 和 BOX-B02（重复装箱）
- SCAN-007 缺少签名（has_signature: false）
- EX-007 是易碎品但缺少缓冲确认（buffer_verified: false）
- EX-UNKNOWN 被扫描（不在展品清单中，未知展品）

### photos/
包含3张模拟照片文件，用于测试照片目录扫描功能。

## 使用场景示例

### 场景1：新撤展项目开始

1. 启动应用
2. 菜单：文件 → 新建项目
3. 输入项目名称和描述
4. 依次导入展品清单、扫描记录、照片目录
5. 执行校验
6. 查看异常清单，处理问题
7. 复核异常，提交处理意见
8. 导出交接单和审计包

### 场景2：继续处理已有项目

1. 启动应用
2. 菜单：文件 → 打开项目
3. 选择之前保存的项目文件
4. 继续处理未解决的异常
5. 添加新的扫描记录或照片
6. 重新校验
7. 导出更新后的报告

### 场景3：只使用校验功能

1. 导入数据（不需要保存项目）
2. 执行校验
3. 查看异常清单
4. 导出异常表或审计包
5. 关闭应用（数据不保存）

## 注意事项

1. **数据安全**：所有数据存储在本地SQLite数据库，不会上传到云端
2. **文件编码**：导入CSV文件时，默认使用UTF-8编码，也支持GBK编码自动检测
3. **照片格式**：支持常见图片格式（.jpg, .jpeg, .png, .gif, .bmp, .tiff）
4. **日期格式**：JSONL文件支持多种日期格式，会自动解析

## 常见问题

### Q: 为什么导入CSV时提示"缺少必需字段"？
A: 请确保CSV文件包含"展品编号"和"名称"列（或对应的英文名"exhibit_id"和"name"）。

### Q: 照片文件无法被识别怎么办？
A: 请检查照片文件名是否符合命名规范，应包含展品编号和箱号，如：`EX-001_BOX-A01_20240515.jpg`。

### Q: 已解决的异常重新校验后又出现了？
A: 不会。系统设计时已考虑这一点，保存异常时会保留已解决的状态。重新校验不会清除已解决的标记。

### Q: 如何自定义校验规则？
A: 可以在 `core/validator.py` 中添加新的规则类，继承 `BaseRule` 并实现 `validate` 方法，然后在 `RuleEngine` 中注册新规则。

## 许可证

本项目仅供内部使用。

## 联系方式

如有问题或建议，请联系开发团队。

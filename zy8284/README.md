# 数据清洗追溯工作台

一个本地数据清洗和追溯系统，支持上传脏数据CSV和清洗规则YAML，自动清洗并存储所有血缘关系信息。

## 功能特性

- 📁 **文件上传**: 支持拖拽上传 dirty_orders.csv 和 cleaning-rules.yaml
- 🔧 **自动清洗**: 根据规则自动清洗客户ID、日期、金额、状态等字段
- 🔍 **数据追溯**: 点击任意单元格查看原始记录、命中规则、变换过程
- ⚠️ **冲突检测**: 自动检测客户ID重复但字段冲突的边界情况
- ✏️ **人工覆盖**: 支持对清洗结果进行人工覆盖并记录原因
- 📤 **多格式导出**: 支持导出 cleaned.csv、lineage.json、audit.md

## 项目结构

```
zy8284/
├── backend/
│   ├── __init__.py
│   ├── app.py              # Flask API 主应用
│   ├── database.py         # SQLite 数据库模型和操作
│   └── cleaning_engine.py  # 数据清洗引擎
├── frontend/
│   └── index.html          # 前端界面
├── samples/
│   ├── dirty_orders.csv    # 示例脏数据
│   └── cleaning-rules.yaml # 示例清洗规则
├── uploads/                # 上传文件存储目录
├── requirements.txt        # Python 依赖
└── README.md               # 本文档
```

## 环境要求

- Python 3.8+
- pip 包管理器

## 安装步骤

1. **克隆项目** (如果使用版本控制) 或直接进入项目目录

```bash
cd /Users/lzy/pro/solocoder/pro/zy8284/repo/zy8284
```

2. **创建虚拟环境** (推荐)

```bash
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
# 或
# venv\Scripts\activate  # Windows
```

3. **安装依赖**

```bash
pip install -r requirements.txt
```

## 启动步骤

1. **启动后端服务**

```bash
python -m backend.app
```

服务将在 `http://localhost:5000` 启动

2. **访问前端界面**

打开浏览器访问: `http://localhost:5000`

## 使用说明

### 1. 上传文件

- 在上传区域，点击或拖拽上传 CSV 数据文件和 YAML 规则文件
- 示例文件位于 `samples/` 目录下

**示例数据说明:**

`dirty_orders.csv` 包含以下脏数据场景:
- 客户ID带前后空格: `  C001 `
- 客户ID大小写不一致: `c002` vs `C002`
- 日期格式多样: `2024-01-15`, `15/02/2024`, `2024/01/16`, `03-04-2024`
- 金额带货币符号: `$1,500.50`, `€2,300.00`, `¥80000`
- 金额带千分位分隔符: `$1,500.50`
- 空值字段: 空的订单日期、空的状态
- **客户ID重复冲突**: 
  - 行2: C001, 日期2024-01-15, 金额1500.50
  - 行4: C001, 日期2024-01-16, 金额1800
  - 这两条记录客户ID相同但日期和金额不同，会产生冲突

`cleaning-rules.yaml` 定义了:
- customer_id: 去除空格、转大写、正则匹配
- order_date: 支持多种日期格式解析
- order_amount: 去除货币符号和千分位
- status: 状态值标准化映射

### 2. 开始清洗

- 选择两个文件后，点击"开始清洗"按钮
- 系统会自动:
  - 解析并存储原始记录
  - 应用清洗规则
  - 检测并记录冲突
  - 存储血缘关系

### 3. 查看清洗结果

- **清洗后数据标签页**: 显示标准化后的表格
- 点击任意单元格，会弹出追溯详情弹窗，显示:
  - 原始行号和原始数据
  - 每个字段的变换过程 (原值 → 新值)
  - 命中的清洗规则
  - 是否有人工覆盖

### 4. 处理冲突

- 切换到"冲突列表"标签页
- 查看检测到的客户ID重复冲突
- 选择正确的值并点击"解决冲突"

### 5. 人工覆盖

- 在数据追溯弹窗中
- 选择要覆盖的字段
- 输入新值和原因
- 点击"应用覆盖"
- 覆盖记录会被保存到血缘关系中

### 6. 导出结果

点击底部的导出按钮，可导出:

#### cleaned.csv
清洗后的标准数据表格，包含:
- 行号
- 客户ID
- 订单日期 (标准化为 YYYY-MM-DD)
- 订单金额 (数值类型)
- 状态 (标准化)
- 是否有人工覆盖

#### lineage.json
完整的数据血缘追溯信息，包含:
- 原始记录信息
- 清洗后的值
- 每个字段的变换细节
- 应用的规则
- 是否为人工覆盖

#### audit.md
审计报告，包含:
- 处理摘要
- 清洗后数据表格
- 冲突列表 (已解决/未解决)
- 详细的血缘关系记录

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/upload | 上传并处理文件 |
| GET | /api/records | 获取所有清洗后记录 |
| GET | /api/lineage/<id> | 获取指定记录的血缘关系 |
| GET | /api/conflicts | 获取所有冲突 |
| POST | /api/conflicts/<id>/resolve | 解决冲突 |
| POST | /api/override | 人工覆盖 |
| GET | /api/export/cleaned | 导出 cleaned.csv |
| GET | /api/export/lineage | 导出 lineage.json |
| GET | /api/export/audit | 导出 audit.md |
| POST | /api/clear | 清空所有数据 |

## 边界情况处理

### 1. 客户ID重复但字段冲突

当两条记录有相同的客户ID但其他字段值不同时:
- 系统会自动检测并记录为冲突
- 在冲突列表中展示两个不同的值
- 用户可以选择正确的值来解决冲突

### 2. 日期格式歧义

系统支持多种日期格式解析:
- `YYYY-MM-DD` (标准格式)
- `DD/MM/YYYY` (欧洲格式)
- `YYYY/MM/DD` (斜杠分隔)
- `DD-MM-YYYY` (横杠分隔)
- 自动解析 (dateutil 库)

解析后统一标准化为 `YYYY-MM-DD` 格式。

## 数据库设计

系统使用 SQLite 存储所有数据，主要表:

- **uploaded_files**: 上传的文件元数据
- **cleaning_rules**: 清洗规则版本
- **raw_records**: 原始记录 (行号 + 原始数据)
- **cleaned_records**: 清洗后记录
- **lineage**: 血缘关系 (每个字段的变换过程)
- **conflicts**: 冲突记录
- **manual_overrides**: 人工覆盖记录

## 演示流程

1. 启动服务: `python -m backend.app`
2. 打开浏览器: `http://localhost:5000`
3. 上传 `samples/dirty_orders.csv` 和 `samples/cleaning-rules.yaml`
4. 点击"开始清洗"
5. 查看清洗后的数据表格
6. 点击任意单元格查看追溯详情
7. 切换到冲突列表，查看 C001 和 C002 的冲突
8. 尝试人工覆盖某个字段
9. 导出 cleaned.csv、lineage.json、audit.md 查看结果

## 常见问题

**Q: 上传后没有反应?**
A: 检查后端服务是否启动，控制台是否有错误信息。

**Q: 日期解析不正确?**
A: 检查 cleaning-rules.yaml 中的日期格式配置，确保包含你的数据格式。

**Q: 如何重新上传数据?**
A: 点击"清空数据"按钮，然后重新上传文件。

**Q: 人工覆盖会影响原始数据吗?**
A: 不会，原始数据永远保留在 raw_records 表中，覆盖只记录在 lineage 和 manual_overrides 表中。

## 许可证

MIT License

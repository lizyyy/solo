# 矫形取模适配台

假肢矫形门诊与制作间管理系统 - 本地桌面GUI应用

## 功能特性

- **患者档案管理**：创建和维护患者信息（姓名、电话、诊断等）
- **订单阶段看板**：待取模 → 待设计 → 制作中 → 待试穿 → 需返修 → 已交付
- **尺寸版本管理**：多版本尺寸记录，JSON格式存储
- **附件归档系统**：
  - 自动复制到项目数据目录
  - SHA256哈希校验
  - 支持图片、3D扫描、PDF等格式
  - 识别同名不同内容、缺失文件等问题
- **状态机规则**：
  - 没有尺寸版本不能进入设计
  - 没有扫描或照片不能进入制作
  - 返修必须关联一次试穿记录
  - 交付前建议生成最终清单
- **数据持久化**：本地SQLite数据库，重启继续
- **导入导出**：
  - CSV导入：校验手机号、左右侧枚举、日期格式、重复订单
  - CSV导出：订单列表
  - Markdown交付单
  - JSON审计包（含附件哈希）

## 项目结构

```
orthotics-station/
├── main.py                  # 主入口文件
├── requirements.txt         # 依赖包
├── sample_data.py           # 示例数据生成
├── sample_import.csv        # CSV导入示例
├── tests.py                 # 测试文件
├── README.md               # 本文档
│
├── config/                  # 配置模块
│   ├── __init__.py
│   └── settings.py          # 全局配置
│
├── models/                  # 数据模型
│   ├── __init__.py
│   ├── database.py          # SQLite数据库连接
│   ├── patient.py           # 患者模型
│   ├── order.py             # 订单模型
│   ├── measurement.py       # 尺寸模型
│   ├── attachment.py        # 附件模型
│   ├── fitting_record.py    # 试穿记录
│   ├── rework_record.py     # 返修记录
│   └── audit_log.py         # 审计日志
│
├── core/                    # 核心业务逻辑
│   ├── __init__.py
│   ├── base_repository.py   # Repository基类
│   ├── patient_repository.py
│   ├── order_repository.py
│   ├── measurement_repository.py
│   ├── attachment_repository.py
│   ├── fitting_repository.py
│   ├── rework_repository.py
│   ├── audit_repository.py
│   │
│   ├── attachment/          # 附件处理
│   │   ├── __init__.py
│   │   ├── hasher.py        # SHA256计算
│   │   ├── archiver.py      # 文件归档
│   │   └── validator.py     # 完整性校验
│   │
│   ├── workflow/            # 工作流
│   │   ├── __init__.py
│   │   ├── state_machine.py # 状态机
│   │   ├── business_rules.py # 业务规则
│   │   └── order_validator.py # 字段验证
│   │
│   └── import_export/       # 导入导出
│       ├── __init__.py
│       ├── csv_import.py    # CSV导入
│       ├── csv_export.py    # CSV导出
│       ├── markdown_report.py # Markdown报告
│       └── json_audit.py    # JSON审计包
│
└── ui/                      # GUI界面
    ├── __init__.py
    ├── main_window.py       # 主窗口
    │
    ├── dialogs/             # 对话框
    │   ├── __init__.py
    │   ├── patient_dialog.py
    │   ├── order_dialog.py
    │   ├── measurement_dialog.py
    │   ├── fitting_dialog.py
    │   ├── rework_dialog.py
    │   ├── import_csv_dialog.py
    │   └── export_dialog.py
    │
    └── widgets/             # 自定义组件
        ├── __init__.py
        ├── order_list.py     # 订单列表
        ├── kanban.py         # 看板视图
        └── detail_widget.py  # 详情面板
```

## 安装方式

### 1. 创建虚拟环境（推荐）

```bash
# macOS/Linux
python3 -m venv venv
source venv/bin/activate

# Windows
python -m venv venv
venv\Scripts\activate
```

### 2. 安装依赖

```bash
pip install -r requirements.txt
```

依赖包说明：
- **PyQt6**：GUI框架
- **pandas**：数据处理
- **python-dateutil**：日期处理

## 启动命令

```bash
python main.py
```

## 数据目录

默认数据位置：`~/.orthotics_station/`

包含：
- `data/orthotics.db` - SQLite数据库
- `data/attachments/` - 附件归档目录
- `data/temp/` - 临时文件

## 核心流程验证

### 使用临时目录测试

1. **初始化示例数据**：

```bash
python sample_data.py
```

或者使用临时目录（不影响正式数据）：

```bash
python sample_data.py --temp
```

2. **启动应用**：

```bash
python main.py
```

### 流程1：创建患者和订单

1. 点击菜单栏「文件」→「新建患者」
2. 输入患者姓名、电话等信息
3. 点击「文件」→「新建订单」
4. 选择患者，填写诊断部位、左右侧、订单号
5. 订单会出现在左侧列表和中间看板的「待取模」列

### 流程2：导入附件

1. 在左侧列表或看板中选择一个订单
2. 在右侧详情区点击「附件清单」标签
3. 点击「+ 导入附件」按钮
4. 选择图片、3D扫描文件（.stl/.obj/.ply）或PDF
5. 系统会：
   - 复制文件到数据目录
   - 计算SHA256哈希
   - 记录到数据库

### 流程3：推进状态

**方式一：看板拖拽**
- 在中间看板中，将订单卡片从一列拖到另一列
- 系统会验证状态转换规则

**方式二：详情面板**
1. 选择订单
2. 在详情区顶部点击「变更状态」
3. 选择目标状态

**状态转换规则**：
| 当前状态 | 可转换到 | 前置条件 |
|---------|---------|---------|
| 待取模 | 待设计 | 需创建尺寸版本 |
| 待设计 | 制作中 | 需有扫描/照片 |
| 制作中 | 待试穿 | - |
| 待试穿 | 需返修/已交付 | 返修需关联试穿记录 |
| 需返修 | 待试穿/已交付 | - |
| 已交付 | (无) | - |

### 流程4：记录尺寸版本

1. 选择订单
2. 点击「尺寸版本」标签
3. 点击「+ 新建尺寸记录」
4. 填写尺寸项（如：残肢长度、围度等）
5. 保存后，可在列表中查看历史版本

### 流程5：记录试穿和返修

**试穿记录**：
1. 选择订单
2. 点击「试穿记录」标签
3. 点击「+ 记录试穿」
4. 填写试穿日期、患者反馈、调整措施

**返修记录**：
1. 点击「返修记录」标签
2. 点击「+ 创建返修」
3. 必须选择关联的试穿记录
4. 填写返修原因和详情

### 流程6：导入CSV

1. 准备CSV文件（参考 `sample_import.csv`）
2. 点击「文件」→「导入CSV」
3. 选择CSV文件
4. 可先点击「预览」查看数据
5. 点击「导入」
6. 系统会逐行校验：
   - 手机号格式
   - 左右侧枚举（左侧/右侧/双侧）
   - 日期格式
   - 订单号重复

**CSV格式示例**：
```csv
患者姓名,订单号,诊断部位,左右侧,联系电话,取模日期,复诊日期,技师,备注
张三,IMP20260501001,小腿假肢,左侧,13900139001,2026-05-01,2026-05-15,王技师,初次取模
```

### 流程7：导出交付包

1. 选择订单
2. 在详情区点击「导出」按钮
3. 选择导出类型：
   - **CSV订单列表**：所有订单或当前订单
   - **Markdown交付单**：含患者信息、尺寸、试穿记录
   - **JSON审计包**：含所有数据和附件SHA256哈希

4. 选择输出目录
5. 点击确定导出

## 运行测试

```bash
python tests.py
```

测试覆盖：
- 患者/订单CRUD操作
- 尺寸版本管理
- 状态机转换
- 业务规则验证
- SHA256哈希计算
- 试穿/返修记录
- 审计日志

## 技术要点

### 状态机设计

状态流转图：
```
待取模 → 待设计 → 制作中 → 待试穿 → 已交付
   ↑        ↑         ↑          ↓
   └────────┴─────────┴────── 需返修
```

### 附件完整性校验

每个附件导入时：
1. 计算SHA256哈希值
2. 检查是否有同名不同内容的文件
3. 记录文件大小、类型、原始名称
4. 复制到数据目录（按订单分类）

### 审计日志

所有重要操作都会记录：
- 状态变更（记录旧值、新值）
- 尺寸修改
- 附件导入/删除
- 试穿/返修记录

## 注意事项

1. **数据备份**：定期备份 `~/.orthotics_station/data/` 目录
2. **附件管理**：删除订单时不会自动删除附件文件，需手动清理
3. **日期格式**：导入CSV时支持多种日期格式，推荐使用 `YYYY-MM-DD`
4. **左右侧**：必须是「左侧」、「右侧」或「双侧」，其他值会被拒绝

## 常见问题

**Q: 启动时提示找不到PyQt6？**

A: 确认已激活虚拟环境并安装依赖：
```bash
source venv/bin/activate  # macOS/Linux
pip install PyQt6
```

**Q: 如何查看数据库内容？**

A: 使用SQLite客户端打开 `~/.orthotics_station/data/orthotics.db`：
```bash
sqlite3 ~/.orthotics_station/data/orthotics.db
```

**Q: 附件存储在哪里？**

A: 每个订单的附件在 `~/.orthotics_station/data/attachments/order_{订单ID}/` 目录下，文件名包含时间戳和哈希前缀，避免重名冲突。

**Q: 如何重置所有数据？**

A: 删除整个数据目录：
```bash
rm -rf ~/.orthotics_station
```

下次启动会自动重新初始化。

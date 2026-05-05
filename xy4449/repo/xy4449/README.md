# 印刷店自动化预检工具

一款为小型印刷店设计的本地自动化工具，用于自动预检客户上传的PDF工单，检查字体缺失、纸张不足、尺寸不匹配和机器保养冲突等问题。

## 功能特性

### 1. 自动预检检查
- **字体检查**：检测PDF中使用的字体是否在系统中可用
- **纸张检查**：检查所需纸张类型和数量是否满足库存要求
- **尺寸匹配**：验证PDF尺寸与裁切模板是否匹配
- **机器占用**：检查生产时间是否与机器保养安排冲突

### 2. 后台任务扫描
- 定期扫描指定目录中的新文件
- 自动识别PDF工单、CSV库存、保养记录和裁切模板
- 实时触发预检流程

### 3. 本地Web接口
- 工单查询和管理
- 添加备注和更新状态
- 复核管理（批准/拒绝/需要澄清）
- 查看预检结果和风险评估

### 4. 风险规则系统
- 6条预设风险规则
- 支持自定义规则（启用/禁用、修改条件）
- 根据预检结果自动触发相应操作

### 5. 复核状态持久化
- 记录所有复核操作
- 保存审核人、时间、备注等信息
- 支持查询历史复核记录

### 6. 导出功能
- **Markdown生产交接单**：生成格式化的生产指导文档
- **JSON审计包**：导出完整的工单、预检、复核数据用于审计

## 项目结构

```
xy4449/
├── config.py              # 配置文件
├── main.py                # 主入口
├── requirements.txt       # 依赖列表
├── README.md             # 本文档
├── models/               # 数据模型
│   ├── __init__.py
│   ├── work_order.py     # 工单模型
│   ├── paper_stock.py    # 纸张库存模型
│   ├── maintenance.py    # 保养记录模型
│   ├── cutting_template.py # 裁切模板模型
│   ├── preflight_result.py # 预检结果模型
│   └── review.py         # 复核记录模型
├── preflight/            # 预检引擎
│   ├── __init__.py
│   ├── engine.py         # 主引擎
│   ├── font_checker.py   # 字体检查器
│   ├── paper_checker.py  # 纸张检查器
│   ├── size_checker.py   # 尺寸检查器
│   └── machine_checker.py # 机器检查器
├── scanner/              # 文件扫描器
│   ├── __init__.py
│   ├── file_watcher.py   # 文件监控
│   └── file_processor.py # 文件处理器
├── web/                  # Web接口
│   ├── __init__.py
│   ├── app.py            # FastAPI应用
│   └── routes.py         # API路由
├── input/                # 输入目录（文件放入这里）
│   ├── paper_stock.csv          # 纸张库存示例
│   ├── maintenance_records.csv  # 保养记录示例
│   └── cutting_templates.csv    # 裁切模板示例
├── output/               # 输出目录（导出文件）
├── data/                 # 数据存储
└── logs/                 # 日志目录
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 准备数据文件

将以下文件放入 `input/` 目录：

#### 纸张库存 CSV (`paper_stock.csv`)
```csv
id,paper_type,paper_size,paper_width,paper_height,quantity,threshold,supplier,location,notes
STK001,铜版纸157g,A4,210,297,500,100,供应商A,仓库A-01,常规库存
```

#### 机器保养记录 CSV (`maintenance_records.csv`)
```csv
id,machine_id,machine_name,type,status,scheduled_date,start_time,end_time,technician,description
MT001,M01,海德堡印刷机,preventive,scheduled,2026-05-06,09:00,12:00,张师傅,定期保养
```

#### 裁切模板 CSV (`cutting_templates.csv`)
```csv
template_id,name,description,paper_width,paper_height,sheets_required,tags,machines,cut_width,cut_height,cut_quantity
TMP001,A4名片模板,标准名片,210,297,1,名片,M01;M02,90,54,10
```

#### PDF工单
将客户的PDF工单文件放入 `input/` 目录，文件名格式建议：
- `客户名称_工单名称_数量.pdf`
- 例如：`张三_企业宣传册_500份.pdf`

### 3. 启动服务

```bash
python main.py
```

服务启动后访问：
- **API文档**: http://127.0.0.1:8000/docs
- **API接口**: http://127.0.0.1:8000/

## API 接口

### 工单管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/orders/` | 获取所有工单 |
| GET | `/api/orders/{order_id}` | 获取单个工单 |
| POST | `/api/orders/{order_id}/notes` | 添加备注 |
| PUT | `/api/orders/{order_id}/status` | 更新状态 |
| GET | `/api/orders/{order_id}/preflight` | 获取预检结果 |

### 库存管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/stocks/` | 获取所有库存 |
| GET | `/api/stocks/{stock_id}` | 获取单个库存 |
| GET | `/api/stocks/?low_stock_only=true` | 获取低库存预警 |

### 保养管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/maintenance/` | 获取所有保养记录 |
| GET | `/api/maintenance/{record_id}` | 获取单个记录 |
| GET | `/api/maintenance/?active_only=true` | 获取进行中的保养 |

### 裁切模板

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/templates/` | 获取所有模板 |
| GET | `/api/templates/{template_id}` | 获取单个模板 |

### 预检管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/preflight/run/{order_id}` | 运行预检 |
| GET | `/api/preflight/results/{result_id}` | 获取预检结果 |

### 风险规则

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/review/rules` | 获取所有规则 |
| GET | `/api/review/rules/{rule_id}` | 获取单个规则 |
| POST | `/api/review/rules` | 添加新规则 |
| PUT | `/api/review/rules/{rule_id}` | 更新规则 |
| DELETE | `/api/review/rules/{rule_id}` | 删除规则 |
| POST | `/api/review/rules/{rule_id}/toggle` | 切换规则启用状态 |

### 复核管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/review/order/{order_id}` | 复核工单 |
| GET | `/api/review/order/{order_id}` | 获取工单复核记录 |
| GET | `/api/review/` | 获取所有复核记录 |

### 导出功能

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/export/markdown/{order_id}` | 导出Markdown交接单 |
| GET | `/api/export/json/{order_id}` | 导出JSON审计包 |

## 风险规则说明

### 默认规则

| ID | 名称 | 触发条件 | 严重程度 | 操作 |
|----|------|----------|----------|------|
| R001 | 缺失字体 | 字体检查失败 | Critical | 需要复核 |
| R002 | 纸张不足 | 纸张检查失败 | Critical | 需要复核 |
| R003 | 尺寸不匹配 | 尺寸检查失败 | High | 需要复核 |
| R004 | 机器冲突 | 机器检查失败 | High | 需要复核 |
| R005 | 低库存警告 | 纸张检查警告 | Medium | 标记待复核 |
| R006 | 多模板匹配 | 尺寸检查警告 | Medium | 标记待复核 |

### 规则状态说明

- **Critical (严重)**: 必须人工复核，无法自动通过
- **High (高)**: 强烈建议人工复核
- **Medium (中)**: 需要注意，建议检查
- **Low (低)**: 信息性提示

## 预检评分系统

### 评分计算

| 问题类型 | 严重程度 | 扣分数 |
|----------|----------|--------|
| 检查失败 | Critical | -40 |
| 检查失败 | High | -25 |
| 检查失败 | Normal | -15 |
| 检查警告 | High | -10 |
| 检查警告 | Normal | -5 |

### 风险等级

| 分数范围 | 风险等级 | 建议操作 |
|----------|----------|----------|
| 80-100 | Low (低) | 可自动通过 |
| 50-79 | Medium (中) | 建议人工复核 |
| 0-49 | High (高) | 必须人工复核 |

## 工单状态流转

```
PENDING (待处理)
    ↓
PREFLIGHT_RUNNING (预检中)
    ↓
┌─────────────────────────────────────┐
│  预检结果                            │
├───────────┬───────────┬─────────────┤
│ PASSED    │ WARNING   │ FAILED      │
│ (通过)    │ (警告)    │ (失败)      │
├───────────┼───────────┼─────────────┤
│ PREFLIGHT │ REVIEW    │ PREFLIGHT   │
│ _PASSED   │ _PENDING  │ _FAILED     │
└───────────┴───────────┴─────────────┘
                    ↓
            ┌───────────────┐
            │  复核结果     │
            ├───────┬───────┤
            │APPROVE│REJECT │
            │ (批准)│ (拒绝)│
            └───────┴───────┘
                ↓
    REVIEW_APPROVED / REVIEW_REJECTED
                ↓
           PRODUCTION (生产中)
                ↓
           COMPLETED (完成)
```

## 文件格式说明

### 纸张库存 CSV

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 库存编号 |
| paper_type | string | 是 | 纸张类型（如：铜版纸157g） |
| paper_size | string | 否 | 纸张尺寸名称（如：A4） |
| paper_width | float | 否 | 宽度（mm） |
| paper_height | float | 否 | 高度（mm） |
| quantity | int | 是 | 库存数量 |
| threshold | int | 否 | 最低库存警戒线 |
| supplier | string | 否 | 供应商 |
| location | string | 否 | 存放位置 |

### 保养记录 CSV

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 记录编号 |
| machine_id | string | 是 | 机器编号 |
| machine_name | string | 是 | 机器名称 |
| type | string | 是 | 保养类型 |
| status | string | 是 | 状态 |
| scheduled_date | date | 是 | 计划日期（YYYY-MM-DD） |
| start_time | string | 否 | 开始时间（HH:MM） |
| end_time | string | 否 | 结束时间（HH:MM） |
| technician | string | 否 | 技术员 |
| description | string | 否 | 描述 |

**保养类型取值**:
- `preventive` - 预防性保养
- `corrective` - 修复性保养
- `inspection` - 检查
- `calibration` - 校准

**状态取值**:
- `scheduled` - 已计划
- `in_progress` - 进行中
- `completed` - 已完成
- `cancelled` - 已取消

### 裁切模板 CSV

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| template_id | string | 是 | 模板编号 |
| name | string | 是 | 模板名称 |
| description | string | 否 | 描述 |
| paper_width | float | 是 | 原纸宽度（mm） |
| paper_height | float | 是 | 原纸高度（mm） |
| sheets_required | int | 否 | 所需张数 |
| tags | string | 否 | 标签（分号分隔） |
| machines | string | 否 | 适用机器（分号分隔） |
| cut_width | float | 否 | 裁切宽度（mm） |
| cut_height | float | 否 | 裁切高度（mm） |
| cut_quantity | int | 否 | 裁切数量 |

## 示例工作流程

### 1. 准备文件

将以下文件放入 `input/` 目录：
- `客户A_宣传单_1000份.pdf` (工单PDF)
- `paper_stock.csv` (更新库存)
- `maintenance_records.csv` (保养安排)
- `cutting_templates.csv` (裁切模板)

### 2. 自动处理

系统会自动：
1. 扫描目录发现新文件
2. 解析CSV文件更新数据
3. 对PDF工单进行预检
4. 生成预检报告

### 3. 人工复核

通过Web接口：
1. 查看预检结果和风险评分
2. 检查问题详情（缺失字体、纸张不足等）
3. 添加备注
4. 批准或拒绝工单

### 4. 导出文档

批准后导出：
- Markdown生产交接单（供车间使用）
- JSON审计包（存档和追溯）

## 配置选项

通过 `.env` 文件或环境变量配置：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| INPUT_DIR | ./input | 输入目录 |
| OUTPUT_DIR | ./output | 输出目录 |
| DATA_DIR | ./data | 数据目录 |
| LOGS_DIR | ./logs | 日志目录 |
| SCAN_INTERVAL | 10 | 扫描间隔（秒） |
| HOST | 127.0.0.1 | 监听地址 |
| PORT | 8000 | 监听端口 |
| MIN_PAPER_STOCK | 100 | 最低库存警戒线 |

## 技术栈

- **语言**: Python 3.9+
- **Web框架**: FastAPI
- **PDF处理**: pypdf
- **数据处理**: pandas
- **数据模型**: pydantic
- **服务器**: uvicorn

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request。

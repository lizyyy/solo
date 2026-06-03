# 老旧小区楼间距复测系统

> 把"补录路线没有重新计算长度"当正常流程处理，而不是罕见边角料。

## 功能特性

### 核心功能
- **三步标准流程**：导入障碍物备注 → 补看楼层剖面草图 → 导出截图更新
- **补录路线处理**：碰到"补录路线没有重新计算长度"时，自动标记为待客户复核，不急于归正常
- **证据留存**：障碍物备注的原始行号、人工改动、当前处理状态完整记录
- **统一数据源**：导出明细、页面展示、API返回读同一份结果
- **四种自检**：重复导入检测、补录路线未重算检测、补录后重算验证、导出一致性检测

### 输出方式
- **CLI**：终端输出完整证据摘要
- **API**：REST接口返回结构化证据数据
- **Excel**：三个sheet（测量记录明细、待客户复核、汇总与自检）
- **JSON**：完整结构化数据导出

## 快速开始

### 1. 安装依赖

```bash
pip install -e .
```

### 2. 运行完整样例

新人照着这一条命令就能从样例跑到报告：

```bash
python examples/run_full_workflow.py
```

这个脚本会完整演示：
1. 导入障碍物备注CSV（含1条重复记录，测试重复导入检测）
2. 许工补录路线，触发"补录路线没有重新计算长度"（不自动重算，留待客户复核）
3. 许工补看两栋楼的楼层剖面草图
4. 导出Excel和JSON报告
5. 运行四项自检
6. 模拟客户复核后重算
7. 再次自检确认所有问题解决
8. 输出API格式的完整证据摘要

### 3. CLI 使用方式

#### 运行完整流程
```bash
python -m resurvey.cli run \
  --import-file examples/sample_obstacle_remarks.csv \
  --export-excel data/report.xlsx \
  --export-json data/report.json
```

#### 补录路线（不自动重算，留给客户复核）
```bash
python -m resurvey.cli run \
  --import-file examples/sample_obstacle_remarks.csv \
  --supplement-record <记录ID> \
  --supplement-points '[{"x":0,"y":0},{"x":8,"y":0},{"x":8,"y":6},{"x":22.3,"y":6}]' \
  --export-excel data/report.xlsx
```

#### 补录路线并自动重算
```bash
python -m resurvey.cli run \
  --import-file examples/sample_obstacle_remarks.csv \
  --supplement-record <记录ID> \
  --supplement-points '[{"x":0,"y":0},{"x":8,"y":0}]' \
  --auto-recalc \
  --export-excel data/report.xlsx
```

#### 查看项目证据
```bash
python -m resurvey.cli show --project-file data/<项目ID>_project.json
python -m resurvey.cli show --project-file data/<项目ID>_project.json --format json
```

#### 运行自检
```bash
python -m resurvey.cli self-check --project-file data/<项目ID>_project.json
```

#### 导出Excel
```bash
python -m resurvey.cli export --project-file data/<项目ID>_project.json --output data/report.xlsx
```

### 4. API 使用方式

#### 启动服务
```bash
python -m resurvey.api
```

服务将在 `http://localhost:8000` 启动，API文档：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

#### 关键接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/import` | 步骤1：导入障碍物备注 |
| POST | `/api/v1/sketch` | 步骤2：补看楼层剖面草图 |
| POST | `/api/v1/export` | 步骤3：导出截图更新 |
| POST | `/api/v1/supplement` | 补录路线（处理长度未重算） |
| POST | `/api/v1/recalculate` | 客户复核后重算 |
| GET | `/api/v1/records` | 获取所有记录（统一数据源） |
| GET | `/api/v1/records/{id}` | 获取单条记录详情 |
| GET | `/api/v1/self-check` | 运行自检 |
| GET | `/api/v1/evidence` | 获取证据摘要 |
| GET | `/api/v1/needs-review` | 获取待客户复核记录 |

#### API 返回证据摘要示例

```json
{
  "project_id": "PRJ_20260603_123456_AB12",
  "project_name": "老旧小区楼间距复测",
  "timestamp": "2026-06-03 12:34:56",
  "summary": {
    "total_records": 6,
    "supplementary_records": 1,
    "needs_customer_review": 1,
    "length_not_recalculated": 1
  },
  "records": [
    {
      "record_id": "REC_...",
      "楼栋A": "2号楼",
      "楼栋B": "3号楼",
      "障碍物备注证据": {
        "原始行号": 3,
        "原始内容": "老旧围墙阻挡，补录绕行点",
        "人工改动记录": [
          "[2026-06-03 12:00:00] 许工: 补录路线点: 2 -> 4个点",
          "[2026-06-03 12:00:00] 许工: 标记为待重算: 补录了新的路线点"
        ],
        "当前处理状态": "补录路线未重算"
      },
      "楼层剖面草图证据": [
        {
          "楼栋": "2号楼",
          "楼层数": 7,
          "是否已补看": true,
          "补看记录": [
            "[2026-06-03 12:05:00] 许工: 2号楼为7层框架结构..."
          ]
        }
      ]
    }
  ]
}
```

### 5. 运行测试

```bash
pip install pytest
pytest tests/
```

## 核心设计

### 数据模型

- **ObstacleRemark**：障碍物备注，保留原始行号、人工改动、处理状态
- **FloorProfileSketch**：楼层剖面草图，记录补看人和补看时间
- **MeasurementRecord**：测量记录，关联障碍物备注和草图
- **ResurveyProject**：项目，统一管理所有记录

### 处理状态

```
待处理 → 已导入 → 补录路线未重算 → 待客户复核 → 已重算 → 已核实 → 已导出
                                 ↓（自动标记）
                             留给客户复核
```

### 补录路线未重算的处理逻辑

1. 许工补录路线点 → 系统检测到需要重算
2. **不自动归为正常**，而是：
   - 标记 `processing_status = "补录路线未重算"`
   - 设置 `needs_customer_review = true`
   - 在人工改动记录中留下操作痕迹
3. 导出时，该记录会出现在"待客户复核"sheet中
4. 客户复核确认后，调用 `recalculate_after_review` 重算并标记为"已核实"

### 统一数据源

所有输出（Excel、页面、API）都通过 `UnifiedDataSource` 读取同一份数据：
- Excel导出：`DataExporter.export_to_excel()`
- 页面视图：`DataExporter.export_page_view()`
- API返回：`ThreeStepWorkflow.get_evidence_for_api()`

一致性由 `DataExporter.verify_consistency()` 验证。

## 目录结构

```
.
├── resurvey/
│   ├── __init__.py
│   ├── models.py          # 数据模型
│   ├── processor.py       # 数据处理（导入、补录、重算）
│   ├── self_check.py      # 四项自检
│   ├── exporter.py        # 统一数据源和导出
│   ├── workflow.py        # 三步流程封装
│   ├── cli.py             # CLI入口
│   └── api.py             # API入口
├── examples/
│   ├── sample_obstacle_remarks.csv  # 样例数据
│   └── run_full_workflow.py         # 完整流程演示
├── tests/
│   └── test_resurvey.py   # 测试用例
├── data/                  # 运行时数据目录
├── pyproject.toml
└── README.md
```

## Excel报告结构

### Sheet1: 测量记录明细
| 列名 | 说明 |
|------|------|
| 记录ID | 唯一标识 |
| 小区名称 |  |
| 楼栋A/楼栋B | 测量的两栋楼 |
| 测量间距(米) |  |
| 路线长度(米) |  |
| 是否补录 | 是/否 |
| 长度是否重算 | 是/否 |
| 原始行号 | 导入时的Excel行号 |
| 原始备注内容 |  |
| 处理状态 | 待处理/已导入/补录路线未重算/... |
| 需要客户复核 | 是/否 |
| 人工改动记录 | 所有操作的时间戳和操作人 |
| 补录备注 |  |

### Sheet2: 待客户复核
列出所有 `needs_customer_review = true` 的记录，包含完整证据链。

### Sheet3: 汇总与自检
- 项目统计（总记录数、补录数、待复核数、未重算数）
- 四项自检结果

## 常见问题

**Q: 为什么补录后不自动重算？**
A: 因为"补录路线没有重新计算长度"不是罕见边角料，许工每隔几天就碰到一次。系统把它当正常流程，留给展陈客户复核，避免自动处理导致数据失真。

**Q: 如何追踪一条记录的完整历史？**
A: 查看 `人工改动记录` 字段，每条操作都有时间戳和操作人。障碍物备注还保留了 `原始行号` 和 `原始内容`，可回溯到导入时的原始数据。

**Q: 为什么Excel、页面、API的数据要读同一份？**
A: 避免"一个地方显示异常、另一个地方消失"的问题。所有视图都从 `UnifiedDataSource` 读取，确保一致性。

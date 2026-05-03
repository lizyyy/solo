# 定值票联锁核验台

变电站继保班定值票联锁核验后端API服务 - 防止同一间隔定值版本拿错、压板投退顺序冲突、审批票漏签就下发。

## 功能特性

- **数据导入**: 支持保护定值 Excel/CSV、一次接线拓扑 JSON、压板状态表和审批票 YAML 的导入
- **版本比对**: 对比当前版本和目标版本的定值差异
- **联锁检查**: 多维度联锁检查，包括：
  - 版本一致性检查（防止同一间隔拿错版本）
  - 压板投退顺序检查（功能压板先于出口压板）
  - 审批票完整性检查（防止漏签下发）
  - 一次拓扑联锁检查（接地刀闸与断路器状态）
  - 定值范围检查（定值是否在合理范围）
- **模拟下发/回滚**: 模拟执行下发和回滚操作
- **风险查询**: 查询操作中的风险项
- **审计导出**: 支持 Markdown/CSV/JSON 三种格式的审计报告导出
- **状态机管理**: 严格的操作状态流转控制

## 技术栈

- **Web框架**: FastAPI
- **数据库**: SQLite + SQLAlchemy ORM
- **数据验证**: Pydantic
- **文件解析**: pandas + openpyxl + PyYAML
- **设计模式**: 状态机模式、规则引擎模式、仓储模式

## 项目结构

```
xy4279/
├── config.py              # 数据库配置和ORM模型定义
├── main.py                # FastAPI应用入口
├── requirements.txt       # Python依赖
├── models/
│   ├── __init__.py
│   └── schemas.py         # Pydantic数据模型
├── parsers/
│   ├── __init__.py
│   ├── excel_parser.py    # Excel文件解析器
│   ├── csv_parser.py      # CSV文件解析器
│   ├── json_parser.py     # JSON文件解析器
│   └── yaml_parser.py     # YAML文件解析器
├── rules/
│   ├── __init__.py
│   └── rule_engine.py     # 联锁规则引擎
├── state_machine/
│   ├── __init__.py
│   └── state_machine.py   # 操作状态机
├── storage/
│   ├── __init__.py
│   └── repository.py      # 数据访问仓储层
├── exporters/
│   ├── __init__.py
│   ├── markdown_exporter.py  # Markdown导出
│   ├── csv_exporter.py       # CSV导出
│   └── json_exporter.py      # JSON导出
├── routes/
│   ├── __init__.py
│   ├── operation_routes.py   # 操作管理路由
│   ├── import_routes.py      # 数据导入路由
│   ├── compare_routes.py     # 版本比对路由
│   ├── check_routes.py       # 联锁检查路由
│   ├── simulation_routes.py  # 模拟执行路由
│   ├── export_routes.py      # 审计导出路由
│   └── risk_routes.py        # 风险查询路由
└── examples/              # 示例数据文件
    ├── __init__.py
    ├── settings_current.yaml
    ├── settings_target.yaml
    ├── topology.json
    ├── plate_status.yaml
    └── approval_ticket.yaml
```

## 快速开始

### 1. 安装依赖

```bash
cd /Users/mac/pro/solocoder/pro/xy4279/repo/xy4279
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

服务将在 `http://localhost:8000` 启动。

### 3. 访问API文档

启动服务后，访问以下地址查看交互式API文档：

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- OpenAPI JSON: http://localhost:8000/openapi.json

## 状态机流转

操作状态流转图：

```
DRAFT(草稿)
   |
   v (import)
IMPORTED(已导入)
   |
   v (compare)
COMPARED(已比对)
   |
   v (check)
CHECKED(已检查)
   |
   v (approve - 需手动设置状态)
APPROVED(已审批)
   |
   v (simulate)
SIMULATED(已模拟)
   |
   v (issue)
ISSUED(已下发)
   |
   v (rollback)
ROLLED_BACK(已回滚)

任何非终结状态均可 CANCEL -> CANCELLED(已取消)
```

## curl 验证流程

以下是完整的操作流程验证，使用 `examples/` 目录下的示例数据文件。

### 1. 健康检查

```bash
# 检查服务是否正常运行
curl -X GET "http://localhost:8000/health"

# 获取系统信息
curl -X GET "http://localhost:8000/api/info"
```

### 2. 创建操作

```bash
# 创建一个新的定值修改操作
curl -X POST "http://localhost:8000/api/operations/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "220kV线路保护间隔定值修改-20240615",
    "description": "220kV线1保护定值升级操作",
    "bay_id": "BAY-2201",
    "bay_name": "220kV线路保护间隔"
  }'
```

记录返回的操作ID，假设为 `1`。

### 3. 导入数据

```bash
cd /Users/mac/pro/solocoder/pro/xy4279/repo/xy4279

# 导入当前定值版本
curl -X POST "http://localhost:8000/api/import/settings" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@examples/settings_current.yaml;type=text/yaml" \
  -F "bay_id=BAY-2201" \
  -F "bay_name=220kV线路保护间隔" \
  -F "version=v2.0.0" \
  -F "operation_id=1" \
  -F "is_target=false"

# 导入目标定值版本
curl -X POST "http://localhost:8000/api/import/settings" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@examples/settings_target.yaml;type=text/yaml" \
  -F "bay_id=BAY-2201" \
  -F "bay_name=220kV线路保护间隔" \
  -F "version=v2.1.0" \
  -F "operation_id=1" \
  -F "is_target=true"

# 导入一次接线拓扑
curl -X POST "http://localhost:8000/api/import/topology" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@examples/topology.json;type=application/json" \
  -F "name=220kV变电站一次接线拓扑" \
  -F "operation_id=1"

# 导入压板状态表
curl -X POST "http://localhost:8000/api/import/plates" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@examples/plate_status.yaml;type=text/yaml" \
  -F "name=220kV线路保护间隔压板状态表" \
  -F "bay_id=BAY-2201" \
  -F "bay_name=220kV线路保护间隔" \
  -F "operation_id=1"

# 导入审批票
curl -X POST "http://localhost:8000/api/import/approval" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@examples/approval_ticket.yaml;type=text/yaml" \
  -F "operation_id=1"
```

### 4. 查看操作状态

```bash
# 查看操作详情
curl -X GET "http://localhost:8000/api/operations/1"

# 查看操作状态摘要
curl -X GET "http://localhost:8000/api/operations/1/summary"

# 查看所有操作
curl -X GET "http://localhost:8000/api/operations/?limit=10"
```

### 5. 版本比对

```bash
# 比对操作关联的两个版本
curl -X GET "http://localhost:8000/api/compare/operations/1?auto_transition=true"

# 查看详细变更
curl -X GET "http://localhost:8000/api/compare/operations/1/changes?show_unchanged=true"
```

### 6. 联锁检查

```bash
# 执行全部联锁检查
curl -X POST "http://localhost:8000/api/check/operations/1?auto_transition=true"

# 只执行特定类型的检查
curl -X POST "http://localhost:8000/api/check/operations/1?check_types=version_consistency&check_types=plate_sequence&check_types=approval_completeness&auto_transition=true"

# 查看检查结果
curl -X GET "http://localhost:8000/api/check/operations/1"

# 只查看未通过的检查
curl -X GET "http://localhost:8000/api/check/operations/1?include_passed=false"

# 查看高风险检查结果
curl -X GET "http://localhost:8000/api/check/operations/1/high-risk"

# 查看检查摘要
curl -X GET "http://localhost:8000/api/check/operations/1/summary"

# 查看可用的检查类型
curl -X GET "http://localhost:8000/api/check/types"
```

### 7. 风险查询

```bash
# 查询操作中的风险
curl -X GET "http://localhost:8000/api/risk/operations/1"

# 只查询高风险项
curl -X GET "http://localhost:8000/api/risk/operations/1?risk_level=high"

# 查看风险摘要
curl -X GET "http://localhost:8000/api/risk/operations/1/summary"

# 查询某间隔的所有风险
curl -X GET "http://localhost:8000/api/risk/bay/BAY-2201"

# 查询所有风险
curl -X GET "http://localhost:8000/api/risk/all?risk_level=high"

# 查看风险类型说明
curl -X GET "http://localhost:8000/api/risk/types"
```

### 8. 审批（手动设置状态）

联锁检查通过后，需要将操作状态更新为已审批：

```bash
# 先查看当前操作的可用状态
curl -X GET "http://localhost:8000/api/operations/statuses/"

# 更新操作状态为已审批（需要手动设置）
# 注意：实际业务中审批流程可能需要单独的审批接口
# 这里通过更新操作状态模拟审批完成
curl -X PUT "http://localhost:8000/api/operations/1" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 9. 模拟执行

```bash
# 模拟下发操作
curl -X POST "http://localhost:8000/api/simulation/operations/1/simulate?auto_transition=true"

# 查看模拟日志
curl -X GET "http://localhost:8000/api/simulation/operations/1/logs"

# 查看模拟执行状态
curl -X GET "http://localhost:8000/api/simulation/operations/1/status"
```

### 10. 正式下发

```bash
# 正式下发操作
curl -X POST "http://localhost:8000/api/simulation/operations/1/issue"

# 回滚操作
curl -X POST "http://localhost:8000/api/simulation/operations/1/rollback?auto_transition=true"
```

### 11. 审计导出

```bash
# 导出 Markdown 格式审计报告
curl -X GET "http://localhost:8000/api/export/operations/1/markdown" -o audit_report.md

# 导出 CSV 格式审计报告
curl -X GET "http://localhost:8000/api/export/operations/1/csv" -o audit_report.csv

# 导出 JSON 格式审计报告
curl -X GET "http://localhost:8000/api/export/operations/1/json" -o audit_report.json

# 导出检查结果（Markdown格式）
curl -X GET "http://localhost:8000/api/export/checks/1/markdown" -o check_results.md

# 导出检查结果（CSV格式）
curl -X GET "http://localhost:8000/api/export/checks/1/csv" -o check_results.csv

# 导出检查结果（JSON格式）
curl -X GET "http://localhost:8000/api/export/checks/1/json" -o check_results.json

# 导出审计日志
curl -X GET "http://localhost:8000/api/export/logs/json?limit=50"
```

### 12. 取消操作

```bash
# 取消操作（仅可从特定状态取消）
curl -X POST "http://localhost:8000/api/operations/1/cancel"
```

## API 接口概览

### 操作管理 (`/api/operations`)

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/` | 创建新操作 |
| GET | `/` | 列出操作（支持分页、筛选） |
| GET | `/{operation_id}` | 获取操作详情 |
| PUT | `/{operation_id}` | 更新操作信息 |
| DELETE | `/{operation_id}` | 删除操作（仅限草稿/已取消状态） |
| POST | `/{operation_id}/cancel` | 取消操作 |
| GET | `/{operation_id}/summary` | 获取操作状态摘要 |
| GET | `/statuses/` | 获取所有可用状态列表 |

### 数据导入 (`/api/import`)

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/settings` | 导入定值版本（Excel/CSV/JSON/YAML） |
| POST | `/topology` | 导入拓扑数据（JSON/YAML） |
| POST | `/plates` | 导入压板状态表 |
| POST | `/approval` | 导入审批票（JSON/YAML） |

### 版本比对 (`/api/compare`)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/versions/{current}/{target}` | 比对两个指定版本 |
| GET | `/operations/{operation_id}` | 比对操作关联的两个版本 |
| GET | `/operations/{operation_id}/changes` | 获取详细变更列表 |

### 联锁检查 (`/api/check`)

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/operations/{operation_id}` | 执行联锁检查 |
| GET | `/operations/{operation_id}` | 获取检查结果 |
| GET | `/operations/{operation_id}/high-risk` | 获取高风险检查结果 |
| GET | `/operations/{operation_id}/summary` | 获取检查摘要 |
| GET | `/types` | 获取可用检查类型 |

### 模拟执行 (`/api/simulation`)

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/operations/{operation_id}/simulate` | 模拟下发操作 |
| POST | `/operations/{operation_id}/rollback` | 模拟回滚操作 |
| POST | `/operations/{operation_id}/issue` | 正式下发操作 |
| GET | `/operations/{operation_id}/logs` | 获取模拟执行日志 |
| GET | `/operations/{operation_id}/status` | 获取模拟执行状态 |

### 审计导出 (`/api/export`)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/operations/{id}/markdown` | 导出操作审计报告（Markdown） |
| GET | `/operations/{id}/csv` | 导出操作审计报告（CSV） |
| GET | `/operations/{id}/json` | 导出操作审计报告（JSON） |
| GET | `/checks/{id}/markdown` | 导出检查结果（Markdown） |
| GET | `/checks/{id}/csv` | 导出检查结果（CSV） |
| GET | `/checks/{id}/json` | 导出检查结果（JSON） |
| GET | `/logs/json` | 导出审计日志 |

### 风险查询 (`/api/risk`)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/operations/{operation_id}` | 查询操作中的风险 |
| GET | `/operations/{operation_id}/summary` | 获取风险摘要 |
| GET | `/bay/{bay_id}` | 查询某间隔的所有风险 |
| GET | `/all` | 查询所有风险 |
| GET | `/types` | 获取风险类型说明 |

## 联锁检查规则说明

### 1. 版本一致性检查 (version_consistency)

**检查目的**: 防止同一间隔拿错版本

**检查内容**:
- 当前版本和目标版本必须属于同一间隔
- 同一间隔内不能有重复版本号
- 版本号格式验证

**风险等级**: Critical（致命）/ High（高）

### 2. 压板投退顺序检查 (plate_sequence)

**检查目的**: 防止压板投退顺序冲突

**检查内容**:
- 功能压板必须在出口压板之前投入
- 退出时出口压板必须在功能压板之前退出
- 检修压板必须最先投入、最后退出

**风险等级**: High（高）/ Medium（中）

### 3. 审批票完整性检查 (approval_completeness)

**检查目的**: 防止审批票漏签就下发

**检查内容**:
- 所有必需的签字环节必须完成
- 签字顺序必须正确（不能跳签）
- 签字人必须与预设角色匹配

**风险等级**: High（高）/ Medium（中）

### 4. 一次拓扑联锁检查 (topology_interlock)

**检查目的**: 检查一次设备状态是否满足联锁条件

**检查内容**:
- 断路器和接地刀闸不能同时合闸
- 隔离开关状态检查
- 母线带电状态检查

**风险等级**: Critical（致命）/ High（高）

### 5. 定值范围检查 (setting_range)

**检查目的**: 确保定值在合理范围内

**检查内容**:
- 动作电流: 0.1 - 100 A
- 动作时间: 0 - 10 s
- 过流定值: 0.1 - 50 A
- 零序电流: 0.01 - 10 A
- 电压定值: 0.1 - 500 V
- 阻抗定值: 0.1 - 1000 Ω
- 频率定值: 45 - 55 Hz
- 时间定值: 0 - 100 s

**风险等级**: High（高）/ Medium（中）/ Low（低）

## 数据库模型

### 主要数据表

| 表名 | 描述 |
|------|------|
| operations | 操作记录表 |
| setting_versions | 定值版本表 |
| setting_values | 定值项表 |
| topologies | 拓扑表 |
| topology_nodes | 拓扑节点表 |
| topology_relations | 拓扑关系表 |
| plate_statuses | 压板状态表 |
| plate_states | 压板状态详情表 |
| approval_tickets | 审批票表 |
| approval_signatures | 签字记录表 |
| check_results | 检查结果表 |
| simulation_logs | 模拟执行日志表 |
| audit_logs | 审计日志表 |

## 示例数据说明

`examples/` 目录下包含完整的示例数据：

| 文件名 | 描述 |
|--------|------|
| `settings_current.yaml` | 当前定值版本 (v2.0.0) |
| `settings_target.yaml` | 目标定值版本 (v2.1.0，包含变更和新增项) |
| `topology.json` | 一次接线拓扑数据 |
| `plate_status.yaml` | 压板状态表（包含正确的投退顺序） |
| `approval_ticket.yaml` | 审批票（模拟部分签字的情况） |

## 常见问题

### Q: 如何修改联锁检查规则？

A: 编辑 `rules/rule_engine.py` 文件中的规则配置。规则引擎支持动态配置检查项、风险等级和定值范围。

### Q: 如何添加新的文件格式支持？

A: 在 `parsers/` 目录下创建新的解析器类，继承现有的解析模式，并在导入路由中注册。

### Q: 如何扩展导出格式？

A: 在 `exporters/` 目录下创建新的导出器类，实现相应的导出逻辑。

### Q: 状态机如何自定义？

A: 编辑 `state_machine/state_machine.py` 中的 `StateTransition` 类，修改状态流转规则。

## 许可证

本项目仅供学习和内部使用。

## 联系方式

如有问题请联系项目维护人员。

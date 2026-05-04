# 音乐节电力管理系统 (Festival Power Management)

用于户外音乐节电力负责人的本地 REST API 服务，支持用电清单管理、风险自动检测、人工改判和报告导出。

## 功能特性

### 📋 数据管理
- **摊位用电清单**: 管理各摊位的用电需求、所属回路、雨棚保护状态、漏保状态
- **配电箱回路表**: 管理回路容量、相别、所属配电箱和发电机
- **发电机容量**: 管理发电机额定容量、冗余阈值配置
- **停电演练记录**: 记录临时停电演练的测试范围和结果

### ⚠️ 风险自动检测
- **单回路超载检测**: 当回路总负载超过额定容量的 90% 时告警
- **三相不平衡检测**: 当三相负载偏差超过平均值的 15% 时告警
- **发电机冗余不足**: 当发电机容量不能满足"总负载 × (1 + 冗余阈值)"时告警
- **雨棚设备未接漏保**: 雨棚保护区域的摊位未安装漏电保护器(RCD)时告警
- **演练未覆盖关键舞台**: 临时停电演练未覆盖所有关键舞台时告警

### 🛠️ 工作流功能
- **风险重算**: 数据变更后重新计算所有风险
- **人工改判**: 对自动检测的风险进行人工判定、添加备注和理由
- **复核意见**: 为每项风险添加讨论和复核记录
- **状态管理**: 支持 OPEN/RESOLVED/DISMISSED/MANUAL_OVERRIDE 状态

### 📤 导出功能
- **JSON 导出**: 完整导出所有数据和风险分析结果
- **Markdown 导出**: 生成格式化的风险评估报告，便于打印和会议讨论

## 快速开始

### 环境要求
- Python 3.9+
- pip

### 安装步骤

1. 安装依赖:
```bash
pip install -r requirements.txt
```

2. 导入示例数据(可选):
```bash
python examples/import_examples.py
```

3. 启动服务:
```bash
uvicorn main:app --reload --port 8000
```

4. 访问 API 文档:
   - Swagger UI: http://localhost:8000/docs
   - ReDoc: http://localhost:8000/redoc

## API 接口

### 摊位管理 (`/api/stalls`)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/stalls` | 获取所有摊位列表 |
| GET | `/api/stalls/{id}` | 获取单个摊位详情 |
| POST | `/api/stalls` | 创建新摊位 |
| POST | `/api/stalls/import` | 批量导入摊位数据 |
| PUT | `/api/stalls/{id}` | 更新摊位信息 |
| DELETE | `/api/stalls/{id}` | 删除摊位 |
| DELETE | `/api/stalls/` | 清空所有摊位 |

**摊位数据结构:**
```json
{
  "name": "美食摊位-A1-烧烤王",
  "location": "美食区-前排",
  "power_required_kw": 8.0,
  "circuit_id": 6,
  "is_rain_protected": false,
  "has_rcd_protection": true,
  "is_critical": false
}
```

### 回路管理 (`/api/circuits`)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/circuits` | 获取所有回路列表 |
| GET | `/api/circuits/{id}` | 获取单个回路详情 |
| POST | `/api/circuits` | 创建新回路 |
| POST | `/api/circuits/import` | 批量导入回路数据 |
| PUT | `/api/circuits/{id}` | 更新回路信息 |
| DELETE | `/api/circuits/{id}` | 删除回路 |
| DELETE | `/api/circuits/` | 清空所有回路 |

**回路数据结构:**
```json
{
  "name": "C-01-主舞台灯光",
  "panel_name": "主配电箱-A",
  "phase": "L1",
  "max_capacity_kw": 30.0,
  "generator_id": 1
}
```

### 发电机管理 (`/api/generators`)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/generators` | 获取所有发电机列表 |
| GET | `/api/generators/{id}` | 获取单个发电机详情 |
| POST | `/api/generators` | 创建新发电机 |
| POST | `/api/generators/import` | 批量导入发电机数据 |
| PUT | `/api/generators/{id}` | 更新发电机信息 |
| DELETE | `/api/generators/{id}` | 删除发电机 |
| DELETE | `/api/generators/` | 清空所有发电机 |

**发电机数据结构:**
```json
{
  "name": "主发电机 #1",
  "capacity_kw": 200.0,
  "redundancy_threshold": 0.3
}
```

### 演练记录 (`/api/drills`)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/drills` | 获取所有演练记录 |
| GET | `/api/drills/{id}` | 获取单个演练详情 |
| POST | `/api/drills` | 创建演练记录 |
| POST | `/api/drills/import` | 批量导入演练记录 |
| DELETE | `/api/drills/{id}` | 删除演练记录 |
| DELETE | `/api/drills/` | 清空所有演练记录 |

**演练记录数据结构:**
```json
{
  "drill_date": "2026-05-02T14:00:00",
  "circuits_tested": "C-01-主舞台灯光, C-02-主舞台音响",
  "stages_tested": "主舞台",
  "critical_stages": "主舞台, 副舞台",
  "notes": "第一次停电演练，发电机切换时间约15秒。"
}
```

### 风险管理 (`/api/risks`)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/risks` | 获取风险列表(支持按 severity 和 status 过滤) |
| GET | `/api/risks/{id}` | 获取单个风险详情 |
| GET | `/api/risks/summary` | 获取风险统计摘要 |
| POST | `/api/risks/recalculate` | 重新计算所有风险 |
| POST | `/api/risks/override` | 人工改判风险 |
| PUT | `/api/risks/{id}/status?status=xxx` | 更新风险状态 |
| POST | `/api/risks/{id}/comments` | 添加复核意见 |
| GET | `/api/risks/{id}/comments` | 获取风险的复核意见 |

**人工改判请求:**
```json
{
  "risk_id": 1,
  "overridden_by": "张工",
  "override_reason": "现场确认该回路实际负载为间歇性，不会同时满载运行",
  "new_status": "manual_override"
}
```

**风险状态类型:**
- `open`: 待处理
- `resolved`: 已解决
- `dismissed`: 已忽略
- `manual_override`: 人工覆盖

### 导出功能 (`/api/export`)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/export/json` | 导出完整数据为 JSON |
| GET | `/api/export/markdown` | 导出完整报告为 Markdown |
| GET | `/api/export/risks/json` | 仅导出风险数据为 JSON |
| GET | `/api/export/risks/markdown` | 仅导出风险报告为 Markdown |

## 风险检查规则详解

### 1. 单回路超载 (circuit_overload)
- **检测逻辑**: 回路下所有摊位的 `power_required_kw` 之和 > `max_capacity_kw × 0.9`
- **严重程度**: 
  - 负载率 > 100%: CRITICAL (严重)
  - 负载率 90%~100%: HIGH (高危)
- **阈值配置**: `load_threshold = 0.9` (90%)

### 2. 三相不平衡 (phase_imbalance)
- **检测逻辑**: 每相负载与平均值的偏差 / 平均值 > 15%
- **严重程度**: HIGH (高危)
- **阈值配置**: `phase_imbalance_threshold = 0.15` (15%)
- **计算公式**: 
  ```
  avg = (L1 + L2 + L3) / 3
  max_deviation = max(|L1-avg|, |L2-avg|, |L3-avg|)
  imbalance_ratio = max_deviation / avg
  ```

### 3. 发电机冗余不足 (generator_insufficient)
- **检测逻辑**: 发电机容量 < 总负载 × (1 + 冗余阈值)
- **严重程度**: CRITICAL (严重)
- **阈值配置**: 每台发电机的 `redundancy_threshold` 字段，默认 0.3 (30%)

### 4. 雨棚设备未接漏保 (rcd_missing)
- **检测逻辑**: `is_rain_protected = true` 且 `has_rcd_protection = false`
- **严重程度**: HIGH (高危)
- **说明**: 户外雨棚区域属于潮湿环境，所有用电设备必须配备漏电保护器

### 5. 演练未覆盖关键舞台 (drill_incomplete)
- **检测逻辑**: 取最新演练记录，比较 `stages_tested` 和 `critical_stages`
- **严重程度**: MEDIUM (中危)
- **数据格式**: 两个字段均使用逗号分隔的舞台名称列表

## 典型工作流

### 场景1: 开场前数据导入

```bash
# 1. 导入发电机配置
curl -X POST http://localhost:8000/api/generators/import \
  -H "Content-Type: application/json" \
  -d @examples/generators.json

# 2. 导入回路表
curl -X POST http://localhost:8000/api/circuits/import \
  -H "Content-Type: application/json" \
  -d @examples/circuits.json

# 3. 导入摊位清单
curl -X POST http://localhost:8000/api/stalls/import \
  -H "Content-Type: application/json" \
  -d @examples/stalls.json

# 4. 导入演练记录
curl -X POST http://localhost:8000/api/drills/import \
  -H "Content-Type: application/json" \
  -d @examples/drills.json
```

### 场景2: 风险分析和报告

```bash
# 1. 触发风险重算
curl -X POST http://localhost:8000/api/risks/recalculate

# 2. 查看风险摘要
curl http://localhost:8000/api/risks/summary

# 3. 导出完整报告 (Markdown)
curl http://localhost:8000/api/export/markdown -o report.md

# 4. 导出 JSON 数据
curl http://localhost:8000/api/export/json -o full_export.json
```

### 场景3: 人工改判

```bash
# 对某项风险进行人工判定
curl -X POST http://localhost:8000/api/risks/override \
  -H "Content-Type: application/json" \
  -d '{
    "risk_id": 3,
    "overridden_by": "李主管",
    "override_reason": "该摊位临时调整了设备，实际需求为 3kW 而非 5kW",
    "new_status": "dismissed"
  }'

# 添加复核意见
curl -X POST http://localhost:8000/api/risks/3/comments \
  -H "Content-Type: application/json" \
  -d '{
    "risk_id": 3,
    "reviewer": "王工",
    "comment": "已现场核实，确认设备已调整，风险解除。"
  }'
```

## 项目结构

```
xy4377/
├── main.py                 # FastAPI 入口
├── config.py               # 配置管理
├── database.py             # 数据库连接和初始化
├── models.py               # SQLAlchemy 数据模型
├── schemas.py              # Pydantic 请求/响应模型
├── risk_calculator.py      # 风险计算核心逻辑
├── requirements.txt        # Python 依赖
├── routers/
│   ├── __init__.py
│   ├── stalls.py           # 摊位路由
│   ├── circuits.py         # 回路路由
│   ├── generators.py       # 发电机路由
│   ├── drills.py           # 演练记录路由
│   ├── risks.py            # 风险管理路由
│   └── exports.py          # 导出功能路由
├── examples/
│   ├── generators.json     # 发电机示例数据
│   ├── circuits.json       # 回路示例数据
│   ├── stalls.json         # 摊位示例数据
│   ├── drills.json         # 演练示例数据
│   └── import_examples.py  # 示例数据导入脚本
└── festival_power.db       # SQLite 数据库 (运行后生成)
```

## 数据模型说明

### 核心实体关系

```
Generator (1) ──< (N) Circuit (1) ──< (N) Stall
       ^
       |
    三相负载汇总
       |
    风险计算 ──> RiskResult
       ^
       |
    ReviewComment (N) ──> (1) RiskResult
```

### 数据库表

| 表名 | 说明 |
|------|------|
| stalls | 摊位用电清单 |
| circuits | 配电箱回路表 |
| generators | 发电机配置 |
| drill_records | 停电演练记录 |
| risk_results | 风险检测结果 |
| review_comments | 复核意见记录 |

## 配置说明

### 环境变量

可以通过 `.env` 文件配置:

```env
DATABASE_URL=sqlite:///./festival_power.db
APP_NAME=Festival Power Management API
DEBUG=true
```

### 风险阈值调整

如需调整默认阈值，可以修改 `risk_calculator.py` 中的常量:

```python
class RiskCalculator:
    def __init__(self, db: Session):
        self.db = db
        self.load_threshold = 0.9      # 回路负载阈值 (90%)
        self.phase_imbalance_threshold = 0.15  # 三相不平衡阈值 (15%)
```

发电机的冗余阈值可以在发电机数据中单独配置，通过 `redundancy_threshold` 字段设置。

## 示例数据说明

`examples/` 目录包含了完整的示例数据，用于演示系统功能。这些数据故意包含了多个风险场景:

### 预设风险场景

1. **回路超载**:
   - 主舞台音响: 22kW / 25kW = 88% (接近阈值)
   - 美食区-A: 8+5 = 13kW / 15kW = 87%
   - 美食区-B: 6+7 = 13kW / 15kW = 87%

2. **三相不平衡**:
   - 发电机#1 的 L1 相负载明显高于其他两相

3. **雨棚漏保缺失**:
   - 雨棚摊位-01-饮品: `is_rain_protected=true`, `has_rcd_protection=false`
   - 雨棚摊位-03-休息区照明: 同样未接漏保

4. **演练覆盖不全**:
   - critical_stages = "主舞台, 副舞台"
   - stages_tested = "主舞台"
   - 未覆盖: 副舞台

## 注意事项

1. **本地使用**: 此系统设计为本地 REST API 服务，不建议直接暴露到公网
2. **数据库**: 使用 SQLite 单文件存储，便于备份和迁移
3. **导入顺序**: 数据导入时注意外键依赖:
   - 先导入: generators → circuits → stalls
   - 再导入: drills (无依赖)
4. **风险重算**: 每次数据变更后需要手动调用 `POST /api/risks/recalculate` 来更新风险结果
5. **人工改判保护**: 被人工改判的风险项在重算时会被保留，不会被覆盖

## License

本项目仅供内部使用。

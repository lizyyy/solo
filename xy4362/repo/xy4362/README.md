# 潜水俱乐部后端服务

一个基于 Flask + SQLite 的潜水气瓶管理系统，用于管理气瓶、充气记录、氧分压目标、年检到期提醒和出海潜点计划。

## 功能特性

- **气瓶管理**: 登记气瓶基本信息（编号、容积、类型、年检到期日期）
- **充气记录**: 记录每次充气的氧分压、压力、操作人员
- **风险检测**: 自动拦截以下风险：
  - 年检过期
  - 混合气氧分压超过安全限制（默认 1.4）
  - 同一气瓶被重复分配
  - 备用气压力不足（默认 < 100 bar）
  - 主供气压力不足（默认 < 150 bar）
- **人工复核**: 支持风险改判（override）、批准、拒绝
- **数据导入**: 支持 JSON 和 CSV 格式导入出海计划
- **数据导出**: 导出 Markdown 装船清单和 JSON 审计包

## 快速开始

### 环境要求

- Python 3.8+
- pip 或 pip3

### 安装依赖

```bash
cd /path/to/project
pip3 install -r requirements.txt
```

### 初始化数据库

```bash
# 创建数据库表
python3 -c "from app import create_app, db; app = create_app(); app.app_context().push(); db.create_all(); print('数据库初始化完成')"
```

或者使用 Flask CLI（需要先设置 FLASK_APP）：

```bash
export FLASK_APP=run.py
flask init-db
```

### 填充示例数据（可选）

```bash
export FLASK_APP=run.py
flask seed-data
```

示例数据包含：
- 4 个气瓶（T001-T004）
  - T001: 正常气瓶，年检有效，氧分压 1.2
  - T002: 氧分压超限（1.5），年检有效
  - T003: 年检过期，压力不足
  - T004: 正常气瓶
- 2 个氧分压目标配置
- 3 条充气记录

### 启动服务

```bash
python3 run.py
```

服务将在 `http://localhost:5000` 启动。

---

## API 接口列表

### 基础接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 服务状态和端点列表 |

### 气瓶管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/tanks` | 获取所有气瓶 |
| GET | `/api/tanks/<id>` | 获取单个气瓶 |
| POST | `/api/tanks` | 创建新气瓶 |
| PUT | `/api/tanks/<id>` | 更新气瓶信息 |
| DELETE | `/api/tanks/<id>` | 删除气瓶 |

### 充气记录

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/fill-records` | 获取所有充气记录 |
| POST | `/api/fill-records` | 新增充气记录 |

### 氧分压目标

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/oxygen-targets` | 获取氧分压配置 |
| POST | `/api/oxygen-targets` | 创建氧分压配置 |

### 潜水计划

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/dive-plans` | 获取所有潜水计划 |
| GET | `/api/dive-plans/<id>` | 获取单个计划详情 |
| POST | `/api/dive-plans` | 创建空计划 |

### 导入接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/import/json` | JSON 格式导入出海计划 |
| POST | `/api/import/csv` | CSV 文件导入出海计划 |

### 复核/改判接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/review/<plan_id>/risks` | 获取计划的所有风险 |
| POST | `/api/review/risk/<risk_id>` | 处理单个风险 |
| POST | `/api/review/<plan_id>/approve` | 整体批准计划 |

### 导出接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/export/<plan_id>/markdown` | 导出 Markdown 装船清单 |
| GET | `/api/export/<plan_id>/json` | 导出 JSON 审计包 |
| GET | `/api/export/<plan_id>/all` | 同时获取两种格式 |

---

## 使用 curl 跑通完整流程

以下是一个完整的使用流程示例：

### 步骤 1: 确认服务启动

```bash
curl http://localhost:5000/
```

### 步骤 2: 查看现有气瓶（如果已填充示例数据）

```bash
curl http://localhost:5000/api/tanks
```

### 步骤 3: 添加新气瓶（如果没有示例数据）

```bash
# 气瓶 1: 正常气瓶
curl -X POST http://localhost:5000/api/tanks \
  -H "Content-Type: application/json" \
  -d '{
    "serial_number": "T001",
    "volume": 12.0,
    "tank_type": "aluminum",
    "current_pressure": 200,
    "inspection_expiry_date": "2027-05-01"
  }'

# 气瓶 2: 氧分压会超限
curl -X POST http://localhost:5000/api/tanks \
  -H "Content-Type: application/json" \
  -d '{
    "serial_number": "T002",
    "volume": 12.0,
    "tank_type": "steel",
    "current_pressure": 180,
    "inspection_expiry_date": "2026-11-01"
  }'

# 气瓶 3: 年检过期
curl -X POST http://localhost:5000/api/tanks \
  -H "Content-Type: application/json" \
  -d '{
    "serial_number": "T003",
    "volume": 10.0,
    "tank_type": "aluminum",
    "current_pressure": 50,
    "inspection_expiry_date": "2026-03-01"
  }'

# 气瓶 4: 备用气瓶
curl -X POST http://localhost:5000/api/tanks \
  -H "Content-Type: application/json" \
  -d '{
    "serial_number": "T004",
    "volume": 12.0,
    "tank_type": "aluminum",
    "current_pressure": 200,
    "inspection_expiry_date": "2027-03-01"
  }'
```

### 步骤 4: 添加充气记录

```bash
# T001 充气 - 正常氧分压 1.2
curl -X POST http://localhost:5000/api/fill-records \
  -H "Content-Type: application/json" \
  -d '{
    "tank_id": 1,
    "oxygen_partial_pressure": 1.2,
    "fill_pressure": 200,
    "operator": "张教练",
    "notes": "常规空气填充"
  }'

# T002 充气 - 氧分压超限 1.5
curl -X POST http://localhost:5000/api/fill-records \
  -H "Content-Type: application/json" \
  -d '{
    "tank_id": 2,
    "oxygen_partial_pressure": 1.5,
    "fill_pressure": 180,
    "operator": "李教练",
    "notes": "高氧混合气填充"
  }'

# T004 充气 - 正常
curl -X POST http://localhost:5000/api/fill-records \
  -H "Content-Type: application/json" \
  -d '{
    "tank_id": 4,
    "oxygen_partial_pressure": 1.3,
    "fill_pressure": 200,
    "operator": "王教练",
    "notes": "空气填充"
  }'
```

### 步骤 5: JSON 导入出海计划（触发风险检测）

创建一个包含风险的导入数据：

```bash
curl -X POST http://localhost:5000/api/import/json \
  -H "Content-Type: application/json" \
  -d '{
    "dive_plan": {
      "plan_name": "周末珊瑚礁潜水",
      "dive_date": "2026-05-10",
      "dive_site": "南海珊瑚礁 A 区",
      "coach": "张教练"
    },
    "tanks": [
      {
        "serial_number": "T001",
        "role": "primary"
      },
      {
        "serial_number": "T002",
        "role": "primary"
      },
      {
        "serial_number": "T003",
        "role": "backup"
      }
    ]
  }'
```

**预期风险检测结果：**
- T002: 氧分压 1.5 > 1.4（CRITICAL）
- T003: 年检过期（CRITICAL）+ 压力不足（HIGH）

### 步骤 6: 查看检测到的风险

```bash
# 替换 <plan_id> 为上一步返回的计划 ID
curl http://localhost:5000/api/review/1/risks
```

### 步骤 7: 人工复核/改判

**场景 A: 批准正常风险**

```bash
# 假设风险 ID 1 是 T001 无风险或已解决的风险
curl -X POST http://localhost:5000/api/review/risk/1 \
  -H "Content-Type: application/json" \
  -d '{
    "action": "approve",
    "reviewer": "高级教练王",
    "reason": "检查确认，气瓶状态正常"
  }'
```

**场景 B: 改判（Override）关键风险**

例如，T002 的氧分压 1.5 在某些特殊情况下是允许的：

```bash
# 假设风险 ID 2 是 T002 的氧分压超限
curl -X POST http://localhost:5000/api/review/risk/2 \
  -H "Content-Type: application/json" \
  -d '{
    "action": "override",
    "reviewer": "技术总监",
    "reason": "本次为技术潜水训练，深度控制在 15 米以内，氧分压 1.5 经特批允许"
  }'
```

**场景 C: 拒绝某个风险（需要更换气瓶）**

对于 T003 的年检过期问题：

```bash
# 假设风险 ID 3 是 T003 的年检过期
curl -X POST http://localhost:5000/api/review/risk/3 \
  -H "Content-Type: application/json" \
  -d '{
    "action": "reject",
    "reviewer": "安全官",
    "reason": "年检过期，必须更换气瓶"
  }'
```

### 步骤 8: 创建一个正确的替代计划

使用正常的气瓶重新导入：

```bash
curl -X POST http://localhost:5000/api/import/json \
  -H "Content-Type: application/json" \
  -d '{
    "dive_plan": {
      "plan_name": "周末珊瑚礁潜水（修正版）",
      "dive_date": "2026-05-10",
      "dive_site": "南海珊瑚礁 A 区",
      "coach": "张教练"
    },
    "tanks": [
      {
        "serial_number": "T001",
        "role": "primary"
      },
      {
        "serial_number": "T004",
        "role": "backup"
      }
    ]
  }'
```

### 步骤 9: 整体批准计划

当所有关键风险都解决后：

```bash
# 替换 <plan_id> 为正确的计划 ID
curl -X POST http://localhost:5000/api/review/2/approve \
  -H "Content-Type: application/json" \
  -d '{
    "reviewer": "安全官"
  }'
```

### 步骤 10: 导出装船清单

**导出 Markdown 格式：**

```bash
# 替换 <plan_id> 为已批准的计划 ID
curl -O "http://localhost:5000/api/export/2/markdown"
```

或者直接查看内容：

```bash
curl "http://localhost:5000/api/export/2/markdown"
```

**导出 JSON 审计包：**

```bash
curl -O "http://localhost:5000/api/export/2/json"
```

### 步骤 11: CSV 导入示例

创建一个 CSV 文件 `tanks.csv`：

```csv
serial_number,role
T001,primary
T004,backup
```

然后使用 curl 导入：

```bash
curl -X POST http://localhost:5000/api/import/csv \
  -F "file=@tanks.csv" \
  -F "plan_name=CSV导入测试" \
  -F "dive_date=2026-05-15" \
  -F "dive_site=测试潜点" \
  -F "coach=李教练"
```

---

## 风险检测规则说明

### 风险类型

| 风险类型 | 严重程度 | 触发条件 |
|---------|---------|---------|
| `inspection_expired` | CRITICAL | 气瓶年检日期 < 潜水日期 |
| `oxygen_over_limit` | CRITICAL | 最新充气记录氧分压 > 1.4 |
| `duplicate_assignment` | CRITICAL | 同一气瓶在计划中被分配多次 |
| `backup_insufficient` | HIGH | 备用气瓶压力 < 100 bar |
| `primary_insufficient` | HIGH | 主供气气瓶压力 < 150 bar |

### 严重级别定义

- **CRITICAL**: 必须解决，否则计划状态为 `blocked`
- **HIGH**: 建议解决，但不阻止批准（可手动 override）
- **MEDIUM/LOW**: 提醒级别

### 计划状态流转

```
draft → pending_review → blocked (有未解决CRITICAL)
                          ↓
                   pending_review (CRITICAL已解决)
                          ↓
                        approved
                          ↓
                        rejected (可手动拒绝)
```

---

## 配置参数

在 `config.py` 中可调整以下参数：

```python
MAX_OXYGEN_PARTIAL_PRESSURE = 1.4    # 最大允许氧分压
BACKUP_TANK_MIN_PRESSURE = 100        # 备用气瓶最低压力 (bar)
PRIMARY_TANK_MIN_PRESSURE = 150       # 主供气最低压力 (bar)
```

---

## 项目结构

```
.
├── app/
│   ├── __init__.py      # 应用初始化
│   ├── models.py        # 数据模型
│   ├── routes.py        # API 路由
│   └── risk_detector.py # 风险检测逻辑
├── config.py            # 配置文件
├── run.py               # 启动脚本
├── requirements.txt     # 依赖列表
└── README.md           # 本文档
```

---

## 注意事项

1. **生产环境**: 请修改 `SECRET_KEY`，使用更强的随机密钥
2. **数据库**: 默认使用 SQLite，生产环境建议使用 PostgreSQL 或 MySQL
3. **备份**: 定期备份 `diving.db` 文件
4. **测试**: 首次使用前建议先用示例数据测试完整流程

---

## 故障排查

### 问题 1: 导入时找不到气瓶

**原因**: 气瓶编号不存在于数据库中

**解决**: 先通过 `POST /api/tanks` 创建气瓶，或检查编号是否正确

### 问题 2: 计划状态始终是 blocked

**原因**: 存在未解决的 CRITICAL 级别风险

**解决**: 
1. 调用 `GET /api/review/<plan_id>/risks` 查看具体风险
2. 更换气瓶解决问题，或使用 `action: override` 改判

### 问题 3: 氧分压检测失败

**原因**: 气瓶没有充气记录

**解决**: 先通过 `POST /api/fill-records` 添加充气记录

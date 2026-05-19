# Featureflag冲突解析后端API

## 项目简介

当多个 Feature Flag 同时命中时，客服只看到最终结果，看不到是哪条规则覆盖了谁。本系统提供了完整的 Feature Flag 冲突解析能力，包括：
- **规则清楚**：明确展示每条规则的匹配条件和优先级计算明细
- **结果可复查**：完整的审计日志，记录所有操作过程、处理人、处理结论
- **人工介入**：支持人工确认、修正、撤回、关闭等全流程操作

## 技术栈

- Python 3.8+
- FastAPI - Web 框架
- SQLAlchemy - ORM
- SQLite - 数据库
- Pytest - 测试框架

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化数据（造数）

```bash
python seed_data.py
```

这会创建 5 个测试用的 Feature Flag：
- `new_ui_vip` - VIP用户新版UI（优先级100，vip用户组）
- `new_ui_all` - 全体用户新版UI（优先级50）
- `promotion_a` - 促销活动A（优先级80，北京/上海，等级>=3）
- `promotion_b` - 促销活动B（优先级90，北京，等级>=5）
- `beta_feature` - Beta测试功能（优先级75，beta用户组）

### 3. 启动服务

```bash
python main.py
```

或者使用 uvicorn 直接启动：

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

服务启动后访问:
- API 文档 (Swagger): http://localhost:8001/docs
- ReDoc: http://localhost:8001/redoc

## API 接口示例 (curl)

### Feature Flag 管理

#### 创建 Feature Flag
```bash
curl -X POST "http://localhost:8001/api/feature-flags/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test_flag",
    "description": "测试开关",
    "conditions": {"region": "北京", "level": {"operator": "gte", "value": 3}},
    "priority": 50,
    "user_group": "vip"
  }'
```

#### 查询所有 Feature Flag
```bash
curl "http://localhost:8001/api/feature-flags/"
```

#### 查询单个 Feature Flag
```bash
curl "http://localhost:8001/api/feature-flags/1"
```

### 冲突检测与解析

#### 评估冲突（核心接口）
```bash
curl -X POST "http://localhost:8001/api/conflicts/evaluate" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "vip_user_001",
    "user_context": {
      "user_group": "vip",
      "login_days": 45
    }
  }'
```

**输出说明**：
```json
{
  "has_conflict": true,
  "conflict_id": 1,
  "matched_flags": [...],        // 所有匹配的 flag
  "winning_flag": {...},         // 最终胜出的 flag
  "overridden_flags": [...],     // 被覆盖的 flags
  "conflict_explanation": [...]  // 覆盖原因说明
}
```

#### 查询冲突列表
```bash
curl "http://localhost:8001/api/conflicts/"
```

#### 按状态过滤冲突
```bash
curl "http://localhost:8001/api/conflicts/?status=pending"
```

#### 人工解决冲突
```bash
curl -X POST "http://localhost:8001/api/conflicts/resolve" \
  -H "Content-Type: application/json" \
  -d '{
    "conflict_id": 1,
    "resolution": "经过业务确认，应该使用VIP专用开关",
    "operator": "客服小王",
    "selected_flag_id": 1
  }'
```

#### 撤回冲突
```bash
curl -X POST "http://localhost:8001/api/conflicts/1/withdraw?operator=客服小王&reason=用户数据有误，重新评估"
```

#### 关闭冲突
```bash
curl -X POST "http://localhost:8001/api/conflicts/1/close?operator=主管小李&reason=该用户已注销"
```

### 报告与导出

#### 获取冲突详情报告
```bash
curl "http://localhost:8001/api/conflicts/1/report"
```

报告包含：
- 冲突基本信息（用户ID、状态、时间）
- 原始输入（保留请求时的完整上下文）
- 冲突的 Feature Flag 详情（条件、优先级、匹配规则）
- 最终结果（胜出flag、被覆盖flags）
- 处理结论
- 完整审计日志（所有状态变更）

#### 导出冲突报告（JSON）
```bash
curl "http://localhost:8001/api/conflicts/1/export" -o conflict_report.json
```

#### 查看操作日志
```bash
curl "http://localhost:8001/api/conflicts/1/logs"
```

## 核心规则说明

### 优先级计算
- **基础优先级**：Feature Flag 设置的 priority 字段
- **用户组匹配加成**：如果 flag 指定了 user_group 且用户匹配，+100
- **VIP用户加成**：用户组包含 "vip"，+50

**示例**：VIP用户同时命中 new_ui_vip (优先级100) 和 new_ui_all (优先级50)：
- new_ui_vip 有效优先级 = 100 (基础) + 100 (用户组匹配) + 50 (VIP加成) = 250
- new_ui_all 有效优先级 = 50 (基础) + 50 (VIP加成) = 100
- 结果: new_ui_vip 胜出，优先级原因覆盖

### 条件匹配运算符
- `eq` / 直接值：等于
- `in`：在列表中
- `not_in`：不在列表中
- `gte`：大于等于
- `lte`：小于等于
- `contains`：字符串包含

### 状态流转
```
pending (待处理)
    ↓
resolved (已解决)  ← 人工选择结果
    ↓
withdrawn (已撤回) ← 判定有误需重评
    ↓
closed (已关闭)   ← 无需再处理
```

## 冲突场景示例

### 场景1: VIP用户UI冲突

```bash
curl -X POST "http://localhost:8001/api/conflicts/evaluate" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "vip_user_123",
    "user_context": {
      "user_group": "vip",
      "login_days": 50
    }
  }'
```

**预期冲突**：
- `new_ui_vip` (基础优先级100 + 用户组匹配100 + VIP50 = 250)
- `new_ui_all` (基础优先级50 + VIP50 = 100)
- 结果: `new_ui_vip` 胜出

### 场景2: 北京高级用户促销冲突

```bash
curl -X POST "http://localhost:8001/api/conflicts/evaluate" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "beijing_user_456",
    "user_context": {
      "region": "北京",
      "user_level": 6
    }
  }'
```

**预期冲突**：
- `promotion_a` (优先级80) - 匹配：北京in列表、等级>=3
- `promotion_b` (优先级90) - 匹配：北京==、等级>=5
- 结果: `promotion_b` 胜出，优先级更高

## 异常处理说明

所有异常路径都完整保留，确保可追溯：

1. **原始输入**：`original_input` 字段保存用户请求时的完整上下文
2. **处理人**：`resolved_by` / `operator` 字段记录每个操作的执行人
3. **处理结论**：`resolution` / `conclusion` 字段记录处理的原因说明
4. **审计日志**：`ResolutionLog` 表记录所有状态变更，包括：
   - 操作类型 (resolve/withdraw/close)
   - 操作人
   - 处理结论
   - 前后状态
   - 操作时间

## 运行测试

运行核心逻辑测试（已验证通过）：

```bash
pytest tests/test_conflict_engine.py -v
```

## 项目结构

```
.
├── main.py              # FastAPI 主应用
├── database.py          # 数据库模型
├── schemas.py           # Pydantic 数据结构
├── conflict_engine.py   # 核心业务逻辑
├── seed_data.py         # 造数脚本
├── requirements.txt     # 依赖声明
├── README.md           # 本文档
└── tests/              # 测试目录
    ├── __init__.py
    └── test_conflict_engine.py
```

## 健康检查

```bash
curl "http://localhost:8001/api/health"
```

## 设计亮点

1. **完整的优先级计算**：支持基础优先级、用户组匹配加成、VIP加成
2. **详细的匹配规则**：每条flag的匹配条件都清晰展示
3. **冲突原因解释**：自动说明为什么某个flag会覆盖其他flag
4. **完整的审计日志**：所有状态变更都有记录，可追溯
5. **原始输入保留**：确保任何时候都能回溯原始请求数据
6. **全流程人工介入**：支持pending→resolved→withdrawn→closed完整状态流转

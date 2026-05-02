# 过敏原配餐审校站

专为幼儿园后厨和保健老师设计的本地纯后端 API 服务，解决菜单、食材批次、儿童过敏档案和替餐申请分散管理的问题，防止含坚果/乳制品的菜品被误分给过敏孩子。

## 功能特性

- ✅ **数据导入**：支持 CSV 格式导入菜单、食材配料表、儿童过敏档案
- ✅ **智能校验**：自动校验过敏原冲突、禁忌食材、替餐审批状态、批次召回
- ✅ **分餐建议**：生成每日分餐计划，标记安全分餐、阻断分餐、需替餐情况
- ✅ **阻断清单**：自动记录过敏原冲突阻断，防止误分配
- ✅ **替餐审批**：完整的状态机管理（待审批 → 已批准/已拒绝 → 已执行）
- ✅ **批次管理**：支持食材批次召回、过期检查
- ✅ **审计流水**：所有操作均记录审计日志，可追溯
- ✅ **多格式导出**：支持 Markdown、CSV、JSON 三种报告格式
- ✅ **数据持久化**：SQLite 本地存储，重启数据不丢失

## 技术栈

- **框架**: FastAPI
- **ORM**: SQLAlchemy 2.0
- **数据库**: SQLite
- **Python**: 3.9+

## 项目结构

```
allergen-checker/
├── app/
│   ├── __init__.py
│   ├── config.py              # 应用配置
│   ├── database.py            # 数据库连接和会话管理
│   ├── main.py                # FastAPI 应用入口
│   ├── models.py              # SQLAlchemy 数据模型
│   ├── schemas.py             # Pydantic 请求/响应模型
│   ├── rules_engine.py        # 规则引擎（过敏原匹配、批次校验、状态机）
│   ├── services.py            # 业务服务（分餐计划、替餐审批、审计）
│   ├── import_service.py      # CSV 导入服务
│   ├── export_service.py      # 多格式导出服务
│   └── routers/               # API 路由
│       ├── __init__.py
│       ├── children.py        # 儿童档案管理
│       ├── menu.py            # 菜单管理
│       ├── ingredients.py     # 食材批次管理
│       ├── substitutions.py   # 替餐申请管理
│       ├── meal_plan.py       # 分餐计划生成
│       ├── import_router.py   # 数据导入接口
│       ├── export_router.py   # 数据导出接口
│       └── audit.py           # 审计流水查询
├── sample_data/               # 示例数据
│   ├── children.csv           # 儿童过敏档案示例
│   ├── menu.csv               # 菜单示例
│   └── ingredients.csv        # 食材批次示例
├── tests/
│   ├── __init__.py
│   └── test_rules_engine.py   # 规则引擎单元测试
├── requirements.txt           # 依赖列表
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn app.main:app --reload --port 8000
```

服务启动后访问：
- API 文档: http://localhost:8000/docs
- OpenAPI 规范: http://localhost:8000/openapi.json

### 3. 运行测试

```bash
pytest tests/ -v
```

---

## API 完整验证流程（curl 示例）

### 基础检查

**健康检查**
```bash
curl http://localhost:8000/health
```

**查看根信息**
```bash
curl http://localhost:8000/
```

---

### 一、数据导入

#### 1. 导入儿童过敏档案

```bash
curl -X POST "http://localhost:8000/api/v1/import/children" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample_data/children.csv;type=text/csv" \
  -F "operator=保健老师"
```

**预期响应**:
```json
{
  "success": true,
  "total": 11,
  "imported": 10,
  "errors": [],
  "skipped": 1
}
```

#### 2. 导入菜单

```bash
curl -X POST "http://localhost:8000/api/v1/import/menu" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample_data/menu.csv;type=text/csv" \
  -F "operator=后厨管理员"
```

#### 3. 导入食材批次

```bash
curl -X POST "http://localhost:8000/api/v1/import/ingredients" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample_data/ingredients.csv;type=text/csv" \
  -F "operator=采购负责人"
```

---

### 二、查看已导入数据

#### 1. 查看儿童列表

```bash
curl "http://localhost:8000/api/v1/children/"
```

**按班级筛选**:
```bash
curl "http://localhost:8000/api/v1/children/?class_name=小班1班"
```

#### 2. 查看菜单

```bash
curl "http://localhost:8000/api/v1/menu/"
```

**按日期筛选**:
```bash
curl "http://localhost:8000/api/v1/menu/?menu_date=2026-05-02"
```

#### 3. 查看食材批次

```bash
curl "http://localhost:8000/api/v1/ingredients/"
```

---

### 三、过敏原兼容性检查

**检查单个儿童与菜品的兼容性**:

```bash
curl -X POST "http://localhost:8000/api/v1/meal-plan/check-compatibility?child_id=1&menu_item_id=1"
```

**预期响应（冲突示例）**:
```json
{
  "success": true,
  "compatibility": {
    "child_name": "张小明",
    "student_id": "STU001",
    "class_name": "小班1班",
    "dish_name": "牛奶燕麦粥",
    "meal_type": "早餐",
    "menu_date": "2026-05-02",
    "has_conflict": true,
    "has_allergen_conflict": true,
    "has_forbidden_conflict": false,
    "matched_allergens": ["乳制品"],
    "matched_forbidden": [],
    "risk_level": "高风险",
    "recommendation": "禁止分餐！检测到过敏原冲突：乳制品"
  }
}
```

---

### 四、生成每日分餐计划

```bash
curl -X POST "http://localhost:8000/api/v1/meal-plan/generate?plan_date=2026-05-02&operator=保健老师"
```

**预期响应**:
```json
{
  "date": "2026-05-02",
  "has_menu": true,
  "meal_plans": [
    {
      "meal_type": "早餐",
      "dishes": [
        {
          "dish_name": "牛奶燕麦粥",
          "allergens": "乳制品",
          "assigned_children": [],
          "blocked_children": [
            {
              "child_name": "张小明",
              "student_id": "STU001",
              "block_reason": "过敏原冲突",
              "matched_allergens": ["乳制品"]
            },
            {
              "child_name": "李小花",
              "student_id": "STU002",
              "block_reason": "过敏原冲突",
              "matched_allergens": ["乳制品"]
            }
          ]
        }
      ]
    }
  ],
  "summary": {
    "total_children": 10,
    "total_dishes": 11,
    "safe_assignments": 75,
    "blocked_assignments": 35,
    "substitutions_needed": 0
  }
}
```

---

### 五、查看阻断清单

```bash
curl "http://localhost:8000/api/v1/meal-plan/block-list"
```

**按日期筛选**:
```bash
curl "http://localhost:8000/api/v1/meal-plan/block-list?block_date=2026-05-02"
```

---

### 六、替餐申请流程

#### 1. 创建替餐申请

```bash
curl -X POST "http://localhost:8000/api/v1/substitutions/" \
  -H "Content-Type: application/json" \
  -d '{
    "child_id": 1,
    "menu_item_id": 1,
    "request_date": "2026-05-02",
    "original_dish": "牛奶燕麦粥",
    "substitution_dish": "白米粥",
    "reason": "乳制品过敏"
  }'
```

#### 2. 审批替餐申请

```bash
curl -X POST "http://localhost:8000/api/v1/substitutions/1/approve?approver=保健老师&substitution_dish=白米粥"
```

#### 3. 执行替餐

```bash
curl -X POST "http://localhost:8000/api/v1/substitutions/1/implement?operator=后厨管理员"
```

#### 4. 查看替餐申请状态

```bash
curl "http://localhost:8000/api/v1/substitutions/"
```

**按状态筛选**:
```bash
curl "http://localhost:8000/api/v1/substitutions/?status=待审批"
```

---

### 七、食材批次召回

```bash
curl -X POST "http://localhost:8000/api/v1/ingredients/recall" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_number": "BATCH-2026-001",
    "reason": "质量问题，检测出超标"
  }'
```

**召回后重新生成分餐计划**：
```bash
curl -X POST "http://localhost:8000/api/v1/meal-plan/generate?plan_date=2026-05-02&operator=保健老师"
```

---

### 八、导出报告

#### 1. 导出分餐计划（Markdown）

```bash
curl -o meal_plan_2026-05-02.md "http://localhost:8000/api/v1/export/meal-plan/markdown?plan_date=2026-05-02"
```

#### 2. 导出分餐计划（JSON）

```bash
curl -o meal_plan_2026-05-02.json "http://localhost:8000/api/v1/export/meal-plan/json?plan_date=2026-05-02"
```

#### 3. 导出阻断清单（Markdown）

```bash
curl -o block_list.md "http://localhost:8000/api/v1/export/block-list/markdown"
```

#### 4. 导出阻断清单（JSON）

```bash
curl -o block_list.json "http://localhost:8000/api/v1/export/block-list/json"
```

#### 5. 导出审计流水（Markdown）

```bash
curl -o audit_logs.md "http://localhost:8000/api/v1/export/audit-logs/markdown"
```

#### 6. 导出 CSV 格式数据

```bash
# 儿童档案
curl -o children.csv "http://localhost:8000/api/v1/export/children/csv"

# 菜单
curl -o menu.csv "http://localhost:8000/api/v1/export/menu/csv"

# 食材
curl -o ingredients.csv "http://localhost:8000/api/v1/export/ingredients/csv"

# 替餐申请
curl -o substitutions.csv "http://localhost:8000/api/v1/export/substitutions/csv"
```

---

### 九、查看审计流水

```bash
curl "http://localhost:8000/api/v1/audit/"
```

**按操作类型筛选**:
```bash
curl "http://localhost:8000/api/v1/audit/?action=IMPORT"
```

**按实体类型筛选**:
```bash
curl "http://localhost:8000/api/v1/audit/?entity_type=Child"
```

---

## 数据模型说明

### 支持的过敏原类型

| 类型 | 说明 | 关键词示例 |
|------|------|-----------|
| NUT | 坚果类 | 坚果、杏仁、核桃、腰果、nut、almond |
| DAIRY | 乳制品 | 牛奶、奶粉、奶酪、黄油、milk、cheese |
| EGG | 蛋类 | 鸡蛋、蛋清、蛋黄、egg |
| WHEAT | 小麦 | 面粉、面筋、wheat、flour |
| SOY | 大豆 | 大豆、黄豆、酱油、豆腐、soy |
| FISH | 鱼类 | 三文鱼、鳕鱼、fish、salmon |
| SHELLFISH | 甲壳类 | 虾、蟹、龙虾、贝类、shrimp、crab |
| PEANUT | 花生 | 花生、peanut |
| SESAME | 芝麻 | 芝麻、sesame |
| MUSTARD | 芥末 | 芥末、mustard |

### 替餐状态流转

```
待审批(PENDING)
    ├──→ 已批准(APPROVED) ───→ 已执行(IMPLEMENTED)
    │           │
    │           └──→ 已拒绝(REJECTED)
    │
    └──→ 已拒绝(REJECTED)
```

### 食材批次状态

- **可用(ACTIVE)**: 正常可使用
- **已召回(RECALLED)**: 因质量问题召回，使用该批次的菜品将被阻断
- **已过期(EXPIRED)**: 超过有效期，系统自动检测

---

## CSV 导入格式说明

### 儿童档案 CSV 格式

| 列名 | 必填 | 说明 |
|------|------|------|
| 姓名 | 是 | 儿童姓名 |
| 学号 | 是 | 唯一标识 |
| 班级 | 是 | 所在班级 |
| 过敏原 | 否 | 过敏原列表，用顿号分隔（如：坚果、乳制品） |
| 禁忌食材 | 否 | 禁忌食材列表，用顿号分隔 |

### 菜单 CSV 格式

| 列名 | 必填 | 说明 |
|------|------|------|
| 日期 | 是 | 菜单日期 (YYYY-MM-DD) |
| 餐次 | 否 | 早餐/午餐/午点/晚餐 |
| 菜品名称 | 是 | 菜名 |
| 食材 | 否 | 食材列表 |
| 过敏原提示 | 否 | 该菜品含有的过敏原 |
| 备注 | 否 | 其他说明 |

### 食材批次 CSV 格式

| 列名 | 必填 | 说明 |
|------|------|------|
| 食材名称 | 是 | 食材名称 |
| 批次号 | 是 | 唯一批次号 |
| 供应商 | 否 | 供应商名称 |
| 生产日期 | 否 | YYYY-MM-DD |
| 有效期至 | 否 | YYYY-MM-DD |
| 过敏原 | 否 | 该食材含有的过敏原 |
| 配料表 | 否 | 详细配料 |

---

## 常见问题

### Q: 数据存储在哪里？

数据存储在当前目录下的 `allergen_checker.db` SQLite 文件中。重启服务后数据不会丢失。

### Q: 如何备份数据？

直接复制 `allergen_checker.db` 文件即可。

### Q: 如何重置数据？

删除 `allergen_checker.db` 文件，重启服务会自动创建新的空数据库。

### Q: 支持哪些日期格式？

导入时支持以下日期格式：
- YYYY-MM-DD (推荐)
- YYYY/MM/DD
- MM/DD/YYYY
- DD/MM/YYYY

### Q: 支持哪些编码格式？

CSV 导入自动支持 UTF-8 和 GBK 编码。

---

## License

MIT License

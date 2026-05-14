# 原料替代审批 API

> 解决原料缺货后临时替代带来的配方、质检、成本核算同步混乱问题

---

## 一、快速启动（3步搞定）

### 1. 安装依赖

```bash
# 进入项目目录
cd /Users/lzy/pro/solo/workspaces/zy70043

# 安装依赖
pip install -e .
```

### 2. 启动服务

```bash
# 方式1：直接运行
python -m app.main

# 方式2：使用 uvicorn
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

启动后访问：
- 接口文档（Swagger UI）: http://localhost:8000/docs
- 接口文档（ReDoc）: http://localhost:8000/redoc

### 3. 初始化测试数据

```bash
# 方式1：命令行（推荐，有业务友好输出）
python -m cli.main init

# 方式2：API 调用
curl -X POST http://localhost:8000/api/seed
```

初始化后会创建：
- **10种原料**（含缺货原料：大豆油A、黄油）
- **3个标准配方**（经典面包、松饼、蛋糕胚）
- **4条质检约束**（替代类别匹配规则）
- **3项系统配置**（成本阈值等）

---

## 二、核心业务流程

### 2.1 正常替代流程（7步）

**场景**: 大豆油A（RM-001）缺货，用大豆油B（RM-002）临时替代

#### 方式A：用命令行（推荐，业务语言输出）

```bash
# 步骤1：创建替代申请
python -m cli.main create \
  --original RM-001 \
  --substitute RM-002 \
  --reason "供应商断货，预计7天后恢复" \
  --creator "采购员-张三"

# ✅ 成功：替代申请已创建，申请单号：SUB-20260509...
# 📝 申请单号：SUB-20260509123000-ABCD
# 📊 受影响配方数：2
#    - F-002: 松饼配方 (用量: 50kg)
#    - F-003: 蛋糕胚配方 (用量: 40kg)
# ⚠️  警告信息：
#    质检校验通过：质检类别校验通过
#    成本警告：差异率 10.4% 超出阈值 10%，需额外审批
```

```bash
# 步骤2：提交审批
python -m cli.main submit \
  --request-no SUB-20260509123000-ABCD \
  --submitter "采购员-张三"

# ✅ 成功：申请已提交，进入 质检复核 流程
# 📌 当前状态：质检复核
# 👤 下一审批人：质检专员
```

```bash
# 步骤3：质检审批（成本超阈值，所以需要质检先审）
python -m cli.main approve \
  --request-no SUB-20260509123000-ABCD \
  --approver "质检-李四" \
  --level qc \
  --result pass \
  --comment "大豆油B规格符合要求，不影响产品品质"

# ✅ 成功：质检审批通过：质检-李四。进入下一审批环节：成本复核
```

```bash
# 步骤4：成本审批
python -m cli.main approve \
  --request-no SUB-20260509123000-ABCD \
  --approver "成本-王五" \
  --level cost \
  --result pass \
  --comment "成本上升10.4%，在可接受范围内"

# ✅ 成功：成本审批通过：成本-王五。进入下一审批环节：最终审批
```

```bash
# 步骤5：最终审批
python -m cli.main approve \
  --request-no SUB-20260509123000-ABCD \
  --approver "经理-赵六" \
  --level final \
  --result pass \
  --comment "同意执行"

# ✅ 成功：最终审批通过：经理-赵六。审批完成，可执行配方更新
```

```bash
# 步骤6：执行配方更新（生成新版本并生效）
python -m cli.main execute \
  --request-no SUB-20260509123000-ABCD \
  --operator "工程师-钱七"

# ✅ 成功：执行完成，共更新 2 个配方，所有配方版本已生效
# 📋 执行详情：
#    ✅ F-002 - 松饼配方: 成功 (新版本: v2)
#    ✅ F-003 - 蛋糕胚配方: 成功 (新版本: v2)
```

```bash
# 步骤7：查看完整详情和追溯
python -m cli.main detail --request-no SUB-20260509123000-ABCD

# 📋 基本信息
#    申请单号: SUB-20260509123000-ABCD
#    当前状态: 已完成
#    ...
# 💰 成本核算
#    原成本: 1125.0 元
#    替代后成本: 1242.0 元
#    成本差额: 117.0 元
#    差异率: 10.4%
#    超出阈值: 是
# 📦 受影响配方 (2 个)
#    F-002 - 松饼配方: 用量 50kg, ✅ 已更新
#    F-003 - 蛋糕胚配方: 用量 40kg, ✅ 已更新
# 📝 审批记录
#    [时间] 质检审批 - 质检-李四: 通过
#    [时间] 成本审批 - 成本-王五: 通过
#    [时间] 最终审批 - 经理-赵六: 通过
# 📊 执行追溯
#    [时间] ✅ 更新配方：F-002
#    [时间] ✅ 更新配方：F-003
```

#### 方式B：用 API 调用

```bash
# 步骤1：创建申请
curl -X POST http://localhost:8000/api/substitutions \
  -H "Content-Type: application/json" \
  -d '{
    "original_code": "RM-001",
    "substitute_code": "RM-002",
    "reason": "供应商断货",
    "created_by": "张三"
  }'

# 步骤2-5：审批（类似上面，改接口）
# POST /api/substitutions/submit
# POST /api/substitutions/approve

# 步骤6：执行
curl -X POST http://localhost:8000/api/substitutions/execute \
  -H "Content-Type: application/json" \
  -d '{
    "request_no": "SUB-XXXX",
    "operator": "工程师"
  }'
```

---

### 2.2 失败补偿流程（重点）

**场景**: 执行配方更新时部分失败，不用清库重来，可直接重试

```bash
# 步骤1：快速走完审批（用演示命令更快捷）
# 或者手动创建 → 提交 → 审批

# 步骤2：执行时模拟失败（第1个配方索引=0）
python -m cli.main execute \
  --request-no SUB-XXXX \
  --operator "工程师" \
  --simulate-failure 0

# ❌ 部分成功：1 个完成，1 个失败，可再次执行补偿失败的配方
# 📋 执行详情：
#    ❌ F-001 - 经典面包配方: 失败 - 模拟执行失败：配方版本锁冲突
#    ✅ F-002 - 松饼配方: 成功 (新版本: v2)
```

```bash
# 步骤3：重试（无需清库，自动只处理失败的）
python -m cli.main retry \
  --request-no SUB-XXXX \
  --operator "工程师"

# ✅ 成功：执行完成，共更新 1 个配方，所有配方版本已生效
# 📋 执行详情：
#    ✅ F-001 - 经典面包配方: 成功 (新版本: v2)
```

```bash
# 查看追溯日志，能看到所有执行历史
python -m cli.main detail --request-no SUB-XXXX

# 📊 执行追溯 (3 条记录):
#    [时间] ❌ 更新配方：F-001
#    [时间] ✅ 更新配方：F-002
#    [时间] ✅ 更新配方：F-001   （重试成功）
```

---

### 2.3 审批冻结流程

**场景**: 审批通过后、执行前发现问题，需要紧急暂停

```bash
# 步骤1：假设已审批到"已通过"状态
# ...（创建 → 提交 → 三级审批）

# 步骤2：执行前发现问题，冻结
python -m cli.main freeze \
  --request-no SUB-XXXX \
  --operator "风控专员" \
  --reason "供应商资质重新审核中，暂停执行"

# ✅ 成功：申请已被 风控专员 冻结，原因：供应商资质重新审核中
```

```bash
# 步骤3：尝试执行，会被拒绝
python -m cli.main execute \
  --request-no SUB-XXXX \
  --operator "工程师"

# ❌ 失败：当前状态[已冻结]不允许执行
```

```bash
# 步骤4：问题解决后解冻
python -m cli.main unfreeze \
  --request-no SUB-XXXX \
  --operator "风控专员"

# ✅ 成功：申请已由 风控专员 解冻，恢复到已通过状态
```

```bash
# 步骤5：正常执行
python -m cli.main execute \
  --request-no SUB-XXXX \
  --operator "工程师"
```

---

## 三、一键演示（不用手打上面的命令）

项目提供3个完整演示，直接运行即可：

```bash
# 演示1：正常流程（大豆油A → 大豆油B）
python -m cli.main demo-normal

# 演示2：失败补偿流程（模拟失败 → 重试成功）
python -m cli.main demo-fail-retry

# 演示3：审批冻结流程（冻结 → 拒绝执行 → 解冻 → 执行）
python -m cli.main demo-freeze
```

---

## 四、导出业务复核单

导出的 CSV 文件可直接用 Excel 打开，用于业务复核，不是调试日志。

```bash
# 导出单个申请的完整复核单（含成本、配方、审批、追溯）
python -m cli.main export --type substitution --request-no SUB-XXXX

# ✅ 导出成功: exports/替代申请复核_SUB-XXXX_20260509_123000.csv
# 💡 提示: 此文件可直接用 Excel 打开查看
```

复核单内容包括：
1. **申请基本信息** - 单号、状态、时间
2. **原料替代信息** - 原原料、替代原料、比例、原因
3. **成本核算对比** - 原成本、替代后成本、差额、差异率、是否超阈值
4. **受影响配方列表** - 配方编码/名称、原用量、处理状态、新版本号
5. **审批记录** - 每级审批人、结果、意见
6. **执行追溯日志** - 每步执行的时间、结果、错误信息
7. **导出说明** - 给业务人员看的提示

```bash
# 导出配方版本历史（用于审计配方变更）
python -m cli.main export --type formula --formula-code F-001

# 导出所有申请汇总表
python -m cli.main export --type summary
```

---

## 五、常用查询命令

```bash
# 查看所有原料（含缺货状态）
curl http://localhost:8000/api/materials
# 或
python -c "from app.database import db_session, init_db; from app.models import RawMaterial; init_db(); 
with db_session() as db:
    mats = db.query(RawMaterial).all();
    for m in mats:
        status = '缺货' if m.stock_quantity <= 0 else '正常'
        print(f'{m.code} - {m.name}: {status}, 库存 {m.stock_quantity}, 单价 {m.unit_price}')"

# 查看所有配方
curl http://localhost:8000/api/formulas

# 查看质检约束规则
curl http://localhost:8000/api/qc-constraints

# 查看申请列表（可按状态过滤）
python -m cli.main list
python -m cli.main list --status 已完成
python -m cli.main list --status 执行失败

# 查看单个申请详情
python -m cli.main detail --request-no SUB-XXXX
```

---

## 六、触发异常的方法

测试异常场景时可以用以下方式：

### 6.1 质检约束不通过

```bash
# 大豆油A（食用油）尝试用面粉Y（谷物）替代
python -m cli.main create \
  --original RM-001 \
  --substitute RM-004 \
  --reason "测试质检约束" \
  --creator "测试员"

# 会显示警告：质检警告：质检约束不通过：替代原料类别[谷物]不在允许列表['食用油']
```

### 6.2 状态转换错误

```bash
# 对"草稿"状态直接执行审批
python -m cli.main approve --request-no SUB-XXXX --approver "测试" --level qc --result pass

# ❌ 失败：当前状态[草稿]不适合进行质检审批
```

### 6.3 模拟执行失败（用于测试重试）

```bash
# 执行时指定 simulate_failure 参数
python -m cli.main execute --request-no SUB-XXXX --operator 工程师 --simulate-failure 0

# 第1个配方会失败，其他成功
```

### 6.4 执行冻结的申请

```bash
# 先冻结
python -m cli.main freeze --request-no SUB-XXXX --operator 测试 --reason "测试"

# 再执行
python -m cli.main execute --request-no SUB-XXXX --operator 工程师

# ❌ 失败：当前状态[已冻结]不允许执行
```

---

## 七、核心概念说明

### 7.1 状态流转图

```
草稿 → 提交 → [质检复核] → [成本复核] → [最终审批] → 已通过
                                                    ↓
                                              （可冻结/解冻）
                                                    ↓
                                                 执行中
                                              ↙        ↘
                                       部分成功       执行失败
                                              ↘        ↙
                                                （可重试）
                                                    ↓
                                                 已完成
```

### 7.2 成本阈值规则

- 默认阈值：**10%**（可通过环境变量 `APPROVAL_THRESHOLD=0.15` 修改）
- 成本差异率 `≤ 10%`：只需成本审批
- 成本差异率 `> 10%`：需质检 + 成本 + 最终，三级审批

### 7.3 配方版本管理

- 每次替代执行成功后，自动创建新版本号（v1 → v2 → v3...）
- 新版本自动生效，旧版本自动失效（记录失效时间）
- 所有版本永久保留，可追溯、可导出

---

## 八、环境变量配置

```bash
# 数据库路径
export SUBSTITUTION_DB_PATH="substitution.db"

# API 服务地址
export API_HOST="0.0.0.0"
export API_PORT="8000"

# 成本审批阈值（小数，0.1 = 10%）
export APPROVAL_THRESHOLD="0.1"

# 最大重试次数
export MAX_RETRY_TIMES="3"

# 导出文件目录
export EXPORT_DIR="exports"
```

---

## 九、项目结构

```
zy70043/
├── app/
│   ├── __init__.py
│   ├── config.py          # 配置项
│   ├── models.py          # 数据模型（10张表）
│   ├── database.py        # 数据库连接
│   ├── seeds.py           # 种子数据
│   ├── services.py        # 核心业务逻辑
│   ├── export_service.py  # CSV 导出
│   ├── schemas.py         # API 请求/响应模型
│   └── main.py            # FastAPI 应用入口
├── cli/
│   ├── __init__.py
│   └── main.py            # 命令行工具 + 3个演示
├── exports/               # 导出文件目录（运行时创建）
├── substitution.db        # SQLite 数据库（运行时创建）
├── pyproject.toml         # 项目配置
└── README.md              # 本文件
```

---

## 十、接口总览

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/seed` | POST | 初始化种子数据 |
| `/api/materials` | GET | 查看所有原料 |
| `/api/formulas` | GET | 查看所有配方 |
| `/api/qc-constraints` | GET | 查看质检约束 |
| `/api/substitutions` | POST | 创建替代申请 |
| `/api/substitutions/submit` | POST | 提交审批 |
| `/api/substitutions/approve` | POST | 执行审批 |
| `/api/substitutions/freeze` | POST | 冻结申请 |
| `/api/substitutions/unfreeze` | POST | 解冻申请 |
| `/api/substitutions/execute` | POST | 执行配方更新 |
| `/api/substitutions/retry` | POST | 重试失败执行 |
| `/api/substitutions` | GET | 查看申请列表 |
| `/api/substitutions/{no}` | GET | 查看申请详情 |
| `/api/exports/substitution/{no}` | GET | 导出申请复核单 |
| `/api/exports/formula/{code}` | GET | 导出配方历史 |
| `/api/exports/summary` | GET | 导出申请汇总 |

---

## 十一、常见问题

### Q: 提示 `python: command not found` 怎么办？
A: 不同环境 Python 命令名可能不同，尝试：
```bash
which python3    # 查看 python3 路径
which python3.13 # 查看 python3.13 路径
```
本文档所有示例使用 `python3`，你可以替换成你环境中实际可用的命令。

### Q: 提示 `ModuleNotFoundError: No module named 'sqlalchemy'` / 'fastapi' 怎么办？
A: 说明依赖没安装成功，确保在项目目录下执行：
```bash
cd /Users/lzy/pro/solo/workspaces/zy70043
python3 -m pip install -e .
```

### Q: 执行失败后为什么不用清库？
A: 系统记录了每个配方的处理状态（pending/success/failed），重试时只处理 `pending` 或 `failed` 的。

### Q: 怎么看成本是增加还是减少？
A: 成本差额正数表示替代后成本更高，负数表示更省钱。导出的复核单里有说明。

### Q: 临时替代和永久替代有区别吗？
A: 目前逻辑相同，但状态字段已保留，后续可扩展自动恢复逻辑。

### Q: 能模拟真实业务场景吗？
A: 种子数据已预设多个测试场景：

| 原原料 | 替代原料 | 成本差异率 | 审批级别 | 演示命令 |
|--------|----------|-----------|---------|---------|
| 面粉X (RM-003) | 面粉Y (RM-004) | **9.375%** | 只需成本审批 | `demo-low-cost` |
| 大豆油A (RM-001) | 大豆油B (RM-002) | **10.4%** | 三级审批 | `demo-normal` |
| 黄油 (RM-008) | 人造黄油 (RM-009) | **-33.33%** | 三级审批 | `demo-fail-retry` |

> **关键**：面粉X → 面粉Y 是专门为验证"低成本差异只需成本审批"流程而设计的（差异率在阈值内）。

---

## 十二、故障排查

### 问题1：低成本差异的申请提交后，成本审批失败

**错误信息**：`当前状态[待审批]不适合进行成本审批`

**原因**：旧版本的状态流转 bug，低成本差异的申请提交后错误地进入"待审批"状态，但成本审批接口要求"成本复核"状态。

**修复**：已在 `app/services.py` 中修复。现在：
- 高成本差异（>10%）：提交 → 质检复核
- 低成本差异（≤10%）：提交 → 成本复核 ✅

### 问题2：`pip install -e .` 失败

**可能原因**：
1. 不在项目目录下执行
2. Python 版本太旧（需要 ≥3.8）

**解决**：
```bash
cd /Users/lzy/pro/solo/workspaces/zy70043
python3 --version  # 确认版本
python3 -m pip install -e .
```

### 问题3：运行演示时数据混乱

**解决**：每次演示前清空数据库：
```bash
rm -f substitution.db
python3 -m cli.main demo-low-cost
```

---

**开始使用吧！建议先跑 `python3 -m cli.main demo-low-cost` 看低成本差异审批流程。**

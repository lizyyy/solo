# 酒庄橡木桶添酒 API

基于 FastAPI + SQLite 的轻量级橡木桶添酒管理系统，解决批次错配、检验未过入桶、重复记录等问题。

## 核心特性

- ✅ **批次校验** - 自动校验橡木桶内酒液批次与添酒批次一致性
- 🚦 **状态机管理** - 严格的添酒流程状态转换控制
- 🛡️ **检验拦截** - 检验未通过无法放行入桶
- 📊 **桶位追踪** - 实时追踪桶内酒量和批次剩余量
- 🔄 **去重机制** - 同一份材料补交只显示一条有效结果
- 📋 **报告导出** - 支持按条件导出 CSV 格式报告

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn main:app --reload
```

服务启动后访问:
- API 文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/health

### 3. 导入测试数据

```bash
python seed_data.py
```

### 4. 运行自检

```bash
pip install requests
python self_test.py
```

## API 使用示例 (curl)

### 基础数据管理

**创建橡木桶**
```bash
curl -X POST "http://localhost:8000/barrels/" \
  -H "Content-Type: application/json" \
  -d '{
    "barrel_code": "BARREL-005",
    "location": "C区-01排",
    "capacity": 225.0,
    "current_volume": 0.0
  }'
```

**创建酒液批次**
```bash
curl -X POST "http://localhost:8000/batches/" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_code": "PIN-2024-001",
    "wine_type": "黑皮诺",
    "vintage": 2024,
    "initial_volume": 2000.0,
    "remaining_volume": 2000.0
  }'
```

**关联桶与批次**
```bash
curl -X POST "http://localhost:8000/batch-records/?barrel_code=BARREL-005&batch_code=PIN-2024-001&fill_date=2024-05-01T00:00:00&initial_volume=200.0"
```

### 添酒管理

**1. 登记添酒记录**
```bash
curl -X POST "http://localhost:8000/toppings/" \
  -H "Content-Type: application/json" \
  -d '{
    "barrel_code": "BARREL-001",
    "source_batch_code": "CAB-2023-001",
    "evaporation_volume": 3.2,
    "topping_volume": 3.2,
    "topping_date": "2024-05-20T10:00:00",
    "operator": "张酿酒师",
    "notes": "每周例行添酒"
  }'
```

**2. 提交检验结果**
```bash
curl -X POST "http://localhost:8000/toppings/TOP-SEED-003/inspect" \
  -H "Content-Type: application/json" \
  -d '{
    "topping_record_code": "TOP-SEED-003",
    "inspector": "王检验员",
    "inspection_date": "2024-05-20T14:00:00",
    "appearance": "清澈，宝石红色",
    "aroma": "红莓、香料香气",
    "taste": "口感柔和，平衡良好",
    "overall_score": 82.5,
    "passed": true,
    "comments": "品质合格，可以入桶"
  }'
```

**3. 放行添酒**
```bash
curl -X POST "http://localhost:8000/toppings/TOP-SEED-002/approve"
```

**4. 拒绝添酒**
```bash
curl -X POST "http://localhost:8000/toppings/TOP-SEED-003/reject?reason=品质不达标"
```

**5. 补录记录**
```bash
curl -X POST "http://localhost:8000/toppings/TOP-SEED-003/resubmit" \
  -H "Content-Type: application/json" \
  -d '{
    "barrel_code": "BARREL-003",
    "source_batch_code": "MER-2023-001",
    "evaporation_volume": 3.0,
    "topping_volume": 3.0,
    "topping_date": "2024-05-20T10:00:00",
    "operator": "李酿酒师",
    "notes": "修正蒸发量数据"
  }'
```

**6. 关闭记录**
```bash
curl -X POST "http://localhost:8000/toppings/TOP-SEED-001/close"
```

### 查询与导出

**查询添酒记录**
```bash
curl "http://localhost:8000/toppings/?barrel_code=BARREL-001&only_valid=true"
```

**导出 CSV 报告**
```bash
curl -o report.csv "http://localhost:8000/toppings/export/csv?start_date=2024-01-01T00:00:00"
```

**生成窖藏报告**
```bash
curl -X POST "http://localhost:8000/reports/" \
  -H "Content-Type: application/json" \
  -d '{
    "report_type": "weekly",
    "start_date": "2024-05-01T00:00:00",
    "end_date": "2024-05-31T23:59:59",
    "generated_by": "窖藏主管"
  }'
```

## 失败路径演示

### 场景 1: 批次错配被拦截

**问题**: 橡木桶 BARREL-001 内是赤霞珠批次，尝试用梅洛批次添酒

```bash
curl -X POST "http://localhost:8000/toppings/" \
  -H "Content-Type: application/json" \
  -d '{
    "barrel_code": "BARREL-001",
    "source_batch_code": "MER-2023-001",
    "evaporation_volume": 3.0,
    "topping_volume": 3.0,
    "topping_date": "2024-05-20T10:00:00",
    "operator": "测试操作员",
    "notes": "测试批次错配"
  }'
```

**预期结果**:
```json
{
  "success": false,
  "message": "添酒批次不匹配：桶内批次 ID 1，添酒批次 ID 2",
  "data": {
    "record_code": "TOP-XXXXXXX",
    "status": "blocked"
  }
}
```

**状态说明**: 记录被标记为 `blocked` 状态，无法继续流程

### 场景 2: 检验未过无法放行

**问题**: 添酒记录检验未通过，尝试直接放行

```bash
curl -X POST "http://localhost:8000/toppings/TOP-SEED-003/approve"
```

**预期结果**:
```json
{
  "success": false,
  "message": "检验未通过，当前状态：pending",
  "data": null
}
```

### 场景 3: 重复提交检测

**问题**: 同一份材料（同桶、同批次、同日期）提交两次

```bash
# 第一次提交
curl -X POST "http://localhost:8000/toppings/" \
  -H "Content-Type: application/json" \
  -d '{
    "barrel_code": "BARREL-001",
    "source_batch_code": "CAB-2023-001",
    "evaporation_volume": 3.0,
    "topping_volume": 3.0,
    "topping_date": "2024-05-21T10:00:00",
    "operator": "张酿酒师"
  }'

# 第二次提交（相同数据）
curl -X POST "http://localhost:8000/toppings/" \
  -H "Content-Type: application/json" \
  -d '{
    "barrel_code": "BARREL-001",
    "source_batch_code": "CAB-2023-001",
    "evaporation_volume": 3.0,
    "topping_volume": 3.0,
    "topping_date": "2024-05-21T10:00:00",
    "operator": "张酿酒师"
  }'
```

**预期结果**: 第二次提交会检测到重复，返回已存在的记录

### 场景 4: 批次酒量不足

**问题**: 添酒量超过批次剩余酒量

```bash
curl -X POST "http://localhost:8000/toppings/" \
  -H "Content-Type: application/json" \
  -d '{
    "barrel_code": "BARREL-001",
    "source_batch_code": "CAB-2023-001",
    "evaporation_volume": 5000.0,
    "topping_volume": 5000.0,
    "topping_date": "2024-05-22T10:00:00",
    "operator": "测试操作员"
  }'
```

**预期结果**:
```json
{
  "success": false,
  "message": "批次剩余酒量不足：需要 5000.0L，剩余 4788.8L",
  "data": null
}
```

### 场景 5: 补录批次错配被拦截

**问题**: 补录时使用错误的酒液批次

```bash
curl -X POST "http://localhost:8000/toppings/TOP-SEED-003/resubmit" \
  -H "Content-Type: application/json" \
  -d '{
    "barrel_code": "BARREL-001",
    "source_batch_code": "MER-2023-001",
    "evaporation_volume": 2.0,
    "topping_volume": 2.0,
    "topping_date": "2024-05-20T10:00:00",
    "operator": "测试补录",
    "notes": "使用错误批次"
  }'
```

**预期结果**:
```json
{
  "success": false,
  "message": "添酒批次不匹配：桶内批次 ID 1，添酒批次 ID 2",
  "data": {
    "record_code": "TOP-XXXXXXX",
    "status": "blocked"
  }
}
```

**重要说明**: 旧记录被标记为无效，新记录为 `blocked` 状态，始终只看到一条可解释的结果

### 场景 6: 补录不存在的桶/批次

**问题**: 补录时使用不存在的橡木桶编号

```bash
curl -X POST "http://localhost:8000/toppings/TOP-SEED-002/resubmit" \
  -H "Content-Type: application/json" \
  -d '{
    "barrel_code": "NONEXISTENT-999",
    "source_batch_code": "CAB-2023-001",
    "evaporation_volume": 2.0,
    "topping_volume": 2.0,
    "topping_date": "2024-05-20T10:00:00",
    "operator": "测试补录"
  }'
```

**预期结果**:
```json
{
  "success": false,
  "message": "橡木桶 NONEXISTENT-999 不存在",
  "data": null
}
```

**数据保证**: 参数错误时旧记录保持有效，不破坏闭环

## 状态机流程

```
pending → inspection_required → approved → completed → closed
   ↓            ↓               ↓
blocked      rejected       closed
               ↓
           pending
```

## 项目结构

```
.
├── main.py              # FastAPI 主应用
├── models.py            # 数据库模型
├── schemas.py           # Pydantic 数据模式
├── crud.py              # 业务逻辑
├── state_machine.py     # 状态机和校验逻辑
├── database.py          # 数据库配置
├── seed_data.py         # 测试数据脚本
├── self_test.py         # 自检脚本
├── requirements.txt     # 依赖列表
└── README.md           # 本文档
```

## 数据库表说明

- **oak_barrels**: 橡木桶信息（编号、位置、容量、当前酒量）
- **wine_batches**: 酒液批次（编号、类型、年份、剩余量）
- **batch_records**: 桶批次关联记录
- **topping_records**: 添酒记录（状态、版本、有效性标记）
- **inspection_results**: 检验结果（外观、香气、口感、评分）
- **cellar_reports**: 窖藏统计报告

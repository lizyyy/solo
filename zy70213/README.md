# 动物园饲料日配系统 API

## 系统概述

动物园饲料日配系统是一个自动化的饲料管理系统，解决传统人工表格容易漏改、难以追溯的问题。

### 核心价值
- **自动化配方匹配**：根据动物品种和季节自动选择合适的饲料配方
- **智能健康修正**：根据动物健康状态自动调整饲料配比
- **多层验证机制**：动物档案、配方可靠性、数据一致性三重验证
- **完整状态流转**：从草稿到执行的完整生命周期管理
- **问题可追溯**：明确的失败原因和人工处理指引

## 快速开始

### 安装依赖
```bash
pip install -r requirements.txt
```

### 运行服务
```bash
python main.py
```
服务将在 http://localhost:8000 启动

### 查看 API 文档
访问 http://localhost:8000/docs

### 运行验收测试
```bash
python test_ration_system.py
```

### 运行 API 客户端
```bash
python api_client.py
```

## 核心模型

### 1. 动物档案 (Animal)
- **name**: 动物名称
- **species**: 品种
- **weight_kg**: 体重（用于计算饲料量）
- **health_status**: 健康状态
  - `healthy`: 健康
  - `mild`: 轻度不适
  - `moderate`: 中度不适
  - `severe`: 严重不适
  - `critical`: 危重
- **status**: 档案状态
  - `active`: 活跃（需要日配）
  - `inactive`: 非活跃
  - `pending`: 待审核
  - `suspended`: 暂停
- **area**: 活动区域
- **last_checkup_date**: 最近体检日期

### 2. 饲料配方 (FeedFormula)
- **species + season**: 唯一标识（品种+季节组合）
- **base_ratio_per_100kg**: 每100kg体重的基础倍数
- **ingredients**: 饲料成分列表
- **is_active**: 是否激活

### 3. 健康修正规则 (HealthCorrectionRule)
- **health_status**: 适用的健康状态
- **ratio_multiplier**: 饲料比例倍数
- **add_ingredients**: 额外添加的饲料
- **remove_feeds**: 需要移除的饲料
- **priority**: 优先级

### 4. 日配计划 (DailyRation)
- **ration_date**: 日配日期
- **status**: 状态（见状态流转）
- **items**: 饲料分配明细
- **original_data_hash**: 原始数据哈希（用于一致性验证）
- **verification_messages**: 验证通过信息
- **warnings**: 警告信息
- **errors**: 错误信息

### 5. 库存 (FeedInventory)
- **feed_name**: 饲料名称
- **current_qty_kg**: 当前库存
- **min_threshold_kg**: 安全阈值

## 状态流转

```
DRAFT (草稿)
    │
    ▼
VALIDATING (验证中)
    │
    ├── 成功 ──► PENDING (待确认)
    │              │
    │              ├── 确认 ──► CONFIRMED (已确认)
    │              │              │
    │              │              ├── 执行 ──► EXECUTED (已执行) ✓
    │              │              │
    │              │              └── 取消 ──► CANCELLED (已取消)
    │              │
    │              └── 修正 ──► DRAFT (回到草稿)
    │
    └── 失败 ──► FAILED (失败)
                   │
                   ├── 重跑 ──► DRAFT (重新生成)
                   │
                   └── 直接验证 ──► VALIDATING (重新验证)
```

## 验证流程

### 阶段1: 动物档案验证
**检查项**:
- 档案状态是否为 `active`
- 体重数据是否合理（> 0）
- 活动区域是否设置
- 体检日期是否近期

**通过标志**: `success: true`

**失败处理**:
- 错误码: `ANIMAL_PROFILE_INVALID`
- 需人工处理: ✅ 是
- 操作建议: 检查动物状态、更新体重、补充缺失信息

### 阶段2: 饲料配方验证
**检查项**:
- 是否已配置对应品种+季节的配方
- 配方是否激活
- 基础比例是否合理
- 是否包含饲料成分

**通过标志**: `success: true`

**失败处理**:
- 错误码: `FEED_FORMULA_MISSING`
- 需人工处理: ✅ 是
- 操作建议: 配置或激活对应季节的饲料配方

### 阶段3: 库存验证
**检查项**:
- 库存是否足够满足日配需求

**通过标志**: `success: true`

**警告（非失败）**:
- 库存低于安全阈值

**失败处理**:
- 错误码: `INVENTORY_INSUFFICIENT`
- 需人工处理: ✅ 是
- 操作建议: 补充库存或调整配方

### 阶段4: 数据一致性验证
**检查项**:
- 日配计划的原始数据哈希与当前计算值是否一致
- 防止数据被篡改或漏改

**通过标志**: `success: true`

**失败处理**:
- 错误码: `DATA_CONSISTENCY_VIOLATION`
- 需人工处理: ✅ 是
- 操作建议: 审查数据变更原因，确认是否需要重新生成日配计划

## 验收标准

### ✅ 通过标志
1. **状态流转正确**
   - 完整路径: `DRAFT` → `VALIDATING` → `PENDING` → `CONFIRMED` → `EXECUTED`
   
2. **所有验证阶段通过**
   - `animal_profile: success=true`
   - `feed_formula: success=true`
   - `inventory: success=true`
   - `data_consistency: success=true`

3. **无错误信息**
   - `errors` 列表为空
   - `warnings` 允许存在（非阻塞性提示）

4. **库存正确扣减**
   - 执行后库存减少对应数量
   - 日配计划记录 `actual_quantity_kg`

### ⚠️ 需要人工处理的标志
1. **状态为 FAILED**
   - 查看 `errors` 列表了解失败原因

2. **错误码分类处理**
   | 错误码 | 原因 | 处理建议 |
   |--------|------|----------|
   | `ANIMAL_PROFILE_INVALID` | 动物档案无效 | 更新动物状态/体重 |
   | `FEED_FORMULA_MISSING` | 配方缺失 | 配置对应品种+季节配方 |
   | `INVENTORY_INSUFFICIENT` | 库存不足 | 补充库存 |
   | `DATA_CONSISTENCY_VIOLATION` | 数据不一致 | 审查数据变更，重新生成 |

3. **修正后操作**
   - 调用 `POST /rations/{id}/retry` 重新生成
   - 或修复数据后重新验证

## API 端点

### 动物管理
- `GET /animals` - 动物列表
- `POST /animals` - 创建动物
- `GET /animals/{id}` - 动物详情

### 配方管理
- `GET /formulas` - 配方列表
- `POST /formulas` - 创建配方

### 库存管理
- `GET /inventories` - 库存列表
- `POST /inventories` - 创建/更新库存

### 日配计划管理
- `POST /rations/generate` - 生成日配计划
- `POST /rations/{id}/validate` - 验证日配计划
- `POST /rations/{id}/confirm` - 确认日配计划
- `POST /rations/{id}/execute` - 执行日配计划
- `POST /rations/{id}/retry` - 重跑失败的日配计划
- `GET /rations/{id}` - 获取日配详情
- `GET /rations/date/{date}` - 按日期查询
- `GET /rations/{id}/verifications` - 获取验证详情

### 健康修正规则
- `POST /correction-rules` - 创建健康修正规则

## 错误响应格式

```json
{
  "success": false,
  "error": {
    "code": "ANIMAL_PROFILE_INVALID",
    "message": "动物档案验证失败，请检查动物状态和数据",
    "details": {
      "animal_id": "xxxx-xxxx-xxxx",
      "verification": {
        "success": false,
        "stage": "animal_profile",
        "messages": [],
        "warnings": [],
        "errors": ["动物档案状态无效: suspended"]
      }
    },
    "need_manual_handling": true
  }
}
```

## 项目结构

```
zoo-ration-system/
├── app/
│   ├── __init__.py          # 模块导出
│   ├── config.py            # 配置
│   ├── enums.py             # 枚举定义
│   ├── models.py            # 数据模型
│   ├── store.py             # 数据存储（内存）
│   ├── services.py          # 业务服务（计算、验证）
│   ├── errors.py            # 业务错误
│   ├── orchestrator.py      # 流程编排
│   └── api.py               # FastAPI 路由
├── main.py                  # 入口文件
├── requirements.txt         # 依赖
├── test_ration_system.py    # 验收测试脚本
└── api_client.py            # API 调用脚本
```

## 测试场景说明

### 场景1: 正常处理
```
流程: 创建动物 → 生成日配 → 验证 → 确认 → 执行 → 一致性验证
预期: 所有阶段通过，状态流转正确，库存扣减
通过标志: status=EXECUTED, errors=[], 验证全部 success=true
```

### 场景2: 失败场景
```
案例1: 动物状态非活跃 → 失败，需激活动物
案例2: 配方缺失 → 失败，需配置配方
案例3: 库存不足 → 验证失败，需补充库存
案例4: 数据一致性 → 验证失败，需审查数据
```

### 场景3: 修正后重跑
```
流程: 制造失败 → 修复问题 → 重试 → 重新验证 → 通过
预期: 修复后验证通过，可以正常执行
通过标志: 重试后状态流转正常
```

## 题目边界

本系统通过以下三个维度拉开题目边界：

1. **动物饲料配方**
   - 按品种+季节的精细化配方管理
   - 基础比例按体重动态计算
   - 配方激活/停用机制

2. **健康修正**
   - 5级健康状态分类
   - 比例调整、添加营养、移除成分三种修正方式
   - 规则优先级支持

3. **日配库存**
   - 生成时检查库存
   - 执行时扣减库存
   - 安全阈值预警

## 运行说明

1. **启动服务**
   ```bash
   python main.py
   ```

2. **运行自动验收测试**
   ```bash
   python test_ration_system.py
   ```
   此脚本会演示三种验收场景，并输出通过/失败结果

3. **使用 API 交互式测试**
   ```bash
   python api_client.py
   ```
   确保服务已启动后运行

4. **查看 API 文档**
   - Swagger UI: http://localhost:8000/docs
   - ReDoc: http://localhost:8000/redoc

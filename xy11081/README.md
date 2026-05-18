# 维修备件小库备件安全库存 API

基于 Node.js + Express + SQLite 的维修备件安全库存管理系统，支持单条人工录入和批量补录，提供采购建议和库存预测。

## 功能特性

### 1. 库存管理
- 单条备件的增删改查
- 按备件编码查询
- 分类筛选和低库存筛选
- 分页查询

### 2. 批量处理
- 批量导入备件数据
- 支持三种更新模式：
  - `skip`: 跳过已存在的记录
  - `overwrite`: 覆盖已存在的记录
  - `merge`: 合并更新

### 3. 采购建议和库存预测
- 自动计算可用库存（当前库存 + 在途数量）
- 检测库存重复计算风险
- 预测缺货天数
- 智能计算建议采购数量
- 明确提示下一步该补什么材料

### 4. 导出功能
- 导出 JSON 和 CSV 格式
- 保留关键业务列，便于台账核对
- 包含所有必要字段用于月底核对

### 5. 完善的错误处理
- 中文错误提示，避免简单的 500 错误
- 参数验证详细错误信息
- 数据库操作错误处理

## 安装和运行

### 1. 安装依赖
```bash
npm install
```

### 2. 初始化数据库（创建表和样例数据）
```bash
npm run init-db
```

### 3. 启动服务器
```bash
npm start
```

开发模式（自动重启）：
```bash
npm run dev
```

服务器默认运行在 http://localhost:3000

## API 接口文档

### 基础信息
- 基础路径: `http://localhost:3000/api/spare-parts`
- Content-Type: `application/json`

### 1. 获取所有备件列表
```
GET /api/spare-parts
```

查询参数：
- `category`: 按备件类别筛选
- `low_stock`: 设置为 `true` 只显示低于安全库存的备件
- `page`: 页码，默认 1
- `limit`: 每页数量，默认 50

响应示例：
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "part_code": "BJ-001",
      "part_name": "轴承",
      "part_spec": "6205-2RS",
      "part_category": "传动部件",
      "unit": "个",
      "safe_stock_quantity": 50,
      "current_stock": 25,
      "in_transit_quantity": 0,
      "available_stock": 25,
      "is_under_safe_stock": true,
      "has_duplicate_risk": false
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 5,
    "total_pages": 1
  }
}
```

### 2. 获取单个备件（按ID）
```
GET /api/spare-parts/:id
```

### 3. 获取单个备件（按编码）
```
GET /api/spare-parts/code/:part_code
```

### 4. 创建备件（单条人工录入）
```
POST /api/spare-parts
```

请求体示例：
```json
{
  "part_code": "XJ-001",
  "part_name": "密封圈",
  "part_spec": "φ50×φ40×8",
  "part_category": "密封件",
  "unit": "个",
  "safe_stock_quantity": 100,
  "current_stock": 45,
  "in_transit_quantity": 0,
  "min_order_quantity": 20,
  "supplier_name": "密封件有限公司",
  "supplier_contact": "王经理 13800138000",
  "average_daily_consumption": 5,
  "lead_time_days": 7,
  "location": "A区-02-01",
  "remarks": "常用易损件"
}
```

### 5. 更新备件
```
PUT /api/spare-parts/:id
```
请求体同创建接口。

### 6. 删除备件
```
DELETE /api/spare-parts/:id
```

### 7. 批量补录
```
POST /api/spare-parts/batch-import
```

请求体示例：
```json
{
  "items": [
    {
      "part_code": "PL-001",
      "part_name": "皮带",
      "part_spec": "B-2000",
      "part_category": "传动部件",
      "unit": "条",
      "safe_stock_quantity": 20,
      "current_stock": 15,
      "in_transit_quantity": 0,
      "min_order_quantity": 10
    },
    {
      "part_code": "DQ-002",
      "part_name": "交流电机",
      "part_spec": "Y100L1-4 2.2KW",
      "part_category": "电气部件",
      "unit": "台",
      "safe_stock_quantity": 3,
      "current_stock": 1,
      "in_transit_quantity": 2
    }
  ],
  "update_mode": "overwrite"
}
```

响应示例：
```json
{
  "success": true,
  "message": "批量导入完成：成功1条，更新1条，跳过0条，失败0条",
  "results": {
    "success": [
      { "index": 0, "part_code": "PL-001", "id": 6 }
    ],
    "updated": [
      { "index": 1, "part_code": "DQ-002", "id": 2 }
    ],
    "skipped": [],
    "failed": []
  }
}
```

### 8. 获取采购建议
```
GET /api/spare-parts/purchase-suggestions
```

查询参数：
- `include_risk_check`: 是否包含重复计算风险检查，默认 true

响应示例：
```json
{
  "success": true,
  "summary": {
    "total_parts": 5,
    "need_purchase": 2,
    "has_warnings": 1
  },
  "warnings": [
    {
      "part_code": "MF-004",
      "part_name": "密封垫圈",
      "warning_type": "duplicate_calculation_risk",
      "message": "该备件存在采购在途(50个)与真实库存重复计算风险，请核实在途状态",
      "current_stock": 120,
      "in_transit": 50,
      "safe_stock": 100
    }
  ],
  "suggestions": [
    {
      "part_code": "KG-005",
      "part_name": "空气滤芯",
      "part_spec": "K3046",
      "part_category": "过滤部件",
      "unit": "个",
      "suggested_quantity": 15,
      "min_order_quantity": 10,
      "reason": "当前库存(5个)低于安全库存(20个)",
      "current_stock": 5,
      "in_transit_quantity": 0,
      "available_stock": 5,
      "safe_stock_quantity": 20,
      "lead_time_days": 10,
      "days_until_stockout": 4,
      "average_daily_consumption": 1.2,
      "supplier_name": "滤清器制造有限公司",
      "supplier_contact": "孙经理 13500135005",
      "next_action": "建议采购 15 个"
    }
  ],
  "next_steps": "请优先采购 空气滤芯、轴承 等材料"
}
```

### 9. 导出数据
```
GET /api/spare-parts/export?format=json
GET /api/spare-parts/export?format=csv
```

导出的关键业务列：
- 备件编码、备件名称、规格型号
- 备件类别、计量单位
- 安全库存、当前库存、在途数量、可用库存
- 是否低于安全库存
- 最小订购量、供应商信息
- 日均消耗量、采购周期
- 存放位置、备注、最后更新时间

## 数据模型字段说明

| 字段名 | 说明 | 必填 |
|--------|------|------|
| part_code | 备件编码 | 是 |
| part_name | 备件名称 | 是 |
| part_spec | 规格型号 | 否 |
| part_category | 备件类别 | 否 |
| unit | 计量单位 | 是 |
| safe_stock_quantity | 安全库存数量 | 是 |
| current_stock | 当前库存数量 | 是 |
| in_transit_quantity | 在途数量 | 否 |
| min_order_quantity | 最小订购量 | 否 |
| supplier_name | 供应商名称 | 否 |
| supplier_contact | 供应商联系方式 | 否 |
| average_daily_consumption | 日均消耗量 | 否 |
| lead_time_days | 采购周期(天) | 否 |
| last_purchase_date | 最后采购日期 | 否 |
| last_consumption_date | 最后消耗日期 | 否 |
| location | 存放位置 | 否 |
| remarks | 备注 | 否 |

## 错误响应示例

```json
{
  "success": false,
  "error": {
    "code": 400,
    "message": "请求参数验证失败",
    "details": [
      {
        "field": "part_code",
        "message": "备件编码不能为空"
      }
    ],
    "timestamp": "2024-01-15T10:30:00.000Z",
    "path": "/api/spare-parts"
  }
}
```

## 项目结构

```
.
├── src/
│   ├── app.js                 # 主应用入口
│   ├── config/
│   │   └── database.js        # 数据库配置
│   ├── controllers/
│   │   └── sparePartsController.js  # 业务逻辑控制器
│   ├── middleware/
│   │   ├── errorHandler.js    # 错误处理中间件
│   │   └── validation.js      # 参数验证中间件
│   ├── routes/
│   │   └── spareParts.js      # 路由定义
│   └── scripts/
│       └── initDB.js          # 数据库初始化脚本
├── data/                      # SQLite 数据库文件目录
├── exports/                   # 导出文件目录
├── package.json
└── README.md
```

## 样例数据

系统初始化时会自动创建5条样例数据，涵盖不同类别的备件，包含真实业务字段，部分数据已预置在途数量以测试重复计算风险检测。

1. 轴承（传动部件）- 库存不足，需要采购
2. 交流电机（电气部件）- 有在途数量，测试重复计算
3. 液压油（油品）- 库存充足
4. 密封垫圈（密封件）- 库存充足但有重复计算风险
5. 空气滤芯（过滤部件）- 即将缺货，急需采购

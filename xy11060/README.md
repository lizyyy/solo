# 蔬菜配送站蔬菜损耗申报 API

## 项目简介

本系统为蔬菜配送站提供标准化的蔬菜损耗申报管理功能，解决了传统临时备注传递导致的争议难以追溯问题。系统支持单条人工处理和批量补录两条入口，提供智能重复扣减检测和一致性校验功能，并能明确告知调用方下一步需要补充的材料。

## 技术栈

- Node.js + Express
- SQLite 数据库
- CSV 批量导入/导出

## 安装部署

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run init-db
```

### 3. 启动服务

```bash
npm start
```

服务默认运行在 `http://localhost:3000`

## API 接口文档

### 基础接口

- **健康检查**: `GET /health`

### 损耗申报接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/loss-reports` | 单条人工申报 |
| POST | `/api/loss-reports/batch` | 批量补录（CSV上传） |
| GET | `/api/loss-reports` | 查询申报列表 |
| GET | `/api/loss-reports/:id` | 查询单条申报详情 |
| PUT | `/api/loss-reports/:id` | 更新申报信息 |
| POST | `/api/loss-reports/:id/audit` | 审核申报 |
| GET | `/api/loss-reports/export` | 导出申报数据 |

## 业务字段说明

系统包含完整的蔬菜损耗申报业务字段：

| 字段名 | 说明 | 必填 |
|--------|------|------|
| station_code | 配送站编码 | 是 |
| station_name | 配送站名称 | 是 |
| report_date | 报损日期 | 是 |
| reporter_code | 上报人编码 | 是 |
| reporter_name | 上报人姓名 | 是 |
| vegetable_code | 蔬菜编码 | 是 |
| vegetable_name | 蔬菜名称 | 是 |
| vegetable_category | 蔬菜品类 | 是 |
| batch_no | 批次号 | 是 |
| delivery_order_no | 配送单号 | - |
| purchase_order_no | 采购单号 | - |
| loss_type | 损耗类型（transport_loss/store_loss） | 是 |
| loss_quantity | 损耗数量 | 是 |
| loss_weight | 损耗重量 | 是 |
| loss_unit | 计量单位 | 是 |
| loss_reason | 损耗原因 | 是 |
| loss_description | 损耗描述 | - |
| discovery_time | 发现时间 | - |
| discovery_location | 发现地点 | - |
| handler_name | 处理人 | - |
| related_docs | 相关单据 | - |

## 智能校验功能

### 1. 重复扣减检测

系统自动检测同一批次蔬菜在3天内是否存在重复报损，避免重复扣减。当检测到可能的重复申报时，接口会返回警告信息。

### 2. 损耗表一致性校验

根据损耗类型（运输损耗/门店报损）自动校验必填材料：

- **运输损耗**: 需要配送单号、发现时间、发现地点、现场照片
- **门店报损**: 需要处理人信息、门店盘点表
- **大额损耗（>100数量或>50公斤）**: 需要主管签字确认单、第三方检测报告

### 3. 下一步材料提示

当校验不通过时，接口会在 `next_step_required` 字段中明确告知需要补充的材料清单。

## 从创建到导出的验收流程

### 验收步骤 1: 创建单条损耗申报

**请求示例:**
```bash
curl -X POST http://localhost:3000/api/loss-reports \
  -H "Content-Type: application/json" \
  -d '{
    "station_code": "BJ001",
    "station_name": "北京朝阳配送站",
    "report_date": "2024-05-18",
    "reporter_code": "R001",
    "reporter_name": "张三",
    "vegetable_code": "V001",
    "vegetable_name": "大白菜",
    "vegetable_category": "叶菜类",
    "batch_no": "B20240518001",
    "delivery_order_no": "D20240518001",
    "purchase_order_no": "P20240518001",
    "loss_type": "transport_loss",
    "loss_quantity": 50,
    "loss_weight": 25.5,
    "loss_unit": "公斤",
    "loss_reason": "运输途中挤压破损",
    "loss_description": "车辆转弯时蔬菜箱倾倒，部分菜叶破损严重",
    "discovery_time": "2024-05-18 08:30:00",
    "discovery_location": "配送站卸货区",
    "handler_name": "李四",
    "related_docs": "运输单T20240518001,照片IMG_001.jpg"
  }'
```

**验收要点:**
- 检查系统是否自动生成报损单号
- 检查校验逻辑是否正确识别需要补充的材料
- 检查 `next_step_required` 字段是否明确提示

---

### 验收步骤 2: 批量补录历史数据

**准备数据:** 使用 `examples/import_template.csv` 作为模板

**请求示例:**
```bash
curl -X POST http://localhost:3000/api/loss-reports/batch \
  -F "file=@examples/import_template.csv"
```

**验收要点:**
- 检查批量导入成功/失败计数是否准确
- 检查失败记录的错误提示是否清晰
- 验证导入数据是否完整保留所有业务字段

---

### 验收步骤 3: 查询与审核

**查询列表:**
```bash
curl "http://localhost:3000/api/loss-reports?station_code=BJ001&status=pending"
```

**审核申报:**
```bash
curl -X POST http://localhost:3000/api/loss-reports/1/audit \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "auditor_code": "A001",
    "auditor_name": "王经理",
    "audit_opinion": "情况属实，同意报损"
  }'
```

**验收要点:**
- 支持按配送站、状态、日期范围、损耗类型筛选
- 审核操作完整记录审核人、审核时间、审核意见
- 状态流转正确（待审核→已通过/已拒绝）

---

### 验收步骤 4: 导出与台账核对

**导出CSV:**
```bash
curl -O -J "http://localhost:3000/api/loss-reports/export?start_date=2024-05-01&end_date=2024-05-31"
```

**导出关键业务列:**
1. 报损单号 - 唯一标识，用于追溯
2. 配送站信息 - 编码+名称，责任明确
3. 蔬菜完整信息 - 编码、名称、品类、批次号，便于溯源
4. 关联单据 - 配送单号、采购单号，可与原始台账匹配
5. 损耗详情 - 类型、数量、重量、原因、描述
6. 时间地点 - 发现时间、发现地点，完整还原场景
7. 处理记录 - 处理人、审核人、审核意见
8. 补充材料提示 - 下一步需补充材料

**验收要点:**
- 导出文件为UTF-8编码的CSV，可直接用Excel打开
- 所有关键字段完整保留，无遗漏
- 可直接与原始采购台账、配送台账逐项核对
- 损耗类型、状态等字段已转换为中文显示，便于阅读

## 目录结构

```
.
├── src/
│   ├── app.js                    # 主应用入口
│   ├── database/
│   │   ├── db.js                 # 数据库连接
│   │   └── init.js               # 数据库初始化脚本
│   ├── services/
│   │   ├── lossReportService.js  # 损耗申报业务逻辑
│   │   └── validationService.js  # 校验服务（重复扣减/一致性）
│   ├── controllers/
│   │   └── lossReportController.js  # API控制器
│   └── routes/
│       └── lossReportRoutes.js   # 路由配置
├── data/                         # 数据库文件目录
├── uploads/                      # 上传文件临时目录
├── examples/
│   └── import_template.csv       # 批量导入模板
├── package.json
└── README.md
```

## 状态说明

- `pending`: 待审核
- `approved`: 已通过
- `rejected`: 已拒绝
- `need_materials`: 需补充材料

## 开发模式

```bash
npm run dev
```

使用 nodemon 自动重启服务。

# 宠物医院药房管理系统

一个完整的宠物医院药房后端管理系统，包含药品管理、库存管理、剂量计算、处方处理、坏记录追踪和审计日志等功能。

## 核心功能

### 1. 药品与库存管理
- 药品信息维护（编码、名称、规格、生产厂家等）
- 库存批次管理（批次号、有效期、库位）
- 库存变动追踪（入库、出库、发药）
- 库存汇总查询

### 2. 剂量计算引擎
- 基于物种和体重区间的剂量规则配置
- 自动计算推荐剂量
- 剂量范围校验（最小/最大剂量）
- 小体重宠物特别提醒
- 处方剂量与推荐值差异预警

### 3. 处方管理
- 处方创建与录入
- 剂量自动校验
- 库存检查与扣减
- 处方状态流转（待审核 → 已审核 → 已发药 → 已取消）
- 处方明细查询

### 4. 数据导入与坏记录处理
- 支持CSV格式导入药品、库存、剂量规则
- 支持JSON格式导入处方
- 坏记录保留（原始数据、错误原因、建议）
- 坏记录处理（修正、忽略）
- 导入统计报告

### 5. 敏感字段脱敏
- 患者/医生姓名脱敏
- 电话号码、邮箱脱敏
- 身份证号脱敏
- 所有API返回和日志自动脱敏

### 6. 审计日志
- 所有操作自动记录
- 支持按实体类型、操作类型查询
- 操作前后数据对比
- 日志统计分析

### 7. 报告生成
- 处方PDF导出
- 剂量推荐报告
- CSV报表导出

## 技术栈

- **运行时**: Node.js 16+
- **语言**: TypeScript
- **Web框架**: Express.js
- **数据库**: SQLite (本地持久化)
- **PDF生成**: PDFKit
- **CSV解析**: csv-parser

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化示例数据

```bash
npm run init
```

### 3. 编译项目

```bash
npm run build
```

### 4. 启动服务器

```bash
npm start
# 或开发模式
npm run dev
```

服务器将在 `http://localhost:3000` 启动。

## API 接口

### 药品管理
- `GET /api/medicines` - 获取药品列表
- `GET /api/medicines/:id` - 获取单个药品
- `POST /api/medicines` - 创建药品

### 库存管理
- `GET /api/inventory` - 获取库存批次
- `GET /api/inventory/summary` - 库存汇总
- `POST /api/inventory` - 创建库存批次

### 剂量管理
- `GET /api/dosage/rules` - 获取剂量规则
- `GET /api/dosage/calculate?medicineId=1&species=犬&weight=10` - 计算剂量
- `POST /api/dosage/rules` - 创建剂量规则

### 处方管理
- `GET /api/prescriptions` - 获取处方列表（支持status筛选）
- `GET /api/prescriptions/:id` - 获取处方详情
- `POST /api/prescriptions` - 创建处方
  ```json
  {
    "prescription": {
      "prescription_no": "PRES001",
      "patient_id": "P001",
      "patient_name": "旺财",
      "species": "犬",
      "weight": 25,
      "doctor_id": "D001",
      "doctor_name": "张医生"
    },
    "items": [
      {
        "medicine_id": 1,
        "dosage": 250,
        "dosage_unit": "mg",
        "quantity": 14,
        "quantity_unit": "片"
      }
    ]
  }
  ```
- `POST /api/prescriptions/:id/validate` - 审核处方
- `POST /api/prescriptions/:id/dispense` - 发药
- `POST /api/prescriptions/:id/cancel` - 取消处方

### 坏记录管理
- `GET /api/bad-records` - 获取坏记录列表
- `GET /api/bad-records/stats` - 坏记录统计
- `POST /api/bad-records/:id/resolve` - 修正坏记录
- `POST /api/bad-records/:id/ignore` - 忽略坏记录

### 审计日志
- `GET /api/audit-logs` - 获取审计日志
- `GET /api/audit-logs/stats` - 日志统计

### 数据导入
- `POST /api/import/medicines` - 导入药品（CSV）
  ```json
  { "csvContent": "code,name,unit\nMED001,阿莫西林,片" }
  ```
- `POST /api/import/inventory` - 导入库存（CSV）
- `POST /api/import/dosage` - 导入剂量规则（CSV）
- `POST /api/import/prescriptions` - 导入处方（JSON）

### 报告
- `GET /api/reports/prescription/:id/pdf` - 下载处方PDF
- `GET /api/reports/dosage/:medicineId?species=犬&minWeight=1&maxWeight=10&step=1` - 剂量报告

### 统计
- `GET /api/stats` - 综合统计信息

## 数据模型

### 药品 (medicines)
- id, code, name, generic_name, manufacturer, specification, unit, dosage_form

### 库存批次 (inventory_batches)
- id, medicine_id, batch_number, quantity, unit, manufacture_date, expiry_date, location, status

### 剂量规则 (dosage_rules)
- id, medicine_id, species, min_weight, max_weight, min_dosage, max_dosage, dosage_unit, dosage_per_kg, frequency, route, notes

### 处方 (prescriptions)
- id, prescription_no, patient_id, patient_name, species, breed, weight, weight_unit, age, doctor_id, doctor_name, diagnosis, status, total_amount, issued_at

### 处方明细 (prescription_items)
- id, prescription_id, medicine_id, batch_id, dosage, dosage_unit, quantity, quantity_unit, frequency, route, days, notes, calculated_dosage, dosage_warning, status

### 坏记录 (bad_records)
- id, source_type, source_file, row_number, original_data, error_type, error_message, suggestion, status, corrected_data, resolved_at, created_at

### 审计日志 (audit_logs)
- id, entity_type, entity_id, action, old_value, new_value, operator_id, operator_name, ip_address, created_at

### 库存变动 (stock_movements)
- id, batch_id, prescription_item_id, movement_type, quantity, unit, reference_no, notes, operator_id, created_at

## 项目结构

```
vet-pharmacy-system/
├── src/
│   ├── index.ts              # 服务入口
│   ├── database.ts           # 数据库连接与初始化
│   ├── models.ts             # 数据模型定义
│   ├── utils/
│   │   └── security.ts       # 脱敏工具
│   └── services/
│       ├── inventoryService.ts    # 库存服务
│       ├── dosageService.ts       # 剂量计算服务
│       ├── prescriptionService.ts # 处方服务
│       ├── badRecordService.ts    # 坏记录服务
│       ├── auditService.ts        # 审计日志服务
│       ├── importService.ts       # 数据导入服务
│       └── reportService.ts       # 报告生成服务
├── scripts/
│   └── initData.ts          # 数据初始化脚本
├── data/                    # 数据目录
│   ├── sample_medicines.csv
│   ├── sample_inventory.csv
│   ├── sample_dosage.csv
│   └── sample_prescriptions.json
├── package.json
├── tsconfig.json
└── README.md
```

## 核心特性说明

### 本地持久化
使用SQLite数据库，数据文件存储在 `data/pharmacy.db`，重启服务后数据不丢失。

### 剂量计算
- 支持按体重区间配置不同规则
- 支持按每公斤体重计算剂量
- 自动限制在最小/最大剂量范围内
- 小体重宠物（<1kg）特别提醒

### 坏记录处理
所有导入失败的记录都会被完整保存，包含：
- 原始数据内容
- 具体错误信息
- 修改建议
- 可以后续修正或标记忽略

### 敏感数据保护
敏感字段在以下位置自动脱敏：
- API返回结果
- 审计日志
- 导出文件
- 系统日志

## 注意事项

1. 首次运行前请确保已安装 Node.js 16+
2. 数据库文件会自动创建在 `data/` 目录
3. 示例数据仅供测试使用
4. 生产环境请配置适当的备份策略

## License

MIT

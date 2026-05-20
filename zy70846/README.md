# 便利店对账系统

便利店对账后端服务，解决盘点CSV、销售JSON、补货单的自动对账、人工复核和报告导出。

## 功能特性

### 1. **数据导入**
- 盘点数据CSV导入
- 销售数据JSON导入
- 补货单CSV导入
- SKU别名自动映射

### 2. **自动对账**
- 库存数量差异比对（盘盈/盘亏）
- 临期商品自动检测（30天内到期）
- SKU别名自动合并统计
- 补货差异分析（多补/少补）
- 理论库存 vs 实际库存计算

### 3. **差异溯源**
- 每条差异记录来源可追溯到原始单据
- 自动生成差异原因说明
- 支持关联记录审计日志

### 4. **人工复核**
- 通过/驳回/修订/要求补充材料
- 复核意见记录
- 复核后数据自动重新计算汇总

### 5. **报告导出**
- Excel格式对账报告（含汇总、差异明细、审计日志）
- CSV格式对账报告
- 差异状态高亮显示

### 6. **历史追溯**
- 对账记录完整历史
- 审计日志全程记录
- 操作人、时间、详情完整可追溯

## 技术栈

- **框架**: FastAPI
- **数据验证**: Pydantic
- **数据处理**: Pandas
- **报表生成**: xlsxwriter
- **API文档**: Swagger UI / ReDoc

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python -m app.main
```

或使用 uvicorn:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. 访问API文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API接口

### 数据导入

- `POST /api/inventory/import` - 导入盘点CSV
- `POST /api/sales/import` - 导入销售JSON
- `POST /api/replenishment/import` - 导入补货单CSV

### 对账管理

- `POST /api/reconciliation/create` - 创建对账
- `GET /api/reconciliation/{id}` - 获取对账详情
- `GET /api/reconciliation` - 获取对账列表
- `POST /api/reconciliation/{id}/review` - 复核差异
- `POST /api/reconciliation/{id}/complete` - 完成对账

### 报告导出

- `GET /api/reconciliation/{id}/report/excel` - 下载Excel报告
- `GET /api/reconciliation/{id}/report/csv` - 下载CSV报告

### 审计日志

- `GET /api/reconciliation/{id}/audit-log` - 获取审计日志

### 测试数据

- `POST /api/sample-data` - 创建示例数据

## 对账流程

```
1. 导入数据
   ├─ 盘点CSV
   ├─ 销售JSON
   └─ 补货单CSV

2. 创建对账
   ├─ SKU别名映射
   ├─ 临期商品检测
   ├─ 数量差异计算
   └─ 差异原因分析

3. 人工复核
   ├─ 查看差异明细
   ├─ 选择处理动作
   │  ├─ 通过 (Approve
   │  ├─ 驳回 Reject
   │  ├─ 修订 Revise
   │  └─ 要求补充材料 Request More Info
   └─ 系统自动重算

4. 完成对账
   ├─ 生成对账报告
   └─ 记录审计日志
```

## 差异类型

| 类型 | 说明 |
|------|------|
| overstock | 盘盈 - 实际库存 > 理论库存 |
| understock | 盘亏 - 实际库存 < 理论库存 |
| expiring_soon | 临期预警 - 30天内到期 |
| sku_alias | SKU别名 - 名称不统一已合并 |
| over_replenish | 多补 - 补货多于申请 |
| under_replenish | 少补 - 补货少于申请 |

## 项目结构

```
zy70846/
├── app/
│   ├── __init__.py
│   ├── main.py              # 应用入口
│   ├── core/
│   │   ├── __init__.py
│   │   └── config.py      # 配置管理
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── common.py      # 通用模型(状态、审计、SKU映射
│   │   ├── inventory.py   # 盘点模型
│   │   ├── sales.py       # 销售模型
│   │   ├── replenishment.py # 补货单模型
│   │   └── reconciliation.py # 对账模型
│   ├── services/
│   │   ├── __init__.py
│   │   ├── import_service.py    # 数据导入服务
│   │   ├── reconciliation_service.py # 对账核心服务
│   │   └── report_service.py   # 报告生成服务
│   ├── storage/
│   │   ├── __init__.py
│   │   └── memory.py      # 内存存储
│   └── api/
│       ├── __init__.py
│       └── routes.py      # API路由
├── data/                      # 数据目录
│   ├── uploads/              # 上传文件
│   └── reports/              # 生成报告
├── requirements.txt          # 依赖配置
├── .env                   # 环境变量
└── README.md             # 说明文档
```

## 使用示例

### 1. 创建示例数据

```bash
curl -X POST "http://localhost:8000/api/sample-data"
```

### 2. 查看对账结果

访问 http://localhost:8000/api/reconciliation

### 3. 下载Excel报告

```bash
curl -X GET "http://localhost:8000/api/reconciliation/{id}/report/excel" --output report.xlsx
```

## 注意事项

1. 当前版本使用内存存储，重启服务数据会丢失
2. 生产环境建议接入数据库
3. SKU别名映射可在 memory.py 中配置
4. 临期检测默认30天，可在 reconciliation_service.py 中调整

## 后续优化方向

- [ ] 接入持久化数据库（SQLite/PostgreSQL）
- [ ] 用户权限管理
- [ ] 批量对账任务调度
- [ ] 多门店对账汇总
- [ ] 数据可视化看板
- [ ] 微信/邮件通知
- [ ] SKU别名机器学习自动学习

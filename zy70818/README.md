# 口腔连锁采购对账服务

一个专门为口腔连锁机构设计的采购对账后端服务，用于自动化处理库存、召回公告和门店消耗数据的比对，支持批号追踪、效期管理、跨门店调拨和人工复核。

## 功能特性

### 1. 数据导入
- **库存CSV导入**: 支持批量导入种植体、麻药、一次性包材等库存数据
- **召回公告Markdown解析**: 自动解析官方召回公告，提取批号和召回范围
- **门店消耗CSV导入**: 导入各门店消耗记录，包括患者信息和医生记录

### 2. 自动比对引擎
- **召回批号检测**: 自动匹配库存批号与召回公告，及时发现需要召回的产品
- **效期管理**: 近效期预警（90天内）、已过期提醒
- **调拨识别**: 识别跨门店调拨记录，确保库存数据一致性
- **数量平衡校验**: 期初库存 - 消耗数量 + 调入 - 调出 = 当前库存

### 3. 差异解释系统
每个差异都附带详细的可读说明：
- 召回批号: 说明召回级别、原因和处理建议
- 近效期: 提示剩余天数和优先使用建议
- 已过期: 提醒立即下架销毁
- 调拨记录: 说明调拨流向和数量

### 4. 人工复核模块
- 支持确认差异、调整数据、驳回差异、标记已解决等操作
- 记录复核人和复核时间
- 复核后自动同步数据到详情、汇总和报告

### 5. 报告生成与下载
支持多种报告类型：
- **汇总报告**: 按门店/物料类型统计的总览
- **明细报告**: 完整的库存和消耗明细
- **差异报告**: 所有差异记录详情
- **召回专项报告**: 召回批号专项追踪
- **效期专项报告**: 效期管理专项报告

支持格式: Excel (.xlsx)、CSV

## 项目结构

```
dental-reconciliation/
├── main.py                      # FastAPI入口文件
├── requirements.txt             # 依赖包
├── README.md                    # 本文档
├── api/                         # API路由
│   ├── __init__.py
│   ├── inventory.py            # 库存管理API
│   ├── recall.py               # 召回公告API
│   ├── consumption.py          # 门店消耗API
│   ├── reconciliation.py       # 对账核对API
│   └── report.py               # 报告下载API
├── models/                      # 数据模型
│   ├── __init__.py
│   ├── inventory.py            # 库存模型
│   ├── recall.py               # 召回模型
│   ├── consumption.py          # 消耗模型
│   ├── reconciliation.py       # 对账模型
│   └── report.py               # 报告模型
├── services/                    # 业务逻辑
│   ├── __init__.py
│   ├── import_service.py       # 数据导入服务
│   ├── reconciliation_service.py # 对账引擎和复核服务
│   └── report_service.py       # 报告生成服务
├── utils/                       # 工具类
│   ├── __init__.py
│   └── storage.py              # 数据存储（JSON文件）
├── data/                        # 数据目录
│   ├── sample_inventory.csv    # 示例库存数据
│   ├── sample_recall.md        # 示例召回公告
│   ├── sample_consumption.csv  # 示例消耗数据
│   └── reports/                # 生成的报告目录
└── tests/                       # 测试脚本
    ├── __init__.py
    ├── test_import.py          # 导入功能测试
    ├── test_reconciliation.py  # 对账功能测试
    └── test_report.py          # 报告功能测试
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 运行测试

```bash
# 运行所有测试
python run_all_tests.py

# 或单独运行
python tests/test_import.py      # 数据导入测试
python tests/test_reconciliation.py  # 对账功能测试
python tests/test_report.py      # 报告生成测试
```

### 3. 启动API服务

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. 访问API文档

启动服务后，访问以下地址查看交互式API文档：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API使用说明

### 数据导入

1. **导入库存CSV**: `POST /api/inventory/import`
2. **导入召回公告**: `POST /api/recall/import`
3. **导入消耗CSV**: `POST /api/consumption/import`

### 对账操作

1. **执行对账**: `POST /api/reconciliation/run`
   ```json
   {
     "name": "2024年1月对账",
     "start_date": "2024-01-01",
     "end_date": "2024-01-31",
     "store_filter": ["总店", "分店1"]
   }
   ```

2. **获取对账列表**: `GET /api/reconciliation/`
3. **获取对账详情**: `GET /api/reconciliation/{id}`
4. **获取差异列表**: `GET /api/reconciliation/{id}/discrepancies`

### 复核差异

```json
POST /api/reconciliation/{reconciliation_id}/discrepancies/{discrepancy_id}/review

{
  "action": "CONFIRM",
  "notes": "已确认该批次需要召回",
  "reviewed_by": "管理员",
  "adjustment_quantity": 0
}
```

### 报告生成

1. **生成报告**: `POST /api/report/{reconciliation_id}/generate?report_type=SUMMARY&report_format=EXCEL`
2. **下载报告**: `GET /api/report/download?file_path=...`
3. **预览报告**: `GET /api/report/{reconciliation_id}/preview`

## 数据格式说明

### 库存CSV字段

| 字段 | 说明 | 示例 |
|------|------|------|
| 批号 | 产品批号 | IMP202301001 |
| 物料名称 | 产品名称 | 登腾种植体 |
| 物料类型 | 种植体/麻药/一次性包材 | 种植体 |
| 规格型号 | 产品规格 | DENT4.0*10mm |
| 数量 | 库存数量 | 50 |
| 单位 | 计量单位 | 支 |
| 生产日期 | 生产日 | 2023-01-15 |
| 有效期至 | 有效期限 | 2025-01-14 |
| 门店名称 | 所属门店 | 总店 |
| 库位 | 仓库位置 | A-001 |
| 供应商 | 供应商名称 | 登腾公司 |
| 入库日期 | 入库日 | 2023-02-01 |

### 消耗CSV字段

| 字段 | 说明 | 示例 |
|------|------|------|
| 批号 | 产品批号 | IMP202301001 |
| 物料名称 | 产品名称 | 登腾种植体 |
| 规格型号 | 产品规格 | DENT4.0*10mm |
| 数量 | 消耗数量 | 5 |
| 消耗日期 | 使用日期 | 2024-01-10 |
| 门店名称 | 所属门店 | 总店 |
| 患者ID | 患者标识 | P001 |
| 医生姓名 | 操作医生 | 张医生 |
| 是否调拨 | 是否调拨 | 是/否 |
| 调拨来源 | 调出门店 | 总店 |
| 调拨目标 | 调入门店 | 分店1 |

### 召回公告Markdown格式

```markdown
# 产品召回公告
公告编号: RC2024001
发布机构: 国家药品监督管理局
发布日期: 2024-01-15
生效日期: 2024-01-15
召回级别: 二级召回
产品名称: 登腾种植体系统
涉及批号: IMP202301001

## 召回原因
该批次产品存在包装密封性问题。

## 召回范围
所有批号为 IMP202301001 的产品。

## 处理措施
1. 立即停止使用
2. 清点库存并上报
3. 联系供应商办理退货
```

## 差异类型说明

| 类型 | 说明 | 处理建议 |
|------|------|----------|
| **召回批号差异** | 库存批号属于召回范围 | 立即停止使用，召回处理 |
| **近效期预警** | 有效期剩余≤90天 | 优先使用，及时补货 |
| **已过期差异** | 产品已过有效期 | 立即下架销毁 |
| **跨门店调拨差异** | 存在门店间调拨记录 | 确认调拨记录，同步库存 |
| **数量不匹配** | 理论库存与实际库存不符 | 盘点核查，调整数据 |
| **批号不存在** | 消耗批号在库存中不存在 | 核查入库记录，补录数据 |

## 技术栈

- **Web框架**: FastAPI + Uvicorn
- **数据验证**: Pydantic 2.x
- **数据存储**: JSON文件（可扩展为数据库）
- **报告生成**: openpyxl (Excel), csv
- **数据处理**: pandas

## 扩展建议

1. **数据库迁移**: 将JSON存储改为 PostgreSQL/MySQL
2. **用户认证**: 添加JWT认证和权限管理
3. **消息通知**: 集成邮件/短信提醒功能
4. **定时任务**: 每日自动对账和效期检查
5. **前端界面**: 开发管理后台，支持可视化操作
6. **审计日志**: 完整的操作日志记录

## 许可证

MIT License

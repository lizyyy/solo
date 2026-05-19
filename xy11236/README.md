# 高校实验室试剂管理系统

## 功能特性

1. **数据导入** - 支持 JSON 和 CSV 格式导入危化品规则、库存、申领单
2. **坏记录处理** - 保留原始位置、失败原因和修改建议
3. **完整业务流程** - 申请 → 审批 → 出库 → 归还 → 盘点
4. **幂等性保证** - 重复提交或导入结果稳定
5. **敏感字段脱敏** - 申请人ID、审批人ID、供应商等字段自动脱敏
6. **分级审批** - 根据危化品等级要求不同审批级别

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

服务将在 `http://localhost:8000` 启动，API 文档: `http://localhost:8000/docs`

### 3. 运行测试脚本

**Python 测试脚本:**
```bash
python test_flow.py
```

**Bash 测试脚本:**
```bash
chmod +x test_flow.sh
./test_flow.sh
```

## API 接口

### 数据导入

| 接口 | 方法 | 说明 |
|------|------|------|
| `/import/chemical-rules` | POST | 导入危化品规则 |
| `/import/inventory` | POST | 导入库存数据 |
| `/import/applications` | POST | 导入申领单 |

### 业务流程

| 接口 | 方法 | 说明 |
|------|------|------|
| `/application/create` | POST | 创建申领单 |
| `/application/approve` | POST | 审批申领单 |
| `/inventory/issue` | POST | 试剂出库 |
| `/inventory/return` | POST | 试剂归还 |
| `/inventory/stocktake` | POST | 库存盘点 |

### 查询导出

| 接口 | 方法 | 说明 |
|------|------|------|
| `/bad-records` | GET | 查看错误记录 |
| `/inventory` | GET | 查看库存 |
| `/applications` | GET | 查看申领单 |
| `/export/{data_type}` | GET | 导出数据 |

## 危化品审批等级

| 危险等级 | 所需审批级别 | 单次申领上限 |
|----------|--------------|--------------|
| 剧毒 | 4级 | 严格限制 |
| 易制爆/易制毒 | 3级 | 严格限制 |
| 腐蚀 | 2级 | 500ml |
| 易燃/氧化 | 1级 | 1000ml |
| 普通 | 1级 | 10000ml |

## 坏记录说明

导入失败的记录会保留以下信息：
- **原始位置**: 导入文件中的行号
- **失败原因**: 具体验证失败原因
- **修改建议**: 如何修正数据的建议

## 示例数据

`data/` 目录包含示例数据文件：
- `chemical_rules.json` - 危化品规则示例
- `inventory.json` - 库存数据示例
- `applications.csv` - 申领单 CSV 示例

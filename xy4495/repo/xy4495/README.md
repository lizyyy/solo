# 小口岸查验系统

小口岸查验科放行前合并舱单、报关单、X光机标注、开箱封签记录和实验室抽检结果的后端API服务。

## 功能特性

- **数据导入**: 支持导入报关单、舱单、X光机检查记录、开箱封签记录、实验室抽检结果
- **风险评估**: 自动检测HS编码与货描不符、重量件数差异、封签断链、抽检超期、高风险货物未复核
- **人工复核**: 支持单条和批量人工复核，记录复核意见和状态
- **数据导出**: 导出 Markdown 查验清单和 JSON 审计包
- **数据查询**: 支持按报关单查询所有相关数据和风险问题

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python app.py
```

服务将在 `http://localhost:5000` 启动。

### 3. 健康检查

```bash
curl http://localhost:5000/api/health
```

---

## API 文档

### 健康检查

```
GET /api/health
```

**响应示例**:
```json
{
  "status": "ok",
  "timestamp": "2026-05-05T10:00:00.000000"
}
```

---

## 数据导入接口

### 导入报关单

```
POST /api/import/declaration
Content-Type: application/json
```

**请求体**:
```json
{
  "declaration_no": "DECL-2026-0001",
  "vessel_name": "东方号",
  "voyage_no": "V2026-05A",
  "port_of_departure": "上海港",
  "port_of_arrival": "小口岸",
  "arrival_date": "2026-05-01T08:00:00",
  "declaration_date": "2026-05-02T10:00:00",
  "consignee": "某某贸易有限公司",
  "consignor": "某某进出口公司",
  "total_weight": 5000.5,
  "total_packages": 100,
  "total_containers": 2,
  "status": "pending",
  "notes": "需要重点查验",
  "items": [
    {
      "item_no": "001",
      "hs_code": "85258013",
      "description": "数码照相机",
      "description_en": "Digital Camera",
      "quantity": 50,
      "unit": "台",
      "weight": 2500.0,
      "weight_unit": "kg",
      "value": 50000.0,
      "currency": "USD",
      "country_of_origin": "日本",
      "is_high_risk": true,
      "risk_level": "high",
      "risk_reason": "电子产品，高风险类别"
    },
    {
      "item_no": "002",
      "hs_code": "30049090",
      "description": "药品",
      "quantity": 200,
      "unit": "盒",
      "weight": 500.0,
      "is_high_risk": true,
      "risk_level": "critical"
    }
  ]
}
```

**Curl 示例**:
```bash
curl -X POST http://localhost:5000/api/import/declaration \
  -H "Content-Type: application/json" \
  -d '{
    "declaration_no": "DECL-2026-0001",
    "vessel_name": "东方号",
    "voyage_no": "V2026-05A",
    "port_of_departure": "上海港",
    "port_of_arrival": "小口岸",
    "arrival_date": "2026-05-01T08:00:00",
    "declaration_date": "2026-05-02T10:00:00",
    "consignee": "某某贸易有限公司",
    "consignor": "某某进出口公司",
    "total_weight": 5000.5,
    "total_packages": 100,
    "total_containers": 2,
    "status": "pending",
    "notes": "需要重点查验",
    "items": [
      {
        "item_no": "001",
        "hs_code": "85258013",
        "description": "数码照相机",
        "quantity": 50,
        "unit": "台",
        "weight": 2500.0,
        "is_high_risk": true,
        "risk_level": "high",
        "risk_reason": "电子产品，高风险类别"
      },
      {
        "item_no": "002",
        "hs_code": "30049090",
        "description": "药品",
        "quantity": 200,
        "unit": "盒",
        "weight": 500.0,
        "is_high_risk": true,
        "risk_level": "critical"
      }
    ]
  }'
```

---

### 导入舱单

```
POST /api/import/manifest
Content-Type: application/json
```

**请求体**:
```json
{
  "manifest_no": "MAN-2026-0001",
  "declaration_no": "DECL-2026-0001",
  "vessel_name": "东方号",
  "voyage_no": "V2026-05A",
  "port_of_departure": "上海港",
  "port_of_arrival": "小口岸",
  "container_no": "MSKU1234567",
  "container_type": "20GP",
  "seal_no": "SEAL-001",
  "seal_type": "一次性铅封",
  "total_weight": 5500.0,
  "total_packages": 110,
  "items": [
    {
      "item_no": "001",
      "hs_code": "85258013",
      "description": "数码照相机",
      "quantity": 50,
      "unit": "台",
      "weight": 2500.0
    },
    {
      "item_no": "002",
      "hs_code": "30049090",
      "description": "药品",
      "quantity": 200,
      "unit": "盒",
      "weight": 500.0
    }
  ]
}
```

**Curl 示例**:
```bash
curl -X POST http://localhost:5000/api/import/manifest \
  -H "Content-Type: application/json" \
  -d '{
    "manifest_no": "MAN-2026-0001",
    "declaration_no": "DECL-2026-0001",
    "vessel_name": "东方号",
    "voyage_no": "V2026-05A",
    "port_of_departure": "上海港",
    "port_of_arrival": "小口岸",
    "container_no": "MSKU1234567",
    "container_type": "20GP",
    "seal_no": "SEAL-001",
    "seal_type": "一次性铅封",
    "total_weight": 5500.0,
    "total_packages": 110,
    "items": [
      {
        "item_no": "001",
        "hs_code": "85258013",
        "description": "数码照相机",
        "quantity": 50,
        "unit": "台",
        "weight": 2500.0
      },
      {
        "item_no": "002",
        "hs_code": "30049090",
        "description": "药品",
        "quantity": 200,
        "unit": "盒",
        "weight": 500.0
      }
    ]
  }'
```

---

### 导入封签记录

```
POST /api/import/seal
Content-Type: application/json
```

**请求体**:
```json
{
  "declaration_no": "DECL-2026-0001",
  "container_no": "MSKU1234567",
  "seal_no": "SEAL-001",
  "seal_type": "一次性铅封",
  "seal_status": "opened",
  "install_date": "2026-05-01T10:00:00",
  "install_location": "上海港",
  "installed_by": "张三",
  "open_date": "2026-05-03T14:00:00",
  "open_location": "小口岸查验场",
  "opened_by": "查验科李四",
  "open_reason": "X光机检查发现异常，需要开箱查验",
  "is_chain_broken": true,
  "chain_break_reason": "封签在运输途中被人为破坏"
}
```

**Curl 示例**:
```bash
curl -X POST http://localhost:5000/api/import/seal \
  -H "Content-Type: application/json" \
  -d '{
    "declaration_no": "DECL-2026-0001",
    "container_no": "MSKU1234567",
    "seal_no": "SEAL-001",
    "seal_type": "一次性铅封",
    "seal_status": "opened",
    "install_date": "2026-05-01T10:00:00",
    "install_location": "上海港",
    "installed_by": "张三",
    "open_date": "2026-05-03T14:00:00",
    "open_location": "小口岸查验场",
    "opened_by": "查验科李四",
    "open_reason": "X光机检查发现异常，需要开箱查验",
    "is_chain_broken": true,
    "chain_break_reason": "封签在运输途中被人为破坏"
  }'
```

---

### 导入 X 光机检查记录

```
POST /api/import/xray
Content-Type: application/json
```

**请求体**:
```json
{
  "declaration_no": "DECL-2026-0001",
  "inspection_no": "XRAY-2026-0001",
  "container_no": "MSKU1234567",
  "inspection_date": "2026-05-03T10:00:00",
  "inspection_location": "小口岸查验场",
  "inspector_name": "王五",
  "scan_result": "部分货物形态与申报不符",
  "anomalies": "发现部分货物包装内有疑似电子产品的密度影像，与申报的药品密度不符",
  "anomaly_type": "密度异常",
  "anomaly_severity": "high",
  "required_further_inspection": true,
  "inspection_status": "completed",
  "notes": "建议开箱查验"
}
```

**Curl 示例**:
```bash
curl -X POST http://localhost:5000/api/import/xray \
  -H "Content-Type: application/json" \
  -d '{
    "declaration_no": "DECL-2026-0001",
    "inspection_no": "XRAY-2026-0001",
    "container_no": "MSKU1234567",
    "inspection_date": "2026-05-03T10:00:00",
    "inspection_location": "小口岸查验场",
    "inspector_name": "王五",
    "scan_result": "部分货物形态与申报不符",
    "anomalies": "发现部分货物包装内有疑似电子产品的密度影像，与申报的药品密度不符",
    "anomaly_type": "密度异常",
    "anomaly_severity": "high",
    "required_further_inspection": true,
    "inspection_status": "completed",
    "notes": "建议开箱查验"
  }'
```

---

### 导入实验室抽检结果

```
POST /api/import/lab-sample
Content-Type: application/json
```

**请求体**:
```json
{
  "declaration_no": "DECL-2026-0001",
  "sample_no": "LAB-2026-0001",
  "container_no": "MSKU1234567",
  "sample_date": "2026-05-03T15:00:00",
  "sample_location": "小口岸查验场",
  "sampler_name": "赵六",
  "sample_type": "药品抽样",
  "sample_description": "从002号商品中抽取5盒进行成分检测",
  "hs_code": "30049090",
  "expected_test_items": "成分分析、含量检测",
  "test_deadline": "2026-05-01T23:59:59",
  "is_overdue": true
}
```

**Curl 示例**:
```bash
curl -X POST http://localhost:5000/api/import/lab-sample \
  -H "Content-Type: application/json" \
  -d '{
    "declaration_no": "DECL-2026-0001",
    "sample_no": "LAB-2026-0001",
    "container_no": "MSKU1234567",
    "sample_date": "2026-05-03T15:00:00",
    "sample_location": "小口岸查验场",
    "sampler_name": "赵六",
    "sample_type": "药品抽样",
    "sample_description": "从002号商品中抽取5盒进行成分检测",
    "hs_code": "30049090",
    "expected_test_items": "成分分析、含量检测",
    "test_deadline": "2026-05-01T23:59:59",
    "is_overdue": true
  }'
```

---

### 批量导入所有数据

```
POST /api/import/batch
Content-Type: application/json
```

可以一次性导入所有类型的数据。

---

## 查询接口

### 获取所有报关单

```
GET /api/query/declarations
```

**查询参数**:
- `page`: 页码 (默认 1)
- `per_page`: 每页数量 (默认 20)
- `status`: 状态筛选

**Curl 示例**:
```bash
curl http://localhost:5000/api/query/declarations?page=1&per_page=10
```

---

### 获取报关单详情

```
GET /api/query/declaration/<declaration_no>
```

返回报关单的所有信息，包括商品、舱单、封签记录、X光检查、实验室抽检、风险评估等。

**Curl 示例**:
```bash
curl http://localhost:5000/api/query/declaration/DECL-2026-0001
```

---

### 按报关单查看问题

```
GET /api/query/declaration/<declaration_no>/issues
```

返回该报关单的所有风险问题，按类型和严重程度分类汇总。

**Curl 示例**:
```bash
curl http://localhost:5000/api/query/declaration/DECL-2026-0001/issues
```

---

## 风险评估接口

### 获取所有风险

```
GET /api/risk/all
```

**查询参数**:
- `page`: 页码
- `per_page`: 每页数量
- `risk_type`: 风险类型筛选
- `risk_level`: 风险等级筛选
- `review_status`: 复核状态筛选
- `declaration_no`: 报关单号筛选

**风险类型**:
- `hs_discrepancy` - HS编码与货描不符
- `weight_package_difference` - 重量件数差异
- `seal_chain_broken` - 封签断链
- `sample_overdue` - 抽检超期
- `high_risk_not_reviewed` - 高风险货物未复核

**Curl 示例**:
```bash
# 获取所有风险
curl http://localhost:5000/api/risk/all

# 按报关单筛选
curl "http://localhost:5000/api/risk/all?declaration_no=DECL-2026-0001"

# 按风险类型筛选
curl "http://localhost:5000/api/risk/all?risk_type=hs_discrepancy"

# 按风险等级筛选
curl "http://localhost:5000/api/risk/all?risk_level=critical"

# 按复核状态筛选
curl "http://localhost:5000/api/risk/all?review_status=pending"
```

---

### 获取风险摘要

```
GET /api/risk/summary
```

**查询参数**:
- `declaration_no`: 可选，指定报关单

**Curl 示例**:
```bash
# 获取所有风险摘要
curl http://localhost:5000/api/risk/summary

# 获取指定报关单的风险摘要
curl "http://localhost:5000/api/risk/summary?declaration_no=DECL-2026-0001"
```

---

### 获取所有风险类型

```
GET /api/risk/types
```

**Curl 示例**:
```bash
curl http://localhost:5000/api/risk/types
```

---

### 重新评估风险

```
POST /api/risk/evaluate/<declaration_no>
```

**Curl 示例**:
```bash
curl -X POST http://localhost:5000/api/risk/evaluate/DECL-2026-0001
```

---

## 复核接口

### 获取复核记录列表

```
GET /api/review/list
```

**查询参数**:
- `page`: 页码
- `per_page`: 每页数量
- `declaration_no`: 报关单号筛选
- `review_status`: 复核状态筛选
- `reviewer_name`: 复核人筛选

**Curl 示例**:
```bash
curl http://localhost:5000/api/review/list
```

---

### 创建复核记录

```
POST /api/review/create
Content-Type: application/json
```

**请求体**:
```json
{
  "declaration_no": "DECL-2026-0001",
  "risk_id": 1,
  "review_type": "risk",
  "reviewer_name": "查验科李科长",
  "review_status": "reviewed",
  "review_notes": "已核实封签断链情况，建议移交缉私部门处理",
  "related_item_no": "001",
  "related_container_no": "MSKU1234567"
}
```

**复核状态**:
- `pending` - 待复核
- `reviewed` - 已复核
- `approved` - 已通过
- `rejected` - 已驳回

**Curl 示例**:
```bash
curl -X POST http://localhost:5000/api/review/create \
  -H "Content-Type: application/json" \
  -d '{
    "declaration_no": "DECL-2026-0001",
    "risk_id": 1,
    "review_type": "risk",
    "reviewer_name": "查验科李科长",
    "review_status": "reviewed",
    "review_notes": "已核实封签断链情况，建议移交缉私部门处理",
    "related_item_no": "001",
    "related_container_no": "MSKU1234567"
  }'
```

---

### 批量复核

```
POST /api/review/batch
Content-Type: application/json
```

**请求体**:
```json
{
  "risk_ids": [1, 2, 3],
  "reviewer_name": "查验科李科长",
  "review_status": "approved",
  "review_notes": "已复核，所有风险已处理完毕"
}
```

**Curl 示例**:
```bash
curl -X POST http://localhost:5000/api/review/batch \
  -H "Content-Type: application/json" \
  -d '{
    "risk_ids": [1, 2, 3],
    "reviewer_name": "查验科李科长",
    "review_status": "approved",
    "review_notes": "已复核，所有风险已处理完毕"
  }'
```

---

### 获取复核记录详情

```
GET /api/review/<review_id>
```

**Curl 示例**:
```bash
curl http://localhost:5000/api/review/1
```

---

### 更新复核记录

```
PUT /api/review/<review_id>
Content-Type: application/json
```

**Curl 示例**:
```bash
curl -X PUT http://localhost:5000/api/review/1 \
  -H "Content-Type: application/json" \
  -d '{
    "review_status": "approved",
    "review_notes": "复核通过，同意放行"
  }'
```

---

### 获取复核摘要

```
GET /api/review/summary
```

**Curl 示例**:
```bash
curl http://localhost:5000/api/review/summary
```

---

## 导出接口

### 导出 Markdown 查验清单

```
GET /api/export/markdown
```

**查询参数**:
- `declaration_no`: 可选，指定报关单，不指定则导出所有
- `reviewer_name`: 可选，复核人姓名

**Curl 示例**:
```bash
# 导出所有报关单的查验清单
curl -o inspection_checklist.md "http://localhost:5000/api/export/markdown?reviewer_name=查验科李科长"

# 导出指定报关单的查验清单
curl -o DECL-2026-0001_checklist.md "http://localhost:5000/api/export/markdown?declaration_no=DECL-2026-0001&reviewer_name=查验科李科长"
```

---

### 预览 Markdown 内容

```
GET /api/export/markdown/preview
```

**Curl 示例**:
```bash
curl "http://localhost:5000/api/export/markdown/preview?declaration_no=DECL-2026-0001&reviewer_name=查验科李科长"
```

---

### 导出 JSON 审计包

```
GET /api/export/json
```

**查询参数**:
- `declaration_no`: 可选，指定报关单
- `reviewer_name`: 可选，复核人姓名

**Curl 示例**:
```bash
# 获取所有数据的JSON
curl "http://localhost:5000/api/export/json?reviewer_name=查验科李科长"

# 获取指定报关单的JSON
curl "http://localhost:5000/api/export/json?declaration_no=DECL-2026-0001&reviewer_name=查验科李科长"
```

---

### 下载 JSON 审计文件

```
GET /api/export/json/download
```

**Curl 示例**:
```bash
# 下载所有数据的JSON文件
curl -o audit_package.json "http://localhost:5000/api/export/json/download?reviewer_name=查验科李科长"

# 下载指定报关单的JSON文件
curl -o DECL-2026-0001_audit.json "http://localhost:5000/api/export/json/download?declaration_no=DECL-2026-0001&reviewer_name=查验科李科长"
```

---

### 获取导出摘要

```
GET /api/export/summary
```

**Curl 示例**:
```bash
curl http://localhost:5000/api/export/summary
```

---

## 风险评估规则

### 1. HS编码与货描不符 (HS Discrepancy)

- **检测逻辑**: 对比HS编码前4位对应的商品类别与货物描述
- **预定义高风险HS类别映射**:
  - `8525` - 摄影设备
  - `8517` - 通信设备设备
  - `8471` - 计算机设备设备
  - `9006` - 摄影设备设备
  - `3004` - 药品设备
  - `3304` - 化妆品设备
  - `2009` - 果汁设备饮料设备
  - `2208` - 酒类设备
  - `7108` - 黄金设备
  - `7106` - 白银设备
  - `0804` - 水果设备
  - `0201` - 肉类设备
  - `0302` - 海鲜设备

- **风险等级**: 高风险 (high)

---

### 2. 重量件数差异 (Weight & Package Difference)

- **检测逻辑**: 比较报关单总重量/件数与舱单总重量/件数
- **差异阈值**:
  - 差异 > 5% 时触发检测
  - 差异 > 10% 为高风险 (high)
  - 差异 5% - 10% 为中风险 (medium)

---

### 3. 封签断链 (Seal Chain Broken)

- **检测逻辑**: 
  - 封签标记为断链设备 (is_chain_broken = True) → 致命风险设备 (critical)
  - 封签已开启但未重新施封设备 (seal_status = 'opened' 且无 reseal_date) → 高风险设备 (high)

---

### 4. 抽检超期设备 (Sample Overdue)

- **检测逻辑**: 
  - 检测设备截止日期设备 (test_deadline) 已过设备且无报告日期设备 (report_date)
  - 超期天数设备:
    - 超期设备 > 7天设备 → 致命风险设备 (critical)
    - 超期设备 > 3天设备 → 高风险设备 (high)
    - 超期设备 > 0天设备 → 中风险设备 (medium)
  - 报告延迟设备: 报告日期设备超过检测设备截止日期设备 → 中低风险设备

---

### 5. 高风险货物未复核设备 (High Risk Not Reviewed)

- **检测逻辑**: 
  - 商品标记为高风险设备 (is_high_risk = True)
  - 关联的风险评估未全部完成复核设备
- **风险等级设备**: 高风险设备 (high)

---

## 数据模型

### CustomsDeclaration (报关单)

| 字段设备 | 类型设备 | 说明设备 |
|------|------|------|
| id设备 | Integer | 主键设备 |
| declaration_no设备 | String | 报关设备单号设备 (唯一设备) |
| vessel_name设备 | String | 船名设备 |
| voyage_no设备 | String | 航次设备 |
| port_of_departure设备 | String | 启运设备港设备 |
| port_of_arrival设备 | String | 目的设备港设备 |
| arrival_date设备 | DateTime | 到港设备日期设备 |
| declaration_date设备 | DateTime | 报关设备日期设备 |
| consignee设备 | String | 收货设备人设备 |
| consignor设备 | String | 发货设备人设备 |
| total_weight设备 | Float | 总重量设备 (kg)设备 |
| total_packages设备 | Integer | 总件数设备 |
| total_containers设备 | Integer | 总集装箱数设备 |
| status设备 | String | 状态设备 |

---

### DeclarationItem (报关设备商品项目)

| 字段设备 | 类型设备 | 说明设备 |
|------|------|------|
| id设备 | Integer | 主键设备 |
| declaration_id设备 | Integer | 关联设备报关设备单设备 ID设备 |
| item_no设备 | String | 商品设备序号设备 |
| hs_code设备 | String | HS设备编码设备 |
| description设备 | Text | 商品设备描述设备 |
| quantity设备 | Float | 数量设备 |
| unit设备 | String | 单位设备 |
| weight设备 | Float | 重量设备 (kg)设备 |
| value设备 | Float | 价值设备 |
| is_high_risk设备 | Boolean | 是否设备高风险设备 |
| risk_level设备 | String | 风险设备等级设备 |

---

### Manifest (舱单)

| 字段设备 | 类型设备 | 说明设备 |
|------|------|------|
| id设备 | Integer | 主键设备设备 |
| manifest_no设备 | String | 舱设备单号设备设备 (唯一设备设备) |
| declaration_no设备 | String | 关联设备报关设备单号设备 |
| container_no设备 | String | 集装箱设备号设备 |
| seal_no设备 | String | 封签设备号设备 |
| total_weight设备 | Float | 总重量设备设备 (kg)设备 |
| total_packages设备 | Integer | 总件数设备设备 |

---

### SealRecord (封签设备记录)

| 字段设备 | 类型设备 | 说明设备 |
|------|------|------|
| id设备 | Integer | 主键设备设备 |
| container_no设备 | String | 集装箱设备号设备 |
| seal_no设备 | String | 封签设备号设备 |
| seal_status设备 | String | 封签设备状态设备设备 (intact/opened/resealed)设备 |
| is_chain_broken设备 | Boolean | 是否设备断链设备设备 |
| chain_break_reason设备 | Text | 断链设备原因设备 |
| open_date设备 | DateTime | 开启设备日期设备 |
| open_reason设备 | Text | 开启设备原因设备 |
| reseal_date设备 | DateTime | 重新设备施封设备日期设备 |
| new_seal_no设备 | String | 新封签设备号设备 |

---

### XrayInspection (X光设备机设备检查设备记录)

| 字段设备 | 类型设备 | 说明设备 |
|------|------|------|
| id设备 | Integer | 主键设备设备 |
| inspection_no设备 | String | 检查设备编号设备 (唯一设备设备) |
| container_no设备 | String | 集装箱设备号设备 |
| inspection_date设备 | DateTime | 检查设备日期设备 |
| inspector_name设备 | String | 检查设备人员设备 |
| scan_result设备 | Text | 扫描设备结果设备 |
| anomalies设备 | Text | 异常设备情况设备 |
| anomaly_type设备 | String | 异常设备类型设备 |
| anomaly_severity设备 | String | 异常设备严重设备程度设备设备 (low/medium/high/critical)设备 |
| required_further_inspection设备 | Boolean | 是否设备需要设备进一步设备检查设备设备 |

---

### LabSample (实验室设备抽检设备结果)

| 字段设备 | 类型设备 | 说明设备 |
|------|------|------|
| id设备 | Integer | 主键设备设备 |
| sample_no设备 | String | 样品设备编号设备 (唯一设备设备) |
| container_no设备 | String | 集装箱设备号设备 |
| sample_date设备 | DateTime | 采样设备日期设备 |
| sample_type设备 | String | 样品设备类型设备 |
| hs_code设备 | String | 关联设备 HS设备编码设备 |
| test_deadline设备 | DateTime | 检测设备截止设备日期设备 |
| is_overdue设备 | Boolean | 是否设备超期设备设备 |
| report_date设备 | DateTime | 报告设备日期设备 |
| is_pass设备 | Boolean | 是否设备合格设备设备 |
| test_result设备 | Text | 检测设备结果设备 |

---

### RiskAssessment (风险设备评估设备记录)

| 字段设备 | 类型设备 | 说明设备 |
|------|------|------|
| id设备 | Integer | 主键设备设备 |
| declaration_id设备 | Integer | 关联设备报关设备单设备 ID设备 |
| item_id设备 | Integer | 关联设备商品设备项目设备 ID设备设备 |
| risk_type设备 | String | 风险设备类型设备设备 |
| risk_level设备 | String | 风险设备等级设备设备 (low/medium/high/critical)设备 |
| risk_description设备 | Text | 风险设备描述设备 |
| detected_at设备 | DateTime | 检测设备时间设备 |
| is_reviewed设备 | Boolean | 是否已设备复核设备设备 |
| reviewed_at设备 | DateTime | 复核设备时间设备 |
| reviewer_name设备 | String | 复核设备人设备姓名设备 |
| review_status设备 | String | 复核设备状态设备设备 (pending/reviewed/approved/rejected)设备 |
| review_notes设备 | Text | 复核设备备注设备 |

---

### ReviewRecord (复核设备记录)

| 字段设备 | 类型设备 | 说明设备 |
|------|------|------|
| id设备 | Integer | 主键设备设备 |
| declaration_id设备 | Integer | 关联设备报关设备单设备 ID设备 |
| risk_id设备 | Integer | 关联设备风险设备评估设备 ID设备设备 |
| review_type设备 | String | 复核设备类型设备设备 |
| reviewer_name设备 | String | 复核设备人设备姓名设备 |
| review_date设备 | DateTime | 复核设备日期设备 |
| review_status设备 | String | 复核设备状态设备设备 |
| review_notes设备 | Text | 复核设备备注设备 |

---

## 完整使用示例流程

### 1. 启动服务

```bash
python app.py
```

### 2. 导入报关设备单

```bash
curl -X POST http://localhost:5000/api/import/declaration \
  -H "Content-Type: application/json" \
  -d '{
    "declaration_no": "DECL-2026-TEST-001",
    "vessel_name": "测试船舶",
    "voyage_no": "TEST-001",
    "port_of_departure": "测试港",
    "port_of_arrival": "小口岸",
    "consignee": "测试公司",
    "total_weight": 1000,
    "total_packages": 50,
    "items": [
      {
        "item_no": "001",
        "hs_code": "85258013",
        "description": "测试商品",
        "quantity": 50,
        "unit": "台",
        "weight": 1000,
        "is_high_risk": true,
        "risk_level": "high",
        "risk_reason": "测试高风险商品"
      }
    ]
  }'
```

### 3. 导入舱设备单 (设置设备不同设备的重量设备/件数设备以设备触发设备差异设备风险设备)

```bash
curl -X POST http://localhost:5000/api/import/manifest \
  -H "Content-Type: application/json" \
  -d '{
    "manifest_no": "MAN-2026-TEST-001",
    "declaration_no": "DECL-2026-TEST-001",
    "container_no": "TEST-1234567",
    "seal_no": "SEAL-TEST-001",
    "total_weight": 1200,
    "total_packages": 60,
    "items": [
      {
        "item_no": "001",
        "hs_code": "85258013",
        "description": "测试商品",
        "quantity": 60,
        "unit": "台",
        "weight": 1200
      }
    ]
  }'
```

### 4. 导入封签设备记录设备 (设置设备断链设备风险设备)

```bash
curl -X POST http://localhost:5000/api/import/seal \
  -H "Content-Type: application/json" \
  -d '{
    "declaration_no": "DECL-2026-TEST-001",
    "container_no": "TEST-1234567",
    "seal_no": "SEAL-TEST-001",
    "seal_status": "opened",
    "is_chain_broken": true,
    "chain_break_reason": "测试封签断链"
  }'
```

### 5. 查看风险设备评估设备结果

```bash
# 查看风险设备摘要设备
curl http://localhost:5000/api/risk/summary

# 查看所有风险设备
curl http://localhost:5000/api/risk/all

# 查看报关设备单设备的设备问题设备
curl http://localhost:5000/api/query/declaration/DECL-2026-TEST-001/issues
```

### 6. 进行复核设备

```bash
# 获取待复核设备的风险设备 ID设备
curl "http://localhost:5000/api/risk/all?review_status=pending"

# 单条复核设备
curl -X POST http://localhost:5000/api/review/create \
  -H "Content-Type: application/json" \
  -d '{
    "risk_id": 1,
    "reviewer_name": "测试复核人",
    "review_status": "reviewed",
    "review_notes": "已复核设备，测试设备备注设备"
  }'
```

### 7. 导出查验设备清单设备和审计设备包设备

```bash
# 导出 Markdown 查验设备清单设备
curl -o test_checklist.md "http://localhost:5000/api/export/markdown?declaration_no=DECL-2026-TEST-001&reviewer_name=测试复核人"

# 导出 JSON 审计设备包设备
curl -o test_audit.json "http://localhost:5000/api/export/json/download?declaration_no=DECL-2026-TEST-001&reviewer_name=测试复核人"
```

---

## 目录结构设备

```
.
├── app.py                    # 主应用设备入口设备
├── requirements.txt          # 依赖设备文件设备
├── README.md                 # 本文档设备
├── models/
│   ├── __init__.py
│   └── models.py             # 数据设备模型设备定义设备
├── routes/
│   ├── __init__.py
│   ├── import_routes.py      # 数据设备导入设备接口设备
│   ├── query_routes.py       # 数据设备查询设备接口设备
│   ├── risk_routes.py        # 风险设备评估设备接口设备
│   ├── review_routes.py      # 复核设备接口设备
│   └── export_routes.py      # 导出设备接口设备
└── services/
    ├── __init__.py
    ├── risk_evaluator.py     # 风险设备评估设备服务设备
    └── exporter.py           # 导出设备服务设备
```

---

## 注意事项设备

1. 数据库设备使用设备 SQLite设备，文件名为设备 `port_inspection.db`设备
2. 服务设备默认设备端口设备为设备 5000设备，可在设备 app.py 中设备修改设备
3. 所有日期设备格式设备使用设备 ISO 8601 格式设备 (YYYY-MM-DDTHH:MM:SS)设备
4. 重量设备单位设备为设备千克设备 (kg)设备
5. 风险设备等级设备包括设备: critical (致命设备)设备、high (高风险设备)设备、medium (中风险设备)设备、low (低风险设备)设备
6. 复核设备状态设备包括设备: pending (待复核设备)设备、reviewed (已复核设备)设备、approved (已通过设备)设备、rejected (已驳回设备)设备

---

## License

MIT License

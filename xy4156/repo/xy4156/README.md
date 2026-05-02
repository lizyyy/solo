# 危化品小瓶分装台

高校实验室危化品分装管理系统纯后端API，专为实验室安全员设计。

## 功能特性

- **台账管理**：试剂台账、批次、瓶码、柜位
- **分装管理**：分装领用单记录，库存守恒校验
- **配伍禁忌**：互斥试剂同柜检测
- **温度监控**：低温试剂温控越界、断档检测
- **废液管理**：废液桶状态机、逾期处置检测
- **人工复核**：分装记录、废液记录复核流程
- **审计日志**：所有操作记录完整追踪
- **数据导入导出**：支持 CSV/JSON 导入，Markdown/CSV/JSON 导出

## 快速开始

### 环境准备

```bash
# 安装依赖
pip install -r requirements.txt
```

### 启动服务

```bash
# 启动开发服务器
python main.py
```

服务将在 `http://localhost:5000` 启动

### 加载示例数据

```bash
# 打开另一个终端，运行以下命令加载示例数据
python -c "from app import create_app; from app.sample_data import load_all_sample_data; app = create_app(); ctx = app.app_context(); ctx.push(); load_all_sample_data()"
```

## API 验证流程 (curl)

### 1. 健康检查

```bash
curl http://localhost:5000/health
```

**预期响应：**
```json
{"status": "healthy", "service": "危化品小瓶分装台"}
```

---

### 2. 试剂台账管理

#### 2.1 创建试剂台账

```bash
curl -X POST http://localhost:5000/api/reagent/ledger \
  -H "Content-Type: application/json" \
  -d '{
    "reagent_name": "甲醇",
    "cas_number": "67-56-1",
    "hazard_class": "易燃品",
    "hazard_details": "易燃液体，闪点11°C",
    "incompatible_with": "强氧化剂、酸类、酸酐、碱金属",
    "is_low_temp": false,
    "created_by": "李老师"
  }'
```

#### 2.2 查询所有试剂台账

```bash
curl http://localhost:5000/api/reagent/ledger
```

#### 2.3 查询单个试剂台账（包含批次和瓶码）

```bash
# 先获取某个台账ID
curl http://localhost:5000/api/reagent/ledger/1
```

---

### 3. 柜位管理

#### 3.1 创建柜位

```bash
curl -X POST http://localhost:5000/api/reagent/cabinet \
  -H "Content-Type: application/json" \
  -d '{
    "cabinet_code": "CAB-NEW-001",
    "name": "新增易燃品柜",
    "location": "实验室D区",
    "hazard_class": "易燃品",
    "is_low_temp": false
  }'
```

#### 3.2 创建低温柜

```bash
curl -X POST http://localhost:5000/api/reagent/cabinet \
  -H "Content-Type: application/json" \
  -d '{
    "cabinet_code": "CAB-FREEZER-001",
    "name": "新增低温冷藏柜",
    "location": "实验室D区",
    "is_low_temp": true,
    "min_temp": -20.0,
    "max_temp": 4.0
  }'
```

#### 3.3 查询所有柜位

```bash
curl http://localhost:5000/api/reagent/cabinet
```

---

### 4. 批次管理

#### 4.1 创建批次

```bash
curl -X POST http://localhost:5000/api/reagent/batch \
  -H "Content-Type: application/json" \
  -d '{
    "batch_number": "MEOH-2024-B001",
    "ledger_id": 1,
    "total_volume": 4000.0,
    "unit": "mL",
    "supplier": "国药集团",
    "manufactured_date": "2024-01-15",
    "expiry_date": "2025-01-15"
  }'
```

#### 4.2 查询所有批次

```bash
curl http://localhost:5000/api/reagent/batch
```

---

### 5. 瓶码管理与配伍禁忌验证

#### 5.1 创建瓶码（会自动校验柜位相容性）

```bash
# 正常情况：易燃品放入易燃品柜
curl -X POST http://localhost:5000/api/reagent/bottle \
  -H "Content-Type: application/json" \
  -d '{
    "bottle_code": "BOT-MEOH-001",
    "batch_id": 1,
    "volume": 500.0,
    "unit": "mL",
    "cabinet_id": 1
  }'
```

#### 5.2 验证互斥试剂同柜（预期失败）

```bash
# 创建一个氧化剂台账（如果还没有）
curl -X POST http://localhost:5000/api/reagent/ledger \
  -H "Content-Type: application/json" \
  -d '{
    "reagent_name": "高锰酸钾",
    "cas_number": "7722-64-7",
    "hazard_class": "氧化剂",
    "hazard_details": "强氧化剂",
    "is_low_temp": false
  }'

# 创建氧化剂批次
curl -X POST http://localhost:5000/api/reagent/batch \
  -H "Content-Type: application/json" \
  -d '{
    "batch_number": "KMNO4-2024-B001",
    "ledger_id": 2,
    "total_volume": 1000.0,
    "unit": "g",
    "supplier": "阿拉丁"
  }'

# 尝试将氧化剂瓶放入易燃品柜（预期失败）
curl -X POST http://localhost:5000/api/reagent/bottle \
  -H "Content-Type: application/json" \
  -d '{
    "bottle_code": "BOT-KMNO4-001",
    "batch_id": 2,
    "volume": 500.0,
    "unit": "g",
    "cabinet_id": 1
  }'
```

**预期错误响应：**
```json
{
  "error": "柜位相容性检查失败",
  "details": {
    "valid": false,
    "message": "互斥试剂同柜风险...",
    "details": { ... }
  }
}
```

#### 5.3 将氧化剂放入正确的柜位

```bash
# 放入氧化剂柜
curl -X POST http://localhost:5000/api/reagent/bottle \
  -H "Content-Type: application/json" \
  -d '{
    "bottle_code": "BOT-KMNO4-001",
    "batch_id": 2,
    "volume": 500.0,
    "unit": "g",
    "cabinet_id": 2
  }'
```

#### 5.4 查询所有瓶码

```bash
curl http://localhost:5000/api/reagent/bottle
```

#### 5.5 移动瓶码到新柜位

```bash
curl -X POST http://localhost:5000/api/reagent/bottle/1/place \
  -H "Content-Type: application/json" \
  -d '{
    "cabinet_id": 1,
    "placed_by": "王老师"
  }'
```

---

### 6. 分装管理与库存守恒验证

#### 6.1 正常分装

```bash
curl -X POST http://localhost:5000/api/dispense/ \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": 1,
    "dispensed_volume": 100.0,
    "unit": "mL",
    "experiment_name": "有机合成实验课",
    "user_name": "张学生",
    "dispense_time": "2024-03-15 09:30:00"
  }'
```

#### 6.2 验证超量分装（预期失败）

```bash
# 尝试分装超过库存的量
curl -X POST http://localhost:5000/api/dispense/ \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": 1,
    "dispensed_volume": 10000.0,
    "unit": "mL",
    "experiment_name": "测试超量",
    "user_name": "测试用户"
  }'
```

**预期错误响应：**
```json
{
  "error": "库存校验失败",
  "details": {
    "valid": false,
    "message": "批次超量分装风险...",
    "details": { ... }
  }
}
```

#### 6.3 查询所有分装记录

```bash
curl http://localhost:5000/api/dispense/
```

#### 6.4 查询待复核的分装记录

```bash
curl http://localhost:5000/api/dispense/pending
```

---

### 7. 温度记录与温控验证

#### 7.1 正常温度记录

```bash
curl -X POST http://localhost:5000/api/temperature/ \
  -H "Content-Type: application/json" \
  -d '{
    "cabinet_id": 4,
    "temperature": 0.0,
    "record_time": "2024-03-15 08:00:00",
    "reported_by": "李老师"
  }'
```

#### 7.2 验证温度越界（高温）

```bash
curl -X POST http://localhost:5000/api/temperature/ \
  -H "Content-Type: application/json" \
  -d '{
    "cabinet_id": 4,
    "temperature": 10.0,
    "record_time": "2024-03-15 10:00:00",
    "reported_by": "李老师"
  }'
```

**预期告警响应：**
```json
{
  "message": "温度记录已保存，存在告警",
  "alerts": [
    {
      "valid": false,
      "message": "温控异常：柜位...温度10.0°C越界",
      "details": { ... }
    }
  ]
}
```

#### 7.3 验证温度越界（低温）

```bash
curl -X POST http://localhost:5000/api/temperature/ \
  -H "Content-Type: application/json" \
  -d '{
    "cabinet_id": 4,
    "temperature": -25.0,
    "record_time": "2024-03-15 12:00:00"
  }'
```

#### 7.4 查询所有温度记录

```bash
curl http://localhost:5000/api/temperature/
```

#### 7.5 查询温度告警记录

```bash
curl http://localhost:5000/api/temperature/alerts
```

#### 7.6 检查柜位温控状态

```bash
curl http://localhost:5000/api/temperature/cabinet/4/check
```

---

### 8. 废液桶管理与逾期检测

#### 8.1 创建废液桶

```bash
curl -X POST http://localhost:5000/api/waste/bucket \
  -H "Content-Type: application/json" \
  -d '{
    "bucket_code": "WB-TEST-001",
    "waste_type": "测试废液",
    "hazard_class": "易燃品",
    "max_volume": 20.0,
    "unit": "L",
    "start_date": "2024-01-01",
    "expiry_days": 90
  }'
```

#### 8.2 创建已逾期的废液桶（用于测试）

```bash
curl -X POST http://localhost:5000/api/waste/bucket \
  -H "Content-Type: application/json" \
  -d '{
    "bucket_code": "WB-EXPIRED-001",
    "waste_type": "过期废液",
    "hazard_class": "腐蚀品",
    "max_volume": 20.0,
    "current_volume": 10.0,
    "unit": "L",
    "start_date": "2023-01-01",
    "expiry_days": 90
  }'
```

#### 8.3 添加废液记录

```bash
curl -X POST http://localhost:5000/api/waste/record \
  -H "Content-Type: application/json" \
  -d '{
    "bucket_id": 1,
    "waste_name": "甲醇废液",
    "volume": 500.0,
    "unit": "mL",
    "user_name": "张学生",
    "record_time": "2024-03-15 16:00:00"
  }'
```

#### 8.4 查询所有废液桶

```bash
curl http://localhost:5000/api/waste/bucket
```

#### 8.5 查询逾期废液桶

```bash
curl http://localhost:5000/api/waste/expired
```

#### 8.6 处置废液桶

```bash
curl -X POST http://localhost:5000/api/waste/bucket/2/dispose \
  -H "Content-Type: application/json" \
  -d '{
    "disposal_date": "2024-03-15",
    "disposed_by": "王老师"
  }'
```

#### 8.7 查询所有废液记录

```bash
curl http://localhost:5000/api/waste/record
```

---

### 9. 人工复核流程

#### 9.1 查询待复核记录

```bash
curl http://localhost:5000/api/review/pending
```

#### 9.2 复核分装记录（通过）

```bash
curl -X POST http://localhost:5000/api/review/dispense/1 \
  -H "Content-Type: application/json" \
  -d '{
    "reviewed_by": "李安全员",
    "review_comment": "分装记录核对无误，用量合理",
    "approved": true
  }'
```

#### 9.3 复核废液记录（驳回）

```bash
# 假设废液记录ID为1
curl -X POST http://localhost:5000/api/review/waste/1 \
  -H "Content-Type: application/json" \
  -d '{
    "reviewed_by": "王安全员",
    "review_comment": "废液量记录异常，请核实后重新提交",
    "approved": false
  }'
```

#### 9.4 验证复核签名缺失（预期失败）

```bash
curl -X POST http://localhost:5000/api/review/dispense/1 \
  -H "Content-Type: application/json" \
  -d '{
    "reviewed_by": "",
    "review_comment": "测试",
    "approved": true
  }'
```

**预期错误响应：**
```json
{
  "error": "复核签名校验失败",
  "details": {
    "valid": false,
    "message": "复核签名缺失",
    "details": { ... }
  }
}
```

---

### 10. 审计日志

#### 10.1 查询所有审计日志

```bash
curl http://localhost:5000/api/audit/
```

#### 10.2 分页查询审计日志

```bash
curl "http://localhost:5000/api/audit/?limit=10&offset=0"
```

#### 10.3 按操作类型过滤

```bash
curl "http://localhost:5000/api/audit/?action=CREATE_LEDGER"
```

#### 10.4 按资源类型过滤

```bash
curl "http://localhost:5000/api/audit/?resource_type=Batch"
```

#### 10.5 按操作用户过滤

```bash
curl "http://localhost:5000/api/audit/?user_name=李老师"
```

#### 10.6 查询可用的操作类型

```bash
curl http://localhost:5000/api/audit/actions
```

#### 10.7 查询可用的资源类型

```bash
curl http://localhost:5000/api/audit/resource-types
```

---

### 11. 数据导入（CSV）

#### 11.1 导入试剂台账 CSV

```bash
# 准备CSV内容
CSV_LEDGERS="reagent_name,cas_number,hazard_class,hazard_details,is_low_temp
乙醇,64-17-5,易燃品,易燃液体,false
氯化钠,7647-14-5,普通试剂,普通试剂,false"

# 导入
curl -X POST "http://localhost:5000/api/import/ledgers/csv?created_by=批量导入" \
  -H "Content-Type: text/csv" \
  -d "$CSV_LEDGERS"
```

#### 11.2 导入柜位 CSV

```bash
CSV_CABINETS="cabinet_code,name,location,hazard_class,is_low_temp,min_temp,max_temp
IMP-CAB-001,导入柜位1,实验室E区,普通试剂,false,,
IMP-CAB-002,导入低温柜,实验室E区,,true,-20,4"

curl -X POST "http://localhost:5000/api/import/cabinets/csv" \
  -H "Content-Type: text/csv" \
  -d "$CSV_CABINETS"
```

#### 11.3 导入废液桶 CSV

```bash
CSV_BUCKETS="bucket_code,waste_type,hazard_class,max_volume,current_volume,start_date,expiry_days
IMP-WB-001,导入废液,易燃品,20,5,2024-01-01,90"

curl -X POST "http://localhost:5000/api/import/waste-buckets/csv" \
  -H "Content-Type: text/csv" \
  -d "$CSV_BUCKETS"
```

---

### 12. 数据导出

#### 12.1 导出试剂台账

```bash
# JSON格式
curl http://localhost:5000/api/export/ledgers/json

# CSV格式
curl http://localhost:5000/api/export/ledgers/csv -o ledgers.csv

# Markdown格式
curl http://localhost:5000/api/export/ledgers/markdown -o ledgers.md
```

#### 12.2 导出批次记录

```bash
curl http://localhost:5000/api/export/batches/json
```

#### 12.3 导出分装记录

```bash
curl http://localhost:5000/api/export/dispense/json
```

#### 12.4 导出废液记录

```bash
curl http://localhost:5000/api/export/waste/json
```

#### 12.5 导出温度记录

```bash
curl http://localhost:5000/api/export/temperature/json
```

---

## 运行测试

```bash
# 运行所有测试
pytest

# 运行测试并显示覆盖率
pytest --cov=app

# 运行特定测试文件
pytest tests/test_rules.py -v
```

## 项目结构

```
xy4156/
├── app/
│   ├── __init__.py          # Flask应用工厂
│   ├── models.py            # 数据模型定义
│   ├── rules.py             # 业务规则引擎
│   ├── audit_log.py         # 审计日志模块
│   ├── import_export.py     # 导入导出模块
│   ├── sample_data.py       # 示例数据生成
│   └── routers/
│       ├── __init__.py
│       ├── reagent.py       # 试剂/柜位/瓶码路由
│       ├── dispense.py      # 分装记录路由
│       ├── temperature.py   # 温度记录路由
│       ├── waste.py         # 废液桶/记录路由
│       ├── review.py        # 复核路由
│       ├── audit.py         # 审计日志路由
│       └── export.py        # 导入导出路由
├── instance/                # 数据库文件目录
├── tests/
│   ├── __init__.py
│   └── test_rules.py        # 规则引擎测试
├── main.py                  # 应用入口
├── requirements.txt         # 依赖包列表
└── README.md                # 本文档
```

## 核心校验规则说明

### 1. 库存守恒（InventoryRule）
- 分装体积必须大于0
- 分装体积不得超过批次剩余体积
- 超量分装将被阻止并返回详细信息

### 2. 配伍禁忌（CompatibilityRule）
- 基于危险分类的不相容组定义
- 瓶码放入柜位时自动校验
- 柜内现有试剂与新试剂互斥检测

**不相容组定义：**
- 爆炸品 ↔ 易燃品、氧化剂、腐蚀品、压缩气体
- 氧化剂 ↔ 易燃品、爆炸品、腐蚀品
- 易燃品 ↔ 氧化剂、爆炸品、腐蚀品
- 腐蚀品 ↔ 爆炸品、易燃品、氧化剂
- 压缩气体 ↔ 爆炸品、易燃品、腐蚀品

### 3. 温度越界（TemperatureRule）
- 低温柜位温度范围校验
- 低于min_temp触发低温告警
- 高于max_temp触发高温告警

### 4. 温控断档（TemperatureRule）
- 检查柜位最新温度记录时间
- 默认4小时无记录视为断档风险

### 5. 废液桶容量（WasteBucketRule）
- 添加废液时校验剩余容量
- 容量超过80%触发"即将满"警告
- 容量超过100%阻止添加

### 6. 废液逾期（WasteBucketRule）
- 基于start_date + expiry_days计算到期日
- 超过到期日标记为"逾期"状态
- 距离到期7天内触发"即将到期"警告

### 7. 复核签名（ReviewRule）
- 复核人姓名不能为空
- 空白字符串视为无效签名

## 数据库模型

### 主要实体关系
```
ReagentLedger (试剂台账)
    └── Batch (批次) - 一对多
    │       └── Bottle (瓶码) - 一对多
    │       └── DispenseRecord (分装记录) - 一对多
    └── Bottle (瓶码) - 一对多

Cabinet (柜位)
    └── Bottle (瓶码) - 一对多
    └── TemperatureRecord (温度记录) - 一对多

WasteBucket (废液桶)
    └── WasteRecord (废液记录) - 一对多

AuditLog (审计日志) - 独立表
```

## 枚举类型

### HazardClass（危险分类）
- EXPLOSIVE: 爆炸品
- FLAMMABLE: 易燃品
- OXIDIZING: 氧化剂
- TOXIC: 有毒品
- CORROSIVE: 腐蚀品
- COMPRESSED_GAS: 压缩气体
- RADIOACTIVE: 放射性
- ORDINARY: 普通试剂

### WasteStatus（废液桶状态）
- ACTIVE: 正常接收
- WARNING: 即将满
- FULL: 已满
- EXPIRED: 逾期
- DISPOSED: 已处置

### ReviewStatus（复核状态）
- PENDING: 待复核
- APPROVED: 已通过
- REJECTED: 已驳回

## 注意事项

1. **生产环境部署**：
   - 请修改 `SECRET_KEY` 环境变量
   - 考虑使用 PostgreSQL/MySQL 替代 SQLite
   - 配置适当的 CORS 策略

2. **数据备份**：
   - SQLite 数据库位于 `instance/chemicals.db`
   - 定期备份该文件

3. **时间处理**：
   - 系统默认使用 UTC 时间
   - 导入导出时请注意时区转换

4. **单位换算**：
   - 分装/瓶码默认单位：mL
   - 废液桶默认单位：L
   - API 调用时请指定正确的单位

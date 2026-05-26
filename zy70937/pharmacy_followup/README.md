# 药店慢病随访提醒API

## 项目概述

解决药店慢病顾客购药记录导入混乱、随访靠个人微信记录的问题。系统支持上传购药CSV、顾客档案JSON和随访规则，自动分类处理结果（正常/待确认/失败），生成随访提醒，并支持全链路追踪。

## 核心功能

### 1. 数据导入与幂等性
- 支持购药记录CSV上传
- 支持顾客档案JSON上传
- 支持随访规则JSON上传
- 基于文件哈希的幂等控制，同一文件重复上传不重复处理

### 2. 业务规则引擎
- **间隔提醒规则**：根据病种和药品自动计算随访时间
- **禁忌药检查**：自动识别禁忌药品并告警
- **隐私脱敏**：手机号、身份证号、地址自动脱敏存储

### 3. 结果分类
- **正常项**：数据完整且无规则冲突
- **待确认项**：数据有瑕疵但不影响使用，需人工确认
- **失败项**：数据严重错误，保留原始字段和处理建议

### 4. 全链路追踪
- 从单条随访提醒可一路追溯到：
  - 购药记录明细
  - 顾客档案信息
  - 导入处理记录
  - 所属批次和报告

## 快速开始

### 环境要求
- Python 3.9+
- pip

### 安装依赖
```bash
cd pharmacy_followup
pip install -r requirements.txt
```

### 启动服务
```bash
python main.py
```
服务启动后访问: http://localhost:8000

### API文档
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 本地复跑完整流程

### 步骤1: 启动服务
```bash
cd pharmacy_followup
python main.py
```

### 步骤2: 运行测试脚本（推荐）
```bash
pip install requests
python tests/test_local.py
```

测试脚本会自动完成以下流程：
1. 健康检查
2. 上传顾客档案（5条记录，含1条待确认）
3. 上传购药记录（10条记录，含失败和禁忌药告警）
4. 生成随访报告
5. 链路追踪演示
6. 重复上传幂等性验证

### 步骤3: 手动测试（可选）

#### 上传顾客档案
```bash
curl -X POST "http://localhost:8000/api/v1/upload/customers" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@data/customers.json"
```

#### 上传购药记录
```bash
curl -X POST "http://localhost:8000/api/v1/upload/purchase" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@data/purchase_records.csv"
```

#### 生成随访报告
```bash
curl -X POST "http://localhost:8000/api/v1/report/generate"
```

#### 查看随访提醒列表
```bash
curl "http://localhost:8000/api/v1/reminders"
```

#### 链路追踪（替换trace_id为实际值）
```bash
curl "http://localhost:8000/api/v1/trace/{trace_id}"
```

#### 查看所有批次
```bash
curl "http://localhost:8000/api/v1/batches"
```

#### 查看当前规则
```bash
curl "http://localhost:8000/api/v1/rules"
```

## 内置默认规则

| 规则ID | 类型 | 病种 | 间隔/禁忌 | 说明 |
|--------|------|------|-----------|------|
| RULE_HYPERTENSION_30 | 间隔 | 高血压 | 30天 | 高血压患者每月随访 |
| RULE_DIABETES_30 | 间隔 | 糖尿病 | 30天 | 糖尿病患者每月随访 |
| RULE_HYPERLIPIDEMIA_60 | 间隔 | 高血脂 | 60天 | 高血脂患者每两月随访 |
| RULE_INSULIN_15 | 间隔 | 糖尿病(胰岛素) | 15天 | 胰岛素使用者每两周随访 |
| RULE_HYPERTENSION_FORBIDDEN | 禁忌 | 高血压 | 甘草、人参、糖皮质激素 | 高血压患者禁用 |
| RULE_DIABETES_FORBIDDEN | 禁忌 | 糖尿病 | 糖浆、蜜炼、糖衣 | 糖尿病患者禁用 |

## 数据格式说明

### 顾客档案JSON格式
```json
[
  {
    "customer_id": "CUST001",
    "name": "张三",
    "phone": "13800138001",
    "id_card": "110101198001011234",
    "disease_type": "高血压",
    "birthday": "1980-01-01",
    "address": "北京市朝阳区建国路88号"
  }
]
```

### 购药记录CSV格式
```csv
record_id,customer_id,药品名称,规格,购药日期,数量,用法用量,医生
PUR001,CUST001,缬沙坦胶囊,80mg*28粒,2026-04-20,2,每日1次每次1粒,王医生
```

### 随访规则JSON格式
```json
[
  {
    "rule_id": "RULE_CUSTOM_001",
    "rule_type": "interval",
    "disease_type": "冠心病",
    "interval_days": 30,
    "description": "冠心病患者每月随访"
  }
]
```

## 项目结构

```
pharmacy_followup/
├── main.py                 # 服务入口
├── database.py             # 数据库配置
├── requirements.txt        # 依赖清单
├── README.md               # 本文档
├── models/
│   ├── __init__.py
│   ├── orm_models.py       # SQLAlchemy ORM模型
│   └── schemas.py          # Pydantic数据模型
├── api/
│   ├── __init__.py
│   └── routes.py           # API路由
├── services/
│   ├── __init__.py
│   └── processor.py        # 核心处理逻辑
├── rules/
│   ├── __init__.py
│   ├── engine.py           # 规则引擎
│   └── default_rules.py    # 默认规则
├── utils/
│   ├── __init__.py
│   ├── privacy.py          # 隐私脱敏工具
│   └── data_import.py      # 数据导入解析
├── data/                   # 测试数据
│   ├── customers.json
│   └── purchase_records.csv
└── tests/
    ├── __init__.py
    └── test_local.py       # 本地复跑测试脚本
```

## 数据库表结构

- **batches**: 导入批次记录（用于幂等控制）
- **customers**: 顾客档案（脱敏存储）
- **purchase_records**: 购药记录
- **followup_rules**: 随访规则
- **processed_records**: 处理记录（含正常/待确认/失败分类）
- **followup_reminders**: 随访提醒明细

## 常见问题

### Q: 同一文件上传两次会怎样？
A: 系统基于文件MD5哈希判断，第二次会直接返回历史处理结果，不会重复入库。

### Q: 失败记录如何处理？
A: 失败记录会保留原始数据和错误原因，并给出处理建议。修正数据后可重新上传。

### Q: 隐私数据如何保护？
A: 手机号、身份证号、地址在入库前自动脱敏，原始数据仅在处理记录的raw_data中保留便于排查。

### Q: 如何排查一条提醒的来龙去脉？
A: 使用 `/api/v1/trace/{trace_id}` 接口，可以看到从原始购药记录到最终提醒的完整链路。

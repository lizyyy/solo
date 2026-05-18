# 水质采样实验室结果单位换算后端API

基于 FastAPI + SQLite 实现的水质采样实验室数据管理系统，支持单位换算、点位匹配、阈值判定、缺样提示、复核报告导出等核心功能。

## 核心功能

- **数据管理**: 采样点位、现场记录、实验室结果、检测参数、计量单位、水质阈值的增删改查
- **单位换算**: 自动进行浓度单位换算（mg/L、μg/L、ng/L等）
- **点位匹配**: 采样点有效性验证，防止无效点位数据录入
- **阈值判定**: 根据水质标准自动判定水质等级
- **缺样检测**: 批量检测缺失的检测参数
- **状态流转**: 实验室结果审核、修正、撤回
- **审计日志**: 完整记录所有操作，保留原始数据和修改痕迹
- **复核报告**: 批量复核报告生成和Excel导出

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问:
- API文档: http://localhost:8000/docs
- 替代文档: http://localhost:8000/redoc

### 3. 初始化测试数据

```bash
python seed_data.py
```

将创建以下测试数据:
- 4个采样点位 (W001-W004)
- 3个浓度单位 + pH单位
- 5个水质参数 (pH、DO、COD、NH3N、TP)
- 21条水质阈值（Ⅰ-Ⅴ类水）
- 3条现场采样记录
- 12条实验室检测结果

## API 主流程示例 (curl)

### 1. 创建采样点

```bash
curl -X POST "http://localhost:8000/sampling-points/" \
  -H "Content-Type: application/json" \
  -d '{"point_code": "TEST001", "point_name": "测试点位", "location": "测试位置", "river_basin": "测试流域"}'
```

### 2. 创建单位

```bash
curl -X POST "http://localhost:8000/units/" \
  -H "Content-Type: application/json" \
  -d '{"unit_code": "MG_L", "unit_name": "毫克/升", "dimension": "浓度", "conversion_factor": 1000.0}'

curl -X POST "http://localhost:8000/units/" \
  -H "Content-Type: application/json" \
  -d '{"unit_code": "UG_L", "unit_name": "微克/升", "dimension": "浓度", "conversion_factor": 1.0}'

curl -X POST "http://localhost:8000/units/" \
  -H "Content-Type: application/json" \
  -d '{"unit_code": "NG_L", "unit_name": "纳克/升", "dimension": "浓度", "conversion_factor": 0.001}'

curl -X POST "http://localhost:8000/units/" \
  -H "Content-Type: application/json" \
  -d '{"unit_code": "PH", "unit_name": "pH值", "dimension": "pH", "conversion_factor": 1.0}'
```

### 3. 创建参数

```bash
curl -X POST "http://localhost:8000/parameters/" \
  -H "Content-Type: application/json" \
  -d '{"param_code": "DO", "param_name": "溶解氧"}'
```

### 4. 创建现场记录

```bash
curl -X POST "http://localhost:8000/field-records/" \
  -H "Content-Type: application/json" \
  -d '{
    "record_code": "FR2024001",
    "sampling_point_id": 1,
    "sampling_time": "2024-01-15T09:00:00",
    "collector": "张三",
    "weather": "晴",
    "temperature": 15.5
  }'
```

### 5. 创建实验室结果（自动单位换算）

```bash
curl -X POST "http://localhost:8000/lab-results/" \
  -H "Content-Type: application/json" \
  -d '{
    "field_record_id": 1,
    "parameter_id": 1,
    "raw_value": 6500.0,
    "raw_unit_id": 2,
    "analyst": "测试员"
  }'
```

### 6. 审核实验室结果

```bash
curl -X POST "http://localhost:8000/lab-results/1/approve" \
  -H "Content-Type: application/json" \
  -d '{"operator": "审核员A", "conclusion": "数据正常，符合标准"}'
```

### 7. 人工修正数据

```bash
curl -X POST "http://localhost:8000/lab-results/1/correct" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "质控员",
    "conclusion": "原始数据录入错误",
    "raw_value": 6.5,
    "remark": "已修正"
  }'
```

### 8. 撤回审核

```bash
curl -X POST "http://localhost:8000/lab-results/1/withdraw" \
  -H "Content-Type: application/json" \
  -d '{"operator": "质控主管", "conclusion": "发现数据异常，需重新检测"}'
```

### 9. 查看审计日志

```bash
curl "http://localhost:8000/audit-logs/?operation_type=correct"
```

### 10. 单位换算工具

```bash
curl "http://localhost:8000/utils/convert-unit?value=6500&from_unit_id=2&to_unit_id=1"
```

### 11. 缺样检测

```bash
curl "http://localhost:8000/utils/missing-samples?field_record_ids=1,2,3"
```

### 12. 阈值判定

```bash
curl "http://localhost:8000/lab-results/1/threshold-check"
```

### 13. 创建复核报告

```bash
curl -X POST "http://localhost:8000/review-reports/" \
  -H "Content-Type: application/json" \
  -d '{
    "report_code": "RPT2024001",
    "field_record_ids": [1, 2, 3],
    "reviewer": "复核员"
  }'
```

### 14. 完成复核报告

```bash
curl -X POST "http://localhost:8000/review-reports/1/finalize?operator=复核主管&conclusion=数据完整，符合要求"
```

### 15. 导出复核报告Excel

```bash
curl -O -J "http://localhost:8000/review-reports/1/export"
```

## 异常与冲突场景测试

### 1. 点位编号重复（编码冲突）

```bash
# 第一次创建成功
curl -X POST "http://localhost:8000/sampling-points/" \
  -H "Content-Type: application/json" \
  -d '{"point_code": "W001", "point_name": "点位1"}'

# 第二次创建失败，返回400
curl -X POST "http://localhost:8000/sampling-points/" \
  -H "Content-Type: application/json" \
  -d '{"point_code": "W001", "point_name": "点位2"}'
```

### 2. 重复审核同一条结果

```bash
# 第一次审核成功
curl -X POST "http://localhost:8000/lab-results/1/approve" \
  -H "Content-Type: application/json" \
  -d '{"operator": "审核员A", "conclusion": "数据正常"}'

# 第二次审核失败，返回400
curl -X POST "http://localhost:8000/lab-results/1/approve" \
  -H "Content-Type: application/json" \
  -d '{"operator": "审核员B", "conclusion": "再次审核"}'
```

### 3. 不同维度单位无法换算

```bash
# 浓度单位与pH单位无法换算，返回400
curl "http://localhost:8000/utils/convert-unit?value=7&from_unit_id=1&to_unit_id=4"
```

### 4. 复核报告编号重复

```bash
# 第一次创建成功
curl -X POST "http://localhost:8000/review-reports/" \
  -H "Content-Type: application/json" \
  -d '{"report_code": "RPT001", "field_record_ids": [1], "reviewer": "复核员"}'

# 第二次创建失败，返回400
curl -X POST "http://localhost:8000/review-reports/" \
  -H "Content-Type: application/json" \
  -d '{"report_code": "RPT001", "field_record_ids": [2], "reviewer": "另一复核员"}'
```

### 5. 重复完成复核报告

```bash
# 第一次完成成功
curl -X POST "http://localhost:8000/review-reports/1/finalize?operator=复核主管&conclusion=第一次完成"

# 第二次完成失败，返回400
curl -X POST "http://localhost:8000/review-reports/1/finalize?operator=复核主管&conclusion=第二次完成"
```

## 运行测试

```bash
pytest test_main.py -v
```

测试覆盖范围:
- 采样点CRUD及编码冲突
- 单位换算（成功/失败场景）
- 实验室结果创建、审核、修正、撤回
- 审核日志记录原始数据和修改数据
- 阈值判定功能
- 缺样检测功能
- 复核报告创建、完成、导出
- 各类异常与冲突场景

## 项目结构

```
.
├── main.py              # FastAPI主应用，路由定义
├── database.py          # 数据库模型和连接配置
├── schemas.py           # Pydantic数据模型
├── services.py          # 业务逻辑服务层
├── seed_data.py         # 测试数据初始化脚本
├── test_main.py         # pytest测试用例
├── requirements.txt     # 依赖列表
└── README.md           # 项目文档
```

## 核心数据模型

- **SamplingPoint**: 采样点位信息
- **Unit**: 计量单位（含换算因子）
- **Parameter**: 检测参数（pH、DO、COD等）
- **Threshold**: 水质阈值（不同水质等级的限值）
- **FieldRecord**: 现场采样记录
- **LabResult**: 实验室检测结果
- **AuditLog**: 审计日志（所有操作记录）
- **ReviewReport**: 复核报告

## 业务状态流转

### 实验室结果状态
```
创建 → 待审核 → 已审核
              ↓ (修正)
           待审核
              ↓ (撤回)
           待审核
```

### 复核报告状态
```
创建(draft) → 完成(finalized)
```

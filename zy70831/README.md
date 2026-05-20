# 公立医院床位周转API服务

用于处理住院处床位周转材料的API服务，支持去重、审计追踪和报告生成。

## 功能特性

- ✅ 批次提交与自动去重（同一批材料重复提交返回原有结果）
- ✅ 床位周转记录管理
- ✅ 完整审计日志（记录谁改过、为什么改、改动前后内容）
- ✅ 关键字段追溯功能（从原始输入追踪到最终报告）
- ✅ 床位周转统计报告生成
- ✅ Excel报告下载

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 启动服务

```bash
python main.py
```

服务将在 `http://localhost:8000` 启动

### API文档

启动后访问 Swagger UI: `http://localhost:8000/docs`

---

## 完整测试流程

以下是从创建批次到下载报告的完整curl命令示例：

### 1. 提交床位周转批次

```bash
curl -X POST "http://localhost:8000/api/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "submitted_by": "王护士长",
    "remark": "2024年5月第二周床位周转材料",
    "records": [
      {
        "department": "内科",
        "bed_number": "A-101",
        "patient_id": "P20240501001",
        "patient_name": "张三",
        "admission_date": "2024-05-01T08:00:00",
        "discharge_date": "2024-05-07T14:30:00",
        "diagnosis": "冠心病",
        "surgeon": "李医生"
      },
      {
        "department": "外科",
        "bed_number": "B-203",
        "patient_id": "P20240502002",
        "patient_name": "李四",
        "admission_date": "2024-05-02T09:15:00",
        "discharge_date": "2024-05-10T10:00:00",
        "diagnosis": "急性阑尾炎",
        "surgeon": "王医生"
      },
      {
        "department": "内科",
        "bed_number": "A-105",
        "patient_id": "P20240503003",
        "patient_name": "王五",
        "admission_date": "2024-05-03T14:00:00",
        "discharge_date": null,
        "diagnosis": "高血压",
        "surgeon": "赵医生"
      }
    ]
  }'
```

### 2. 验证去重机制（再次提交相同批次）

```bash
curl -X POST "http://localhost:8000/api/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "submitted_by": "王护士长",
    "remark": "2024年5月第二周床位周转材料",
    "records": [
      {
        "department": "内科",
        "bed_number": "A-101",
        "patient_id": "P20240501001",
        "patient_name": "张三",
        "admission_date": "2024-05-01T08:00:00",
        "discharge_date": "2024-05-07T14:30:00",
        "diagnosis": "冠心病",
        "surgeon": "李医生"
      },
      {
        "department": "外科",
        "bed_number": "B-203",
        "patient_id": "P20240502002",
        "patient_name": "李四",
        "admission_date": "2024-05-02T09:15:00",
        "discharge_date": "2024-05-10T10:00:00",
        "diagnosis": "急性阑尾炎",
        "surgeon": "王医生"
      },
      {
        "department": "内科",
        "bed_number": "A-105",
        "patient_id": "P20240503003",
        "patient_name": "王五",
        "admission_date": "2024-05-03T14:00:00",
        "discharge_date": null,
        "diagnosis": "高血压",
        "surgeon": "赵医生"
      }
    ]
  }'
```

预期返回：`"is_duplicate": true, "message": "该批次材料已提交过，返回原有处理结果"`

### 3. 获取批次列表

```bash
curl -X GET "http://localhost:8000/api/batches?limit=10"
```

### 4. 获取批次详情（替换 {batch_id} 为实际ID）

```bash
BATCH_ID="替换为实际的batch_id"
curl -X GET "http://localhost:8000/api/batches/$BATCH_ID"
```

### 5. 修改记录（替换 {record_id} 为实际ID）

```bash
RECORD_ID="替换为实际的record_id"
curl -X PUT "http://localhost:8000/api/records/$RECORD_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "李主任",
    "reason": "患者诊断信息更正，经核实为高血压3级",
    "updates": {
      "diagnosis": "高血压3级",
      "discharge_date": "2024-05-15T09:00:00"
    }
  }'
```

### 6. 查询批次审计日志

```bash
curl -X GET "http://localhost:8000/api/audit/batch/$BATCH_ID"
```

### 7. 查询单条记录审计日志

```bash
curl -X GET "http://localhost:8000/api/audit/record/$RECORD_ID"
```

### 8. 关键字段追溯（查看修改历史）

```bash
curl -X GET "http://localhost:8000/api/trace/$RECORD_ID"
```

### 9. 生成床位周转统计报告（JSON格式）

```bash
curl -X GET "http://localhost:8000/api/reports/$BATCH_ID"
```

### 10. 下载Excel报告

```bash
curl -X GET "http://localhost:8000/api/reports/$BATCH_ID/download" \
  -o "床位周转报告.xlsx"
```

---

## Python脚本示例（完整流程）

```python
import requests
import json

BASE_URL = "http://localhost:8000"

def submit_batch():
    data = {
        "submitted_by": "王护士长",
        "remark": "2024年5月第二周床位周转材料",
        "records": [
            {
                "department": "内科",
                "bed_number": "A-101",
                "patient_id": "P20240501001",
                "patient_name": "张三",
                "admission_date": "2024-05-01T08:00:00",
                "discharge_date": "2024-05-07T14:30:00",
                "diagnosis": "冠心病",
                "surgeon": "李医生"
            },
            {
                "department": "外科",
                "bed_number": "B-203",
                "patient_id": "P20240502002",
                "patient_name": "李四",
                "admission_date": "2024-05-02T09:15:00",
                "discharge_date": "2024-05-10T10:00:00",
                "diagnosis": "急性阑尾炎",
                "surgeon": "王医生"
            }
        ]
    }
    
    response = requests.post(f"{BASE_URL}/api/batches", json=data)
    result = response.json()
    print(f"批次提交结果: {result['message']}")
    print(f"批次ID: {result['batch_id']}")
    print(f"是否重复: {result['is_duplicate']}")
    return result['batch_id']

def get_batch_detail(batch_id):
    response = requests.get(f"{BASE_URL}/api/batches/{batch_id}")
    result = response.json()
    print(f"\n批次详情 - 记录数: {len(result['records'])}")
    return result['records'][0]['id']

def update_record(record_id):
    data = {
        "operator": "李主任",
        "reason": "诊断信息更正",
        "updates": {
            "diagnosis": "冠心病（不稳定型）"
        }
    }
    response = requests.put(f"{BASE_URL}/api/records/{record_id}", json=data)
    print(f"\n更新结果: {response.json()['message']}")

def get_audit_logs(record_id):
    response = requests.get(f"{BASE_URL}/api/audit/record/{record_id}")
    logs = response.json()
    print(f"\n审计日志数量: {len(logs)}")
    for log in logs:
        if log['field_name']:
            print(f"  - {log['operator']} 修改 {log['field_name']}: {log['old_value']} → {log['new_value']}")
            print(f"    原因: {log['reason']}")

def get_traceability(record_id):
    response = requests.get(f"{BASE_URL}/api/trace/{record_id}")
    result = response.json()
    print(f"\n关键字段追溯:")
    for field in result['traceability']:
        if field['change_count'] > 0:
            print(f"  - {field['field_name']}: {field['original_value']} → {field['current_value']}")

def download_report(batch_id):
    response = requests.get(f"{BASE_URL}/api/reports/{batch_id}/download")
    with open("床位周转报告.xlsx", "wb") as f:
        f.write(response.content)
    print(f"\n报告已下载: 床位周转报告.xlsx")

if __name__ == "__main__":
    print("=== 床位周转API服务测试 ===")
    batch_id = submit_batch()
    record_id = get_batch_detail(batch_id)
    update_record(record_id)
    get_audit_logs(record_id)
    get_traceability(record_id)
    download_report(batch_id)
    print("\n=== 测试完成 ===")
```

---

## API接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/batches` | 提交床位周转批次 |
| GET | `/api/batches` | 获取批次列表 |
| GET | `/api/batches/{batch_id}` | 获取批次详情 |
| PUT | `/api/records/{record_id}` | 修改床位周转记录 |
| GET | `/api/audit/batch/{batch_id}` | 获取批次审计日志 |
| GET | `/api/audit/record/{record_id}` | 获取单条记录审计日志 |
| GET | `/api/trace/{record_id}` | 关键字段追溯 |
| GET | `/api/reports/{batch_id}` | 生成统计报告（JSON） |
| GET | `/api/reports/{batch_id}/download` | 下载Excel报告 |

---

## 核心字段说明

| 字段 | 说明 | 可追溯 |
|------|------|--------|
| department | 科室名称 | ✅ |
| bed_number | 床号 | ✅ |
| patient_id | 患者ID | ✅ |
| patient_name | 患者姓名 | ✅ |
| admission_date | 入院日期 | ✅ |
| discharge_date | 出院日期 | ✅ |
| diagnosis | 诊断 | ✅ |
| surgeon | 主治医生 | ✅ |

---

## 数据库结构

- `batches`: 批次表（存储批次信息和原始数据）
- `bed_turnover_records`: 床位周转记录表
- `audit_logs`: 审计日志表（记录所有修改操作）

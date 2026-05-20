# 高校导师名额分配 API 服务

研究生院秘书可以通过此 API 提交学生材料，系统自动进行导师名额分配，并支持重复提交检测和修改记录追踪。

## 功能特性

- 批次材料提交与自动分配
- 重复提交识别（基于内容哈希）
- 分配结论修改及审计追踪
- 完整报告下载
- 关键字段可追溯（原始输入 → 最终报告）

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问: http://localhost:8000/docs 查看 Swagger 文档

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/batches | 提交批次材料 |
| GET | /api/batches | 查询所有批次 |
| GET | /api/batches/{batch_id}/results | 查询批次分配结果 |
| PUT | /api/results/{result_id} | 修改分配结论 |
| GET | /api/batches/{batch_id}/audit-logs | 查询修改记录 |
| GET | /api/batches/{batch_id}/report | 下载完整报告 |

## 数据追溯说明

从原始输入到最终报告的关键字段追溯：

```
原始材料
  ├── student_id (学号)
  ├── student_name (姓名)
  ├── department (学院)
  ├── major (专业)
  ├── gpa (成绩)
  ├── research_interest (研究方向)
  └── preferred_tutors (意向导师)
        ↓
分配结果
  ├── tutor_id (导师ID)
  ├── tutor_name (导师姓名)
  └── allocation_reason (分配理由)
        ↓
审计日志
  ├── modified_by (修改人)
  ├── modified_at (修改时间)
  ├── change_reason (修改原因)
  ├── field_name (修改字段)
  ├── old_value (修改前)
  └── new_value (修改后)
```

## curl 示例命令

### 1. 提交第一个批次材料

```bash
curl -X POST http://localhost:8000/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "batch_name": "2024年秋季研究生导师分配",
    "submitted_by": "张秘书",
    "description": "计算机学院第一批",
    "materials": [
      {
        "student_id": "S2024001",
        "student_name": "张三",
        "department": "计算机学院",
        "major": "计算机科学与技术",
        "gpa": 3.8,
        "research_interest": "人工智能",
        "preferred_tutors": "张教授"
      },
      {
        "student_id": "S2024002",
        "student_name": "李四",
        "department": "计算机学院",
        "major": "软件工程",
        "gpa": 3.6,
        "research_interest": "大数据",
        "preferred_tutors": "李教授"
      },
      {
        "student_id": "S2024003",
        "student_name": "王五",
        "department": "数学学院",
        "major": "应用数学",
        "gpa": 3.9,
        "research_interest": "数值计算",
        "preferred_tutors": "王教授"
      }
    ]
  }'
```

### 2. 重复提交相同材料（验证重复检测）

```bash
curl -X POST http://localhost:8000/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "batch_name": "重复提交测试",
    "submitted_by": "李秘书",
    "description": "测试重复提交",
    "materials": [
      {
        "student_id": "S2024001",
        "student_name": "张三",
        "department": "计算机学院",
        "major": "计算机科学与技术",
        "gpa": 3.8,
        "research_interest": "人工智能",
        "preferred_tutors": "张教授"
      },
      {
        "student_id": "S2024002",
        "student_name": "李四",
        "department": "计算机学院",
        "major": "软件工程",
        "gpa": 3.6,
        "research_interest": "大数据",
        "preferred_tutors": "李教授"
      },
      {
        "student_id": "S2024003",
        "student_name": "王五",
        "department": "数学学院",
        "major": "应用数学",
        "gpa": 3.9,
        "research_interest": "数值计算",
        "preferred_tutors": "王教授"
      }
    ]
  }'
```

### 3. 查询所有批次

```bash
curl http://localhost:8000/api/batches
```

### 4. 查询批次分配结果（请替换 {batch_id}）

```bash
curl http://localhost:8000/api/batches/1/results
```

### 5. 修改分配结论（请替换 {result_id}）

```bash
curl -X PUT http://localhost:8000/api/results/1 \
  -H "Content-Type: application/json" \
  -d '{
    "modified_by": "王主任",
    "change_reason": "学生研究方向更匹配陈教授的课题",
    "tutor_id": "CS003",
    "tutor_name": "陈教授",
    "allocation_reason": "根据学生人工智能研究方向，调整至陈教授课题组"
  }'
```

### 6. 查询修改记录

```bash
curl http://localhost:8000/api/batches/1/audit-logs
```

### 7. 下载完整报告

```bash
curl http://localhost:8000/api/batches/1/report
```

## Python 示例脚本

```python
import requests

BASE_URL = "http://localhost:8000"

# 1. 提交批次材料
batch_data = {
    "batch_name": "2024年秋季研究生导师分配",
    "submitted_by": "张秘书",
    "description": "计算机学院第一批",
    "materials": [
        {
            "student_id": "S2024001",
            "student_name": "张三",
            "department": "计算机学院",
            "major": "计算机科学与技术",
            "gpa": 3.8,
            "research_interest": "人工智能",
            "preferred_tutors": "张教授"
        },
        {
            "student_id": "S2024002",
            "student_name": "李四",
            "department": "计算机学院",
            "major": "软件工程",
            "gpa": 3.6,
            "research_interest": "大数据",
            "preferred_tutors": "李教授"
        }
    ]
}

response = requests.post(f"{BASE_URL}/api/batches", json=batch_data)
result = response.json()
print("提交结果:", result["message"])
print("批次ID:", result["batch_id"])
batch_id = result["batch_id"]

# 2. 查看分配结果
response = requests.get(f"{BASE_URL}/api/batches/{batch_id}/results")
results = response.json()
print("\n分配结果:")
for r in results["allocation_results"]:
    print(f"  {r['student_name']} -> {r['tutor_name']}")
    first_result_id = r["id"]

# 3. 修改分配结论
update_data = {
    "modified_by": "王主任",
    "change_reason": "学生更适合陈教授的研究方向",
    "tutor_id": "CS003",
    "tutor_name": "陈教授"
}
response = requests.put(f"{BASE_URL}/api/results/{first_result_id}", json=update_data)
print("\n修改结果:", response.json()["message"])

# 4. 查看审计日志
response = requests.get(f"{BASE_URL}/api/batches/{batch_id}/audit-logs")
logs = response.json()
print("\n修改记录:")
for log in logs["audit_logs"]:
    print(f"  {log['modified_by']} 在 {log['modified_at']}")
    print(f"    原因: {log['change_reason']}")
    print(f"    {log['field_name']}: {log['old_value']} -> {log['new_value']}")

# 5. 下载完整报告
response = requests.get(f"{BASE_URL}/api/batches/{batch_id}/report")
report = response.json()
print(f"\n报告生成时间: {report['report_generated_at']}")
print(f"学生总数: {report['total_students']}")
print(f"修改次数: {report['total_modifications']}")
```

## 项目结构

```
.
├── main.py          # API 主程序
├── models.py        # 数据模型
├── database.py      # 数据库配置
├── requirements.txt # 依赖列表
└── README.md        # 说明文档
```

## 核心实现原理

### 重复提交检测

使用 SHA-256 对材料内容计算哈希值：

1. 按 student_id 排序材料列表
2. 序列化并计算哈希
3. 查询数据库是否存在该哈希

即使批次名称不同，只要学生材料内容完全一致，系统会识别为重复提交。

### 修改审计追踪

每次修改分配结论时，系统会：

1. 记录修改人
2. 记录修改原因
3. 记录修改字段
4. 记录修改前后的值

所有记录永久保存，用于后续复盘审查。

# 楼宇维保对账服务

一个基于FastAPI的后端服务，用于整合设备台账、巡检照片、合同期限，实现自动比对、人工复核和对账报告生成。

## 功能特性

- ✅ **Excel数据导入**：支持设备台账、合同、照片清单批量导入
- 🔍 **自动比对分析**：
  - 维保过期检测
  - 同一设备多合同识别
  - 巡检照片缺失检查
  - 合同有效期监控
- 👨‍💼 **人工复核流程**：支持对异常记录进行复核修正
- 🔄 **重新计算**：复核后数据同步更新汇总统计
- 📊 **报告生成**：导出Excel对账报告，包含汇总、明细、问题清单、复核记录

## 技术栈

- **框架**: FastAPI 0.104
- **数据库**: SQLite (SQLAlchemy ORM)
- **Excel处理**: pandas + openpyxl + xlsxwriter
- **服务**: Uvicorn

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

服务将在 http://localhost:8000 启动

### 3. 访问API文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 4. 运行演示脚本

新开一个终端窗口：

```bash
python demo.py
```

演示脚本将自动完成：
1. 生成样例Excel文件
2. 导入设备、合同、照片数据
3. 创建对账任务并执行计算
4. 展示异常记录并演示人工复核
5. 生成并下载对账报告

## API接口说明

### 数据导入
- `POST /import/devices` - 导入设备台账Excel
- `POST /import/contracts` - 导入合同Excel
- `POST /import/photos` - 导入照片清单Excel

### 对账任务
- `POST /tasks/create` - 创建对账任务
- `POST /tasks/{id}/run` - 执行对账计算
- `POST /tasks/{id}/recalculate` - 重新计算
- `GET /tasks/{id}/summary` - 获取对账汇总
- `GET /tasks/{id}/records` - 获取对账明细

### 复核流程
- `POST /records/{id}/review` - 复核对账记录

### 报告下载
- `GET /tasks/{id}/report/excel` - 下载Excel报告
- `GET /tasks/{id}/report/text` - 获取文本摘要

### 统计查询
- `GET /stats/devices` - 设备统计
- `GET /stats/contracts` - 合同统计

## 项目结构

```
.
├── main.py              # FastAPI主应用
├── database.py          # 数据库模型和连接
├── excel_importer.py    # Excel导入功能
├── reconciliation.py    # 对账逻辑引擎
├── report_generator.py  # 报告生成模块
├── demo.py              # 演示脚本
├── requirements.txt     # 依赖列表
└── README.md           # 项目文档
```

## 数据库模型

- **Device**: 设备信息（编号、类型、楼层、区域、维保日期等）
- **Contract**: 合同信息（合同号、设备关联、供应商、有效期等）
- **PhotoRecord**: 照片记录（设备关联、上传日期、上传人等）
- **ReconciliationTask**: 对账任务
- **ReconciliationRecord**: 对账明细记录
- **ReconciliationSummary**: 对账汇总统计

## 异常检测规则

| 异常类型 | 检测条件 |
|---------|---------|
| 维保过期 | 下次维保日期 < 今天 |
| 多合同 | 同一设备关联多份有效合同 |
| 照片缺失 | 设备无对应的巡检照片记录 |
| 合同过期 | 合同截止日期 < 今天 |
| 无维保记录 | 上次维保日期为空 |

## 报告内容

Excel报告包含4个工作表：
1. **汇总**：整体对账统计
2. **明细**：所有设备对账详情（按楼层排序）
3. **问题清单**：仅异常设备记录
4. **复核记录**：已人工复核的记录

## 使用示例

### 1. 生成样例数据
```python
import requests
response = requests.get("http://localhost:8001/sample/generate")
```

### 2. 导入数据
```python
with open('sample_devices.xlsx', 'rb') as f:
    requests.post("http://localhost:8001/import/devices", files={'file': f})
```

### 3. 创建并执行对账
```python
# 创建任务
task = requests.post("http://localhost:8001/tasks/create?task_name=月度对账").json()

# 执行对账
result = requests.post(f"http://localhost:8001/tasks/{task['task_id']}/run").json()

# 查看汇总
print(result['summary'])
```

### 4. 复核异常记录
```python
review_data = {
    "review_notes": "已核实维保完成",
    "corrections": {"overall_status": "normal"}
}
requests.post("http://localhost:8001/records/1/review", json=review_data)
```

### 5. 下载报告
```python
response = requests.get(f"http://localhost:8001/tasks/{task_id}/report/excel")
with open('report.xlsx', 'wb') as f:
    f.write(response.content)
```

## 注意事项

1. 复核后的记录在重新计算时不会被覆盖
2. Excel导入支持增量更新，相同设备/合同编号会自动更新
3. 对账记录自动按楼层和区域排序，便于现场核查

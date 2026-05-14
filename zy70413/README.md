# 批量回调验签服务

基于 FastAPI + SQLAlchemy 构建的后端服务，用于处理离线会员续费流水的批量验签。

## 核心功能

1. **批次处理**：支持正常/异常/部分成功批次处理
2. **时间顺序检测**：自动检测同一会员交易时间顺序错误并标记
3. **幂等性处理**：同一批次重复提交复用旧结论
4. **冲突检测**：同一批次号不同内容提交时标记冲突
5. **明细保留**：每条记录单独标记状态，不整批标记成功/失败
6. **规则版本管理**：支持多版本验签规则，旧批次保留当时的判断口径
7. **人工备注**：实验室样本单的人工备注入库，支持按调用方查询
8. **异常导出**：异常记录导出Excel供同事复核

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

服务将在 `http://localhost:8000` 启动

### 3. 访问API文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 4. 运行演示

```bash
python demo_client.py
```

## API 接口

### 批次管理

- `POST /api/batch/submit` - 提交批次进行验签
- `GET /api/batch/{batch_no}` - 查询批次信息
- `GET /api/batch/{batch_no}/details` - 查询批次明细

### 人工备注

- `POST /api/notes` - 添加人工备注
- `GET /api/notes/caller/{caller}` - 按调用方查询备注

### 导出功能

- `POST /api/export` - 导出批次数据
- `GET /api/export/{task_no}/download` - 下载导出文件

### 规则管理

- `POST /api/rules` - 创建验签规则
- `GET /api/rules` - 查询所有规则

### 健康检查

- `GET /api/health` - 服务健康检查

## 项目结构

```
.
├── main.py              # FastAPI 主应用
├── models.py            # 数据库模型
├── schemas.py           # Pydantic 数据模型
├── services.py          # 业务逻辑服务
├── export_service.py    # 导出服务
├── database.py          # 数据库配置
├── demo_data.py         # 演示数据生成
├── demo_client.py       # API 演示客户端
├── requirements.txt     # 依赖列表
└── README.md           # 项目说明
```

## 数据库模型

- **VerificationRule** - 验签规则版本
- **Batch** - 批次信息
- **BatchDetail** - 批次明细记录
- **ManualNote** - 人工备注
- **ExportTask** - 导出任务

## 验签规则

### v1.0（基础规则）
- 检查时间顺序
- 检查金额为正数

### v2.0（宽松规则）
- 仅检查金额为正数
- 不检查时间顺序

## 使用示例

### 提交批次

```python
import requests

data = {
    "batch_no": "BATCH_001",
    "caller": "member_service",
    "transactions": [
        {
            "sequence_no": 1,
            "member_id": "M001",
            "transaction_no": "TXN001",
            "transaction_time": "2024-01-01T10:00:00",
            "amount": 99.0,
            "transaction_type": "renewal"
        }
    ],
    "rule_version": "v1.0"
}

response = requests.post("http://localhost:8000/api/batch/submit", json=data)
```

### 添加人工备注

```python
note_data = {
    "batch_no": "BATCH_001",
    "detail_id": 1,
    "caller": "member_service",
    "note_content": "实验室样本单复核确认，数据无误",
    "created_by": "qa_team",
    "note_type": "review_note"
}

response = requests.post("http://localhost:8000/api/notes", json=note_data)
```

### 导出异常记录

```python
export_request = {
    "batch_no": "BATCH_001",
    "include_failed_only": True,
    "created_by": "qa_team"
}

response = requests.post("http://localhost:8000/api/export", json=export_request)
```
